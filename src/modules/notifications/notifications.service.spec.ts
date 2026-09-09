import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationType, Platform } from '../../common/enums/notification.enum';

/**
 * The case-context query builder, which resolves `{{provider}}` and friends.
 * Every test in this file uses only user-scoped variables, so it never runs —
 * but the constructor needs something shaped like a repository.
 */
const caseQueryBuilder = () => {
  const qb: Record<string, jest.Mock> = {
    leftJoin: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
};


const mockGetApps = jest.fn();
const mockSendEach = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: () => mockGetApps(),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEach: mockSendEach }),
}));

describe('NotificationsService push delivery', () => {
  const DASHBOARD_URL = 'https://dashboard.example';

  let service: NotificationsService;
  let pushTokenFind: jest.Mock;
  let pushTokenUpdate: jest.Mock;
  let warn: jest.SpyInstance;

  const webToken = (over: Record<string, unknown> = {}) => ({
    id: 'pt-web',
    token: 'tok-web',
    userId: 'u1',
    platform: Platform.WEB,
    ...over,
  });

  const build = () =>
    new NotificationsService(
      {
        create: jest.fn((row: unknown) => row),
        save: jest.fn(async (rows: unknown) => rows),
      } as any,
      { find: pushTokenFind, update: pushTokenUpdate } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      // Case + template repositories: no test here renders a case variable
      // or reads a template name, so an empty result is the honest stub.
      { createQueryBuilder: jest.fn(() => caseQueryBuilder()) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue(DASHBOARD_URL) } as any,
    );

  const send = () =>
    service.sendNotification({
      userIds: ['u1'],
      title: 'Nuova bolletta',
      body: 'Mario Rossi ha caricato una bolletta',
      type: NotificationType.ADMIN_BILL,
      data: { billId: 'bill-1' },
    } as any);

  /** One FCM response per token, in the order the tokens were found. */
  const fcmReplies = (...responses: Record<string, unknown>[]) =>
    mockSendEach.mockResolvedValue({
      responses,
      failureCount: responses.filter((r) => !r.success).length,
      successCount: responses.filter((r) => r.success).length,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    pushTokenFind = jest.fn().mockResolvedValue([webToken()]);
    pushTokenUpdate = jest.fn().mockResolvedValue(undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    service = build();
  });

  afterEach(() => warn.mockRestore());

  const warnings = () => warn.mock.calls.map((c) => String(c[0]));

  it('reports an FCM rejection with its code and platform', async () => {
    fcmReplies({
      success: false,
      error: { code: 'messaging/invalid-argument' },
    });

    await send();

    expect(warnings()).toContainEqual(
      expect.stringContaining('web:messaging/invalid-argument'),
    );
  });

  it('tallies repeated rejections rather than logging one line each', async () => {
    pushTokenFind.mockResolvedValue([
      webToken({ id: 'pt-1', token: 'a' }),
      webToken({ id: 'pt-2', token: 'b' }),
      webToken({ id: 'pt-3', token: 'c', platform: Platform.ANDROID }),
    ]);
    fcmReplies(
      { success: false, error: { code: 'messaging/third-party-auth-error' } },
      { success: false, error: { code: 'messaging/third-party-auth-error' } },
      { success: true },
    );

    await send();

    const rejection = warnings().find((w) => w.includes('FCM rejected'));
    expect(rejection).toContain('2/3');
    expect(rejection).toContain('web:messaging/third-party-auth-error x2');
  });

  it('deactivates a dead token instead of reporting it as a rejection', async () => {
    fcmReplies({
      success: false,
      error: { code: 'messaging/registration-token-not-registered' },
    });

    await send();

    expect(pushTokenUpdate).toHaveBeenCalledWith(['pt-web'], {
      isActive: false,
    });
    expect(warnings().some((w) => w.includes('FCM rejected'))).toBe(false);
  });

  it('says nothing when every message is delivered', async () => {
    fcmReplies({ success: true });

    await send();

    expect(pushTokenUpdate).not.toHaveBeenCalled();
    expect(warnings().some((w) => w.includes('FCM rejected'))).toBe(false);
  });

  it('warns once per process when Firebase is not initialised', async () => {
    mockGetApps.mockReturnValue([]);

    await send();
    await send();

    expect(
      warnings().filter((w) => w.includes('Firebase is not initialised')),
    ).toHaveLength(1);
    expect(mockSendEach).not.toHaveBeenCalled();
  });

  it('sends web push at high urgency, pointed at the dashboard', async () => {
    fcmReplies({ success: true });

    await send();

    expect(mockSendEach).toHaveBeenCalledWith([
      expect.objectContaining({
        token: 'tok-web',
        webpush: {
          fcmOptions: { link: `${DASHBOARD_URL}/notifications` },
          headers: { Urgency: 'high', TTL: '86400' },
        },
      }),
    ]);
  });

  it('carries the notification type in the push data, next to the deep-link keys', async () => {
    fcmReplies({ success: true });

    await send();

    // Without `type` the apps cannot tell an offer notification from a
    // contract one, and every tap lands on the notification centre instead of
    // the screen the message is about.
    expect(mockSendEach.mock.calls[0][0][0].data).toEqual({
      billId: 'bill-1',
      type: NotificationType.ADMIN_BILL,
    });
  });

  it('lets the row type win over a type hand-written into data', async () => {
    fcmReplies({ success: true });

    await service.sendNotification({
      userIds: ['u1'],
      title: 'Offerte disponibili',
      body: 'Abbiamo selezionato delle offerte per te.',
      type: NotificationType.OFFER_AVAILABLE,
      data: { billId: 'bill-1', type: 'general' },
    } as any);

    expect(mockSendEach.mock.calls[0][0][0].data.type).toBe(
      NotificationType.OFFER_AVAILABLE,
    );
  });

  it('leaves mobile messages without a webpush block', async () => {
    pushTokenFind.mockResolvedValue([
      webToken({ id: 'pt-ios', token: 'tok-ios', platform: Platform.IOS }),
    ]);
    fcmReplies({ success: true });

    await send();

    expect(mockSendEach.mock.calls[0][0][0]).not.toHaveProperty('webpush');
  });
});
