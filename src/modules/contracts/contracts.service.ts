import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractDocument } from './entities/contract-document.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { AddContractDocumentsDto } from './dto/add-contract-documents.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import {
  ContractStatus,
  ContractDocumentType,
  ContractDeliveryMethod,
} from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { BillStatus } from '../../common/enums/bill.enum';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractDocument)
    private readonly contractDocumentRepository: Repository<ContractDocument>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(CaseEvent)
    private readonly eventRepository: Repository<CaseEvent>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * A contract delivered through the app is only useful if a file travels with
   * it — that is the copy the customer opens, downloads and signs. Contracts
   * predating per-document storage carry the file in the legacy `documentUrl`,
   * so either source counts.
   */
  private async hasContractFile(contract: Contract): Promise<boolean> {
    if (contract.documentUrl) return true;
    const count = await this.contractDocumentRepository.count({
      where: {
        contractId: contract.id,
        documentType: ContractDocumentType.CONTRACT,
      },
    });
    return count > 0;
  }

  async createContract(
    dto: CreateContractDto,
    createdById: string,
  ): Promise<Contract> {
    const switchCase = await this.caseRepository.findOne({
      where: { id: dto.caseId },
    });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    // Check if contract already exists for this case
    const existing = await this.contractRepository.findOne({
      where: { caseId: dto.caseId },
    });

    if (existing) {
      throw new ConflictException('A contract already exists for this case');
    }

    // Delivering through the app means the customer downloads the contract from
    // there — refuse to announce one with nothing to open.
    const documents = dto.documents ?? [];
    if (
      dto.deliveryMethod === ContractDeliveryMethod.APP &&
      documents.length === 0 &&
      !dto.documentUrl
    ) {
      throw new BadRequestException(
        'A contract delivered through the app must include at least one contract document',
      );
    }

    // If deliveryMethod is provided, set status to SENT directly
    const initialStatus = dto.deliveryMethod
      ? ContractStatus.SENT
      : ContractStatus.DRAFT;

    // Resolve estimated savings from the sent offer
    let estimatedSavings: number | null = null;
    const sentOffer = await this.sentOfferRepository.findOne({
      where: { billId: switchCase.billId, offerId: switchCase.selectedOfferId },
    });
    if (sentOffer?.estimatedSavings) {
      estimatedSavings = Number(sentOffer.estimatedSavings);
    }

    const contract = this.contractRepository.create({
      caseId: dto.caseId,
      offerId: switchCase.selectedOfferId,
      userId: switchCase.userId,
      contractNumber: dto.contractNumber,
      podPdrNumber: dto.podPdrNumber,
      status: initialStatus,
      deliveryMethod: dto.deliveryMethod || null,
      documentUrl: dto.documentUrl || documents[0]?.fileUrl || null,
      estimatedSavings,
    });

    const saved = await this.contractRepository.save(contract);

    // Store the documents before anything else so the contract is never
    // announced to the customer with nothing attached to it.
    if (documents.length > 0) {
      await this.contractDocumentRepository.save(
        documents.map((doc) =>
          this.contractDocumentRepository.create({
            contractId: saved.id,
            documentType: ContractDocumentType.CONTRACT,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            originalName: doc.originalName || null,
            mimeType: doc.mimeType || null,
            fileSizeBytes: doc.fileSizeBytes || null,
            uploadedById: createdById,
          }),
        ),
      );
    }

    // Update case status to CONTRACT_SENT
    switchCase.status = CaseStatus.CONTRACT_SENT;
    await this.caseRepository.save(switchCase);

    // Log case event
    await this.eventRepository.save(
      this.eventRepository.create({
        caseId: switchCase.id,
        eventType: CaseEventType.CONTRACT_GENERATED,
        title: 'Contratto creato',
        description: dto.deliveryMethod
          ? `Contratto ${dto.contractNumber} creato e inviato via ${dto.deliveryMethod}`
          : `Contratto ${dto.contractNumber} creato in bozza`,
        oldStatus: null,
        newStatus: CaseStatus.CONTRACT_SENT,
      }),
    );

    // Send notification to user if contract is being sent
    if (dto.deliveryMethod) {
      const msgKey = dto.deliveryMethod === 'app' ? 'contract_sent_app' : 'contract_sent_other';

      try {
        await this.notificationsService.sendNotification({
          userId: switchCase.userId,
          messageKey: msgKey,
          bodyParams: dto.deliveryMethod !== 'app' ? [dto.deliveryMethod] : [],
          type: NotificationType.CONTRACT_STATUS,
          data: {
            caseId: switchCase.id,
            billId: switchCase.billId,
            contractId: saved.id,
            deliveryMethod: dto.deliveryMethod,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to send contract notification: ${error?.message || error}`,
        );
      }
    }

    // Set bill status directly
    const bill = await this.billRepository.findOne({ where: { id: switchCase.billId } });
    if (bill) {
      bill.status = BillStatus.CONTRACT_SENT;
      await this.billRepository.save(bill);
    }

    // Return with the documents so the caller sees the contract exactly as the
    // customer will, without a second round-trip.
    return this.getContractById(saved.id);
  }

  async getContracts(
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Contract>> {
    const qb = this.contractRepository.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.offer', 'offer')
      .leftJoinAndSelect('c.switchCase', 'switchCase')
      .leftJoinAndSelect('c.documents', 'documents');

    if (query.search) {
      qb.andWhere(
        '(c.contractNumber ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('c.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getContractById(id: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['user', 'offer', 'switchCase', 'documents'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async updateContract(
    id: string,
    dto: UpdateContractDto,
  ): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const oldStatus = contract.status;

    // Sending through the app without a file would leave the customer with a
    // notification and nothing to open — same rule as creation.
    const nextDeliveryMethod = dto.deliveryMethod ?? contract.deliveryMethod;
    if (
      dto.status === ContractStatus.SENT &&
      oldStatus !== ContractStatus.SENT &&
      nextDeliveryMethod === ContractDeliveryMethod.APP &&
      !dto.documentUrl &&
      !(await this.hasContractFile(contract))
    ) {
      throw new BadRequestException(
        'Attach at least one contract document before sending this contract through the app',
      );
    }

    // If status is being set to SIGNED, record the signing timestamp
    if (dto.status === ContractStatus.SIGNED && !contract.signedAt) {
      contract.signedAt = new Date();
    }

    Object.assign(contract, dto);

    const saved = await this.contractRepository.save(contract);

    // Sync case status based on contract status and send notifications
    if (dto.status && dto.status !== oldStatus) {
      const switchCase = await this.caseRepository.findOne({
        where: { id: contract.caseId },
      });

      if (switchCase) {
        let newCaseStatus: CaseStatus | null = null;
        let eventTitle = '';
        let eventDescription = '';
        let eventType: CaseEventType = CaseEventType.STATUS_CHANGE;
        let messageKey = '';
        let messageBodyParams: any[] = [];

        let notificationType: NotificationType = NotificationType.CONTRACT_STATUS;

        if (dto.status === ContractStatus.SENT) {
          newCaseStatus = CaseStatus.CONTRACT_SENT;
          eventTitle = 'Contratto Inviato';
          eventDescription = contract.deliveryMethod === 'app'
            ? 'Contratto caricato nella app.'
            : `Contratto inviato via ${contract.deliveryMethod || 'email'}.`;
          messageKey = contract.deliveryMethod === 'app' ? 'contract_sent_app' : 'contract_sent_other';
          messageBodyParams = contract.deliveryMethod !== 'app' ? [contract.deliveryMethod || 'email'] : [];
        } else if (dto.status === ContractStatus.SIGNED) {
          newCaseStatus = CaseStatus.CONTRACT_SIGNED;
          eventTitle = 'Contratto Firmato';
          eventDescription = 'Contratto firmato, in fase di attivazione.';
          eventType = CaseEventType.CONTRACT_SIGNED;
          messageKey = 'contract_signed';
        } else if (dto.status === ContractStatus.ACTIVE) {
          newCaseStatus = CaseStatus.ACTIVATED;
          eventTitle = 'Utenza Attivata';
          eventDescription = 'Utenza attivata.';
          notificationType = NotificationType.ACTIVATION_COMPLETE;
          messageKey = 'utility_activated';
        }

        if (newCaseStatus) {
          const oldCaseStatus = switchCase.status;
          switchCase.status = newCaseStatus;
          await this.caseRepository.save(switchCase);

          // Log case event (admin-facing, Italian)
          await this.eventRepository.save(
            this.eventRepository.create({
              caseId: switchCase.id,
              eventType,
              title: eventTitle,
              description: eventDescription,
              oldStatus: oldCaseStatus,
              newStatus: newCaseStatus,
            }),
          );

          // Send notification to user (i18n)
          if (messageKey) {
            try {
              await this.notificationsService.sendNotification({
                userId: switchCase.userId,
                messageKey,
                bodyParams: messageBodyParams,
                type: notificationType,
                data: {
                  caseId: switchCase.id,
                  billId: switchCase.billId,
                  contractId: saved.id,
                  newStatus: dto.status,
                },
              });
            } catch (error) {
              this.logger.warn(
                `Failed to send contract status notification: ${error?.message || error}`,
              );
            }
          }

          // Set bill status directly based on contract status
          const bill = await this.billRepository.findOne({ where: { id: switchCase.billId } });
          if (bill) {
            if (dto.status === ContractStatus.SENT) {
              bill.status = BillStatus.CONTRACT_SENT;
            } else if (dto.status === ContractStatus.SIGNED) {
              bill.status = BillStatus.CONTRACT_REVIEW;
            } else if (dto.status === ContractStatus.ACTIVE) {
              bill.status = BillStatus.ACTIVATED;
            }
            await this.billRepository.save(bill);
          }
        }
      }
    }

    return saved;
  }

  async getContractByCase(caseId: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { caseId },
      relations: ['user', 'offer', 'switchCase', 'documents'],
    });

    if (!contract) {
      throw new NotFoundException('No contract found for this case');
    }

    return contract;
  }

  // ─── User-facing methods ─────────────────────────────────

  async getUserContracts(userId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: { userId },
      relations: ['offer', 'offer.supplier', 'documents'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserContractById(id: string, userId: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['offer', 'offer.supplier', 'documents'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return contract;
  }

  async uploadSignedContract(
    id: string,
    userId: string,
    dto: AddContractDocumentsDto,
  ): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (contract.status !== ContractStatus.SENT) {
      throw new BadRequestException(
        'Contract must be in SENT status to upload signed document',
      );
    }

    // Save signed documents
    const docs = dto.documents.map((doc) =>
      this.contractDocumentRepository.create({
        contractId: contract.id,
        documentType: ContractDocumentType.SIGNED,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        originalName: doc.originalName || null,
        mimeType: doc.mimeType || null,
        fileSizeBytes: doc.fileSizeBytes || null,
        uploadedById: userId,
      }),
    );
    await this.contractDocumentRepository.save(docs);

    // Keep legacy field pointing to the first document
    contract.signedDocumentUrl = dto.documents[0].fileUrl;
    contract.status = ContractStatus.SIGNED;
    contract.signedAt = new Date();

    const saved = await this.contractRepository.save(contract);

    // Sync case status
    const switchCase = await this.caseRepository.findOne({
      where: { id: contract.caseId },
    });

    if (switchCase) {
      const oldCaseStatus = switchCase.status;
      switchCase.status = CaseStatus.CONTRACT_SIGNED;
      await this.caseRepository.save(switchCase);

      // Log case event
      await this.eventRepository.save(
        this.eventRepository.create({
          caseId: switchCase.id,
          eventType: CaseEventType.CONTRACT_SIGNED,
          title: 'Contratto firmato dal cliente',
          description: `Il cliente ha caricato ${docs.length} documento/i firmato/i.`,
          oldStatus: oldCaseStatus,
          newStatus: CaseStatus.CONTRACT_SIGNED,
          actorId: userId,
        }),
      );

      // Set bill status directly: signed → contract_review
      const bill = await this.billRepository.findOne({ where: { id: switchCase.billId } });
      if (bill) {
        bill.status = BillStatus.CONTRACT_REVIEW;
        await this.billRepository.save(bill);
      }
    }

    return saved;
  }

  // ─── Contract Document methods ──────────────────────────

  async addContractDocuments(
    contractId: string,
    uploadedById: string,
    dto: AddContractDocumentsDto,
    documentType: ContractDocumentType,
  ): Promise<ContractDocument[]> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const docs = dto.documents.map((doc) =>
      this.contractDocumentRepository.create({
        contractId,
        documentType,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        originalName: doc.originalName || null,
        mimeType: doc.mimeType || null,
        fileSizeBytes: doc.fileSizeBytes || null,
        uploadedById,
      }),
    );

    const saved = await this.contractDocumentRepository.save(docs);

    // Keep legacy field in sync with the first document
    if (documentType === ContractDocumentType.CONTRACT && !contract.documentUrl) {
      contract.documentUrl = dto.documents[0].fileUrl;
      await this.contractRepository.save(contract);
    } else if (
      documentType === ContractDocumentType.SIGNED &&
      !contract.signedDocumentUrl
    ) {
      contract.signedDocumentUrl = dto.documents[0].fileUrl;
      await this.contractRepository.save(contract);
    }

    return saved;
  }

  async getContractDocuments(contractId: string): Promise<ContractDocument[]> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return this.contractDocumentRepository.find({
      where: { contractId },
      order: { createdAt: 'ASC' },
    });
  }

  async getUserContractDocuments(
    contractId: string,
    userId: string,
  ): Promise<ContractDocument[]> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.contractDocumentRepository.find({
      where: { contractId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteContractDocument(
    contractId: string,
    documentId: string,
  ): Promise<void> {
    const doc = await this.contractDocumentRepository.findOne({
      where: { id: documentId, contractId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const removedUrl = doc.fileUrl;
    const documentType = doc.documentType;

    await this.contractDocumentRepository.remove(doc);

    // The legacy URL is what the app falls back to when no documents are
    // stored — leaving it pointing at a deleted file would show the customer a
    // dead link, so re-point it at whatever is left.
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) return;

    const isContractDoc = documentType === ContractDocumentType.CONTRACT;
    const currentUrl = isContractDoc
      ? contract.documentUrl
      : contract.signedDocumentUrl;

    if (currentUrl !== removedUrl) return;

    const remaining = await this.contractDocumentRepository.findOne({
      where: { contractId, documentType },
      order: { createdAt: 'ASC' },
    });

    if (isContractDoc) {
      contract.documentUrl = remaining?.fileUrl ?? null;
    } else {
      contract.signedDocumentUrl = remaining?.fileUrl ?? null;
    }
    await this.contractRepository.save(contract);
  }
}
