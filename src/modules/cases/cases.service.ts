import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwitchCase } from './entities/switch-case.entity';
import { CaseDocument } from './entities/case-document.entity';
import { CaseEvent } from './entities/case-event.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { Offer } from '../offers/entities/offer.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CaseStatus } from '../../common/enums/case.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentType } from '../../common/enums/user.enum';
import { BillStatus, BillType } from '../../common/enums/bill.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { SupplierStatus } from '../../common/enums/supplier.enum';
import { OfferPaymentMethod } from '../../common/enums/offer.enum';
import { PaymentMethod } from '../../common/enums/payment.enum';

/**
 * Province is free text — it is stored exactly as the user typed it, with only
 * surrounding whitespace removed and blanks collapsed to null.
 */
function normalizeProvince(value?: string): string | null {
  const province = value?.trim();
  return province ? province : null;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(CaseDocument)
    private readonly documentRepository: Repository<CaseDocument>,
    @InjectRepository(CaseEvent)
    private readonly eventRepository: Repository<CaseEvent>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createCase(
    userId: string,
    dto: CreateCaseDto,
  ): Promise<SwitchCase> {
    const bill = await this.billRepository.findOne({
      where: { id: dto.billId },
    });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const offer = await this.offerRepository.findOne({
      where: { id: dto.selectedOfferId },
      relations: ['supplier'],
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.supplier?.status === SupplierStatus.PENDING_DELETION) {
      throw new BadRequestException(
        'Cannot create a case for an offer from a supplier that is pending deletion',
      );
    }
    this.assertPaymentMethodAcceptedBy(offer, dto.paymentMethod);

    // The user may have corrected the delivery point on the request form — the
    // bill is the single source of truth for it, so write the correction back.
    this.applyDeliveryPointCorrection(bill, dto.podNumber);

    const caseNumber = await this.generateCaseNumber();

    const switchCase = this.caseRepository.create({
      userId,
      billId: dto.billId,
      selectedOfferId: dto.selectedOfferId,
      status: CaseStatus.NEW,
      caseNumber,
      fromSupplierId: await this.resolveFromSupplierId(bill),
      toSupplierId: offer.supplierId,
      supplyStreet: dto.supplyStreet || null,
      supplyStreetNumber: dto.supplyStreetNumber || null,
      supplyCity: dto.supplyCity || null,
      supplyPostalCode: dto.supplyPostalCode || null,
      supplyProvince: normalizeProvince(dto.supplyProvince),
      residentialSameAsSupply: dto.residentialSameAsSupply ?? false,
      residentialStreet: dto.residentialStreet || null,
      residentialStreetNumber: dto.residentialStreetNumber || null,
      residentialCity: dto.residentialCity || null,
      residentialPostalCode: dto.residentialPostalCode || null,
      residentialProvince: normalizeProvince(dto.residentialProvince),
      shippingSameAsSupply: dto.shippingSameAsSupply ?? false,
      shippingStreet: dto.shippingStreet || null,
      shippingStreetNumber: dto.shippingStreetNumber || null,
      shippingCity: dto.shippingCity || null,
      shippingPostalCode: dto.shippingPostalCode || null,
      shippingProvince: normalizeProvince(dto.shippingProvince),
      paymentMethod: dto.paymentMethod || null,
      invoiceDelivery: dto.invoiceDelivery || null,
      invoiceEmail: dto.invoiceEmail || null,
      iban: dto.iban || null,
      ibanHolderFirstName: dto.ibanHolderFirstName || null,
      ibanHolderLastName: dto.ibanHolderLastName || null,
      ibanHolderTaxCode: dto.ibanHolderTaxCode || null,
    });

    const saved = await this.caseRepository.save(switchCase);

    bill.status = BillStatus.OFFER_ACCEPTED;
    await this.billRepository.save(bill);

    await this.logEvent(saved.id, CaseEventType.STATUS_CHANGE, 'Case created', {
      newStatus: CaseStatus.NEW,
      actorId: userId,
    });

    return this.getCaseById(saved.id, { id: userId, role: UserRole.ADMIN });
  }

  async getCases(
    query: QueryCasesDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<PaginatedResponseDto<SwitchCase>> {
    const qb = this.caseRepository.createQueryBuilder('sc')
      .leftJoinAndSelect('sc.user', 'user')
      .leftJoinAndSelect('sc.assignedAgent', 'agent')
      .leftJoinAndSelect('sc.selectedOffer', 'offer')
      .leftJoinAndSelect('sc.bill', 'bill');

    if (currentUser.role !== UserRole.ADMIN) {
      qb.andWhere('sc.userId = :userId', { userId: currentUser.id });
    }

    if (query.status) {
      qb.andWhere('sc.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('sc.priority = :priority', { priority: query.priority });
    }

    if (query.assignedAgentId) {
      qb.andWhere('sc.assignedAgentId = :assignedAgentId', {
        assignedAgentId: query.assignedAgentId,
      });
    }

    if (query.userId) {
      qb.andWhere('sc.userId = :filterUserId', {
        filterUserId: query.userId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search OR sc.caseNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('sc.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getCaseById(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<SwitchCase> {
    const switchCase = await this.caseRepository.findOne({
      where: { id },
      relations: [
        'user',
        'assignedAgent',
        'selectedOffer',
        'selectedOffer.supplier',
        'fromSupplier',
        'toSupplier',
        'bill',
        'documents',
        'events',
      ],
    });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      switchCase.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return switchCase;
  }

  /**
   * The case behind one bill, as the app's sign-contract screen reads it.
   *
   * The saving is quoted from the offer the customer accepted rather than
   * stored on the case: it is a property of that offer, and copying it would
   * only let the two drift apart.
   */
  async getCaseByBillId(
    billId: string,
    userId: string,
  ): Promise<(SwitchCase & { estimatedSavings: number | null }) | null> {
    const switchCase = await this.caseRepository.findOne({
      where: { billId, userId },
      relations: [
        'selectedOffer',
        'selectedOffer.supplier',
        'documents',
        'events',
      ],
      order: { createdAt: 'DESC' },
    });

    if (!switchCase) return null;

    let estimatedSavings: number | null = null;
    if (switchCase.selectedOfferId) {
      const sentOffer = await this.sentOfferRepository.findOne({
        where: { billId: switchCase.billId, offerId: switchCase.selectedOfferId },
      });
      if (sentOffer?.estimatedSavings != null) {
        estimatedSavings = Number(sentOffer.estimatedSavings);
      }
    }

    return Object.assign(switchCase, { estimatedSavings });
  }

  async updateCase(
    id: string,
    dto: UpdateCaseDto,
    actorId?: string,
  ): Promise<SwitchCase> {
    const switchCase = await this.caseRepository.findOne({ where: { id } });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    const oldStatus = switchCase.status;

    const { activationDate, expiryDate, ...rest } = dto;
    Object.assign(switchCase, rest);

    // A utility the customer can see must carry the dates it is described by.
    // The same rule is enforced on the transition endpoint; this is the other
    // way into "In Attivazione", so it cannot be the loophole.
    const nextStatus = dto.status ?? switchCase.status;
    if (activationDate !== undefined) {
      switchCase.activationDate = activationDate ? new Date(activationDate) : null;
    }
    if (expiryDate !== undefined) {
      switchCase.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    if (
      nextStatus === CaseStatus.AWAITING_ACTIVATION &&
      (!switchCase.activationDate || !switchCase.expiryDate)
    ) {
      throw new BadRequestException(
        'Activation date and expiry date are required to put a case in activation',
      );
    }

    if (
      switchCase.activationDate &&
      switchCase.expiryDate &&
      new Date(switchCase.expiryDate) <= new Date(switchCase.activationDate)
    ) {
      throw new BadRequestException(
        'Expiry date must be after the activation date',
      );
    }

    const saved = await this.caseRepository.save(switchCase);

    // Log status change event and notify user
    if (dto.status && dto.status !== oldStatus) {
      await this.logEvent(id, CaseEventType.STATUS_CHANGE, `Status changed from ${oldStatus} to ${dto.status}`, {
        oldStatus,
        newStatus: dto.status,
        actorId,
      });

      try {
        await this.notificationsService.sendNotification({
          userId: switchCase.userId,
          messageKey: 'case_update',
          bodyParams: [switchCase.caseNumber],
          type: NotificationType.CASE_UPDATE,
          data: { caseId: id, billId: switchCase.billId, newStatus: dto.status },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to send case update notification: ${error?.message || error}`,
        );
      }

    }

    // Log agent assignment event
    if (dto.assignedAgentId) {
      await this.logEvent(id, CaseEventType.ADMIN_ASSIGNED, 'Agent assigned to case', {
        actorId,
        metadata: { assignedAgentId: dto.assignedAgentId },
      });
    }

    return saved;
  }

  async uploadDocument(
    caseId: string,
    uploadedById: string,
    documentType: DocumentType,
    fileUrl: string,
    fileName: string,
  ): Promise<CaseDocument> {
    const switchCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    const document = this.documentRepository.create({
      caseId,
      documentType,
      fileUrl,
      fileName,
      uploadedById,
    });

    const saved = await this.documentRepository.save(document);

    await this.logEvent(caseId, CaseEventType.DOCUMENT_UPLOADED, `Document uploaded: ${fileName}`, {
      actorId: uploadedById,
      metadata: { documentType, fileName },
    });

    return saved;
  }

  async getDocuments(caseId: string): Promise<CaseDocument[]> {
    const switchCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    return this.documentRepository.find({
      where: { caseId },
      relations: ['uploadedBy', 'verifiedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async verifyDocument(
    caseId: string,
    docId: string,
    verifiedById: string,
  ): Promise<CaseDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: docId, caseId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.verified = true;
    document.verifiedById = verifiedById;
    document.verifiedAt = new Date();

    const saved = await this.documentRepository.save(document);

    await this.logEvent(caseId, CaseEventType.DOCUMENT_VERIFIED, `Document verified: ${document.fileName}`, {
      actorId: verifiedById,
      metadata: { documentId: docId, documentType: document.documentType },
    });

    return saved;
  }

  /**
   * The supplier the customer is leaving. OCR only ever reads a *name* off the
   * bill, so a bill is rarely linked to a supplier record — match the name
   * against the catalogue here so the case carries a real supplier whenever one
   * exists. Returns null when nothing matches; consumers then fall back to the
   * bill's `supplierName`.
   */
  private async resolveFromSupplierId(bill: EnergyBill): Promise<string | null> {
    if (bill.supplierId) return bill.supplierId;

    const name = bill.supplierName?.trim();
    if (!name) return null;

    const match = await this.supplierRepository
      .createQueryBuilder('s')
      // Exact name first, then a contains match so "Enel Energia S.p.A." on the
      // bill still finds the "Enel Energia" record.
      .where('LOWER(s.name) = LOWER(:name)', { name })
      .orWhere(':name ILIKE CONCAT(\'%\', s.name, \'%\')', { name })
      .orderBy('LENGTH(s.name)', 'DESC')
      .getOne();

    if (match) {
      // Link the bill too, so every later read resolves without re-matching.
      bill.supplierId = match.id;
    }

    return match?.id ?? null;
  }

  /**
   * The request form lets the customer correct the POD/PDR read off the bill.
   * The bill owns that value, so the correction is written back to it — the
   * mutated entity is saved by the caller.
   */
  /**
   * The mobile form only shows the payment methods an offer accepts, but the
   * endpoint is public to any authenticated client — so enforce it here too.
   * Offers accepting both methods never reject.
   */
  private assertPaymentMethodAcceptedBy(
    offer: Offer,
    chosen?: PaymentMethod,
  ): void {
    if (!chosen) return;
    if (
      !offer.paymentMethod ||
      offer.paymentMethod === OfferPaymentMethod.BOTH
    ) {
      return;
    }

    const required =
      offer.paymentMethod === OfferPaymentMethod.DIRECT_DEBIT
        ? PaymentMethod.RID_BANCARIO
        : PaymentMethod.POSTAL_ORDER;

    if (chosen !== required) {
      throw new BadRequestException(
        `Offer "${offer.name}" only accepts ${offer.paymentMethod.replace('_', ' ')} as payment method`,
      );
    }
  }

  private applyDeliveryPointCorrection(
    bill: EnergyBill,
    deliveryPoint?: string,
  ): void {
    const value = deliveryPoint?.trim();
    if (!value) return;

    // Gas bills carry a PDR, electricity bills a POD. Fall back to whichever
    // the bill already has when the type is ambiguous.
    const isGas = bill.billType === BillType.GAS || (!bill.podNumber && !!bill.pdrNumber);
    if (isGas) {
      bill.pdrNumber = value;
    } else {
      bill.podNumber = value;
    }
  }

  private async generateCaseNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SW-${dateStr}-`;

    const lastCase = await this.caseRepository
      .createQueryBuilder('sc')
      .where('sc.caseNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sc.caseNumber', 'DESC')
      .getOne();

    let seq = 1;
    if (lastCase?.caseNumber) {
      const lastSeq = parseInt(lastCase.caseNumber.split('-').pop() || '0', 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  private async logEvent(
    caseId: string,
    eventType: CaseEventType,
    title: string,
    options?: {
      description?: string;
      oldStatus?: CaseStatus;
      newStatus?: CaseStatus;
      actorId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<CaseEvent> {
    return this.eventRepository.save(
      this.eventRepository.create({
        caseId,
        eventType,
        title,
        ...options,
      }),
    );
  }
}
