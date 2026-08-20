import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
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
import { CaseStatus, CLOSED_CASE_STATUSES } from '../../common/enums/case.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentType } from '../../common/enums/user.enum';
import { BillStatus, BillType } from '../../common/enums/bill.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { SupplierStatus } from '../../common/enums/supplier.enum';
import { OfferPaymentMethod } from '../../common/enums/offer.enum';
import { PaymentMethod } from '../../common/enums/payment.enum';
import {
  normalizePostalCode,
  normalizeProvince,
} from '../../common/utils/address.utils';
import {
  CaseAddressesDto,
  CASE_ADDRESS_BLOCKS,
  CASE_ADDRESS_BLOCK_LABELS,
  CASE_ADDRESS_FIELDS,
} from './dto/case-addresses.dto';
import {
  CaseContractDetailsDto,
  CASE_CONTRACT_DETAIL_FIELDS,
  CASE_CONTRACT_DETAIL_LABELS,
} from './dto/case-contract-details.dto';


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
    if (bill.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bill');
    }

    // One bill, one switch. Without this a second acceptance would leave the
    // customer with two live cases competing over the same supply point.
    const openCase = await this.caseRepository.findOne({
      where: { billId: dto.billId, status: Not(In([...CLOSED_CASE_STATUSES])) },
    });
    if (openCase) {
      throw new BadRequestException(
        'A switch request already exists for this bill',
      );
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
    this.assertPaymentMethodAcceptedBy(offer, dto.paymentMethod ?? undefined);

    // The offer has to be one that was actually proposed for this bill. A case
    // pinned to any other bill marks a bill nobody chose as accepted and leaves
    // the offers the customer did choose from sitting in their list.
    const sentOffer = await this.sentOfferRepository.findOne({
      where: { billId: dto.billId, offerId: dto.selectedOfferId },
    });
    if (!sentOffer) {
      throw new BadRequestException(
        'This offer was not proposed for the selected bill',
      );
    }

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
      residentialSameAsSupply: dto.residentialSameAsSupply ?? false,
      shippingSameAsSupply: dto.shippingSameAsSupply ?? false,
    });

    // The addresses and the payment details go through the same writers the
    // admin's edits use, so the app cannot create a case shaped differently
    // from one the CRM saved.
    this.applyAddressFields(switchCase, dto);
    this.applyContractDetailFields(switchCase, dto);

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

  /**
   * Corrects a case, field by field.
   *
   * Everything the case holds is editable here — the workflow fields only the
   * CRM writes (status, priority, type, assignment, notes, activation dates),
   * the three addresses, the payment and invoicing details, and the offer the
   * switch is filed against. Each group that moved is written to the case's own
   * timeline, with the exact before-and-after values in the event metadata, so
   * a correction is always attributable.
   */
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
    const oldOfferId = switchCase.selectedOfferId;

    const { activationDate, expiryDate, selectedOfferId, ...rest } = dto;

    // The offer decides which supplier the case is filed against, so it is
    // resolved before anything is written: a bad offer id must leave the case
    // untouched rather than half-corrected. A blank one is not a correction —
    // a case always points at the offer it is switching to.
    let newOffer: Offer | null = null;
    if (selectedOfferId && selectedOfferId !== oldOfferId) {
      newOffer = await this.offerRepository.findOne({
        where: { id: selectedOfferId },
        relations: ['supplier'],
      });
      if (!newOffer) {
        throw new NotFoundException('Offer not found');
      }
      if (newOffer.supplier?.status === SupplierStatus.PENDING_DELETION) {
        throw new BadRequestException(
          'Cannot move a case onto an offer from a supplier that is pending deletion',
        );
      }
    }

    // The addresses and the contract details are held back from the blind
    // assign: they need normalising, the same-as-supply blocks need squaring up
    // afterwards, and both are logged as corrections.
    const handledKeys = new Set<string>([
      ...CASE_ADDRESS_BLOCKS.flatMap((block) =>
        CASE_ADDRESS_FIELDS.map((field) => `${block}${field}`),
      ),
      'residentialSameAsSupply',
      'shippingSameAsSupply',
      ...CASE_CONTRACT_DETAIL_FIELDS,
    ]);
    // Status, type and priority are columns the case is never without, so a
    // null on any of them is a caller mistake rather than a request to clear it.
    const NEVER_NULL = new Set(['status', 'caseType', 'priority']);
    Object.assign(
      switchCase,
      Object.fromEntries(
        Object.entries(rest).filter(
          ([key, value]) =>
            !handledKeys.has(key) && !(value === null && NEVER_NULL.has(key)),
        ),
      ),
    );
    const addressChanges = this.applyAddressFields(switchCase, dto);
    const contractChanges = this.applyContractDetailFields(switchCase, dto);

    if (newOffer) {
      switchCase.selectedOfferId = newOffer.id;
      switchCase.toSupplierId = newOffer.supplierId;
    }

    // Whichever half of the pair moved, the two still have to agree: an offer
    // sold as direct-debit-only cannot be left on a case paying by postal order.
    if (newOffer || dto.paymentMethod !== undefined) {
      const offer =
        newOffer ??
        (await this.offerRepository.findOne({
          where: { id: switchCase.selectedOfferId },
        }));
      if (offer) {
        this.assertPaymentMethodAcceptedBy(
          offer,
          switchCase.paymentMethod ?? undefined,
        );
      }
    }

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

    // Addresses are what the switch is actually filed against, so a correction
    // belongs on the case's own timeline rather than only in the activity log.
    if (Object.keys(addressChanges).length > 0) {
      // The timeline names the blocks that moved; the exact old and new values
      // of every field are in the metadata for anyone who needs to audit them.
      const blocksTouched = CASE_ADDRESS_BLOCKS.filter((block) =>
        Object.keys(addressChanges).some((field) => field.startsWith(block)),
      ).map((block) => CASE_ADDRESS_BLOCK_LABELS[block]);

      await this.logEvent(id, CaseEventType.SYSTEM_EVENT, 'Addresses updated', {
        description: `${blocksTouched.join(', ')} corrected by an admin`,
        actorId,
        metadata: { changes: addressChanges },
      });
    }

    // The payment and invoicing details are what the supplier sets the contract
    // up from, so they are audited exactly the way the addresses are.
    if (Object.keys(contractChanges).length > 0) {
      const fieldsTouched = CASE_CONTRACT_DETAIL_FIELDS.filter(
        (field) => field in contractChanges,
      ).map((field) => CASE_CONTRACT_DETAIL_LABELS[field]);

      await this.logEvent(
        id,
        CaseEventType.SYSTEM_EVENT,
        'Payment and invoicing details updated',
        {
          description: `${fieldsTouched.join(', ')} corrected by an admin`,
          actorId,
          metadata: { changes: contractChanges },
        },
      );
    }

    if (newOffer) {
      const supplierName = newOffer.supplier?.name;
      await this.logEvent(
        id,
        CaseEventType.SYSTEM_EVENT,
        'Selected offer changed',
        {
          description: supplierName
            ? `Case moved onto "${newOffer.name}" (${supplierName}) by an admin`
            : `Case moved onto "${newOffer.name}" by an admin`,
          actorId,
          metadata: {
            changes: {
              selectedOfferId: { old: oldOfferId, new: newOffer.id },
            },
          },
        },
      );
    }

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

  /**
   * Writes whichever address fields the caller supplied onto the case, and
   * keeps the three blocks coherent afterwards.
   *
   * Two rules, both enforced here rather than trusted to the caller:
   *
   * - A CAP is five digits or nothing, and a province is trimmed free text.
   *   The app and the CRM both come through here, so neither can store a
   *   half-read CAP that looks filled in on the form and reaches the supplier
   *   unchecked.
   * - While `residentialSameAsSupply` or `shippingSameAsSupply` is true, that
   *   block is a copy of the supply address. Correcting the supply address
   *   therefore moves the residence and the shipping address with it, instead
   *   of leaving the case claiming a residence the customer never gave.
   *
   * Returns the fields that actually changed, for the case timeline.
   */
  private applyAddressFields(
    switchCase: SwitchCase,
    dto: Partial<CaseAddressesDto>,
  ): Record<string, { old: unknown; new: unknown }> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    const set = (field: string, value: unknown): void => {
      const previous = (switchCase as any)[field] ?? null;
      if (previous === value) return;
      changes[field] = { old: previous, new: value };
      (switchCase as any)[field] = value;
    };

    const normalize = (field: string, value?: string): string | null => {
      if (field === 'PostalCode') return normalizePostalCode(value);
      if (field === 'Province') return normalizeProvince(value);
      return value?.trim() || null;
    };

    for (const block of CASE_ADDRESS_BLOCKS) {
      if (block !== 'supply') {
        const flag = `${block}SameAsSupply`;
        if ((dto as any)[flag] !== undefined) set(flag, (dto as any)[flag]);
      }

      for (const field of CASE_ADDRESS_FIELDS) {
        const key = `${block}${field}`;
        if ((dto as any)[key] === undefined) continue;
        set(key, normalize(field, (dto as any)[key]));
      }
    }

    for (const block of ['residential', 'shipping'] as const) {
      if (!(switchCase as any)[`${block}SameAsSupply`]) continue;
      for (const field of CASE_ADDRESS_FIELDS) {
        set(`${block}${field}`, (switchCase as any)[`supply${field}`] ?? null);
      }
    }

    return changes;
  }

  /**
   * Writes the payment and invoicing details onto a case.
   *
   * The counterpart of {@link applyAddressFields}, and it exists for the same
   * reason: the app filing a request and the admin correcting it afterwards
   * both come through one writer, so a value stored by either is normalised the
   * same way. A field left out of the DTO is untouched; a field sent as `null`
   * or blank is cleared, which is how an admin blanks an IBAN that was entered
   * against the wrong account.
   *
   * The IBAN is stored without the spaces it is usually printed with and in
   * upper case, so two people typing the same account cannot produce two
   * different-looking values the supplier then has to reconcile.
   *
   * Returns the fields that actually changed, for the case timeline.
   */
  private applyContractDetailFields(
    switchCase: SwitchCase,
    dto: Partial<CaseContractDetailsDto>,
  ): Record<string, { old: unknown; new: unknown }> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const field of CASE_CONTRACT_DETAIL_FIELDS) {
      const incoming = (dto as any)[field];
      if (incoming === undefined) continue;

      const value =
        typeof incoming === 'string'
          ? (field === 'iban'
              ? incoming.replace(/\s+/g, '').toUpperCase()
              : incoming.trim()) || null
          : (incoming ?? null);

      const previous = (switchCase as any)[field] ?? null;
      if (previous === value) continue;

      changes[field] = { old: previous, new: value };
      (switchCase as any)[field] = value;
    }

    return changes;
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
