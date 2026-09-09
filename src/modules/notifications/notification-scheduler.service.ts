import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillStatus } from '../../common/enums/bill.enum';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import {
  BillVerification,
  VerificationStatus,
} from '../bills/entities/bill-verification.entity';
import { NotificationEventsService } from './notification-events.service';

/** How long the customer gets before the single re-upload reminder. */
const DOCUMENT_REMINDER_HOURS = 48;

/** How long an application may sit on the operator's desk before we say so. */
const STALL_DAYS = 3;

/**
 * The statuses where the next move is ours.
 *
 * Deliberately excludes the two states waiting on the customer
 * (`VERIFICATION_REQUIRED`, `OFFER_SENT` — those have their own reminders or
 * are simply the customer taking their time), the two long external waits
 * (`CONTRACT_SENT`, `AWAITING_ACTIVATION` — the supplier legitimately takes
 * weeks), and the terminal states.
 */
const OPERATOR_OWED_STATUSES: readonly BillStatus[] = [
  BillStatus.PENDING_EMAIL,
  BillStatus.UPLOADED,
  BillStatus.ANALYZING,
  BillStatus.ANALYZED,
  BillStatus.ERROR,
  BillStatus.VERIFICATION_REVIEW,
  BillStatus.VERIFIED,
  BillStatus.OFFER_ACCEPTED,
];

/**
 * A run never processes more than this. It is a runaway guard, not a policy —
 * hitting it is logged loudly rather than silently truncating coverage.
 */
const MAX_ROWS_PER_RUN = 500;

/**
 * The two notifications that are triggered by time passing rather than by
 * someone doing something.
 *
 * Both live here rather than in `BillsService` so that every scheduled send
 * sits next to every immediate one. Entities are registered directly on
 * `NotificationsModule` instead of importing `BillsModule`, matching how
 * `User` is already registered there to avoid a dependency cycle.
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    @InjectRepository(BillVerification)
    private readonly verificationRepository: Repository<BillVerification>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    private readonly events: NotificationEventsService,
  ) {}

  /**
   * One reminder, 48 hours after the admin asked for a document.
   *
   * There is no cancellation to manage. Uploading flips the verification to
   * SUBMITTED and moving the case on resolves it, so either way the row stops
   * matching this query. Hourly rather than daily so "after 48 hours" means
   * roughly that, and the dedupe key keeps it to exactly one reminder however
   * long the request stays open.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendPendingDocumentReminders(): Promise<void> {
    try {
      // The cutoff is computed by Postgres, not by Node. `created_at` here is
      // `timestamp without time zone` — the rows carry a wall clock with no
      // offset — so handing it a JS Date compares two different frames of
      // reference and the reminder lands hours early or late depending on the
      // server's timezone. Doing the arithmetic in SQL keeps both sides in the
      // database's own frame, which is also the frame the rows were written in.
      const overdue = await this.verificationRepository
        .createQueryBuilder('verification')
        .leftJoinAndSelect('verification.bill', 'bill')
        .where('verification.status = :status', {
          status: VerificationStatus.PENDING,
        })
        .andWhere(
          `verification.createdAt <= NOW() - (:hours * INTERVAL '1 hour')`,
          { hours: DOCUMENT_REMINDER_HOURS },
        )
        .orderBy('verification.createdAt', 'ASC')
        .take(MAX_ROWS_PER_RUN)
        .getMany();

      if (!overdue.length) {
        return;
      }

      if (overdue.length === MAX_ROWS_PER_RUN) {
        this.logger.warn(
          `Document reminder scan hit the ${MAX_ROWS_PER_RUN}-row cap; the rest are picked up next hour.`,
        );
      }

      let sent = 0;
      for (const verification of overdue) {
        const bill = verification.bill;
        if (!bill) {
          continue;
        }

        await this.events.documentReminder(
          {
            id: verification.id,
            billId: verification.billId,
            adminMessage: verification.adminMessage,
          },
          { id: bill.id, userId: bill.userId, billType: bill.billType },
        );
        sent += 1;
      }

      this.logger.log(
        `Document reminder pass: ${sent} pending request(s) considered (already-reminded ones are dropped by the dedupe key).`,
      );
    } catch (error) {
      this.logger.error(
        `Document reminder job failed: ${error?.message || error}`,
        error?.stack,
      );
    }
  }

  /**
   * Tells the admins about applications that have not moved in three days.
   *
   * Measured from `status_changed_at`, so an admin editing a field or adding a
   * note does not reset the clock — and does not count as progress either.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async flagStalledApplications(): Promise<void> {
    try {
      const now = Date.now();

      const stalled = await this.billRepository
        .createQueryBuilder('bill')
        .leftJoinAndSelect('bill.switchCases', 'switchCase')
        .where('bill.status IN (:...statuses)', {
          statuses: [...OPERATOR_OWED_STATUSES],
        })
        // Cutoff computed by Postgres for the same reason as above: the two
        // columns in the COALESCE do not even agree with each other —
        // `status_changed_at` carries an offset and `created_at` does not — so
        // a JS Date would be right for one branch and wrong for the other.
        .andWhere(
          `COALESCE(bill.statusChangedAt, bill.createdAt) <= NOW() - (:days * INTERVAL '1 day')`,
          { days: STALL_DAYS },
        )
        // Oldest bill first, so the cap below drops the freshest rather than
        // the most neglected. Deliberately a plain column: TypeORM parses an
        // `orderBy` string as `alias.property` and rejects an expression, and
        // `statusChangedAt` is never earlier than `createdAt`, so bill age
        // orders by stall age closely enough for a tiebreak — while keeping
        // rows that predate the column (NULL, and so the oldest) at the front.
        .orderBy('bill.createdAt', 'ASC')
        .take(MAX_ROWS_PER_RUN)
        .getMany();

      if (!stalled.length) {
        return;
      }

      if (stalled.length === MAX_ROWS_PER_RUN) {
        this.logger.warn(
          `Stalled-application scan hit the ${MAX_ROWS_PER_RUN}-row cap; the rest are picked up tomorrow.`,
        );
      }

      for (const bill of stalled) {
        const stalledSince = bill.statusChangedAt || bill.createdAt;
        // Postgres has already decided this row is at least STALL_DAYS old, so
        // the copy never claims less than that — the fallback column is a
        // naive timestamp and reading it back into a JS Date shifts it by the
        // server's offset, which is enough to round "3 giorni" down to "2".
        const days = Math.max(
          STALL_DAYS,
          Math.floor(
            (now - new Date(stalledSince).getTime()) / (24 * 60 * 60 * 1000),
          ),
        );

        const activeCase = bill.switchCases?.length
          ? [...bill.switchCases].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0]
          : null;

        await this.events.adminApplicationStalled(
          { id: bill.id, userId: bill.userId, status: bill.status },
          new Date(stalledSince),
          days,
          activeCase?.caseNumber,
        );
      }

      this.logger.log(
        `Stalled-application pass: ${stalled.length} case(s) considered (already-flagged ones are dropped by the dedupe key).`,
      );
    } catch (error) {
      this.logger.error(
        `Stalled application job failed: ${error?.message || error}`,
        error?.stack,
      );
    }
  }
}
