import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { BillType } from '../../common/enums/bill.enum';

const mockGetApps = jest.fn();
const mockSendEach = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: () => mockGetApps(),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEach: mockSendEach }),
}));

const CUSTOMER = {
  id: 'u1',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario@example.it',
};

const CASE_ROW = {
  id: 'c1',
  userId: 'u1',
  caseNumber: 'SW-20260731-00001',
  selectedOffer: {
    id: 'o1',
    name: 'Casa Luce Fissa 12',
    supplier: { id: 's1', name: 'Illumia' },
  },
  bill: { id: 'b1', billType: BillType.ELECTRICITY },
};

/**
 * Sending from a template is deliberately the *same* path as sending free text:
 * the composer resolves the template into title and body before it posts, and
 * the id rides along only so a customer's history can say where the words came
 * from. These tests pin that down, and in particular pin down that provenance
 * never reaches the FCM payload — `data` is the apps' deep-link contract.
 */
describe('NotificationsService template sends', () => {
  let save: jest.Mock;
  let insertBuilder: Record<string, jest.Mock>;
  let caseGetMany: jest.Mock;
  let caseQb: Record<string, jest.Mock>;
  let caseCreateQueryBuilder: jest.Mock;
  let service: NotificationsService;

  const build = (cases: unknown[] = [CASE_ROW]) => {
    caseGetMany = jest.fn().mockResolvedValue(cases);
    caseQb = {
      leftJoin: jest.fn(() => caseQb),
      addSelect: jest.fn(() => caseQb),
      where: jest.fn(() => caseQb),
      andWhere: jest.fn(() => caseQb),
      orderBy: jest.fn(() => caseQb),
      getMany: caseGetMany,
    };
    caseCreateQueryBuilder = jest.fn(() => caseQb);

    save = jest.fn(async (rows: unknown) => rows);
    insertBuilder = {
      insert: jest.fn(() => insertBuilder),
      into: jest.fn(() => insertBuilder),
      values: jest.fn(() => insertBuilder),
      orIgnore: jest.fn(() => insertBuilder),
      returning: jest.fn(() => insertBuilder),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    };

    return new NotificationsService(
      {
        create: jest.fn((row: unknown) => row),
        save,
        createQueryBuilder: jest.fn(() => insertBuilder),
      } as any,
      {
        find: jest
          .fn()
          .mockResolvedValue([
            { id: 'pt-1', token: 'tok-1', userId: 'u1', platform: 'android' },
          ]),
        update: jest.fn(),
      } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn().mockResolvedValue([CUSTOMER]) } as any,
      { createQueryBuilder: caseCreateQueryBuilder } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue('https://dashboard.example') } as any,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    mockSendEach.mockResolvedValue({
      responses: [{ success: true }],
      failureCount: 0,
      successCount: 1,
    });
    service = build();
  });

  it('records the template the message was composed from', async () => {
    await service.sendNotification({
      userId: 'u1',
      title: 'Nuova offerta',
      body: 'Testo.',
      type: NotificationType.GENERAL,
      templateId: 'tpl-1',
    } as any);

    expect(save.mock.calls[0][0][0]).toMatchObject({ templateId: 'tpl-1' });
  });

  /**
   * The mobile-safety test. `buildDataPayload` forwards `data` verbatim into
   * every push — alongside the row's own `type`, which is what the apps route
   * on — and the Flutter deep-link switch reads both. Provenance living in a
   * column rather than in `data` is what keeps that contract byte-identical.
   */
  it('keeps the FCM payload identical to a free-text send', async () => {
    await service.sendNotification({
      userId: 'u1',
      title: 'Nuova offerta',
      body: 'Testo.',
      type: NotificationType.GENERAL,
      data: { billId: 'b1' },
      templateId: 'tpl-1',
    } as any);
    const withTemplate = mockSendEach.mock.calls[0][0];

    jest.clearAllMocks();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    mockSendEach.mockResolvedValue({
      responses: [{ success: true }],
      failureCount: 0,
      successCount: 1,
    });
    service = build();

    await service.sendNotification({
      userId: 'u1',
      title: 'Nuova offerta',
      body: 'Testo.',
      type: NotificationType.GENERAL,
      data: { billId: 'b1' },
    } as any);
    const withoutTemplate = mockSendEach.mock.calls[0][0];

    expect(withTemplate).toEqual(withoutTemplate);
    expect(withTemplate[0].data).toEqual({
      billId: 'b1',
      type: NotificationType.GENERAL,
    });
  });

  it('leaves a template send on the ordinary save path, so it can be repeated', async () => {
    await service.sendNotification({
      userId: 'u1',
      title: 'Documenti da ricaricare',
      body: 'Testo.',
      type: NotificationType.GENERAL,
      templateId: 'tpl-1',
    } as any);

    expect(save).toHaveBeenCalled();
    expect(insertBuilder.orIgnore).not.toHaveBeenCalled();
  });

  describe('case-scoped variables', () => {
    it('renders the provider, offer name and utility type from the newest case', async () => {
      await service.sendNotification({
        userId: 'u1',
        title: 'Pratica {{utility_type}}',
        body: 'Ciao {{name}}, {{provider}} — {{offer_name}}.',
        type: NotificationType.GENERAL,
      } as any);

      expect(save.mock.calls[0][0][0]).toMatchObject({
        title: 'Pratica Luce',
        body: 'Ciao Mario Rossi, Illumia — Casa Luce Fissa 12.',
      });
    });

    it('refuses the send when the customer has no case, writing and pushing nothing', async () => {
      service = build([]);

      await expect(
        service.sendNotification({
          userId: 'u1',
          title: 'Promo',
          body: 'Passa a {{provider}} e risparmia.',
          type: NotificationType.GENERAL,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(save).not.toHaveBeenCalled();
      expect(mockSendEach).not.toHaveBeenCalled();
    });

    it('names the variables it could not resolve', async () => {
      service = build([]);

      await expect(
        service.sendNotification({
          userId: 'u1',
          title: 'Promo',
          body: '{{provider}} {{offer_name}}',
          type: NotificationType.GENERAL,
        } as any),
      ).rejects.toThrow(/\{\{provider\}\}.*\{\{offer_name\}\}/);
    });

    it('refuses a message containing a mistyped variable', async () => {
      await expect(
        service.sendNotification({
          userId: 'u1',
          title: 'Promo',
          body: 'Ciao {{nome}}',
          type: NotificationType.GENERAL,
        } as any),
      ).rejects.toThrow(/\{\{nome\}\}/);

      expect(save).not.toHaveBeenCalled();
    });

    /** One query for the batch, not one per recipient. */
    it('loads the case context in a single query', async () => {
      await service.sendNotification({
        userIds: ['u1'],
        title: 'T',
        body: '{{provider}}',
        type: NotificationType.GENERAL,
      } as any);

      expect(caseCreateQueryBuilder).toHaveBeenCalledTimes(1);
      expect(caseGetMany).toHaveBeenCalledTimes(1);
    });

    it('does not query cases at all for a message that only names the customer', async () => {
      await service.sendNotification({
        userId: 'u1',
        title: 'Ciao {{firstName}}',
        body: 'Testo.',
        type: NotificationType.GENERAL,
      } as any);

      expect(caseCreateQueryBuilder).not.toHaveBeenCalled();
    });

    it('scopes to an explicit case when the admin picked one', async () => {
      await service.sendNotification({
        userId: 'u1',
        title: 'T',
        body: '{{provider}}',
        type: NotificationType.GENERAL,
        caseId: 'c1',
      } as any);

      expect(caseQb.andWhere).toHaveBeenCalledWith('sc.id = :caseId', {
        caseId: 'c1',
      });
    });
  });

  /** What the preview endpoint renders against. */
  describe('buildRenderContext', () => {
    it('returns the customer and their newest case', async () => {
      const { context, locale } = await service.buildRenderContext('u1');

      expect(locale).toBe('it');
      expect(context).toMatchObject({
        user: CUSTOMER,
        provider: 'Illumia',
        offerName: 'Casa Luce Fissa 12',
        caseNumber: 'SW-20260731-00001',
      });
    });

    it('returns no case context for a customer who has none', async () => {
      service = build([]);

      const { context } = await service.buildRenderContext('u1');

      expect(context.user).toEqual(CUSTOMER);
      expect(context.provider).toBeUndefined();
    });

    /**
     * Otherwise a preview for an unknown id renders every user variable as an
     * empty string — they fall back through to the email, which is empty too —
     * and the admin sees a blank message instead of an error.
     */
    it('rejects an unknown customer rather than rendering blanks', async () => {
      const noUser = new NotificationsService(
        { create: jest.fn(), save: jest.fn() } as any,
        { find: jest.fn().mockResolvedValue([]), update: jest.fn() } as any,
        { findOne: jest.fn().mockResolvedValue(null) } as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        { createQueryBuilder: jest.fn(() => caseQb) } as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        { get: jest.fn() } as any,
      );

      await expect(noUser.buildRenderContext('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
