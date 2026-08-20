import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';

describe('AdminNotificationsService', () => {
  const ADMIN_A = 'admin-a';
  const ADMIN_B = 'admin-b';

  let find: jest.Mock;
  let findOne: jest.Mock;
  let sendNotification: jest.Mock;
  let service: AdminNotificationsService;

  const build = () => {
    find = jest.fn().mockResolvedValue([{ id: ADMIN_A }, { id: ADMIN_B }]);
    findOne = jest.fn().mockResolvedValue(null);
    sendNotification = jest.fn().mockResolvedValue(undefined);
    return new AdminNotificationsService(
      { find, findOne } as any,
      { sendNotification } as any,
    );
  };

  beforeEach(() => {
    service = build();
  });

  const event = (over: Record<string, unknown> = {}) => ({
    messageKey: 'admin_bill_uploaded' as const,
    type: NotificationType.ADMIN_BILL,
    bodyParams: ['Mario Rossi', 'electricity'],
    data: { billId: 'bill-1' },
    ...over,
  });

  it('addresses every active admin', async () => {
    await service.notifyAdmins(event());

    expect(find).toHaveBeenCalledWith({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0].userIds).toEqual([
      ADMIN_A,
      ADMIN_B,
    ]);
  });

  it('leaves the acting admin out, so nobody is notified of their own action', async () => {
    await service.notifyAdmins(event({ actorId: ADMIN_A }));

    expect(sendNotification.mock.calls[0][0].userIds).toEqual([ADMIN_B]);
  });

  it('sends nothing when the only admin is the actor', async () => {
    find.mockResolvedValue([{ id: ADMIN_A }]);

    await service.notifyAdmins(event({ actorId: ADMIN_A }));

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends nothing when there are no admins at all', async () => {
    find.mockResolvedValue([]);

    await service.notifyAdmins(event());

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('never sets sentBy, so the dashboard files these under "received"', async () => {
    await service.notifyAdmins(event());

    expect(sendNotification.mock.calls[0][0].sentBy).toBeUndefined();
    expect(sendNotification.mock.calls[0].length).toBe(1);
  });

  it('records the event key and actor on the payload', async () => {
    await service.notifyAdmins(
      event({ actorId: ADMIN_A, actorName: 'Admin A' }),
    );

    expect(sendNotification.mock.calls[0][0].data).toEqual({
      event: 'admin_bill_uploaded',
      actorId: ADMIN_A,
      actorName: 'Admin A',
      billId: 'bill-1',
    });
  });

  it('swallows a repository failure rather than breaking the caller', async () => {
    find.mockRejectedValue(new Error('database is down'));

    await expect(service.notifyAdmins(event())).resolves.toBeUndefined();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('swallows a delivery failure rather than breaking the caller', async () => {
    sendNotification.mockRejectedValue(new Error('FCM unavailable'));

    await expect(service.notifyAdmins(event())).resolves.toBeUndefined();
  });

  it('memoises the admin lookup across events', async () => {
    await service.notifyAdmins(event());
    await service.notifyAdmins(event());

    expect(find).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it('re-reads the admin list once the cache is invalidated', async () => {
    await service.notifyAdmins(event());
    service.invalidateAdminCache();
    await service.notifyAdmins(event());

    expect(find).toHaveBeenCalledTimes(2);
  });

  describe('describeUser', () => {
    it('prefers the full name', async () => {
      findOne.mockResolvedValue({
        id: 'u1',
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario@example.com',
      });

      await expect(service.describeUser('u1')).resolves.toBe('Mario Rossi');
    });

    it('falls back to the email when the name is blank', async () => {
      findOne.mockResolvedValue({
        id: 'u1',
        firstName: '',
        lastName: '',
        email: 'mario@example.com',
      });

      await expect(service.describeUser('u1')).resolves.toBe(
        'mario@example.com',
      );
    });

    it('labels a system-triggered event', async () => {
      await expect(service.describeUser(undefined)).resolves.toBe('Sistema');
      expect(findOne).not.toHaveBeenCalled();
    });

    it('never throws when the lookup fails', async () => {
      findOne.mockRejectedValue(new Error('database is down'));

      await expect(service.describeUser('u1')).resolves.toBe(
        'Utente sconosciuto',
      );
    });
  });
});
