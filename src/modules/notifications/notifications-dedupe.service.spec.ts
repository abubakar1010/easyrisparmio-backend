import { NotificationsService } from './notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';

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

/**
 * The `(user_id, dedupe_key)` unique index is enforced by Postgres, which a
 * unit test cannot run. What it *can* pin down is the contract the service
 * relies on: a keyed send must go through `ON CONFLICT DO NOTHING`, and the
 * push must follow the rows the database says it actually inserted rather than
 * the rows we asked it to.
 */
describe('NotificationsService deduplication', () => {
  let execute: jest.Mock;
  let save: jest.Mock;
  let insertBuilder: Record<string, jest.Mock>;
  let pushTokenFind: jest.Mock;
  let service: NotificationsService;

  /** Rows the fake INSERT ... RETURNING * reports as having been written. */
  const inserted = (...userIds: string[]) =>
    execute.mockResolvedValue({
      raw: userIds.map((userId, i) => ({
        id: `n-${i}`,
        user_id: userId,
        title: 'Offerte disponibili',
        body: 'Aprile nella app.',
        type: NotificationType.OFFER_AVAILABLE,
        data: null,
        is_read: false,
        read_at: null,
        sent_by: null,
        dedupe_key: 'bill:b1:offers_available',
        created_at: new Date(),
        updated_at: new Date(),
      })),
    });

  const send = (over: Record<string, unknown> = {}) =>
    service.sendNotification({
      userIds: ['u1'],
      title: 'Offerte disponibili',
      body: 'Aprile nella app.',
      type: NotificationType.OFFER_AVAILABLE,
      dedupeKey: 'bill:b1:offers_available',
      ...over,
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    mockSendEach.mockResolvedValue({
      responses: [{ success: true }],
      failureCount: 0,
      successCount: 1,
    });

    execute = jest.fn();
    insertBuilder = {
      insert: jest.fn(() => insertBuilder),
      into: jest.fn(() => insertBuilder),
      values: jest.fn(() => insertBuilder),
      orIgnore: jest.fn(() => insertBuilder),
      returning: jest.fn(() => insertBuilder),
      execute,
    };
    save = jest.fn(async (rows: unknown) => rows);
    pushTokenFind = jest
      .fn()
      .mockResolvedValue([
        { id: 'pt-1', token: 'tok-1', userId: 'u1', platform: 'android' },
      ]);

    service = new NotificationsService(
      {
        create: jest.fn((row: unknown) => row),
        save,
        createQueryBuilder: jest.fn(() => insertBuilder),
      } as any,
      { find: pushTokenFind, update: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      // Case + template repositories: no test here renders a case variable
      // or reads a template name, so an empty result is the honest stub.
      { createQueryBuilder: jest.fn(() => caseQueryBuilder()) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue('https://dashboard.example') } as any,
    );
  });

  it('writes a keyed notification with ON CONFLICT DO NOTHING', async () => {
    inserted('u1');

    await send();

    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(insertBuilder.returning).toHaveBeenCalledWith('*');
    expect(save).not.toHaveBeenCalled();
  });

  it('sends no push when the event was already announced', async () => {
    inserted(); // conflict: RETURNING gives back nothing

    const result = await send();

    expect(result).toEqual([]);
    expect(mockSendEach).not.toHaveBeenCalled();
  });

  it('pushes only to the recipients whose row was actually inserted', async () => {
    // Two admins, but one of them was already told about this event.
    inserted('u2');
    pushTokenFind.mockResolvedValue([
      { id: 'pt-2', token: 'tok-2', userId: 'u2', platform: 'web' },
    ]);

    await send({ userIds: ['u1', 'u2'] });

    expect(pushTokenFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: expect.objectContaining({ _value: ['u2'] }),
        }),
      }),
    );
    expect(mockSendEach).toHaveBeenCalledTimes(1);
  });

  it('leaves an unkeyed notification on the ordinary save path', async () => {
    await send({ dedupeKey: undefined });

    expect(save).toHaveBeenCalled();
    expect(insertBuilder.orIgnore).not.toHaveBeenCalled();
  });
});

describe('NotificationsService placeholder substitution', () => {
  const buildWith = (user: Record<string, unknown> | null) => {
    const save = jest.fn(async (rows: any[]) => rows);
    const service = new NotificationsService(
      { create: jest.fn((row: unknown) => row), save } as any,
      { find: jest.fn().mockResolvedValue([]), update: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn().mockResolvedValue(user ? [user] : []) } as any,
      // Case + template repositories: no test here renders a case variable
      // or reads a template name, so an empty result is the honest stub.
      { createQueryBuilder: jest.fn(() => caseQueryBuilder()) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue('https://dashboard.example') } as any,
    );
    return { service, save };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([]);
  });

  it('substitutes the recipient name into a hand-written message', async () => {
    const { service, save } = buildWith({
      id: 'u1',
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@example.com',
    });

    await service.sendNotification({
      userId: 'u1',
      title: 'Ciao {{firstName}}',
      body: 'Ciao {{name}}, abbiamo una nuova offerta ({{email}}).',
      type: NotificationType.GENERAL,
    } as any);

    expect(save.mock.calls[0][0][0]).toMatchObject({
      title: 'Ciao Mario',
      body: 'Ciao Mario Rossi, abbiamo una nuova offerta (mario@example.com).',
    });
  });

  it('falls back to the email rather than leaving a hole in the sentence', async () => {
    const { service, save } = buildWith({
      id: 'u1',
      firstName: null,
      lastName: null,
      email: 'mario@example.com',
    });

    await service.sendNotification({
      userId: 'u1',
      title: 'Promo',
      body: 'Ciao {{name}}!',
      type: NotificationType.GENERAL,
    } as any);

    expect(save.mock.calls[0][0][0].body).toBe('Ciao mario@example.com!');
  });

  it('does not look up recipients when there is nothing to substitute', async () => {
    const userFind = jest.fn().mockResolvedValue([]);
    const service = new NotificationsService(
      {
        create: jest.fn((row: unknown) => row),
        save: jest.fn(async (rows: unknown) => rows),
      } as any,
      { find: jest.fn().mockResolvedValue([]), update: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      { find: userFind } as any,
      // Case + template repositories: no test here renders a case variable
      // or reads a template name, so an empty result is the honest stub.
      { createQueryBuilder: jest.fn(() => caseQueryBuilder()) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockReturnValue('https://dashboard.example') } as any,
    );

    await service.sendNotification({
      userId: 'u1',
      title: 'Promo',
      body: 'Nessun segnaposto qui.',
      type: NotificationType.GENERAL,
    } as any);

    expect(userFind).not.toHaveBeenCalled();
  });
});
