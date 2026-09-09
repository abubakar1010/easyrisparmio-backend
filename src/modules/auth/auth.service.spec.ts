// AuthService only imports FirebaseService for its type, but loading it drags
// in firebase-admin, which reaches ESM-only `jose` and cannot be required under
// this Jest config. None of the paths under test touch it.
jest.mock('./firebase.service', () => ({ FirebaseService: class {} }));

import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ForgotPasswordDto } from './dto/reset-password.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/role.enum';
import { AuthProvider, OtpType, UserStatus } from '../../common/enums/user.enum';

/**
 * Covers the password-reset flow end to end against in-memory repositories.
 *
 * The behaviours pinned here are the ones a reader would otherwise be tempted
 * to "tidy up" back into the bugs they replaced: replies that stay identical
 * whether or not the address exists, a reset token that only works once, and a
 * mail failure that is reported rather than swallowed.
 */

const JWT_SECRET = 'test-secret';

type Row = OtpCode & { id: string };

class FakeOtpRepository {
  rows: Row[] = [];
  private seq = 0;

  private nextId() {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  private matches(row: Row, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, expected]) => {
      const actual = (row as any)[key];
      // MoreThan(date) arrives as a FindOperator; the only one used here.
      if (expected && typeof expected === 'object' && '_type' in expected) {
        return actual > (expected as any)._value;
      }
      return actual === expected;
    });
  }

  create(data: Partial<OtpCode>): Row {
    return { ...data } as Row;
  }

  async save(row: Row): Promise<Row> {
    if (!row.id) {
      row.id = this.nextId();
      row.createdAt = row.createdAt ?? new Date();
      row.attempts = row.attempts ?? 0;
      row.used = row.used ?? false;
      this.rows.push(row);
    }
    return row;
  }

  async findOne({
    where,
    order,
  }: {
    where: Record<string, any>;
    order?: { createdAt: 'ASC' | 'DESC' };
  }): Promise<Row | null> {
    const found = this.rows.filter((r) => this.matches(r, where));
    if (order?.createdAt === 'DESC') {
      found.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return found[0] ?? null;
  }

  async update(where: Record<string, any>, patch: Partial<OtpCode>) {
    this.rows
      .filter((r) => this.matches(r, where))
      .forEach((r) => Object.assign(r, patch));
  }

  async increment(where: Record<string, any>, field: string, by: number) {
    this.rows
      .filter((r) => this.matches(r, where))
      .forEach((r) => ((r as any)[field] += by));
  }

  async delete(where: Record<string, any>) {
    this.rows = this.rows.filter((r) => !this.matches(r, where));
  }
}

class FakeRefreshTokenRepository {
  rows: Array<Partial<RefreshToken>> = [];
  create(data: Partial<RefreshToken>) {
    return { ...data };
  }
  async save(row: Partial<RefreshToken>) {
    this.rows.push(row);
    return row;
  }
  async update(where: Record<string, any>, patch: Partial<RefreshToken>) {
    this.rows
      .filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      )
      .forEach((r) => Object.assign(r, patch));
  }
}

/** The UsersService mock, shared so tests can assert which loader was used. */
let usersServiceMock: Record<string, jest.Mock>;

describe('AuthService — password reset', () => {
  let service: AuthService;
  let otpRepository: FakeOtpRepository;
  let refreshTokenRepository: FakeRefreshTokenRepository;
  let jwtService: JwtService;
  let sendOtpEmail: jest.Mock;
  let users: Map<string, User>;

  const ACTIVE_EMAIL = 'mario.rossi@email.com';

  const makeUser = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: ACTIVE_EMAIL,
      passwordHash: bcrypt.hashSync('OldP@ssw0rd', 4),
      firstName: 'Mario',
      lastName: 'Rossi',
      role: UserRole.PERSONAL,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      ...over,
    }) as User;

  /** Reads back the code the service just mailed. */
  const mailedCode = (): string => sendOtpEmail.mock.calls.at(-1)![1];

  beforeEach(() => {
    otpRepository = new FakeOtpRepository();
    refreshTokenRepository = new FakeRefreshTokenRepository();
    jwtService = new JwtService({ secret: JWT_SECRET });
    sendOtpEmail = jest.fn().mockResolvedValue(undefined);

    users = new Map([['user-1', makeUser()]]);

    usersServiceMock = {
      findByEmail: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findById: jest.fn(async (id: string) => users.get(id) ?? null),
      // `passwordHash` is `select: false`, so the auth flows that compare a
      // password go through the explicit loaders. Same fixtures either way —
      // these mocks stand in for the query that names the column.
      findByEmailWithPassword: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findByIdWithPassword: jest.fn(async (id: string) => users.get(id) ?? null),
      update: jest.fn(async (id: string, patch: Partial<User>) => {
        const user = users.get(id)!;
        Object.assign(user, patch);
        return user;
      }),
    };

    service = new AuthService(
      refreshTokenRepository as any,
      otpRepository as any,
      {} as any, // businessProfileRepository — unused on these paths
      usersServiceMock as any,
      jwtService,
      { get: jest.fn(() => '7') } as any,
      {} as any, // firebaseService
      {} as any, // referralsService
      { sendOtpEmail } as any,
      {} as any, // legalService
      {} as any, // dataSource
    );
  });

  describe('forgotPassword', () => {
    it('answers identically for a registered, an unknown and a suspended address', async () => {
      users.set(
        'user-2',
        makeUser({ id: 'user-2', email: 'banned@email.com', status: UserStatus.SUSPENDED }),
      );

      const registered = await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);
      const unknown = await service.forgotPassword({ email: 'nobody@email.com' } as ForgotPasswordDto);
      const suspended = await service.forgotPassword({ email: 'banned@email.com' } as ForgotPasswordDto);

      expect(unknown).toEqual(registered);
      expect(suspended).toEqual(registered);
      // ...and only the real, active account was actually mailed.
      expect(sendOtpEmail).toHaveBeenCalledTimes(1);
      expect(sendOtpEmail.mock.calls[0][0]).toBe(ACTIVE_EMAIL);
    });

    it('does not mail the same account twice inside the cooldown, and still says nothing about it', async () => {
      const first = await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);
      const second = await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);

      expect(second).toEqual(first);
      expect(sendOtpEmail).toHaveBeenCalledTimes(1);
    });

    it('reports a mail transport failure instead of claiming a code was sent', async () => {
      sendOtpEmail.mockRejectedValueOnce(new Error('transport down'));

      await expect(
        service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // The dead code is gone, so the cooldown does not block the retry.
      expect(otpRepository.rows).toHaveLength(0);
      await expect(
        service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto),
      ).resolves.toBeDefined();
      expect(sendOtpEmail).toHaveBeenCalledTimes(2);
    });

    it('stores the code hashed, never in plaintext', async () => {
      await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);

      const [row] = otpRepository.rows;
      expect(row.codeHash).not.toBe(mailedCode());
      expect(await bcrypt.compare(mailedCode(), row.codeHash)).toBe(true);
    });
  });

  describe('verifyOtp', () => {
    beforeEach(async () => {
      await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);
    });

    it('exchanges a correct code for a reset token and spends the code', async () => {
      const result = await service.verifyOtp({
        email: ACTIVE_EMAIL,
        code: mailedCode(),
        type: OtpType.PASSWORD_RESET,
      });

      expect(result.resetToken).toEqual(expect.any(String));
      expect(otpRepository.rows[0].used).toBe(true);
    });

    it('gives the same error for a wrong code as for an address with no code pending', async () => {
      const failureOf = (dto: {
        email: string;
        code: string;
        type: OtpType;
      }) => service.verifyOtp(dto).then(() => null, (e: Error) => e.message);

      const wrongCode = await failureOf({
        email: ACTIVE_EMAIL,
        code: '000000',
        type: OtpType.PASSWORD_RESET,
      });
      const noSuchUser = await failureOf({
        email: 'nobody@email.com',
        code: '123456',
        type: OtpType.PASSWORD_RESET,
      });

      expect(wrongCode).toBe('Invalid or expired OTP code');
      expect(noSuchUser).toBe(wrongCode);
    });

    it('locks the code out after five wrong guesses, even if the sixth is right', async () => {
      const code = mailedCode();
      for (let i = 0; i < 5; i++) {
        await expect(
          service.verifyOtp({
            email: ACTIVE_EMAIL,
            code: '000000',
            type: OtpType.PASSWORD_RESET,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      await expect(
        service.verifyOtp({
          email: ACTIVE_EMAIL,
          code,
          type: OtpType.PASSWORD_RESET,
        }),
      ).rejects.toThrow('Too many failed attempts. Please request a new code.');
    });
  });

  describe('resetPassword', () => {
    let resetToken: string;

    beforeEach(async () => {
      await service.forgotPassword({ email: ACTIVE_EMAIL } as ForgotPasswordDto);
      refreshTokenRepository.rows.push({ userId: 'user-1', revoked: false });

      const verified = await service.verifyOtp({
        email: ACTIVE_EMAIL,
        code: mailedCode(),
        type: OtpType.PASSWORD_RESET,
      });
      resetToken = verified.resetToken!;
    });

    it('sets the new password and revokes every refresh token', async () => {
      await service.resetPassword({ resetToken, newPassword: 'BrandNewP@ss1' });

      const user = users.get('user-1')!;
      expect(await bcrypt.compare('BrandNewP@ss1', user.passwordHash!)).toBe(true);
      expect(refreshTokenRepository.rows.every((t) => t.revoked)).toBe(true);
    });

    it('refuses a second use of the same reset token', async () => {
      await service.resetPassword({ resetToken, newPassword: 'BrandNewP@ss1' });

      await expect(
        service.resetPassword({ resetToken, newPassword: 'AnotherP@ss2' }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('refuses a token that is not a reset token, however well signed', async () => {
      // Shape of an ordinary access token: same secret, same issuer, has a sub.
      const accessToken = jwtService.sign({
        sub: 'user-1',
        email: ACTIVE_EMAIL,
        role: UserRole.PERSONAL,
      });

      await expect(
        service.resetPassword({ resetToken: accessToken, newPassword: 'BrandNewP@ss1' }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('refuses a code already spent at verify-otp when replayed as email + code', async () => {
      await expect(
        service.resetPassword({
          email: ACTIVE_EMAIL,
          code: mailedCode(),
          newPassword: 'BrandNewP@ss1',
        }),
      ).rejects.toThrow('Invalid or expired OTP code');
    });

    it('rejects a new password identical to the current one', async () => {
      await expect(
        service.resetPassword({ resetToken, newPassword: 'OldP@ssw0rd' }),
      ).rejects.toThrow('New password must be different from your current password');
    });

    it('activates an account that never finished email verification', async () => {
      const user = users.get('user-1')!;
      user.status = UserStatus.PENDING_VERIFICATION;
      user.emailVerified = false;

      await service.resetPassword({ resetToken, newPassword: 'BrandNewP@ss1' });

      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.emailVerified).toBe(true);
    });
  });
});

/**
 * The last step of sign-up. The app goes straight from here to the home
 * screen, so verifying the address has to hand back a usable session: it used
 * to return a bare message, leaving the brand-new account on the home screen
 * with no token, where the first request 401'd and the interceptor bounced it
 * back out to the login screen. A business account never got as far as seeing
 * its company details.
 */
describe('AuthService — sign-up email verification', () => {
  let service: AuthService;
  let otpRepository: FakeOtpRepository;
  let refreshTokenRepository: FakeRefreshTokenRepository;
  let jwtService: JwtService;
  let sendOtpEmail: jest.Mock;
  let users: Map<string, User>;

  const EMAIL = 'azienda@email.com';

  const businessProfile = {
    id: 'bp-1',
    companyName: 'Rossi S.r.l.',
    partitaIva: '12345678901',
    jobRole: 'CEO / Founder',
  };

  const mailedCode = (): string => sendOtpEmail.mock.calls.at(-1)![1];

  beforeEach(() => {
    otpRepository = new FakeOtpRepository();
    refreshTokenRepository = new FakeRefreshTokenRepository();
    jwtService = new JwtService({ secret: JWT_SECRET });
    sendOtpEmail = jest.fn().mockResolvedValue(undefined);

    users = new Map([
      [
        'user-1',
        {
          id: 'user-1',
          email: EMAIL,
          passwordHash: bcrypt.hashSync('StrongP@ss1', 4),
          firstName: 'Mario',
          lastName: 'Rossi',
          role: UserRole.BUSINESS,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerified: false,
          businessProfile,
        } as unknown as User,
      ],
    ]);

    usersServiceMock = {
      findByEmail: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findById: jest.fn(async (id: string) => users.get(id) ?? null),
      // `passwordHash` is `select: false`, so the auth flows that compare a
      // password go through the explicit loaders. Same fixtures either way —
      // these mocks stand in for the query that names the column.
      findByEmailWithPassword: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findByIdWithPassword: jest.fn(async (id: string) => users.get(id) ?? null),
      update: jest.fn(async (id: string, patch: Partial<User>) => {
        const user = users.get(id)!;
        Object.assign(user, patch);
        return user;
      }),
    };

    service = new AuthService(
      refreshTokenRepository as any,
      otpRepository as any,
      {} as any,
      usersServiceMock as any,
      jwtService,
      { get: jest.fn(() => '7') } as any,
      {} as any,
      {} as any,
      { sendOtpEmail } as any,
      {} as any,
      {} as any,
    );
  });

  /** Puts a live email-verification code on the pending account. */
  const requestCode = async () => {
    await service.resendOtp({
      email: EMAIL,
      type: OtpType.EMAIL_VERIFICATION,
    } as any);
    return mailedCode();
  };

  it('hands back a session, so the app is not left signed out on the home screen', async () => {
    const code = await requestCode();

    const result: any = await service.verifyOtp({
      email: EMAIL,
      code,
      type: OtpType.EMAIL_VERIFICATION,
    } as any);

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    // The refresh token is the stored one, not an unsaved string.
    expect(refreshTokenRepository.rows).toHaveLength(1);
    expect(refreshTokenRepository.rows[0].token).toBe(result.refreshToken);

    const claims = jwtService.verify(result.accessToken, { secret: JWT_SECRET });
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe(UserRole.BUSINESS);
  });

  it('returns the company details, so a business account sees them straight away', async () => {
    const code = await requestCode();

    const result: any = await service.verifyOtp({
      email: EMAIL,
      code,
      type: OtpType.EMAIL_VERIFICATION,
    } as any);

    expect(result.user.role).toBe(UserRole.BUSINESS);
    expect(result.user.businessProfile).toMatchObject({
      companyName: 'Rossi S.r.l.',
      partitaIva: '12345678901',
      jobRole: 'CEO / Founder',
    });
    // The account is active by the time the client is told it is signed in.
    expect(result.user.status).toBe(UserStatus.ACTIVE);
    expect(result.user.emailVerified).toBe(true);
  });

  it('never puts the password hash in that payload', async () => {
    const code = await requestCode();

    const result: any = await service.verifyOtp({
      email: EMAIL,
      code,
      type: OtpType.EMAIL_VERIFICATION,
    } as any);

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('issues nothing for a wrong code', async () => {
    await requestCode();

    await expect(
      service.verifyOtp({
        email: EMAIL,
        code: '000000',
        type: OtpType.EMAIL_VERIFICATION,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(refreshTokenRepository.rows).toHaveLength(0);
    expect(users.get('user-1')!.status).toBe(UserStatus.PENDING_VERIFICATION);
  });
});

describe('ForgotPasswordDto', () => {
  it('folds the address so a differently-cased sign-up is still reachable', () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: '  Mario.Rossi@Email.COM ' });
    expect(dto.email).toBe('mario.rossi@email.com');
  });
});

/**
 * `User.passwordHash` is `select: false`, so a password can only be compared by
 * a flow that asked for the column by name. Reverting any of these to the
 * ordinary finder would not fail to compile and would not change a status code
 * — login would simply start refusing everyone, which looks exactly like a
 * wrong password. These tests name the loader instead.
 */
describe('AuthService — password flows load the hash explicitly', () => {
  const HASH = '$2b$10$abcdefghijklmnopqrstuv';

  const buildService = () => {
    const user = {
      id: 'user-1',
      email: 'mario@example.it',
      passwordHash: HASH,
      status: 'active',
    };
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({ ...user, passwordHash: undefined }),
      findById: jest.fn().mockResolvedValue({ ...user, passwordHash: undefined }),
      findByEmailWithPassword: jest.fn().mockResolvedValue(user),
      findByIdWithPassword: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    };
    // Positional, matching the constructor: refreshToken, otp, businessProfile,
    // users, jwt, config, firebase, referrals, email, legal, dataSource. Only
    // the users service and the JWT signer are exercised on these two paths.
    const service = new AuthService(
      { find: jest.fn().mockResolvedValue([]), save: jest.fn() } as any,
      { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() } as any,
      {} as any,
      usersService as any,
      new JwtService({ secret: 'test-secret' }),
      { get: jest.fn(() => '7') } as any,
      {} as any,
      {} as any,
      { sendOtpEmail: jest.fn() } as any,
      {} as any,
      {} as any,
    );
    return { service, usersService };
  };

  it('validateUser asks for the password hash by name', async () => {
    const { service, usersService } = buildService();

    await service.validateUser('mario@example.it', 'whatever');

    expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(
      'mario@example.it',
    );
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('changePassword asks for the password hash by name', async () => {
    const { service, usersService } = buildService();

    await service
      .changePassword('user-1', {
        currentPassword: 'wrong',
        newPassword: 'Whatever-1!',
        confirmPassword: 'Whatever-1!',
      } as any)
      .catch(() => undefined); // the comparison fails; the lookup is the point

    expect(usersService.findByIdWithPassword).toHaveBeenCalledWith('user-1');
    expect(usersService.findById).not.toHaveBeenCalled();
  });
});

/**
 * Social login is the one entry point where an *external* service decides who
 * the caller is, so the checks that stand between a Firebase token and a
 * session are pinned here. Each test names a way the endpoint used to hand out
 * something it should not have.
 */
describe('AuthService — social login', () => {
  const GOOGLE_UID = 'firebase-uid-google-1';
  const SOCIAL_EMAIL = 'mario.rossi@email.com';

  /** A decoded Firebase ID token: verified and Google-issued unless told otherwise. */
  const token = (over: Record<string, any> = {}) => ({
    uid: GOOGLE_UID,
    email: SOCIAL_EMAIL,
    email_verified: true,
    name: 'Mario Rossi',
    picture: 'https://lh3.googleusercontent.com/a/mario',
    firebase: { sign_in_provider: 'google.com' },
    ...over,
  });

  const makeSocialUser = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: SOCIAL_EMAIL,
      passwordHash: null,
      firstName: 'Mario',
      lastName: 'Rossi',
      role: UserRole.PERSONAL,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      firebaseUid: null,
      avatar: null,
      ...over,
    }) as unknown as User;

  const buildService = (existing: User | null) => {
    const rows = new Map<string, User>();
    if (existing) rows.set(existing.id, existing);

    const usersService = {
      findByFirebaseUid: jest.fn(
        async (uid: string) =>
          [...rows.values()].find((u) => u.firebaseUid === uid) ?? null,
      ),
      findByEmail: jest.fn(
        async (email: string) =>
          [...rows.values()].find(
            (u) => u.email.toLowerCase() === email.toLowerCase(),
          ) ?? null,
      ),
      findById: jest.fn(async (id: string) => rows.get(id) ?? null),
      update: jest.fn(async (id: string, patch: Partial<User>) => {
        const row = rows.get(id)!;
        Object.assign(row, patch);
        return row;
      }),
      create: jest.fn(async (data: Partial<User>) => {
        const row = { id: 'user-new', ...data } as User;
        rows.set(row.id, row);
        return row;
      }),
    };

    const verifyIdToken = jest.fn();

    // Positional, matching the constructor: refreshToken, otp, businessProfile,
    // users, jwt, config, firebase, referrals, email, legal, dataSource.
    const service = new AuthService(
      { create: (row: any) => row, save: jest.fn(async (row: any) => row) } as any,
      {} as any,
      {} as any,
      usersService as any,
      new JwtService({ secret: JWT_SECRET }),
      { get: jest.fn(() => '7') } as any,
      { verifyIdToken } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, usersService, verifyIdToken };
  };

  it('links an unlinked account and stamps the login in a single write', async () => {
    const existing = makeSocialUser();
    const { service, usersService, verifyIdToken } = buildService(existing);
    verifyIdToken.mockResolvedValue(token());

    const result = await service.socialLogin('id-token');

    expect(result.user.id).toBe('user-1');
    expect(existing.firebaseUid).toBe(GOOGLE_UID);
    // Linking the UID, adopting the avatar, promoting the account and stamping
    // `lastLoginAt` were four separate SELECT-then-UPDATE round trips, and the
    // stamp landed after the reload — so the response always carried the
    // previous login's timestamp.
    expect(usersService.update).toHaveBeenCalledTimes(1);
    expect(result.user.lastLoginAt).toEqual(expect.any(Date));
  });

  it('refuses a suspended account instead of quietly reactivating it', async () => {
    // The reactivation branch keyed off `emailVerified`, not off the status, so
    // a banned account with an unverified address was set back to ACTIVE by the
    // very request that should have been turned away — and then let in, because
    // the suspension check read the row *after* that write.
    const banned = makeSocialUser({
      status: UserStatus.SUSPENDED,
      emailVerified: false,
    });
    const { service, usersService, verifyIdToken } = buildService(banned);
    verifyIdToken.mockResolvedValue(token());

    await expect(service.socialLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(banned.status).toBe(UserStatus.SUSPENDED);
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('will not hand over an existing account on an unverified provider email', async () => {
    // Google always verifies. Facebook returns whatever is on the profile, and
    // this endpoint is shared by every provider — so an unverified address used
    // to be enough to be given the account that happens to use it.
    const victim = makeSocialUser({ passwordHash: 'a-real-bcrypt-hash' } as any);
    const { service, usersService, verifyIdToken } = buildService(victim);
    verifyIdToken.mockResolvedValue(
      token({
        uid: 'firebase-uid-attacker',
        email_verified: false,
        firebase: { sign_in_provider: 'facebook.com' },
      }),
    );

    await expect(service.socialLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(victim.firebaseUid).toBeNull();
    expect(usersService.update).not.toHaveBeenCalled();
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('promotes an account still waiting on its own email verification', async () => {
    const pending = makeSocialUser({
      status: UserStatus.PENDING_VERIFICATION,
      emailVerified: false,
    });
    const { service, verifyIdToken } = buildService(pending);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token');

    expect(pending.status).toBe(UserStatus.ACTIVE);
    expect(pending.emailVerified).toBe(true);
  });

  it('creates the account with the role the sign-up screen chose', async () => {
    const { service, usersService, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token', { role: UserRole.BUSINESS });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: SOCIAL_EMAIL,
        role: UserRole.BUSINESS,
        firebaseUid: GOOGLE_UID,
        authProvider: AuthProvider.GOOGLE,
        passwordHash: null,
        emailVerified: true,
      }),
    );
  });

  it('defaults a new account to personal, and never to admin', async () => {
    const { service, usersService, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token', { role: UserRole.ADMIN });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.PERSONAL }),
    );
  });

  it('refuses to create an account for a login-only caller', async () => {
    // The sign-in screen sends `allowSignUp: false`. It has no account type to
    // ask for, and the account type is chosen at sign-up and never changes, so
    // an account created there would sit on the `personal` default for good.
    const { service, usersService, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(token());

    await expect(
      service.socialLogin('id-token', { allowSignUp: false }),
    ).rejects.toThrow(NotFoundException);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('still signs a login-only caller into an account that exists', async () => {
    const existing = makeSocialUser();
    const { service, verifyIdToken } = buildService(existing);
    verifyIdToken.mockResolvedValue(token());

    const result = await service.socialLogin('id-token', {
      allowSignUp: false,
    });

    expect(result.user.id).toBe(existing.id);
    expect(result.accessToken).toBeDefined();
  });

  it('creates the account when sign-up is not refused', async () => {
    // The default, and what the sign-up screen relies on.
    const { service, usersService, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token');

    expect(usersService.create).toHaveBeenCalled();
  });

  it('leaves the role of an existing account alone', async () => {
    // `role` describes the account to create. A login request must not be able
    // to change the role of the account it merely authenticated.
    const existing = makeSocialUser({ role: UserRole.PERSONAL });
    const { service, verifyIdToken } = buildService(existing);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token', { role: UserRole.BUSINESS });

    expect(existing.role).toBe(UserRole.PERSONAL);
  });

  it('keeps a profile picture the user already has', async () => {
    const existing = makeSocialUser({
      avatar: 'https://cdn.vyzi.app/me.png',
    } as Partial<User>);
    const { service, verifyIdToken } = buildService(existing);
    verifyIdToken.mockResolvedValue(token());

    await service.socialLogin('id-token');

    expect(existing.avatar).toBe('https://cdn.vyzi.app/me.png');
  });

  it('drops a non-HTTPS avatar rather than storing it', async () => {
    const { service, usersService, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(
      token({ picture: 'http://insecure.example/a.png' }),
    );

    await service.socialLogin('id-token');

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: undefined }),
    );
  });

  it('refuses a token that carries no email', async () => {
    const { service, verifyIdToken } = buildService(null);
    verifyIdToken.mockResolvedValue(token({ email: undefined }));

    await expect(service.socialLogin('id-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
