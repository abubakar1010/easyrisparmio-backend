import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { AdminSettings } from './entities/admin-settings.entity';
import { AdminAlert } from '../alerts/entities/admin-alert.entity';
import { ActivityLog } from '../activity-log/entities/activity-log.entity';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import {
  CaseStatus,
  LIVE_UTILITY_CASE_STATUSES,
} from '../../common/enums/case.enum';
import { AlertStatus } from '../../common/enums/alert.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
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
      priorityTasks,
      conversionFunnel,
      activeAlerts,
      recentActivity,
    ] = await Promise.all([
      this.getKpiStats(),
      this.getPriorityTasks(),
      this.getConversionFunnel(),
      this.getActiveAlerts(),
      this.getRecentActivity(),
    ]);

    return {
      kpiStats,
      priorityTasks,
      conversionFunnel,
      activeAlerts,
      recentActivity,
    };
  }

  async getUserDashboard(userId: string) {
    const [totalCases, recentCases, potentialSavings] = await Promise.all([
      this.caseRepository.count({ where: { userId } }),
      this.caseRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['selectedOffer'],
      }),
      this.getUserPotentialSavings(userId),
    ]);

    return {
      totalCases,
      // Single source of truth: the utility count and the savings figure are
      // read off the same set of live cases, so the two summary cards on the
      // app home screen can never contradict each other. The key keeps its
      // historical name — the app and the admin dashboard both read it.
      activeContracts: potentialSavings.activeUtilities,
      potentialSavings,
      recentCases,
    };
  }

  // ─── KPI Stats ──────────────────────────────────────────

  private async getKpiStats() {
    const [result, sparklineRows] = await Promise.all([
      this.dataSource.query(`
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
      `),
      this.dataSource.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', NOW()) - INTERVAL '6 months',
            date_trunc('month', NOW()),
            '1 month'
          ) AS month_start
        )
        SELECT
          m.month_start,
          (SELECT COUNT(*)::int FROM switch_cases
           WHERE created_at >= m.month_start AND created_at < m.month_start + INTERVAL '1 month'
             AND deleted_at IS NULL) AS switches,
          (SELECT COUNT(*)::int FROM users
           WHERE created_at >= m.month_start AND created_at < m.month_start + INTERVAL '1 month'
             AND status = 'active' AND role IN ('personal', 'business')
             AND deleted_at IS NULL) AS customers,
          COALESCE((
            SELECT ROUND(
              COUNT(*) FILTER (WHERE status = 'activated')::numeric * 100.0 /
              NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled')::numeric, 0), 1)
            FROM switch_cases
            WHERE created_at >= m.month_start AND created_at < m.month_start + INTERVAL '1 month'
              AND deleted_at IS NULL
          ), 0) AS conversion_rate,
          COALESCE((
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400)::numeric, 1)
            FROM case_events ce
            JOIN switch_cases sc ON ce.case_id = sc.id
            WHERE ce.event_type = 'status_change' AND ce.new_status = 'activated'
              AND ce.created_at >= m.month_start AND ce.created_at < m.month_start + INTERVAL '1 month'
              AND sc.deleted_at IS NULL
          ), 0) AS processing_time
        FROM months m
        ORDER BY m.month_start
      `),
    ]);

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
        sparkline: sparklineRows.map((r: any) => parseInt(r.switches) || 0),
      },
      activeCustomers: {
        value: customersTotal,
        delta: this.calcDelta(customersNewCurr, customersNewPrev),
        sparkline: sparklineRows.map((r: any) => parseInt(r.customers) || 0),
      },
      conversionRate: {
        value: conversionRate,
        delta: parseFloat((currConvRate - prevConvRate).toFixed(1)),
        sparkline: sparklineRows.map((r: any) => parseFloat(r.conversion_rate) || 0),
      },
      avgProcessingTime: {
        value: processingAvg,
        delta: parseFloat((processingCurr - processingPrev).toFixed(1)),
        sparkline: sparklineRows.map((r: any) => parseFloat(r.processing_time) || 0),
      },
    };
  }

  // ─── Priority Tasks ─────────────────────────────────────

  private async getPriorityTasks() {
    const [missingDocuments, expiringContracts, pendingValidation, followUpRequired] =
      await Promise.all([
        this.caseRepository.count({
          where: { status: CaseStatus.DOCUMENTS_PENDING },
        }),
        this.caseRepository
          .createQueryBuilder('c')
          .where('c.status IN (:...statuses)', {
            statuses: [...LIVE_UTILITY_CASE_STATUSES],
          })
          .andWhere('c.expiryDate IS NOT NULL')
          .andWhere('c.expiryDate <= NOW() + INTERVAL \'30 days\'')
          .andWhere('c.deletedAt IS NULL')
          .getCount(),
        // Out for signature: the customer is signing with the supplier and the
        // case is waiting on us to confirm activation.
        this.caseRepository.count({
          where: { status: CaseStatus.CONTRACT_SENT },
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
        COUNT(*) FILTER (WHERE status NOT IN ('new', 'cancelled', 'rejected'))::int AS documentation,
        COUNT(*) FILTER (WHERE status NOT IN ('new', 'in_progress', 'documents_pending', 'cancelled', 'rejected'))::int AS validation,
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

  /**
   * Savings and utility count behind the two home summary cards.
   *
   * Both figures count a utility from "In Attivazione" onward, exactly like the
   * utilities list: reading `LIVE_UTILITY_CASE_STATUSES` off the case keeps the
   * count, the savings and the list on precisely the same utilities. The saving
   * itself comes from the offer the customer accepted.
   */
  private async getUserPotentialSavings(userId: string) {
    const result = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(COALESCE(so.estimated_savings, 0)), 0) AS "totalSavings",
        COUNT(DISTINCT sc.id)::int AS "activeUtilities"
      FROM switch_cases sc
      LEFT JOIN sent_offers so
        ON so.bill_id = sc.bill_id
       AND so.offer_id = sc.selected_offer_id
      WHERE sc.user_id = $1
        AND sc.status::text = ANY($2::text[])
        AND sc.deleted_at IS NULL`,
      [userId, [...LIVE_UTILITY_CASE_STATUSES]],
    );

    const row = result[0] || {};
    return {
      totalSavings: parseFloat(row.totalSavings) || 0,
      activeUtilities: row.activeUtilities || 0,
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
      settings = this.adminSettingsRepository.create({});
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
