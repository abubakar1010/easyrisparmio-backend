import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwitchCase } from './entities/switch-case.entity';
import { CaseDocument } from './entities/case-document.entity';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CaseStatus } from '../../common/enums/case.enum';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentType } from '../../common/enums/user.enum';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(CaseDocument)
    private readonly documentRepository: Repository<CaseDocument>,
  ) {}

  async createCase(
    userId: string,
    dto: CreateCaseDto,
  ): Promise<SwitchCase> {
    const switchCase = this.caseRepository.create({
      userId,
      billId: dto.billId,
      selectedOfferId: dto.selectedOfferId,
      status: CaseStatus.NEW,
    });

    return this.caseRepository.save(switchCase);
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

    // Non-admin users can only see their own cases
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
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search)',
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

    // Non-admin users can only view their own cases
    if (
      currentUser.role !== UserRole.ADMIN &&
      switchCase.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return switchCase;
  }

  async updateCase(id: string, dto: UpdateCaseDto): Promise<SwitchCase> {
    const switchCase = await this.caseRepository.findOne({ where: { id } });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    Object.assign(switchCase, dto);

    return this.caseRepository.save(switchCase);
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

    return this.documentRepository.save(document);
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

    return this.documentRepository.save(document);
  }
}
