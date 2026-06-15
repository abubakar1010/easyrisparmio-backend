import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwitchCase } from './entities/switch-case.entity';
import { CaseDocument } from './entities/case-document.entity';
import { CaseEvent } from './entities/case-event.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { Offer } from '../offers/entities/offer.entity';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CaseStatus } from '../../common/enums/case.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentType } from '../../common/enums/user.enum';

@Injectable()
export class CasesService {
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
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const caseNumber = await this.generateCaseNumber();

    const switchCase = this.caseRepository.create({
      userId,
      billId: dto.billId,
      selectedOfferId: dto.selectedOfferId,
      status: CaseStatus.NEW,
      caseNumber,
      fromSupplierId: bill.supplierId || null,
      toSupplierId: offer.supplierId,
    });

    const saved = await this.caseRepository.save(switchCase);

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
      qb.andWhere('sc.user_id = :userId', { userId: currentUser.id });
    }

    if (query.status) {
      qb.andWhere('sc.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('sc.priority = :priority', { priority: query.priority });
    }

    if (query.assignedAgentId) {
      qb.andWhere('sc.assigned_agent_id = :assignedAgentId', {
        assignedAgentId: query.assignedAgentId,
      });
    }

    if (query.userId) {
      qb.andWhere('sc.user_id = :filterUserId', {
        filterUserId: query.userId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search OR sc.case_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('sc.created_at', 'DESC');
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
        'bill',
        'documents',
        'contract',
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

    Object.assign(switchCase, dto);
    const saved = await this.caseRepository.save(switchCase);

    // Log status change event
    if (dto.status && dto.status !== oldStatus) {
      await this.logEvent(id, CaseEventType.STATUS_CHANGE, `Status changed from ${oldStatus} to ${dto.status}`, {
        oldStatus,
        newStatus: dto.status,
        actorId,
      });
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

  private async generateCaseNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SW-${dateStr}-`;

    const lastCase = await this.caseRepository
      .createQueryBuilder('sc')
      .where('sc.case_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('sc.case_number', 'DESC')
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
