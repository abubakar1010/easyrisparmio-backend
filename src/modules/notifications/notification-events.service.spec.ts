import { Logger } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';
import { BillStatus } from '../../common/enums/bill.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { ReferralStatus } from '../../common/enums/referral.enum';
import { TicketStatus } from '../../common/enums/support.enum';

/**
 * The dedupe key is the whole anti-duplication mechanism, so it is asserted
 * literally. Changing one of these strings re-opens an event that has already
 * been sent to every existing customer — which is exactly why the test spells
 * the key out rather than recomputing it.
 */
describe('NotificationEventsService', () => {
  let sendNotification: jest.Mock;
  let notifyAdmins: jest.Mock;
  let events: NotificationEventsService;

  const BILL = { id: 'b1', userId: 'u1', billType: 'electricity' };

  /** The single argument the customer path was called with. */
  const sent = () => sendNotification.mock.calls[0]?.[0];
  const toAdmins = () => notifyAdmins.mock.calls[0]?.[0];

  beforeEach(() => {
    jest.clearAllMocks();
    sendNotification = jest.fn().mockResolvedValue(undefined);
    notifyAdmins = jest.fn().mockResolvedValue(undefined);
    events = new NotificationEventsService(
      { sendNotification } as any,
      { notifyAdmins, describeUser: async () => 'Mario Rossi' } as any,
    );
  });

  describe('customer milestones', () => {
    it.each([
      [BillStatus.OFFER_SENT, 'bill:b1:offers_available'],
      [BillStatus.CONTRACT_SENT, 'bill:b1:contract_ready'],
      [BillStatus.AWAITING_ACTIVATION, 'bill:b1:in_activation'],
      [BillStatus.ACTIVATED, 'bill:b1:activated'],
      [BillStatus.CANCELLED, 'bill:b1:cancelled'],
    ])('announces %s under the key %s', async (status, key) => {
      await events.billMilestone(BILL, status as BillStatus);

      expect(sent()).toMatchObject({ userId: 'u1', dedupeKey: key });
    });

    it.each([
      BillStatus.PENDING_EMAIL,
      BillStatus.UPLOADED,
      BillStatus.ANALYZING,
      BillStatus.ANALYZED,
      BillStatus.ERROR,
      BillStatus.VERIFICATION_REVIEW,
      BillStatus.VERIFIED,
      BillStatus.OFFER_ACCEPTED,
    ])('says nothing about the internal status %s', async (status) => {
      await events.billMilestone(BILL, status);

      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('skips VERIFICATION_REQUIRED, which carries the admin message instead', async () => {
      await events.billMilestone(BILL, BillStatus.VERIFICATION_REQUIRED);

      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('reaches the same key from the case status column', async () => {
      await events.caseMilestone(
        { id: 'c1', userId: 'u1', billId: 'b1', caseNumber: 'CASE-1' },
        CaseStatus.ACTIVATED,
      );

      // Identical to billMilestone(ACTIVATED) above: whichever column moves
      // first sends, and the second is a no-op at the database.
      expect(sent().dedupeKey).toBe('bill:b1:activated');
    });

    it('treats a rejected case as a cancellation', async () => {
      await events.caseMilestone(
        { id: 'c1', userId: 'u1', billId: 'b1', caseNumber: 'CASE-1' },
        CaseStatus.REJECTED,
      );

      expect(sent().dedupeKey).toBe('bill:b1:cancelled');
    });

    it('stays silent on a case with no bill, which cannot be deduplicated', async () => {
      await events.caseMilestone(
        { id: 'c1', userId: 'u1', billId: null, caseNumber: 'CASE-1' },
        CaseStatus.ACTIVATED,
      );

      expect(sendNotification).not.toHaveBeenCalled();
    });

    it.each([CaseStatus.NEW, CaseStatus.IN_PROGRESS, CaseStatus.DOCUMENTS_PENDING])(
      'says nothing about the internal case status %s',
      async (status) => {
        await events.caseMilestone(
          { id: 'c1', userId: 'u1', billId: 'b1', caseNumber: 'CASE-1' },
          status,
        );

        expect(sendNotification).not.toHaveBeenCalled();
      },
    );
  });

  describe('offers', () => {
    it('shares its key with the OFFER_SENT milestone', async () => {
      await events.offersAvailable(BILL, { count: 4, bestSavings: 312.5 });

      expect(sent()).toMatchObject({
        dedupeKey: 'bill:b1:offers_available',
        type: NotificationType.OFFER_AVAILABLE,
        bodyParams: [4, '312.50'],
      });
    });
  });

  describe('documents', () => {
    const VERIFICATION = {
      id: 'v1',
      billId: 'b1',
      adminMessage: 'La bolletta è illeggibile.',
    };

    it('keys the request to the verification, not the bill', async () => {
      await events.documentRequested(VERIFICATION, BILL);

      // A second, different request must be able to notify again — hence the
      // verification id rather than the bill id.
      expect(sent()).toMatchObject({
        dedupeKey: 'verification:v1:requested',
        body: 'La bolletta è illeggibile.',
      });
    });

    it('keys the 48h reminder separately from the request', async () => {
      await events.documentReminder(VERIFICATION, BILL);

      expect(sent()).toMatchObject({
        dedupeKey: 'verification:v1:reminder',
        bodyParams: ['La bolletta è illeggibile.'],
      });
    });
  });

  describe('support', () => {
    const TICKET = { id: 't1', userId: 'u1', subject: 'Bolletta errata' };

    it('keys a reply to the message, so every reply notifies', async () => {
      await events.supportReplied(TICKET, { id: 'm1', preview: 'Ci pensiamo noi' });

      expect(sent()).toMatchObject({ dedupeKey: 'ticket-msg:m1' });
    });

    it.each([
      [TicketStatus.RESOLVED, 'ticket:t1:resolved'],
      [TicketStatus.CLOSED, 'ticket:t1:closed'],
    ])('announces %s', async (status, key) => {
      await events.ticketClosedOut(TICKET, status as TicketStatus);

      expect(sent().dedupeKey).toBe(key);
    });

    it.each([TicketStatus.OPEN, TicketStatus.IN_PROGRESS])(
      'says nothing about %s',
      async (status) => {
        await events.ticketClosedOut(TICKET, status);

        expect(sendNotification).not.toHaveBeenCalled();
      },
    );
  });

  describe('referrals', () => {
    const REFERRAL = { id: 'r1', referrerId: 'u1' };

    it.each([
      [ReferralStatus.QUALIFIED, 'referral:r1:qualified'],
      [ReferralStatus.REWARDED, 'referral:r1:rewarded'],
    ])('announces the successful status %s', async (status, key) => {
      await events.referralSucceeded(REFERRAL, status as ReferralStatus, 25);

      expect(sent().dedupeKey).toBe(key);
    });

    it.each([
      ReferralStatus.PENDING,
      ReferralStatus.REGISTERED,
      ReferralStatus.EXPIRED,
    ])('says nothing about %s', async (status) => {
      await events.referralSucceeded(REFERRAL, status);

      expect(sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('admin events', () => {
    it('keys the bill check request to the bill', async () => {
      await events.adminBillCheckRequested(BILL);

      expect(toAdmins()).toMatchObject({
        messageKey: 'admin_bill_uploaded',
        dedupeKey: 'bill:b1:admin_bill_check',
      });
    });

    it('uses the same key for the email variant, so it lands once per bill', async () => {
      await events.adminBillCheckRequested(BILL, { viaEmail: true });

      expect(toAdmins()).toMatchObject({
        messageKey: 'admin_bill_email_requested',
        dedupeKey: 'bill:b1:admin_bill_check',
      });
    });

    it('keys the submitted application to the case', async () => {
      await events.adminApplicationSubmitted(
        { id: 'c1', userId: 'u1', billId: 'b1', caseNumber: 'CASE-1' },
        'Enel',
      );

      expect(toAdmins()).toMatchObject({
        dedupeKey: 'case:c1:admin_submitted',
        bodyParams: ['Mario Rossi', 'Enel', 'CASE-1'],
      });
    });

    it('re-arms the stalled alert only when the status change moves', async () => {
      const first = new Date('2026-08-01T10:00:00.000Z');
      const second = new Date('2026-08-10T10:00:00.000Z');

      await events.adminApplicationStalled(
        { ...BILL, status: BillStatus.VERIFICATION_REVIEW },
        first,
        3,
      );
      await events.adminApplicationStalled(
        { ...BILL, status: BillStatus.VERIFICATION_REVIEW },
        second,
        3,
      );

      expect(notifyAdmins.mock.calls.map((c) => c[0].dedupeKey)).toEqual([
        'bill:b1:stalled:2026-08-01T10:00:00.000Z',
        'bill:b1:stalled:2026-08-10T10:00:00.000Z',
      ]);
    });
  });

  it('never lets a failed notification escape into the caller', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    sendNotification.mockRejectedValue(new Error('database is down'));

    await expect(
      events.billMilestone(BILL, BillStatus.ACTIVATED),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
