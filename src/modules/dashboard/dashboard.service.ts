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
import { AdminAlert } from '../alerts/entities/admin-alert.entity';
import { ActivityLog } from '../activity-log/entities/activity-log.entity';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { AlertStatus } from '../../common/enums/alert.enum';

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
    @InjectRepository(AdminAlert)
    private readonly adminAlertRepository: Repository<AdminAlert>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    private readonly dataSource: DataSource,
  ) {}

  async getAdminDashboard() {
    const [
      kpiStats,
      financialKpis,
      priorityTasks,
      conversionFunnel,
      revenueTrend,
      activeAlerts,
      recentActivity,
    ] = await Promise.all([
      this.getKpiStats(),
      this.getFinancialKpis(),
      this.getPriorityTasks(),
      this.getConversionFunnel(),
      this.getRevenueTrend(),
      this.getActiveAlerts(),
      this.getRecentActivity(),
    ]);

    return {
      kpiStats,
      financialKpis,
      priorityTasks,
      conversionFunnel,
      revenueTrend,
      activeAlerts,
      recentActivity,
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

  // ─── KPI Stats ──────────────────────────────────────────

  private async getKpiStats() {
    const result = await this.dataSource.query(`
      WITH date_ranges AS (
        SELECT
          date_trunc('month', NOW()) AS current_month_start,
          date_trunc('month', NOW()) - INTERVAL '1 month' AS prev_month_start,
          date_trunc('month', NOW()) AS prev_month_end
      ),
      switch_stats AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE sc.created_at >= dr.current_month_start)::int AS current_month,
          COUNT(*) FILTER (WHERE sc.created_at >= dr.prev_month_start AND sc.created_at < dr.prev_month_end)::int AS prev_month
        FROM switch_cases sc, date_ranges dr
        WHERE sc.deleted_at IS NULL
      ),
      customer_stats AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE u.created_at >= dr.current_month_start)::int AS new_current,
          COUNT(*) FILTER (WHERE u.created_at >= dr.prev_month_start AND u.created_at < dr.prev_month_end)::int AS new_prev
        FROM users u, date_ranges dr
        WHERE u.status = 'active'
          AND u.role IN ('personal', 'business')
          AND u.deleted_at IS NULL
      ),
      conversion_all AS (
        SELECT
          COUNT(*) FILTER (WHERE sc.status != 'cancelled')::int AS total_eligible,
          COUNT(*) FILTER (WHERE sc.status = 'activated')::int AS total_activated,
          COUNT(*) FILTER (WHERE sc.status != 'cancelled' AND sc.created_at >= dr.current_month_start)::int AS curr_eligible,
          COUNT(*) FILTER (WHERE sc.status = 'activated' AND sc.created_at >= dr.current_month_start)::int AS curr_activated,
          COUNT(*) FILTER (WHERE sc.status != 'cancelled' AND sc.created_at >= dr.prev_month_start AND sc.created_at < dr.prev_month_end)::int AS prev_eligible,
          COUNT(*) FILTER (WHERE sc.status = 'activated' AND sc.created_at >= dr.prev_month_start AND sc.created_at < dr.prev_month_end)::int AS prev_activated
        FROM switch_cases sc, date_ranges dr
        WHERE sc.deleted_at IS NULL
      ),
      processing_time AS (
        SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400)::numeric, 1) AS avg_days,
          ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400) FILTER (WHERE ce.created_at >= dr.current_month_start)::numeric, 1) AS curr_avg,
          ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400) FILTER (WHERE ce.created_at >= dr.prev_month_start AND ce.created_at < dr.prev_month_end)::numeric, 1) AS prev_avg
        FROM case_events ce
        JOIN switch_cases sc ON ce.case_id = sc.id
        CROSS JOIN date_ranges dr
        WHERE ce.event_type = 'status_change'
          AND ce.new_status = 'activated'
          AND sc.deleted_at IS NULL
      )
      SELECT
        ss.total AS switches_total,
        ss.current_month AS switches_current,
        ss.prev_month AS switches_prev,
        cs.total AS customers_total,
        cs.new_current AS customers_new_current,
        cs.new_prev AS customers_new_prev,
        ca.total_eligible,
        ca.total_activated,
        ca.curr_eligible,
        ca.curr_activated,
        ca.prev_eligible,
        ca.prev_activated,
        pt.avg_days AS processing_avg,
        pt.curr_avg AS processing_curr,
        pt.prev_avg AS processing_prev
      FROM switch_stats ss, customer_stats cs, conversion_all ca, processing_time pt
    `);

    const row = result[0] || {};

    const switchesTotal = row.switches_total || 0;
    const switchesCurr = row.switches_current || 0;
    const switchesPrev = row.switches_prev || 0;

    const customersTotal = row.customers_total || 0;
    const customersNewCurr = row.customers_new_current || 0;
    const customersNewPrev = row.customers_new_prev || 0;

    const totalEligible = row.total_eligible || 0;
    const totalActivated = row.total_activated || 0;
    const currEligible = row.curr_eligible || 0;
    const currActivated = row.curr_activated || 0;
    const prevEligible = row.prev_eligible || 0;
    const prevActivated = row.prev_activated || 0;

    const conversionRate = totalEligible > 0
      ? parseFloat(((totalActivated / totalEligible) * 100).toFixed(1))
      : 0;
    const currConvRate = currEligible > 0 ? (currActivated / currEligible) * 100 : 0;
    const prevConvRate = prevEligible > 0 ? (prevActivated / prevEligible) * 100 : 0;

    const processingAvg = parseFloat(row.processing_avg) || 0;
    const processingCurr = parseFloat(row.processing_curr) || 0;
    const processingPrev = parseFloat(row.processing_prev) || 0;

    return {
      totalSwitches: {
        value: switchesTotal,
        delta: this.calcDelta(switchesCurr, switchesPrev),
      },
      activeCustomers: {
        value: customersTotal,
        delta: this.calcDelta(customersNewCurr, customersNewPrev),
      },
      conversionRate: {
        value: conversionRate,
        delta: parseFloat((currConvRate - prevConvRate).toFixed(1)),
      },
      avgProcessingTime: {
        value: processingAvg,
        delta: parseFloat((processingCurr - processingPrev).toFixed(1)),
      },
    };
  }

  // ─── Financial KPIs ─────────────────────────────────────

  private async getFinancialKpis() {
    const [commissionsByType, pendingRevenue, churnRate] = await Promise.all([
      this.dataSource.query(`
        SELECT
          commission_type,
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*)::int AS count
        FROM commissions
        GROUP BY commission_type
      `),
      this.commissionRepository
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.amount), 0)', 'total')
        .addSelect('COUNT(*)::int', 'count')
        .where('c.status = :status', { status: 'pending' })
        .getRawOne(),
      this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('expired', 'cancelled'))::int AS churned,
          COUNT(*) FILTER (WHERE status IN ('active', 'expired', 'cancelled'))::int AS base
        FROM contracts
        WHERE deleted_at IS NULL
      `),
    ]);

    const activation = commissionsByType.find((r: any) => r.commission_type === 'activation');
    const renewal = commissionsByType.find((r: any) => r.commission_type === 'renewal');
    const churnRow = churnRate[0] || {};

    return {
      acquisitionCommission: {
        total: parseFloat(activation?.total || '0'),
        count: activation?.count || 0,
      },
      recurringCommission: {
        total: parseFloat(renewal?.total || '0'),
        count: renewal?.count || 0,
      },
      pendingRevenue: {
        total: parseFloat(pendingRevenue?.total || '0'),
        count: pendingRevenue?.count || 0,
      },
      churnRate: churnRow.base > 0
        ? parseFloat(((churnRow.churned / churnRow.base) * 100).toFixed(1))
        : 0,
    };
  }

  // ─── Priority Tasks ─────────────────────────────────────

  private async getPriorityTasks() {
    const [missingDocuments, expiringContracts, pendingValidation, followUpRequired] =
      await Promise.all([
        this.caseRepository.count({
          where: { status: CaseStatus.DOCUMENTS_PENDING },
        }),
        this.contractRepository
          .createQueryBuilder('c')
          .where('c.status = :status', { status: ContractStatus.ACTIVE })
          .andWhere('c.expiryDate IS NOT NULL')
          .andWhere('c.expiryDate <= NOW() + INTERVAL \'30 days\'')
          .andWhere('c.deletedAt IS NULL')
          .getCount(),
        this.caseRepository.count({
          where: { status: CaseStatus.CONTRACT_SIGNED },
        }),
        this.caseRepository
          .createQueryBuilder('c')
          .where('c.status IN (:...statuses)', {
            statuses: [CaseStatus.NEW, CaseStatus.IN_PROGRESS],
          })
          .andWhere('c.updatedAt < NOW() - INTERVAL \'7 days\'')
          .andWhere('c.deletedAt IS NULL')
          .getCount(),
      ]);

    return {
      missingDocuments,
      expiringContracts,
      pendingValidation,
      followUpRequired,
    };
  }

  // ─── Conversion Funnel ──────────────────────────────────

  private async getConversionFunnel() {
    const result = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled')::int AS request_received,
        COUNT(*) FILTER (WHERE status NOT IN ('new', 'cancelled'))::int AS documentation,
        COUNT(*) FILTER (WHERE status NOT IN ('new', 'in_progress', 'documents_pending', 'cancelled'))::int AS validation,
        COUNT(*) FILTER (WHERE status = 'activated')::int AS activation,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM switch_cases
      WHERE deleted_at IS NULL
    `);

    const row = result[0] || {};
    const requestReceived = row.request_received || 0;
    const activation = row.activation || 0;

    return {
      requestReceived,
      documentation: row.documentation || 0,
      validation: row.validation || 0,
      activation,
      rejected: row.rejected || 0,
      conversionRate: requestReceived > 0
        ? parseFloat(((activation / requestReceived) * 100).toFixed(1))
        : 0,
    };
  }

  // ─── Revenue Trend ──────────────────────────────────────

  private async getRevenueTrend() {
    const result = await this.dataSource.query(`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS potential,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS validated,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS collected
      FROM commissions
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `);

    return result.map((row: any) => ({
      month: row.month,
      potential: parseFloat(row.potential),
      validated: parseFloat(row.validated),
      collected: parseFloat(row.collected),
    }));
  }

  // ─── Active Alerts ──────────────────────────────────────

  private async getActiveAlerts() {
    return this.adminAlertRepository
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AlertStatus.ACTIVE })
      .orderBy(
        `CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('a.createdAt', 'DESC')
      .take(10)
      .getMany();
  }

  // ─── Recent Activity ────────────────────────────────────

  private async getRecentActivity() {
    return this.activityLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['user'],
    });
  }

  // ─── User Dashboard Helpers ─────────────────────────────

  private async getUserPotentialSavings(userId: string) {
    const result = await this.analysisRepository
      .createQueryBuilder('a')
      .innerJoin('a.bill', 'bill')
      .select('COALESCE(SUM(a.potentialSavings), 0)', 'totalSavings')
      .addSelect('COUNT(*)::int', 'analyzedBills')
      .where('bill.userId = :userId', { userId })
      .andWhere('bill.status = :status', { status: 'analyzed' })
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

  // ─── Utility ────────────────────────────────────────────

  private calcDelta(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
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
