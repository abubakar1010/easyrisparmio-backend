// AuthService only imports FirebaseService for its type, but loading it drags
// in firebase-admin, which reaches ESM-only `jose` and cannot be required under
// this Jest config. None of the paths under test touch it.
jest.mock('./firebase.service', () => ({ FirebaseService: class {} }));

import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ForgotPasswordDto } from './dto/reset-password.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/role.enum';
import { OtpType, UserStatus } from '../../common/enums/user.enum';

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

    const usersService = {
      findByEmail: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findById: jest.fn(async (id: string) => users.get(id) ?? null),
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
      usersService as any,
      jwtService,
      { get: jest.fn(() => '7') } as any,
      {} as any, // firebaseService
      {} as any, // referralsService
      { sendOtpEmail } as any,
      { notifyAdmins: jest.fn() } as any, // adminNotifications
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

    const usersService = {
      findByEmail: jest.fn(async (email: string) =>
        [...users.values()].find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        ) ?? null,
      ),
      findById: jest.fn(async (id: string) => users.get(id) ?? null),
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
      usersService as any,
      jwtService,
      { get: jest.fn(() => '7') } as any,
      {} as any,
      {} as any,
      { sendOtpEmail } as any,
      { notifyAdmins: jest.fn() } as any,
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
