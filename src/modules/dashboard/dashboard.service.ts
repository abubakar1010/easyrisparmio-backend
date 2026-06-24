import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { BillAnalysis } from '../bills/entities/bill-analysis.entity';
import { AdminSettings } from './entities/admin-settings.entity';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CommissionStatus } from '../../common/enums/commission.enum';
import { BillStatus } from '../../common/enums/bill.enum';
import { CaseStatus } from '../../common/enums/case.enum';

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
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(BillAnalysis)
    private readonly analysisRepository: Repository<BillAnalysis>,
    @InjectRepository(AdminSettings)
    private readonly adminSettingsRepository: Repository<AdminSettings>,
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
      billStats,
    ] = await Promise.all([
      this.userRepository.count(),
      this.getCasesByStatus(),
      this.contractRepository.count({
        where: { status: ContractStatus.ACTIVE },
      }),
      this.getCommissionStats(),
      this.getMonthlyTrends(),
      this.getRecentCases(),
      this.getBillStats(),
    ]);

    return {
      totalUsers,
      casesByStatus,
      activeContracts,
      commissions: commissionStats,
      monthlyTrends,
      recentCases,
      billStats,
    };
  }

  async getUserDashboard(userId: string) {
    const [totalCases, activeContracts, recentCases, potentialSavings, activeRequests] =
      await Promise.all([
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
        this.getUserPotentialSavings(userId),
        this.getUserActiveRequests(userId),
      ]);

    return {
      totalCases,
      activeContracts,
      potentialSavings,
      activeRequests,
      recentCases,
    };
  }

  private async getUserPotentialSavings(userId: string) {
    const result = await this.analysisRepository
      .createQueryBuilder('a')
      .innerJoin('a.bill', 'bill')
      .select('COALESCE(SUM(a.potentialSavings), 0)', 'totalSavings')
      .addSelect('COUNT(*)::int', 'analyzedBills')
      .where('bill.userId = :userId', { userId })
      .andWhere('bill.status = :status', { status: BillStatus.ANALYZED })
      .getRawOne();

    return {
      totalSavings: parseFloat(result.totalSavings),
      analyzedBills: result.analyzedBills,
    };
  }

  private async getUserActiveRequests(userId: string) {
    const activeStatuses = [
      CaseStatus.NEW,
      CaseStatus.IN_PROGRESS,
      CaseStatus.DOCUMENTS_PENDING,
      CaseStatus.CONTRACT_SENT,
    ];

    const cases = await this.caseRepository.find({
      where: activeStatuses.map((status) => ({ userId, status })),
      order: { createdAt: 'DESC' },
      relations: ['selectedOffer', 'fromSupplier', 'toSupplier'],
    });

    return {
      count: cases.length,
      requests: cases,
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

  private async getBillStats() {
    const [billsByStatus, pendingReview, recentBills] = await Promise.all([
      this.billRepository
        .createQueryBuilder('b')
        .select('b.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('b.status')
        .getRawMany(),
      this.analysisRepository.count({
        where: { offersSentToUser: false },
      }),
      this.billRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user', 'analysis'],
      }),
    ]);

    const statusMap: Record<string, number> = {};
    let totalBills = 0;
    for (const row of billsByStatus) {
      statusMap[row.status] = row.count;
      totalBills += row.count;
    }

    return {
      totalBills,
      billsByStatus: {
        uploaded: statusMap[BillStatus.UPLOADED] || 0,
        analyzing: statusMap[BillStatus.ANALYZING] || 0,
        analyzed: statusMap[BillStatus.ANALYZED] || 0,
        error: statusMap[BillStatus.ERROR] || 0,
      },
      pendingReview,
      recentBills,
    };
  }

  // ─── Admin Settings ──────────────────────────────────────

  async getAdminSettings(): Promise<AdminSettings> {
    let settings = await this.adminSettingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.adminSettingsRepository.create({
        autoSendOffers: false,
        maxRecommendedOffers: 3,
      });
      await this.adminSettingsRepository.save(settings);
    }
    return settings;
  }

  async updateAdminSettings(
    dto: UpdateAdminSettingsDto,
    adminId: string,
  ): Promise<AdminSettings> {
    const settings = await this.getAdminSettings();
    Object.assign(settings, dto, { updatedBy: adminId });
    return this.adminSettingsRepository.save(settings);
  }
}
