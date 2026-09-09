import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';

/**
 * Covers the account and company writes against in-memory repositories.
 *
 * An account's type is settled at registration and no caller can change their
 * own, so most of what is pinned here touches the company row while the role
 * stays put: the own-profile update has to persist the company details, has to
 * refuse a Partita IVA another account already holds, and an admin opening an
 * account by hand has to land the account and its company together or not at
 * all.
 *
 * An *admin* can still correct a type that was picked wrongly, and the last
 * block covers what has to move with it — a company row that outlives the role
 * is invisible while its VAT goes on holding the unique index.
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

/**
 * The error a unique index raises, carrying the `detail` string Postgres puts
 * on it — that string is how the service tells which column was hit.
 */
function uniqueViolation(constraint: string): QueryFailedError {
  const driverError = Object.assign(new Error('duplicate key'), {
    detail: `Key (${constraint})=(...) already exists.`,
  });
  const error = new QueryFailedError('INSERT', [], driverError);
  (error as QueryFailedError & { code?: string }).code = '23505';
  return error;
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

  private seq = 0;

  /** Set to make the next save fail the way the unique email index does. */
  uniqueViolationOnNextSave = false;

  create(data: Partial<User>) {
    return { ...data } as User;
  }

  /** `findByEmail` resolves the account through a query builder. */
  createQueryBuilder() {
    let wanted = '';
    const qb: any = {
      leftJoinAndSelect: () => qb,
      where: (_condition: string, params: { email: string }) => {
        wanted = params.email.trim().toLowerCase();
        return qb;
      },
      getOne: async () =>
        this.rows.find((r) => r.email?.toLowerCase() === wanted) ?? null,
    };
    return qb;
  }

  async findOne({ where }: { where: Record<string, any> }) {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async save(row: User) {
    if (this.uniqueViolationOnNextSave) {
      this.uniqueViolationOnNextSave = false;
      throw uniqueViolation('users_email_key');
    }
    if (!row.id) {
      this.seq += 1;
      row.id = `u-${this.seq}`;
      this.rows.push(row);
    }
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

  async delete(criteria: Record<string, any>) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, criteria));
    return { affected: before - this.rows.length };
  }

  async save(row: BusinessProfile) {
    if (this.uniqueViolationOnNextSave) {
      this.uniqueViolationOnNextSave = false;
      throw uniqueViolation('partita_iva');
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
 * Just enough EntityManager for the transactional writes, backed by the same
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
    delete: (entity: unknown, criteria: any) =>
      (repoFor(entity) as any).delete(criteria),
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

  const service = new UsersService(
    users as any,
    profiles as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any, // emailService
    dataSource as any,
  );

  return { service, users, profiles };
}

/**
 * The company row a business registration writes alongside the account. Pushed
 * straight into the fake repository rather than through the service, which only
 * ever writes one as part of a registration or an admin's own edit.
 */
function seedCompany(
  profiles: FakeBusinessProfileRepository,
  overrides: Partial<BusinessProfile> = {},
): BusinessProfile {
  const row = {
    id: `bp-seed-${profiles.rows.length + 1}`,
    userId: USER_ID,
    companyName: 'Rossi S.r.l.',
    partitaIva: '12345678901',
    jobRole: 'CEO / Founder',
    ...overrides,
  } as BusinessProfile;
  profiles.rows.push(row);
  return row;
}

describe('UsersService — company details on the own-profile update', () => {
  /**
   * `updateProfile` used to leave companyName and partitaIva out of the fields
   * it copied across, so the app could PATCH them, receive a 200, and see
   * nothing change.
   */
  it('persists companyName and partitaIva', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles);

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
      makeUser({ role: UserRole.BUSINESS }),
      makeUser({
        id: OTHER_ID,
        email: 'other@email.com',
        role: UserRole.BUSINESS,
      }),
    ]);
    seedCompany(profiles, { userId: OTHER_ID, partitaIva: '12345678901' });
    seedCompany(profiles, { partitaIva: '98765432101' });

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

  it('ignores a company name on a personal account', async () => {
    const { service, profiles } = makeService([makeUser()]);

    const updated = await service.updateProfile(USER_ID, {
      companyName: 'Rossi S.r.l.',
    } as any);

    expect(updated.role).toBe(UserRole.PERSONAL);
    expect(profiles.rows).toHaveLength(0);
  });

  /**
   * One account, one tax identifier. A private customer is identified by their
   * Codice Fiscale and a company by its Partita IVA, so the VAT number is
   * refused here by name rather than quietly dropped: a save that reports
   * success and stores nothing is how a customer ends up at the switch request
   * form wondering where the number they typed went.
   */
  it('refuses a Partita IVA on a personal account', async () => {
    const { service, profiles } = makeService([makeUser()]);

    await expect(
      service.updateProfile(USER_ID, { partitaIva: '12345678903' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(profiles.rows).toHaveLength(0);
  });

  it('refuses a Codice Fiscale on a business account', async () => {
    const { service, users } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);

    await expect(
      service.updateProfile(USER_ID, {
        codiceFiscale: 'RSSMRA85T10A562S',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(users.rows[0].codiceFiscale).toBeFalsy();
  });

  /**
   * The account type is chosen at registration and is fixed for the life of
   * the account — the business rule the app is built around. Nothing a user
   * sends about their own role may move it, in either direction, whatever
   * company details ride along with the request.
   */
  it('ignores role on a personal account, company details and all', async () => {
    const { service, users, profiles } = makeService([makeUser()]);

    // No VAT number in the payload: an account that is still personal is
    // refused one outright, and what this test is about is the role staying put.
    const updated = await service.updateProfile(USER_ID, {
      role: UserRole.BUSINESS,
      companyName: 'Rossi S.r.l.',
    } as any);

    expect(updated.role).toBe(UserRole.PERSONAL);
    expect(users.rows[0].role).toBe(UserRole.PERSONAL);
    expect(profiles.rows).toHaveLength(0);
  });

  it('ignores role on a business account too', async () => {
    const { service, users, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles);

    const updated = await service.updateProfile(USER_ID, {
      role: UserRole.PERSONAL,
    } as any);

    expect(updated.role).toBe(UserRole.BUSINESS);
    expect(users.rows[0].role).toBe(UserRole.BUSINESS);
    // And the company row it identifies is still there.
    expect(profiles.rows).toHaveLength(1);
  });
});

/**
 * The customer an admin opens by hand from Client Management.
 *
 * What is pinned here is what the path quietly lacked: the account and the
 * company row have to land together or not at all, a Partita IVA another
 * company already holds has to be refused before anything is written, and a job
 * role the admin typed has to survive the save.
 */
describe('UsersService — customers created by an admin', () => {
  function createDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      email: 'luigi.verdi@email.com',
      password: 'StrongP@ss1',
      firstName: 'Luigi',
      lastName: 'Verdi',
      role: UserRole.PERSONAL,
      ...overrides,
    } as CreateUserDto;
  }

  function businessDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return createDto({
      role: UserRole.BUSINESS,
      companyName: 'Verdi S.r.l.',
      partitaIva: '12345678903',
      jobRole: 'CEO / Founder',
      ...overrides,
    });
  }

  it('opens a personal account, active and pre-verified, with no company row', async () => {
    const { service, users, profiles } = makeService([]);

    const created = await service.adminCreateUser(createDto());

    expect(created.role).toBe(UserRole.PERSONAL);
    expect(created.status).toBe(UserStatus.ACTIVE);
    expect(created.emailVerified).toBe(true);
    expect(users.rows).toHaveLength(1);
    expect(profiles.rows).toHaveLength(0);
  });

  it('writes the company row with the account, job role included', async () => {
    // `jobRole` reaches the DTO and every other path that touches the company
    // row stores it; this one used to drop it on the floor.
    const { service, profiles } = makeService([]);

    const created = await service.adminCreateUser(businessDto());

    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]).toMatchObject({
      userId: created.id,
      companyName: 'Verdi S.r.l.',
      partitaIva: '12345678903',
      jobRole: 'CEO / Founder',
    });
  });

  it('refuses an email that is already registered', async () => {
    const { service, users } = makeService([makeUser()]);

    await expect(
      service.adminCreateUser(createDto({ email: 'mario.rossi@email.com' })),
    ).rejects.toThrow(ConflictException);
    expect(users.rows).toHaveLength(1);
  });

  it('leaves no account behind when the Partita IVA belongs to someone else', async () => {
    // The reason the check comes first. The account row used to be committed
    // before the company row was even attempted, so a VAT that was already
    // taken left a business account with no company, on an email that was now
    // taken too and could never be entered again.
    const { service, users, profiles } = makeService([
      makeUser({ id: OTHER_ID, email: 'other@email.com' }),
    ]);
    profiles.rows.push({
      id: 'bp-existing',
      userId: OTHER_ID,
      partitaIva: '12345678903',
    } as BusinessProfile);

    await expect(service.adminCreateUser(businessDto())).rejects.toThrow(
      ConflictException,
    );
    expect(users.rows).toHaveLength(1);
  });

  it('turns a lost unique-index race into a conflict, not a 500', async () => {
    const { service, profiles } = makeService([]);
    profiles.uniqueViolationOnNextSave = true;

    await expect(service.adminCreateUser(businessDto())).rejects.toThrow(
      /Partita IVA is already registered/,
    );
  });

  it('names the email when that is the column the race was lost on', async () => {
    const { service, users } = makeService([]);
    users.uniqueViolationOnNextSave = true;

    await expect(service.adminCreateUser(createDto())).rejects.toThrow(
      /Email already registered/,
    );
  });
});

describe('UsersService — an admin moving an account between the two types', () => {
  /**
   * Left behind, the company row was invisible: nothing reads `businessProfile`
   * on a personal account. Its Partita IVA went on holding the unique index all
   * the same, so the company that actually owns that VAT could never register
   * it — a failure with no symptom at the account it was stranded on and no
   * explanation at the one it blocked.
   */
  it('drops the company row when a business becomes personal', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles, { partitaIva: '12345678903' });

    const updated = await service.adminUpdateUser(USER_ID, {
      role: UserRole.PERSONAL,
    } as any);

    expect(updated.role).toBe(UserRole.PERSONAL);
    expect(profiles.rows).toHaveLength(0);
  });

  it('frees the Partita IVA for the company that actually holds it', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
      makeUser({ id: OTHER_ID, email: 'other@business.it', role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles, { partitaIva: '12345678903' });

    await service.adminUpdateUser(USER_ID, { role: UserRole.PERSONAL } as any);

    // Would have been a 409 while the stranded row still held the number.
    await expect(
      service.adminUpdateUser(OTHER_ID, {
        companyName: 'Rossi S.r.l.',
        partitaIva: '12345678903',
      } as any),
    ).resolves.toMatchObject({ id: OTHER_ID });
  });

  /**
   * `UpdateUserDto` is a PartialType, so the `ValidateIf` that makes these two
   * required on create never fires for a field the request simply omits. A bare
   * `PATCH { role: 'business' }` therefore used to produce a business account
   * with no company at all — invisible until the switch flow went looking for a
   * Partita IVA and found none.
   */
  it('refuses to make an account a business with nothing to identify it', async () => {
    const { service, profiles } = makeService([makeUser()]);

    await expect(
      service.adminUpdateUser(USER_ID, { role: UserRole.BUSINESS } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profiles.rows).toHaveLength(0);
  });

  it('leaves the account personal when it refuses', async () => {
    const { service, users } = makeService([makeUser()]);

    await expect(
      service.adminUpdateUser(USER_ID, {
        role: UserRole.BUSINESS,
        companyName: 'Rossi S.r.l.',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.rows[0].role).toBe(UserRole.PERSONAL);
  });

  it('promotes an account that brings both, writing the company row', async () => {
    const { service, profiles } = makeService([makeUser()]);

    await service.adminUpdateUser(USER_ID, {
      role: UserRole.BUSINESS,
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678903',
      pecEmail: 'rossi@pec.it',
    } as any);

    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]).toMatchObject({
      userId: USER_ID,
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678903',
      pecEmail: 'rossi@pec.it',
    });
  });

  /**
   * The customer form sends `role` on every save, so an edit that changes a
   * phone number arrives carrying the type the account already is. That must
   * not read as a change and must not disturb the company row.
   */
  it('leaves the company row alone when the role is merely restated', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    const company = seedCompany(profiles, { partitaIva: '12345678903' });

    await service.adminUpdateUser(USER_ID, {
      role: UserRole.BUSINESS,
      phone: '+393331234567',
    } as any);

    expect(profiles.rows).toEqual([company]);
  });

  /** Null and the empty string both mean "there is none", not "leave it". */
  it('clears a PEC an admin has emptied', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles, { pecEmail: 'old@pec.it' });

    await service.adminUpdateUser(USER_ID, {
      pecEmail: '',
    } as any);

    expect(profiles.rows[0].pecEmail).toBeNull();
  });
});
