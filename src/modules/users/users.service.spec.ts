import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';
import { AddressType } from '../../common/enums/address.enum';

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

class FakeAddressRepository {
  rows: UserAddress[] = [];
  private seq = 0;

  create(data: Partial<UserAddress>) {
    return { ...data } as UserAddress;
  }

  async findOne({ where }: { where: Record<string, any> }) {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async delete(criteria: Record<string, any>) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, criteria));
    return { affected: before - this.rows.length };
  }

  async update(criteria: Record<string, any>, patch: Partial<UserAddress>) {
    const hit = this.rows.filter((r) => matches(r, criteria));
    for (const row of hit) Object.assign(row, patch);
    return { affected: hit.length };
  }

  // Replaces by id rather than only inserting: the service upserts an address
  // by saving a copy of the row it read back, so a fake that ignored a save
  // carrying an id would report every edit as a no-op.
  async save(row: UserAddress) {
    if (!row.id) {
      this.seq += 1;
      row.id = `ua-${this.seq}`;
      this.rows.push(row);
      return row;
    }
    const at = this.rows.findIndex((r) => r.id === row.id);
    if (at >= 0) this.rows[at] = { ...this.rows[at], ...row };
    else this.rows.push(row);
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
  addresses: FakeAddressRepository,
) {
  const repoFor = (entity: unknown) => {
    if (entity === User) return users;
    if (entity === UserAddress) return addresses;
    return profiles;
  };

  const manager = {
    findOne: (entity: unknown, options: any) =>
      (repoFor(entity) as any).findOne(options),
    create: (entity: unknown, data: any) =>
      entity === User
        ? ({ ...data } as User)
        : (repoFor(entity) as any).create(data),
    save: (entity: unknown, row: any) => (repoFor(entity) as any).save(row),
    update: (entity: unknown, criteria: any, patch: any) =>
      (repoFor(entity) as any).update(criteria, patch),
    delete: (entity: unknown, criteria: any) =>
      (repoFor(entity) as any).delete(criteria),
  };

  return {
    transaction: async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
    // The non-transactional writes reach for `dataSource.manager` — the own
    // profile update writes its address through it — and it is the same manager
    // over the same rows, so both routes are pinned against one set of fakes.
    manager,
  };
}

function makeService(rows: User[]) {
  const users = new FakeUserRepository(rows);
  const profiles = new FakeBusinessProfileRepository();
  const addresses = new FakeAddressRepository();
  const dataSource = makeDataSource(users, profiles, addresses);

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

  return { service, users, profiles, addresses };
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

describe('UsersService — an account type never changes', () => {
  /**
   * The account type is settled when the account is opened and stays settled.
   * It decides which tax identifier the account carries, which address type its
   * own address is filed under, and which tariffs may be sent to it — so moving
   * it underneath a live account silently invalidated all three at once. There
   * is no route that does it any more, for an admin no more than the customer.
   *
   * `role` is off `UpdateUserDto`, and the global pipe runs with
   * `forbidNonWhitelisted`, so a request carrying one never reaches the service.
   * These call the service directly, past the pipe, which is the only way the
   * old behaviour could still be reached.
   */
  it('leaves a business account a business, whatever the payload asks for', async () => {
    const { service, users } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);

    const updated = await service.adminUpdateUser(USER_ID, {
      role: UserRole.PERSONAL,
      phone: '+393331234567',
    } as any);

    expect(updated.role).toBe(UserRole.BUSINESS);
    expect(users.rows[0].role).toBe(UserRole.BUSINESS);
    // The rest of the save still lands: the role is dropped, not the request.
    expect(users.rows[0].phone).toBe('+393331234567');
  });

  it('leaves a personal account personal, whatever the payload asks for', async () => {
    const { service, users } = makeService([makeUser()]);

    const updated = await service.adminUpdateUser(USER_ID, {
      role: UserRole.BUSINESS,
      phone: '+393331234567',
    } as any);

    expect(updated.role).toBe(UserRole.PERSONAL);
    expect(users.rows[0].role).toBe(UserRole.PERSONAL);
  });

  /**
   * The company row used to be dropped when a business was made personal. With
   * the role pinned there is nothing to drop, and the row has to survive a save
   * that asks for the switch — losing it would strand the account's Partita IVA
   * and take its VAT number out of the switch flow.
   */
  it('keeps the company row when a payload asks to make a business personal', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    const company = seedCompany(profiles, { partitaIva: '12345678903' });

    await service.adminUpdateUser(USER_ID, {
      role: UserRole.PERSONAL,
    } as any);

    expect(profiles.rows).toEqual([company]);
  });

  /**
   * Company details name something a personal account cannot hold. Written,
   * they would have produced the company row that the removed role switch used
   * to create; ignored, they would be a 200 that saved none of what was typed.
   */
  it('refuses company details on a personal account rather than opening a company', async () => {
    const { service, profiles } = makeService([makeUser()]);

    await expect(
      service.adminUpdateUser(USER_ID, {
        companyName: 'Rossi S.r.l.',
        partitaIva: '12345678903',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profiles.rows).toHaveLength(0);
  });

  it('refuses a PEC on a personal account too', async () => {
    const { service } = makeService([makeUser()]);

    await expect(
      service.adminUpdateUser(USER_ID, { pecEmail: 'rossi@pec.it' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still corrects the company details of an account that is a business', async () => {
    const { service, profiles } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles, { companyName: 'Old S.r.l.', partitaIva: '12345678903' });

    await service.adminUpdateUser(USER_ID, {
      companyName: 'Rossi S.r.l.',
      pecEmail: 'rossi@pec.it',
    } as any);

    expect(profiles.rows[0]).toMatchObject({
      companyName: 'Rossi S.r.l.',
      pecEmail: 'rossi@pec.it',
    });
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


/**
 * A person has a residence; a company has a registered office — a sede legale —
 * and no residence at all. The two live in the same table and the same columns,
 * so `addressType` is the *only* thing that tells them apart: once a company's
 * address is filed as `residential`, nothing downstream can recover the fact
 * that it is a legal seat rather than somebody's home.
 *
 * That makes the type an invariant rather than a default. These cover the two
 * ways it used to break: an explicit type sent against the wrong role, and a
 * role changed underneath an address that was already right for the old one.
 */
describe('UsersService — the account address follows the account type', () => {
  const address = {
    streetAddress: 'Via Po 22',
    city: 'Torino',
    postalCode: '10123',
  };

  function creationDto(overrides: Record<string, any> = {}): any {
    return {
      email: 'nuovo@email.com',
      password: 'Password1!',
      firstName: 'Giuseppe',
      lastName: 'Verdi',
      role: UserRole.PERSONAL,
      address,
      ...overrides,
    };
  }

  it('files a business account address as its registered office', async () => {
    const { service, addresses } = makeService([]);

    await service.adminCreateUser(
      creationDto({
        role: UserRole.BUSINESS,
        companyName: 'Verdi S.r.l.',
        partitaIva: '12345678901',
      }),
    );

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0].addressType).toBe(AddressType.LEGAL);
  });

  it('files a personal account address as a residence', async () => {
    const { service, addresses } = makeService([]);

    await service.adminCreateUser(creationDto());

    expect(addresses.rows[0].addressType).toBe(AddressType.RESIDENTIAL);
  });

  /**
   * The default was never the whole rule. `addressType` is an accepted field,
   * so a request naming `residential` on a company was written verbatim — and
   * silently, which is the worst part: the row looked deliberate.
   */
  it('refuses a residence on a business account', async () => {
    const { service, addresses } = makeService([]);

    await expect(
      service.adminCreateUser(
        creationDto({
          role: UserRole.BUSINESS,
          companyName: 'Verdi S.r.l.',
          partitaIva: '12345678901',
          address: { ...address, addressType: AddressType.RESIDENTIAL },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addresses.rows).toHaveLength(0);
  });

  it('refuses a registered office on a personal account', async () => {
    const { service, addresses } = makeService([]);

    await expect(
      service.adminCreateUser(
        creationDto({ address: { ...address, addressType: AddressType.LEGAL } }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addresses.rows).toHaveLength(0);
  });

  /** Naming the type the role does call for is simply accepted. */
  it('accepts the type the role calls for, stated explicitly', async () => {
    const { service, addresses } = makeService([]);

    await service.adminCreateUser(
      creationDto({
        role: UserRole.BUSINESS,
        companyName: 'Verdi S.r.l.',
        partitaIva: '12345678901',
        address: { ...address, addressType: AddressType.LEGAL },
      }),
    );

    expect(addresses.rows[0].addressType).toBe(AddressType.LEGAL);
  });

  /**
   * Seeds an address of a given type directly, the way registration leaves one
   * behind before an admin comes along and corrects the account type.
   */
  function seedAddress(
    addresses: FakeAddressRepository,
    addressType: AddressType,
  ): UserAddress {
    const row = {
      id: `ua-seed-${addresses.rows.length + 1}`,
      userId: USER_ID,
      addressType,
      streetAddress: 'Via Roma 42',
      city: 'Roma',
      postalCode: '00185',
      country: 'IT',
      isPrimary: true,
    } as UserAddress;
    addresses.rows.push(row);
    return row;
  }

  /**
   * The type used to be rewritten when an admin moved an account between the
   * two. Nothing moves an account any more, so the type an address was filed
   * under at registration is the type it keeps — a save that asks for the other
   * role changes neither the account nor its address.
   */
  it('leaves a residence a residence when a payload asks for a business', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.adminUpdateUser(USER_ID, {
      role: UserRole.BUSINESS,
      firstName: 'Marco',
    } as any);

    expect(addresses.rows[0].addressType).toBe(AddressType.RESIDENTIAL);
  });

  it('leaves a registered office a registered office', async () => {
    const { service, profiles, addresses } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles);
    seedAddress(addresses, AddressType.LEGAL);

    await service.adminUpdateUser(USER_ID, { role: UserRole.PERSONAL } as any);

    expect(addresses.rows[0].addressType).toBe(AddressType.LEGAL);
  });

  /**
   * Where the energy arrives and where the invoice is posted are statements
   * about places, not about who the holder is, and were never retyped. They
   * stay untouched here for the same reason everything else does.
   */
  it('leaves supply and billing addresses alone', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);
    seedAddress(addresses, AddressType.SUPPLY);
    seedAddress(addresses, AddressType.BILLING);

    await service.adminUpdateUser(USER_ID, { firstName: 'Marco' } as any);

    expect(addresses.rows.map((r) => r.addressType)).toEqual([
      AddressType.RESIDENTIAL,
      AddressType.SUPPLY,
      AddressType.BILLING,
    ]);
  });


  it('leaves the address type alone on an edit that keeps the role', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.adminUpdateUser(USER_ID, {
      firstName: 'Marco',
      role: UserRole.PERSONAL,
    } as any);

    expect(addresses.rows[0].addressType).toBe(AddressType.RESIDENTIAL);
  });
});

/**
 * `UpdateUserDto` inherits `address` from the create DTO, so both PATCH routes
 * accepted an address, validated it, and returned 200 — while the value landed
 * on a property with no column behind it and vanished on save. An admin fixing
 * a customer's address watched it save and revert.
 */
describe('UsersService — an address sent to the update routes', () => {
  const address = {
    streetAddress: 'Via Nuova 9',
    city: 'Bologna',
    postalCode: '40121',
    province: 'BO',
  };

  function seedAddress(
    addresses: FakeAddressRepository,
    addressType: AddressType,
    overrides: Partial<UserAddress> = {},
  ): UserAddress {
    const row = {
      id: `ua-seed-${addresses.rows.length + 1}`,
      userId: USER_ID,
      addressType,
      streetAddress: 'Via Roma 42',
      city: 'Roma',
      postalCode: '00185',
      country: 'IT',
      isPrimary: true,
      ...overrides,
    } as UserAddress;
    addresses.rows.push(row);
    return row;
  }

  it('replaces the residence an admin has corrected', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.adminUpdateUser(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0]).toMatchObject({
      streetAddress: 'Via Nuova 9',
      city: 'Bologna',
      postalCode: '40121',
      province: 'BO',
      addressType: AddressType.RESIDENTIAL,
    });
  });

  it('writes a first address for an account that had none', async () => {
    const { service, addresses } = makeService([makeUser()]);

    await service.adminUpdateUser(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0]).toMatchObject({
      userId: USER_ID,
      streetAddress: 'Via Nuova 9',
      addressType: AddressType.RESIDENTIAL,
      isPrimary: true,
    });
  });

  it('files it as the registered office on a business account', async () => {
    const { service, profiles, addresses } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles);
    seedAddress(addresses, AddressType.LEGAL);

    await service.adminUpdateUser(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0]).toMatchObject({
      streetAddress: 'Via Nuova 9',
      addressType: AddressType.LEGAL,
    });
  });

  /** The invariant holds on this door too, not only on create. */
  it('refuses a residence sent to a business account', async () => {
    const { service, profiles, addresses } = makeService([
      makeUser({ role: UserRole.BUSINESS }),
    ]);
    seedCompany(profiles);

    await expect(
      service.adminUpdateUser(USER_ID, {
        address: { ...address, addressType: AddressType.RESIDENTIAL },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addresses.rows).toHaveLength(0);
  });

  /**
   * The row is matched on its type, not on the primary flag: an account can
   * hold a supply address flagged primary, and matching on the flag would have
   * let an edited residence overwrite a supply point.
   */
  it('leaves a supply address alone when the residence is corrected', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL, { isPrimary: false });
    const supply = seedAddress(addresses, AddressType.SUPPLY, {
      streetAddress: 'Via Milano 15',
      isPrimary: true,
    });

    await service.adminUpdateUser(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(2);
    expect(addresses.rows[0]).toMatchObject({
      streetAddress: 'Via Nuova 9',
      // Not promoted: correcting a street name says nothing about which
      // address is the primary one.
      isPrimary: false,
    });
    expect(addresses.rows[1]).toEqual(supply);
  });

  /**
   * The address used to be written after a role retype, so that the two could
   * not both land under the same type. With the role pinned there is no retype
   * to sequence against: the row replaces the one of the account's own type and
   * the account is left holding exactly one.
   */
  it('replaces the account address rather than adding a second', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.adminUpdateUser(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0]).toMatchObject({
      streetAddress: 'Via Nuova 9',
      addressType: AddressType.RESIDENTIAL,
    });
  });


  it('leaves the address alone on a save that does not carry one', async () => {
    const { service, addresses } = makeService([makeUser()]);
    const before = seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.adminUpdateUser(USER_ID, { firstName: 'Marco' } as any);

    expect(addresses.rows).toEqual([before]);
  });

  it('writes an address a customer sends to their own profile', async () => {
    const { service, addresses } = makeService([makeUser()]);
    seedAddress(addresses, AddressType.RESIDENTIAL);

    await service.updateProfile(USER_ID, { address } as any);

    expect(addresses.rows).toHaveLength(1);
    expect(addresses.rows[0]).toMatchObject({
      streetAddress: 'Via Nuova 9',
      addressType: AddressType.RESIDENTIAL,
    });
  });

  /**
   * A customer cannot change their own account type, so the role the address is
   * filed against is always the stored one — a `legal` sent from the app is the
   * same mistake as one sent by an admin.
   */
  it('refuses a registered office sent to a personal profile', async () => {
    const { service, addresses } = makeService([makeUser()]);

    await expect(
      service.updateProfile(USER_ID, {
        address: { ...address, addressType: AddressType.LEGAL },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addresses.rows).toHaveLength(0);
  });
});
