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
import { QueryPriorityTasksDto } from './dto/query-priority-tasks.dto';
import {
  CaseStatus,
  LIVE_UTILITY_CASE_STATUSES,
} from '../../common/enums/case.enum';
import { AlertStatus } from '../../common/enums/alert.enum';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  CONTRACT_EXPIRY_WINDOW_DAYS,
  FOLLOW_UP_AFTER_DAYS,
  PRIORITY_TASK_BILL_STATUSES,
  PRIORITY_TASK_CATEGORY_SQL,
  PRIORITY_TASK_DEFINITIONS,
  PRIORITY_TASK_RANK_SQL,
  PriorityTaskCategory,
  type PriorityTaskItem,
} from './priority-tasks.constant';
import {
  roundMoney,
  roundPercent,
  roundTo,
} from '../../common/utils/precision.util';

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
            ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400)::numeric, 2) AS avg_days,
            ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400) FILTER (WHERE ce.created_at >= dr.current_month_start)::numeric, 2) AS curr_avg,
            ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400) FILTER (WHERE ce.created_at >= dr.prev_month_start AND ce.created_at < dr.prev_month_end)::numeric, 2) AS prev_avg
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
              NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled')::numeric, 0), 2)
            FROM switch_cases
            WHERE created_at >= m.month_start AND created_at < m.month_start + INTERVAL '1 month'
              AND deleted_at IS NULL
          ), 0) AS conversion_rate,
          COALESCE((
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ce.created_at - sc.created_at)) / 86400)::numeric, 2)
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
      ? roundPercent((totalActivated / totalEligible) * 100)
      : 0;
    const currConvRate = currEligible > 0 ? (currActivated / currEligible) * 100 : 0;
    const prevConvRate = prevEligible > 0 ? (prevActivated / prevEligible) * 100 : 0;

    // An AVG over days is the one figure here that is neither money nor a rate,
    // and unrounded it reaches the dashboard as 4.333333333333333 days.
    const processingAvg = roundTo(row.processing_avg, 2);
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
        delta: roundPercent(currConvRate - prevConvRate),
        sparkline: sparklineRows.map((r: any) => parseFloat(r.conversion_rate) || 0),
      },
      avgProcessingTime: {
        value: processingAvg,
        delta: roundTo(processingCurr - processingPrev, 2),
        sparkline: sparklineRows.map((r: any) => parseFloat(r.processing_time) || 0),
      },
    };
  }

  // ─── Priority Tasks ─────────────────────────────────────

  /**
   * Every open task, one row each, as a CTE the two queries below share.
   *
   * Sharing it is the point: the counts on the card and the rows behind them
   * come out of the same definition, so a number the admin clicks always opens
   * exactly that many rows.
   *
   * $1 open bill statuses · $2 follow-up threshold in days · $3 expiry window
   * in days.
   */
  private static readonly OPEN_TASKS_CTE = `
    WITH open_tasks AS (
      SELECT
        b.id                                        AS id,
        ${PRIORITY_TASK_CATEGORY_SQL}               AS category,
        b.id                                        AS bill_id,
        NULL::uuid                                  AS case_id,
        b.user_id                                   AS user_id,
        b.status::text                              AS status,
        b.bill_type::text                           AS bill_type,
        COALESCE(b.pod_number, b.pdr_number)        AS pod_pdr,
        b.supplier_name                             AS supplier_name,
        b.total_amount                              AS amount,
        COALESCE(b.status_changed_at, b.created_at)::timestamptz AS waiting_since,
        NULL::date                                  AS due_date,
        COALESCE(b.status_changed_at, b.created_at)::timestamptz AS sort_key
      FROM energy_bills b
      WHERE b.deleted_at IS NULL
        AND b.status::text = ANY($1::text[])
        -- An unanswered offer is not yet work anybody owes; one the customer
        -- has been sitting on for a week is the call this card asks for.
        AND (
          b.status::text <> 'offer_sent'
          OR COALESCE(b.status_changed_at, b.created_at)
               <= NOW() - ($2::int * INTERVAL '1 day')
        )

      UNION ALL

      -- Renewals. Restricted to activated cases on purpose: those are the live
      -- supplies with a contract that can run out, and confining the bucket to
      -- a finished pipeline status is what keeps it from overlapping the
      -- contract lane above, so the category counts still sum to the total.
      SELECT
        sc.id                                       AS id,
        '${PriorityTaskCategory.EXPIRING_CONTRACTS}' AS category,
        sc.bill_id                                  AS bill_id,
        sc.id                                       AS case_id,
        sc.user_id                                  AS user_id,
        sc.status::text                             AS status,
        b.bill_type::text                           AS bill_type,
        COALESCE(b.pod_number, b.pdr_number)        AS pod_pdr,
        b.supplier_name                             AS supplier_name,
        b.total_amount                              AS amount,
        sc.created_at::timestamptz                  AS waiting_since,
        sc.expiry_date                              AS due_date,
        sc.expiry_date::timestamptz                 AS sort_key
      FROM switch_cases sc
      LEFT JOIN energy_bills b
        ON b.id = sc.bill_id AND b.deleted_at IS NULL
      WHERE sc.deleted_at IS NULL
        AND sc.status::text = '${CaseStatus.ACTIVATED}'
        AND sc.expiry_date IS NOT NULL
        -- Already-expired contracts stay in: an expiry nobody acted on is the
        -- most overdue renewal there is, and the sort puts it at the front.
        AND sc.expiry_date <= (NOW() + ($3::int * INTERVAL '1 day'))::date
    )`;

  /**
   * The joins and filters the list and its total both run over.
   *
   * $4 category (NULL for every bucket) · $5 ILIKE search pattern.
   */
  private static readonly TASK_LIST_SOURCE = `
    FROM open_tasks t
    LEFT JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL
    -- The newest case on the bill, when there is one. A task is addressed by
    -- its bill everywhere in the admin panel, but the case number is what the
    -- admins search by, so it is worth carrying.
    LEFT JOIN LATERAL (
      SELECT sc.id, sc.case_number
      FROM switch_cases sc
      WHERE sc.bill_id = t.bill_id AND sc.deleted_at IS NULL
      ORDER BY sc.created_at DESC
      LIMIT 1
    ) c ON TRUE
    WHERE ($4::text IS NULL OR t.category = $4::text)
      AND (
        $5::text IS NULL
        OR u.first_name ILIKE $5
        OR u.last_name ILIKE $5
        OR u.email ILIKE $5
        OR t.pod_pdr ILIKE $5
        OR t.supplier_name ILIKE $5
        OR c.case_number ILIKE $5
      )`;

  /**
   * Counts per bucket for the dashboard card.
   *
   * The buckets are read off the bill pipeline rather than off case statuses.
   * A case is only created once the customer accepts an offer, so the old
   * count of `documents_pending` cases reported zero missing documents however
   * many bills were sitting in `verification_required` — a state reached long
   * before any case exists. See `priority-tasks.constant.ts`.
   */
  private async getPriorityTasks() {
    const rows: Array<{ category: string; count: number }> =
      await this.dataSource.query(
        `${DashboardService.OPEN_TASKS_CTE}
        SELECT t.category, COUNT(*)::int AS count
        FROM open_tasks t
        GROUP BY t.category`,
        [
          [...PRIORITY_TASK_BILL_STATUSES],
          FOLLOW_UP_AFTER_DAYS,
          CONTRACT_EXPIRY_WINDOW_DAYS,
        ],
      );

    const countOf = new Map(rows.map((r) => [r.category, r.count]));

    const categories = PRIORITY_TASK_DEFINITIONS.map((def) => ({
      key: def.key,
      severity: def.severity,
      owner: def.owner,
      count: countOf.get(def.key) ?? 0,
    }));

    return {
      total: categories.reduce((sum, c) => sum + c.count, 0),
      categories,
      // The four flat keys the card was built on before the buckets became
      // data. Kept so a dashboard build that predates this change still renders
      // numbers rather than blanks.
      missingDocuments: countOf.get(PriorityTaskCategory.MISSING_DOCUMENTS) ?? 0,
      expiringContracts:
        countOf.get(PriorityTaskCategory.EXPIRING_CONTRACTS) ?? 0,
      pendingValidation:
        countOf.get(PriorityTaskCategory.PENDING_VALIDATION) ?? 0,
      followUpRequired:
        countOf.get(PriorityTaskCategory.FOLLOW_UP_REQUIRED) ?? 0,
    };
  }

  /**
   * The customers and cases behind one bucket — or behind every bucket at
   * once, which is what "View all tasks" opens.
   */
  async getPriorityTaskList(
    query: QueryPriorityTasksDto,
  ): Promise<PaginatedResponseDto<PriorityTaskItem>> {
    const filters = [
      [...PRIORITY_TASK_BILL_STATUSES],
      FOLLOW_UP_AFTER_DAYS,
      CONTRACT_EXPIRY_WINDOW_DAYS,
      query.category ?? null,
      query.search ? `%${query.search}%` : null,
    ];

    const [rows, totals] = await Promise.all([
      this.dataSource.query(
        `${DashboardService.OPEN_TASKS_CTE}
        SELECT
          t.id,
          t.category,
          t.bill_id,
          COALESCE(t.case_id, c.id) AS case_id,
          c.case_number,
          t.status,
          t.bill_type,
          t.pod_pdr,
          t.supplier_name,
          t.amount,
          t.waiting_since,
          -- Sent as plain YYYY-MM-DD. An expiry is a calendar day, and handing
          -- it over as a timestamp lets the driver stamp it with the server's
          -- midnight — a client an hour the other side of UTC then renders the
          -- day before as the expiry.
          to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
          -- Both figures are worked out by Postgres. The two columns behind
          -- \`waiting_since\` disagree about time zones — \`status_changed_at\`
          -- carries an offset, \`created_at\` does not — so a cutoff built from
          -- a JS Date would be right for one and off by the server's offset for
          -- the other.
          GREATEST(EXTRACT(DAY FROM (NOW() - t.waiting_since))::int, 0) AS days_waiting,
          (t.due_date - CURRENT_DATE)::int AS days_until_due,
          u.id AS customer_id,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.role::text AS customer_role
        ${DashboardService.TASK_LIST_SOURCE}
        ORDER BY ${PRIORITY_TASK_RANK_SQL} ASC, t.sort_key ASC NULLS LAST, t.id ASC
        LIMIT $6 OFFSET $7`,
        [...filters, query.limit, query.skip],
      ),
      this.dataSource.query(
        `${DashboardService.OPEN_TASKS_CTE}
        SELECT COUNT(*)::int AS total
        ${DashboardService.TASK_LIST_SOURCE}`,
        filters,
      ),
    ]);

    const data: PriorityTaskItem[] = rows.map((row: any) => ({
      id: row.id,
      category: row.category,
      billId: row.bill_id,
      caseId: row.case_id,
      caseNumber: row.case_number,
      status: row.status,
      billType: row.bill_type,
      podPdr: row.pod_pdr,
      supplierName: row.supplier_name,
      // A bill OCR could not read an amount off keeps a null here — rounding it
      // would report a €0.00 bill, which is a different claim.
      amount: row.amount == null ? null : roundMoney(row.amount),
      waitingSince: row.waiting_since,
      daysWaiting: row.days_waiting ?? 0,
      dueDate: row.due_date,
      daysUntilDue: row.days_until_due ?? null,
      customer: row.customer_id
        ? {
            id: row.customer_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            role: row.customer_role,
          }
        : null,
    }));

    return new PaginatedResponseDto(
      data,
      totals[0]?.total ?? 0,
      query.page,
      query.limit,
    );
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
        ? roundPercent((activation / requestReceived) * 100)
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
      totalSavings: roundMoney(row.totalSavings),
      activeUtilities: row.activeUtilities || 0,
    };
  }

  // ─── Utility ────────────────────────────────────────────

  private calcDelta(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return roundPercent(((current - previous) / previous) * 100);
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
