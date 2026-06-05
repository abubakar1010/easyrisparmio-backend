import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CommissionStatus } from '../../common/enums/commission.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    private readonly dataSource: DataSource,
  ) {}

  async getAdminDashboard() {
    const [
      totalUsers,
      casesByStatus,
      activeContracts,
      commissionStats,
      monthlyTrends,
      recentCases,
    ] = await Promise.all([
      this.userRepository.count(),
      this.getCasesByStatus(),
      this.contractRepository.count({
        where: { status: ContractStatus.ACTIVE },
      }),
      this.getCommissionStats(),
      this.getMonthlyTrends(),
      this.getRecentCases(),
    ]);

    return {
      totalUsers,
      casesByStatus,
      activeContracts,
      commissions: commissionStats,
      monthlyTrends,
      recentCases,
    };
  }

  async getAgentDashboard(agentId: string) {
    const [assignedCases, agentCommissions, recentCases] = await Promise.all([
      this.getCasesByStatusForAgent(agentId),
      this.getAgentCommissions(agentId),
      this.getRecentCasesForAgent(agentId),
    ]);

    return {
      assignedCases,
      commissions: agentCommissions,
      recentCases,
    };
  }

  async getUserDashboard(userId: string) {
    const [totalCases, activeContracts, recentCases] = await Promise.all([
      this.caseRepository.count({ where: { userId } }),
      this.contractRepository.count({
        where: { userId, status: ContractStatus.ACTIVE },
      }),
      this.caseRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['selectedOffer'],
      }),
    ]);

    return {
      totalCases,
      activeContracts,
      recentCases,
    };
  }

  private async getCasesByStatus() {
    const result = await this.caseRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('c.status')
      .getRawMany();

    return result;
  }

  private async getCasesByStatusForAgent(agentId: string) {
    const result = await this.caseRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('c.assigned_agent_id = :agentId', { agentId })
      .groupBy('c.status')
      .getRawMany();

    return result;
  }

  private async getCommissionStats() {
    const result = await this.commissionRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(c.amount), 0)', 'total')
      .groupBy('c.status')
      .getRawMany();

    const pending = result.find((r) => r.status === CommissionStatus.PENDING);
    const paid = result.find((r) => r.status === CommissionStatus.PAID);

    return {
      pendingCount: pending?.count || 0,
      pendingTotal: parseFloat(pending?.total || '0'),
      paidCount: paid?.count || 0,
      paidTotal: parseFloat(paid?.total || '0'),
    };
  }

  private async getAgentCommissions(agentId: string) {
    const result = await this.commissionRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(c.amount), 0)', 'total')
      .where('c.agent_id = :agentId', { agentId })
      .groupBy('c.status')
      .getRawMany();

    const pending = result.find((r) => r.status === CommissionStatus.PENDING);
    const paid = result.find((r) => r.status === CommissionStatus.PAID);

    return {
      pendingCount: pending?.count || 0,
      pendingTotal: parseFloat(pending?.total || '0'),
      paidCount: paid?.count || 0,
      paidTotal: parseFloat(paid?.total || '0'),
    };
  }

  private async getMonthlyTrends() {
    const result = await this.dataSource.query(`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS cases_count
      FROM switch_cases
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `);

    return result;
  }

  private async getRecentCases() {
    return this.caseRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['user', 'assignedAgent'],
    });
  }

  private async getRecentCasesForAgent(agentId: string) {
    return this.caseRepository.find({
      where: { assignedAgentId: agentId },
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['user'],
    });
  }
}
