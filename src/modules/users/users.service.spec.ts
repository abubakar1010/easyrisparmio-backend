import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UpgradeToBusinessDto } from './dto/upgrade-to-business.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';

/**
 * Covers the self-service account-type switch against in-memory repositories.
 *
 * The behaviours pinned here are the ones the feature quietly lacked before it
 * had a backend at all — the switch has to actually persist, has to survive
 * being submitted twice, and must never let two accounts hold the same Partita
 * IVA — plus the one that is easy to "simplify" away: switching back to
 * personal keeps the company row, so switching forward again needs no re-entry.
 */

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'mario.rossi@email.com',
    firstName: 'Mario',
    lastName: 'Rossi',
    role: UserRole.PERSONAL,
    status: UserStatus.ACTIVE,
    ...overrides,
  } as User;
}

function dto(overrides: Partial<UpgradeToBusinessDto> = {}): UpgradeToBusinessDto {
  return {
    companyName: 'Rossi S.r.l.',
    partitaIva: '12345678901',
    jobRole: 'CEO / Founder',
    acceptedTerms: true,
    ...overrides,
  };
}

/** Resolves the one FindOperator the service uses: `Not(value)`. */
function matches(row: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '_type' in expected) {
      if (expected._type === 'not') return row[key] !== expected._value;
      throw new Error(`unsupported FindOperator ${expected._type}`);
    }
    return row[key] === expected;
  });
}

class FakeUserRepository {
  constructor(public rows: User[]) {}

  async findOne({ where }: { where: Record<string, any> }) {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async save(row: User) {
    return row;
  }

  async update(criteria: Record<string, any>, patch: Partial<User>) {
    for (const row of this.rows.filter((r) => matches(r, criteria))) {
      Object.assign(row, patch);
    }
    return { affected: 1 };
  }
}

class FakeBusinessProfileRepository {
  rows: BusinessProfile[] = [];
  private seq = 0;

  /** Set to make the next save fail the way a unique index does. */
  uniqueViolationOnNextSave = false;

  create(data: Partial<BusinessProfile>) {
    return { ...data } as BusinessProfile;
  }

  async findOne({ where }: { where: Record<string, any> }) {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async save(row: BusinessProfile) {
    if (this.uniqueViolationOnNextSave) {
      this.uniqueViolationOnNextSave = false;
      const error = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (error as QueryFailedError & { code?: string }).code = '23505';
      throw error;
    }
    if (!row.id) {
      this.seq += 1;
      row.id = `bp-${this.seq}`;
      this.rows.push(row);
    }
    return row;
  }
}

/**
 * Just enough EntityManager for the upgrade transaction, backed by the same
 * in-memory rows so the transaction and the repositories cannot disagree.
 */
function makeDataSource(
  users: FakeUserRepository,
  profiles: FakeBusinessProfileRepository,
) {
  const repoFor = (entity: unknown) =>
    entity === User ? users : profiles;

  const manager = {
    findOne: (entity: unknown, options: any) =>
      (repoFor(entity) as any).findOne(options),
    create: (entity: unknown, data: any) =>
      entity === User ? ({ ...data } as User) : profiles.create(data),
    save: (entity: unknown, row: any) => (repoFor(entity) as any).save(row),
    update: (entity: unknown, criteria: any, patch: any) =>
      (repoFor(entity) as any).update(criteria, patch),
  };

  return {
    transaction: async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
  };
}

function makeService(rows: User[]) {
  const users = new FakeUserRepository(rows);
  const profiles = new FakeBusinessProfileRepository();
  const dataSource = makeDataSource(users, profiles);

  // findById also asks for relations; wire the profile in by hand.
  const originalFindOne = users.findOne.bind(users);
  users.findOne = async (options: any) => {
    const user = await originalFindOne(options);
    if (!user) return null;
    (user as any).businessProfile =
      profiles.rows.find((p) => p.userId === user.id) ?? null;
    return user;
  };

  const legalService = {
    recordAcceptanceFor: jest.fn().mockResolvedValue(undefined),
  };

  const service = new UsersService(
    users as any,
    profiles as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any, // emailService
    legalService as any,
    dataSource as any,
  );

  return { service, users, profiles, legalService };
}

describe('UsersService — account type switching', () => {
  describe('upgradeToBusiness', () => {
    it('stores the company details and flips the role', async () => {
      const { service, profiles } = makeService([makeUser()]);

      const updated = await service.upgradeToBusiness(USER_ID, dto());

      expect(updated.role).toBe(UserRole.BUSINESS);
      expect(profiles.rows).toHaveLength(1);
      expect(profiles.rows[0]).toMatchObject({
        userId: USER_ID,
        companyName: 'Rossi S.r.l.',
        partitaIva: '12345678901',
        jobRole: 'CEO / Founder',
      });
    });

    it('is idempotent — a resubmission updates rather than duplicates', async () => {
      const { service, profiles } = makeService([makeUser()]);

      await service.upgradeToBusiness(USER_ID, dto());
      const updated = await service.upgradeToBusiness(
        USER_ID,
        dto({ companyName: 'Rossi Costruzioni S.r.l.' }),
      );

      expect(updated.role).toBe(UserRole.BUSINESS);
      expect(profiles.rows).toHaveLength(1);
      expect(profiles.rows[0].companyName).toBe('Rossi Costruzioni S.r.l.');
    });

    it('keeps a job role that a later submission omits', async () => {
      const { service, profiles } = makeService([makeUser()]);

      await service.upgradeToBusiness(USER_ID, dto());
      await service.upgradeToBusiness(USER_ID, dto({ jobRole: undefined }));

      expect(profiles.rows[0].jobRole).toBe('CEO / Founder');
    });

    it('rejects a Partita IVA that belongs to another account', async () => {
      const { service, profiles } = makeService([
        makeUser(),
        makeUser({ id: OTHER_ID, email: 'other@email.com' }),
      ]);
      await service.upgradeToBusiness(OTHER_ID, dto());
      expect(profiles.rows).toHaveLength(1);

      await expect(service.upgradeToBusiness(USER_ID, dto())).rejects.toThrow(
        ConflictException,
      );
      expect(profiles.rows).toHaveLength(1);
    });

    it('does not let a user be blocked by their own Partita IVA', async () => {
      const { service } = makeService([makeUser()]);

      await service.upgradeToBusiness(USER_ID, dto());
      await service.switchToPersonal(USER_ID);
      const back = await service.upgradeToBusiness(USER_ID, dto());

      expect(back.role).toBe(UserRole.BUSINESS);
    });

    it('turns a lost unique-index race into a conflict, not a 500', async () => {
      const { service, profiles } = makeService([makeUser()]);
      profiles.uniqueViolationOnNextSave = true;

      await expect(service.upgradeToBusiness(USER_ID, dto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses administrator accounts', async () => {
      const { service } = makeService([makeUser({ role: UserRole.ADMIN })]);

      await expect(service.upgradeToBusiness(USER_ID, dto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reports an unknown user', async () => {
      const { service } = makeService([]);

      await expect(service.upgradeToBusiness(USER_ID, dto())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('switchToPersonal', () => {
    it('flips the role back but keeps the company on file', async () => {
      const { service, profiles } = makeService([makeUser()]);
      await service.upgradeToBusiness(USER_ID, dto());

      const updated = await service.switchToPersonal(USER_ID);

      expect(updated.role).toBe(UserRole.PERSONAL);
      // Kept on purpose: re-upgrading needs no re-entry, and cases opened as a
      // business keep the company they were opened under.
      expect(profiles.rows).toHaveLength(1);
      expect(profiles.rows[0].companyName).toBe('Rossi S.r.l.');
    });

    it('is idempotent for an account that is already personal', async () => {
      const { service } = makeService([makeUser()]);

      const updated = await service.switchToPersonal(USER_ID);

      expect(updated.role).toBe(UserRole.PERSONAL);
    });

    it('refuses administrator accounts', async () => {
      const { service } = makeService([makeUser({ role: UserRole.ADMIN })]);

      await expect(service.switchToPersonal(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

describe('UsersService — company details on the own-profile update', () => {
  /**
   * `updateProfile` used to leave companyName and partitaIva out of the fields
   * it copied across, so the app could PATCH them, receive a 200, and see
   * nothing change.
   */
  it('persists companyName and partitaIva', async () => {
    const { service, profiles } = makeService([makeUser()]);
    await service.upgradeToBusiness(USER_ID, dto());

    const updated = await service.updateProfile(USER_ID, {
      firstName: 'Mario',
      companyName: 'Rossi Costruzioni S.r.l.',
      partitaIva: '98765432101',
    } as any);

    expect(updated.role).toBe(UserRole.BUSINESS);
    expect(profiles.rows[0].companyName).toBe('Rossi Costruzioni S.r.l.');
    expect(profiles.rows[0].partitaIva).toBe('98765432101');
  });

  it('rejects a Partita IVA held by another account and changes nothing', async () => {
    const { service, profiles } = makeService([
      makeUser(),
      makeUser({ id: OTHER_ID, email: 'other@email.com' }),
    ]);
    await service.upgradeToBusiness(OTHER_ID, dto());
    await service.upgradeToBusiness(
      USER_ID,
      dto({ partitaIva: '98765432101' }),
    );

    await expect(
      service.updateProfile(USER_ID, { partitaIva: '12345678901' } as any),
    ).rejects.toThrow(ConflictException);

    const mine = profiles.rows.find((r) => r.userId === USER_ID)!;
    expect(mine.partitaIva).toBe('98765432101');
  });

  it('creates the company row for a business account that has none', async () => {
    // Reachable through an admin setting the role by hand, and through the
    // accounts the old non-transactional registration left behind.
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    expect(profiles.rows).toHaveLength(0);

    await service.updateProfile(USER_ID, {
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678901',
    } as any);

    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]).toMatchObject({
      userId: USER_ID,
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678901',
    });
  });

  it('says so rather than silently dropping a half-filled company row', async () => {
    const { service } = makeService([makeUser({ role: UserRole.BUSINESS })]);

    await expect(
      service.updateProfile(USER_ID, { companyName: 'Rossi S.r.l.' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('ignores company fields on a personal account', async () => {
    const { service, profiles } = makeService([makeUser()]);

    const updated = await service.updateProfile(USER_ID, {
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678901',
    } as any);

    expect(updated.role).toBe(UserRole.PERSONAL);
    expect(profiles.rows).toHaveLength(0);
  });
});
