import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commission } from './entities/commission.entity';
import { CommissionRule } from './entities/commission-rule.entity';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { QueryCommissionsDto } from './dto/query-commissions.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  CommissionStatus,
  CommissionType,
} from '../../common/enums/commission.enum';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(CommissionRule)
    private readonly ruleRepository: Repository<CommissionRule>,
  ) {}

  // --- Commission Rules CRUD ---

  async createRule(dto: CreateCommissionRuleDto): Promise<CommissionRule> {
    const rule = this.ruleRepository.create({
      supplierId: dto.supplierId,
      energyType: dto.energyType,
      commissionAmount: dto.commissionAmount,
      commissionPercentage: dto.commissionPercentage,
      isActive: dto.isActive ?? true,
      validFrom: dto.validFrom,
      validUntil: dto.validUntil,
    });

    return this.ruleRepository.save(rule);
  }

  async getRules(): Promise<CommissionRule[]> {
    return this.ruleRepository.find({
      relations: ['supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateRule(
    id: string,
    dto: Partial<CreateCommissionRuleDto>,
  ): Promise<CommissionRule> {
    const rule = await this.ruleRepository.findOne({ where: { id } });

    if (!rule) {
      throw new NotFoundException('Commission rule not found');
    }

    Object.assign(rule, dto);

    return this.ruleRepository.save(rule);
  }

  // --- Auto-create commission when case is activated ---

  async createCommissionForActivation(
    agentId: string,
    caseId: string,
    offerId: string,
    supplierId: string,
    energyType: string,
  ): Promise<Commission> {
    // Find applicable rule
    const rule = await this.ruleRepository
      .createQueryBuilder('r')
      .where('r.supplier_id = :supplierId', { supplierId })
      .andWhere('r.energy_type = :energyType', { energyType })
      .andWhere('r.is_active = true')
      .andWhere('r.valid_from <= CURRENT_DATE')
      .andWhere('(r.valid_until IS NULL OR r.valid_until >= CURRENT_DATE)')
      .getOne();

    const amount = rule ? rule.commissionAmount : 0;

    const commission = this.commissionRepository.create({
      agentId,
      caseId,
      offerId,
      supplierId,
      amount,
      currency: 'EUR',
      status: CommissionStatus.PENDING,
      commissionType: CommissionType.ACTIVATION,
    });

    return this.commissionRepository.save(commission);
  }

  // --- Get commissions (paginated, filtered) ---

  async getCommissions(
    query: QueryCommissionsDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<PaginatedResponseDto<Commission>> {
    const qb = this.commissionRepository.createQueryBuilder('c')
      .leftJoinAndSelect('c.agent', 'agent')
      .leftJoinAndSelect('c.case', 'switchCase')
      .leftJoinAndSelect('c.offer', 'offer')
      .leftJoinAndSelect('c.supplier', 'supplier');

    if (query.agentId) {
      qb.andWhere('c.agent_id = :filterAgentId', {
        filterAgentId: query.agentId,
      });
    }

    if (query.supplierId) {
      qb.andWhere('c.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('c.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('c.created_at <= :dateTo', { dateTo: query.dateTo });
    }

    qb.orderBy('c.created_at', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  // --- Commission stats ---

  async getCommissionStats(
    currentUser: { id: string; role: UserRole },
  ): Promise<{
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    grandTotal: number;
    count: number;
  }> {
    const qb = this.commissionRepository.createQueryBuilder('c');

    qb.select([
      `COALESCE(SUM(CASE WHEN c.status = '${CommissionStatus.PENDING}' THEN c.amount ELSE 0 END), 0) AS "totalPending"`,
      `COALESCE(SUM(CASE WHEN c.status = '${CommissionStatus.APPROVED}' THEN c.amount ELSE 0 END), 0) AS "totalApproved"`,
      `COALESCE(SUM(CASE WHEN c.status = '${CommissionStatus.PAID}' THEN c.amount ELSE 0 END), 0) AS "totalPaid"`,
      `COALESCE(SUM(c.amount), 0) AS "grandTotal"`,
      `COUNT(c.id) AS "count"`,
    ]);

    const result = await qb.getRawOne();

    return {
      totalPending: parseFloat(result.totalPending),
      totalApproved: parseFloat(result.totalApproved),
      totalPaid: parseFloat(result.totalPaid),
      grandTotal: parseFloat(result.grandTotal),
      count: parseInt(result.count, 10),
    };
  }

  // --- Approve commission ---

  async approveCommission(id: string): Promise<Commission> {
    const commission = await this.commissionRepository.findOne({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.status !== CommissionStatus.PENDING) {
      throw new BadRequestException(
        'Only pending commissions can be approved',
      );
    }

    commission.status = CommissionStatus.APPROVED;

    return this.commissionRepository.save(commission);
  }

  // --- Mark commission as paid ---

  async markAsPaid(id: string): Promise<Commission> {
    const commission = await this.commissionRepository.findOne({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.status !== CommissionStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved commissions can be marked as paid',
      );
    }

    commission.status = CommissionStatus.PAID;
    commission.paidAt = new Date();

    return this.commissionRepository.save(commission);
  }
}
