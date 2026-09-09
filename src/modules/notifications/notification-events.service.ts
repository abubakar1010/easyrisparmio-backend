import { Injectable, Logger } from '@nestjs/common';
import { BillStatus } from '../../common/enums/bill.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { ReferralStatus } from '../../common/enums/referral.enum';
import { TicketStatus } from '../../common/enums/support.enum';
import { BILL_STATUS_LABELS } from '../../common/utils/bill-status-transitions';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationsService } from './notifications.service';
import {
  CASE_STATUS_MILESTONES,
  CUSTOMER_MILESTONES,
  MessageKey,
} from './notification-messages';

/**
 * The parameters are structural rather than entity classes so this service
 * depends on no other module and can be unit-tested with plain objects.
 */
export interface BillRef {
  id: string;
  userId: string;
  billType?: string;
}

export interface VerificationRef {
  id: string;
  billId: string;
  adminMessage: string;
}

export interface CaseRef {
  id: string;
  userId: string;
  billId: string | null;
  caseNumber: string | null;
}

export interface TicketRef {
  id: string;
  userId: string;
  subject: string;
}

/**
 * Every notification the platform is allowed to send, in one place.
 *
 * Nothing outside this file may call `NotificationsService.sendNotification`
 * or `AdminNotificationsService.notifyAdmins` — the sole exception is the
 * admin's manual composer on `POST /notifications/send`. That rule is what
 * keeps the trigger list reviewable: it used to be twenty-seven ad-hoc calls
 * spread over six services, which is how a notification ended up firing on
 * essentially every database write.
 *
 * Two invariants hold for every method here:
 *
 *  1. **It reports a business event, not a save.** Callers invoke these only
 *     when something a person cares about actually happened.
 *  2. **It carries a dedupe key.** The unique `(user_id, dedupe_key)` index
 *     means the same event on the same application can never be announced
 *     twice, whatever the caller does — a status moved back and forth, a cron
 *     that runs again, two admins clicking at once.
 *
 * Failures are swallowed and logged. A notification must never break the
 * transaction that produced it.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly adminNotifications: AdminNotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // Customer events — push + in-app notification centre
  // ═══════════════════════════════════════════════════════════

  /** The customer's request has been received. Sent once per bill. */
  async applicationSubmitted(bill: BillRef): Promise<void> {
    await this.toCustomer({
      userId: bill.userId,
      messageKey: 'application_submitted',
      type: NotificationType.CASE_UPDATE,
      dedupeKey: `bill:${bill.id}:submitted`,
      data: { billId: bill.id, entityType: 'bill', entityId: bill.id },
    });
  }

  /**
   * Offers are ready. Exactly one notification however many offers were sent,
   * and however many times the admin sends another batch — the key is shared
   * with the `OFFER_SENT` milestone, so the two entry points collapse into one.
   */
  async offersAvailable(
    bill: BillRef,
    offers: { count: number; bestSavings: number },
  ): Promise<void> {
    await this.toCustomer({
      userId: bill.userId,
      messageKey: 'offers_recommended',
      bodyParams: [offers.count, offers.bestSavings.toFixed(2)],
      type: NotificationType.OFFER_AVAILABLE,
      dedupeKey: `bill:${bill.id}:offers_available`,
      data: { billId: bill.id, entityType: 'bill', entityId: bill.id },
    });
  }

  /**
   * The customer-facing half of a bill status change.
   *
   * Statuses absent from `CUSTOMER_MILESTONES` — every internal one — return
   * without sending anything. That is the whole point: silence is the default.
   */
  async billMilestone(
    bill: BillRef,
    status: BillStatus,
    context: { caseId?: string | null } = {},
  ): Promise<void> {
    const milestone = CUSTOMER_MILESTONES[status];
    if (!milestone) {
      return;
    }

    await this.toCustomer({
      userId: bill.userId,
      messageKey: milestone.messageKey,
      type: milestone.type,
      dedupeKey: `bill:${bill.id}:${milestone.event}`,
      data: {
        billId: bill.id,
        ...(context.caseId ? { caseId: context.caseId } : {}),
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  /**
   * The same milestones reached through the case status column instead.
   *
   * Keyed on the bill, so a flow that moves both columns notifies once. A case
   * with no bill behind it cannot be deduplicated safely, so it is skipped
   * rather than risk a repeat on every save.
   */
  async caseMilestone(caseRow: CaseRef, status: CaseStatus): Promise<void> {
    const milestone = CASE_STATUS_MILESTONES[status];
    if (!milestone || !caseRow.billId) {
      return;
    }

    await this.toCustomer({
      userId: caseRow.userId,
      messageKey: milestone.messageKey,
      type: milestone.type,
      dedupeKey: `bill:${caseRow.billId}:${milestone.event}`,
      data: {
        billId: caseRow.billId,
        caseId: caseRow.id,
        entityType: 'case',
        entityId: caseRow.id,
      },
    });
  }

  /** An admin has asked the customer to re-upload a document or bill. */
  async documentRequested(
    verification: VerificationRef,
    bill: BillRef,
  ): Promise<void> {
    await this.toCustomer({
      userId: bill.userId,
      messageKey: 'bill_verification_required',
      // The admin's own words are the body; the catalogue supplies the title.
      body: verification.adminMessage,
      type: NotificationType.BILL_VERIFICATION,
      dedupeKey: `verification:${verification.id}:requested`,
      data: {
        billId: bill.id,
        verificationId: verification.id,
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  /**
   * The single 48-hour nudge. Cancelling it needs no bookkeeping: the
   * scheduler only selects verifications still PENDING, so a customer who
   * uploads in the meantime drops out of the query.
   */
  async documentReminder(
    verification: VerificationRef,
    bill: BillRef,
  ): Promise<void> {
    await this.toCustomer({
      userId: bill.userId,
      messageKey: 'document_reminder',
      bodyParams: [verification.adminMessage || ''],
      type: NotificationType.BILL_VERIFICATION,
      dedupeKey: `verification:${verification.id}:reminder`,
      data: {
        billId: bill.id,
        verificationId: verification.id,
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  /** An admin replied on a support ticket. One per reply, keyed by message. */
  async supportReplied(
    ticket: TicketRef,
    message: { id: string; preview: string },
  ): Promise<void> {
    await this.toCustomer({
      userId: ticket.userId,
      messageKey: 'support_reply',
      body: message.preview,
      type: NotificationType.SUPPORT_REPLY,
      dedupeKey: `ticket-msg:${message.id}`,
      data: {
        ticketId: ticket.id,
        messageId: message.id,
        entityType: 'ticket',
        entityId: ticket.id,
      },
    });
  }

  /** The ticket was resolved or closed. Other status moves stay silent. */
  async ticketClosedOut(ticket: TicketRef, status: TicketStatus): Promise<void> {
    const messageKey: MessageKey | null =
      status === TicketStatus.RESOLVED
        ? 'ticket_resolved'
        : status === TicketStatus.CLOSED
          ? 'ticket_closed'
          : null;

    if (!messageKey) {
      return;
    }

    await this.toCustomer({
      userId: ticket.userId,
      messageKey,
      type: NotificationType.SUPPORT_REPLY,
      dedupeKey: `ticket:${ticket.id}:${status}`,
      data: {
        ticketId: ticket.id,
        status,
        entityType: 'ticket',
        entityId: ticket.id,
      },
    });
  }

  /**
   * A referral paid off. Qualified (the friend's switch completed) and
   * rewarded (the bonus landed) are separate news to the referrer; every other
   * referral state is silent.
   */
  async referralSucceeded(
    referral: { id: string; referrerId: string },
    status: ReferralStatus,
    rewardAmount?: number | null,
  ): Promise<void> {
    const messageKey: MessageKey | null =
      status === ReferralStatus.QUALIFIED
        ? 'referral_qualified'
        : status === ReferralStatus.REWARDED
          ? 'referral_rewarded'
          : null;

    if (!messageKey) {
      return;
    }

    await this.toCustomer({
      userId: referral.referrerId,
      messageKey,
      bodyParams: messageKey === 'referral_rewarded' ? [rewardAmount ?? 0] : [],
      type: NotificationType.REFERRAL_STATUS,
      dedupeKey: `referral:${referral.id}:${status}`,
      data: {
        referralId: referral.id,
        status,
        entityType: 'referral',
        entityId: referral.id,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Admin events — CRM notification centre
  //
  // Each of these marks the customer finishing their part of the process, so
  // an operator now has something to do. Admin-initiated changes deliberately
  // notify nobody: admins used to be told about their own colleagues' clicks
  // on every status move, which was most of the panel's noise.
  // ═══════════════════════════════════════════════════════════

  /** A bill arrived and needs checking. */
  async adminBillCheckRequested(
    bill: BillRef,
    options: { viaEmail?: boolean } = {},
  ): Promise<void> {
    const customerName = await this.adminNotifications.describeUser(bill.userId);

    await this.adminNotifications.notifyAdmins({
      messageKey: options.viaEmail
        ? 'admin_bill_email_requested'
        : 'admin_bill_uploaded',
      type: NotificationType.ADMIN_BILL,
      bodyParams: options.viaEmail
        ? [customerName]
        : [customerName, bill.billType || ''],
      dedupeKey: `bill:${bill.id}:admin_bill_check`,
      data: {
        billId: bill.id,
        userId: bill.userId,
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  /** The customer accepted an offer, so a pratica now exists to work on. */
  async adminApplicationSubmitted(
    caseRow: CaseRef,
    supplierName: string,
  ): Promise<void> {
    const customerName = await this.adminNotifications.describeUser(
      caseRow.userId,
    );

    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_offer_accepted',
      type: NotificationType.ADMIN_OFFER_ACCEPTED,
      bodyParams: [customerName, supplierName, caseRow.caseNumber || caseRow.id],
      dedupeKey: `case:${caseRow.id}:admin_submitted`,
      data: {
        caseId: caseRow.id,
        billId: caseRow.billId,
        userId: caseRow.userId,
        entityType: 'case',
        entityId: caseRow.id,
      },
    });
  }

  /** The customer uploaded the document the admin asked for. */
  async adminDocumentSubmitted(
    verification: VerificationRef,
    bill: BillRef,
  ): Promise<void> {
    const customerName = await this.adminNotifications.describeUser(bill.userId);

    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_verification_submitted',
      type: NotificationType.ADMIN_VERIFICATION,
      bodyParams: [customerName],
      dedupeKey: `verification:${verification.id}:admin_submitted`,
      data: {
        billId: bill.id,
        verificationId: verification.id,
        userId: bill.userId,
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  async adminTicketCreated(ticket: TicketRef): Promise<void> {
    const customerName = await this.adminNotifications.describeUser(
      ticket.userId,
    );

    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_ticket_created',
      type: NotificationType.ADMIN_SUPPORT,
      bodyParams: [customerName, ticket.subject],
      dedupeKey: `ticket:${ticket.id}:admin_created`,
      data: {
        ticketId: ticket.id,
        userId: ticket.userId,
        entityType: 'ticket',
        entityId: ticket.id,
      },
    });
  }

  async adminTicketReplied(
    ticket: TicketRef,
    message: { id: string; senderId: string; preview: string },
  ): Promise<void> {
    const senderName = await this.adminNotifications.describeUser(
      message.senderId,
    );

    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_ticket_replied',
      type: NotificationType.ADMIN_SUPPORT,
      bodyParams: [senderName, ticket.subject, message.preview],
      dedupeKey: `ticket-msg:${message.id}:admin`,
      data: {
        ticketId: ticket.id,
        messageId: message.id,
        userId: ticket.userId,
        entityType: 'ticket',
        entityId: ticket.id,
      },
    });
  }

  /**
   * A case has sat in an operator-owed status for too long.
   *
   * The key carries the timestamp of the status change the case is stuck on,
   * so the alert fires once per stall and re-arms only after the status
   * genuinely moves — not on the next run of the job, and not on a field edit.
   */
  async adminApplicationStalled(
    bill: BillRef & { status: BillStatus },
    stalledSince: Date,
    days: number,
    caseNumber?: string | null,
  ): Promise<void> {
    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_case_stalled',
      type: NotificationType.ADMIN_CASE,
      bodyParams: [
        caseNumber || bill.id,
        BILL_STATUS_LABELS[bill.status] || bill.status,
        days,
      ],
      dedupeKey: `bill:${bill.id}:stalled:${stalledSince.toISOString()}`,
      data: {
        billId: bill.id,
        userId: bill.userId,
        status: bill.status,
        stalledSince: stalledSince.toISOString(),
        entityType: 'bill',
        entityId: bill.id,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════

  private async toCustomer(input: {
    userId: string;
    messageKey: MessageKey;
    type: NotificationType;
    dedupeKey: string;
    bodyParams?: any[];
    body?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.notifications.sendNotification({
        userId: input.userId,
        messageKey: input.messageKey,
        bodyParams: input.bodyParams || [],
        body: input.body,
        type: input.type,
        dedupeKey: input.dedupeKey,
        data: input.data,
      });
    } catch (error) {
      this.logger.warn(
        `Customer notification "${input.messageKey}" (${input.dedupeKey}) failed: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }
}
