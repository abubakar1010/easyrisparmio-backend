import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';

import { User } from '../users/entities/user.entity';
import { BusinessProfile } from '../users/entities/business-profile.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpCode } from './entities/otp-code.entity';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType, AuthProvider } from '../../common/enums/user.enum';
import { UsersService } from '../users/users.service';
import { FirebaseService } from './firebase.service';
import { ReferralsService } from '../referrals/referrals.service';
import { EmailService } from '../email/email.service';
import { AdminNotificationsService } from '../notifications/admin-notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
/** Long enough to type a password, short enough that a leaked token is stale. */
const RESET_TOKEN_TTL = '10m';
const RESET_TOKEN_PURPOSE = 'password_reset';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * bcrypt hash of a string no OTP can ever be, compared against whenever there
 * is no real hash to check. Without it, "no account" and "no code pending"
 * return in a fraction of the time a wrong-code guess takes, and that gap is
 * enough to enumerate accounts through an endpoint whose replies are otherwise
 * deliberately identical.
 */
const ABSENT_OTP_HASH = bcrypt.hashSync('otp-that-cannot-exist', 10);

/** Same wording on every branch — see `forgotPassword`. */
const FORGOT_PASSWORD_REPLY =
  'If the email is registered, a password reset code has been sent';
const RESEND_OTP_REPLY =
  'If the email is registered, a new verification code has been sent';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,
    @InjectRepository(BusinessProfile)
    private readonly businessProfileRepository: Repository<BusinessProfile>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
    private readonly referralsService: ReferralsService,
    private readonly emailService: EmailService,
    private readonly adminNotifications: AdminNotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto) {
    if ((dto.role as string) === UserRole.ADMIN) {
      throw new BadRequestException('Cannot register as admin');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      status: UserStatus.PENDING_VERIFICATION,
    });

    if (dto.role === UserRole.BUSINESS && dto.companyName) {
      const businessProfile = this.businessProfileRepository.create({
        userId: user.id,
        companyName: dto.companyName,
        partitaIva: dto.partitaIva,
        pecEmail: dto.pecEmail,
        legalRepresentative: dto.legalRepresentative,
        companyType: dto.companyType,
        atecoCode: dto.atecoCode,
      });
      await this.businessProfileRepository.save(businessProfile);
    }

    // Process referral code if provided
    let referralWarning: string | undefined;
    if (dto.referralCode) {
      try {
        await this.referralsService.processReferralCode(
          dto.referralCode,
          user.id,
          dto.email,
        );
      } catch (error) {
        this.logger.warn(
          `Referral code processing failed for user ${dto.email}: ${error?.message || error}`,
        );
        referralWarning = 'Referral code could not be applied';
      }
    }

    // The account row is already committed, so a mail outage must not turn into
    // a failed registration: the address would be taken and the user could
    // never sign up again with it. Report the problem and let them retry
    // through resend-otp, which `generateAndSaveOtp` has left uncooled.
    let emailWarning: string | undefined;
    try {
      await this.generateAndSaveOtp(user, OtpType.EMAIL_VERIFICATION);
    } catch (error) {
      this.logger.error(
        `Registration succeeded but the verification email to user ${user.id} failed: ${error?.message || error}`,
      );
      emailWarning =
        'We could not send the verification code. Use "resend code" to try again.';
    }

    await this.adminNotifications.notifyAdmins({
      messageKey: 'admin_user_registered',
      type: NotificationType.ADMIN_USER,
      bodyParams: [
        `${user.firstName} ${user.lastName}`.trim() || user.email,
        user.role,
        user.email,
      ],
      data: { userId: user.id, role: user.role, entityType: 'user' },
    });

    const verificationToken = this.generateVerificationToken(user.email);
    const { passwordHash: _, ...result } = user;
    return {
      message: 'Registration successful. Please verify your email.',
      user: result,
      verificationToken,
      ...(referralWarning && { referralWarning }),
      ...(emailWarning && { emailWarning }),
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(
    user: User,
    meta?: { ipAddress?: string; deviceInfo?: string },
  ) {
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      // Subject to the same cooldown as resend-otp. Knowing the password is not
      // much of a gate when the person hammering this endpoint is the one who
      // knows it, and every attempt would otherwise post another mail.
      // A delivery failure must not mask the 403 — the client still needs the
      // verification token to reach the OTP screen.
      if (!(await this.otpCooldownRemaining(user.id, OtpType.EMAIL_VERIFICATION))) {
        try {
          await this.generateAndSaveOtp(user, OtpType.EMAIL_VERIFICATION);
        } catch (error) {
          this.logger.error(
            `Could not send the verification email to user ${user.id} on login: ${error?.message || error}`,
          );
        }
      }
      const verificationToken = this.generateVerificationToken(user.email);
      throw new ForbiddenException({
        message:
          'Your email is not verified. A verification code has been sent to your email.',
        data: { verificationToken },
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support for assistance.',
      );
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.generateTokens(user, meta);
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.verificationToken
      ? this.resolveEmailFromToken(dto.verificationToken)
      : dto.email;
    if (!email) {
      throw new BadRequestException('Either email or verificationToken is required');
    }
    const user = await this.usersService.findByEmail(email);
    // Generic error on every miss — including a suspended account — so this
    // endpoint cannot be used to test whether an address is registered.
    if (!user || user.status === UserStatus.SUSPENDED) {
      await bcrypt.compare(dto.code, ABSENT_OTP_HASH);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    const otpCode = await this.consumeOtp(user, dto.type, dto.code);

    if (dto.type === OtpType.EMAIL_VERIFICATION) {
      const wasPending = user.status === UserStatus.PENDING_VERIFICATION;
      await this.usersService.update(user.id, {
        emailVerified: true,
        status: wasPending ? UserStatus.ACTIVE : user.status,
      });

      // Only the transition out of PENDING_VERIFICATION is news to an admin;
      // re-verifying an already active address is not.
      if (wasPending) {
        await this.adminNotifications.notifyAdmins({
          messageKey: 'admin_user_verified',
          type: NotificationType.ADMIN_USER,
          bodyParams: [
            `${user.firstName} ${user.lastName}`.trim() || user.email,
            user.email,
          ],
          data: { userId: user.id, role: user.role, entityType: 'user' },
        });
      }
    }

    if (dto.type === OtpType.PHONE_VERIFICATION) {
      await this.usersService.update(user.id, {
        phoneVerified: true,
      });
    }

    // For password reset, hand back a short-lived reset token so the client can
    // POST /auth/reset-password without holding on to the raw code. The token
    // names the OTP row it came from: that row is deleted once the reset lands,
    // which is what stops the token being replayed to overwrite a password the
    // user has since changed again.
    if (dto.type === OtpType.PASSWORD_RESET) {
      const resetToken = this.jwtService.sign(
        { sub: user.id, purpose: RESET_TOKEN_PURPOSE, otp: otpCode.id },
        { expiresIn: RESET_TOKEN_TTL },
      );
      return { message: 'OTP verified successfully', resetToken };
    }

    return { message: 'OTP verified successfully' };
  }

  async resendOtp(dto: ResendOtpDto) {
    // Only allow email_verification and password_reset
    if (dto.type === OtpType.PHONE_VERIFICATION) {
      throw new BadRequestException('Phone verification OTP cannot be resent via this endpoint');
    }

    const email = dto.verificationToken
      ? this.resolveEmailFromToken(dto.verificationToken)
      : dto.email;
    if (!email) {
      throw new BadRequestException('Either email or verificationToken is required');
    }
    const user = await this.usersService.findByEmail(email);
    if (!user || user.status === UserStatus.SUSPENDED) {
      // Don't reveal whether email exists — return same success response
      return { message: RESEND_OTP_REPLY };
    }

    // For email verification, only allow if user is still pending
    if (
      dto.type === OtpType.EMAIL_VERIFICATION &&
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
      return { message: RESEND_OTP_REPLY };
    }

    // Absorbed silently rather than reported: "please wait 45 seconds" was only
    // ever returned for an address that exists, which made the cooldown itself
    // an account-existence oracle on an endpoint whose replies are otherwise
    // identical by design. Both clients run their own 60s countdown, so the
    // resend button is disabled during the window anyway.
    if (await this.otpCooldownRemaining(user.id, dto.type)) {
      return { message: RESEND_OTP_REPLY };
    }

    await this.generateAndSaveOtp(user, dto.type);

    return { message: RESEND_OTP_REPLY };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    // Unknown address, suspended account, still inside the cooldown — every
    // branch answers with the same sentence. Anything that tells them apart
    // turns this endpoint into an "is this person a customer" oracle.
    //
    // The one thing deliberately *not* hidden is a mail transport that refuses
    // the message: `generateAndSaveOtp` throws and the caller gets a 503.
    // Claiming "we sent you a code" when nothing was sent is the failure this
    // flow is being fixed for, and a dead transport is dead for every address,
    // so failing loudly says nothing about this one.
    if (!user || user.status === UserStatus.SUSPENDED) {
      return { message: FORGOT_PASSWORD_REPLY };
    }

    // Per-account, because the controller's throttle is per-IP and so does
    // nothing to stop a rotating source from flooding one victim's inbox.
    if (await this.otpCooldownRemaining(user.id, OtpType.PASSWORD_RESET)) {
      return { message: FORGOT_PASSWORD_REPLY };
    }

    await this.generateAndSaveOtp(user, OtpType.PASSWORD_RESET);

    return { message: FORGOT_PASSWORD_REPLY };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = dto.resetToken
      ? await this.userFromResetToken(dto.resetToken)
      : await this.userFromOtpCode(dto);

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support for assistance.',
      );
    }

    if (
      user.passwordHash &&
      (await bcrypt.compare(dto.newPassword, user.passwordHash))
    ) {
      throw new BadRequestException(
        'New password must be different from your current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.update(user.id, {
      passwordHash,
      // Reading the code proves control of the mailbox exactly as the
      // verification OTP does, so an account that never finished sign-up is
      // activated here instead of being stranded with a working password it
      // still cannot log in with.
      emailVerified: true,
      status:
        user.status === UserStatus.PENDING_VERIFICATION
          ? UserStatus.ACTIVE
          : user.status,
    });

    // Nothing minted before the reset survives it — that is the entire point of
    // a reset on an account someone else has got into. The OTP rows go with it,
    // which is what makes the reset token single-use.
    await this.otpCodeRepository.delete({
      userId: user.id,
      type: OtpType.PASSWORD_RESET,
    });
    await this.refreshTokenRepository.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );

    return { message: 'Password reset successfully' };
  }

  /**
   * Preferred path: verify-otp minted the token once the code checked out, so
   * no code is replayed over the wire here.
   */
  private async userFromResetToken(resetToken: string): Promise<User> {
    let payload: { sub?: string; purpose?: string; otp?: string };
    try {
      payload = this.jwtService.verify(resetToken);
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // `purpose` is what keeps an ordinary access token — same secret, same
    // issuer, and it carries a `sub` too — from being posted here as a reset
    // token by anyone who has merely stolen a session.
    if (
      payload?.purpose !== RESET_TOKEN_PURPOSE ||
      !payload.sub ||
      !payload.otp ||
      !UUID_PATTERN.test(payload.otp)
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // The OTP row this token was minted from is deleted by a successful reset,
    // so a replay inside the token's lifetime finds nothing and is refused.
    const otpRow = await this.otpCodeRepository.findOne({
      where: {
        id: payload.otp,
        userId: payload.sub,
        type: OtpType.PASSWORD_RESET,
        used: true,
      },
    });
    if (!otpRow) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    return user;
  }

  /**
   * Legacy path for callers that post the code straight to reset-password
   * rather than exchanging it at verify-otp first. A client cannot do both:
   * verify-otp marks the code used, so a code already exchanged for a reset
   * token is rejected here.
   */
  private async userFromOtpCode(dto: ResetPasswordDto): Promise<User> {
    if (!dto.email || !dto.code) {
      throw new BadRequestException('Either resetToken or email+code is required');
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.status === UserStatus.SUSPENDED) {
      await bcrypt.compare(dto.code, ABSENT_OTP_HASH);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    await this.consumeOtp(user, OtpType.PASSWORD_RESET, dto.code);
    return user;
  }

  async refreshToken(
    token: string,
    meta?: { ipAddress?: string; deviceInfo?: string },
  ) {
    // Use a transaction to prevent race condition:
    // generate new tokens BEFORE revoking the old one
    return this.dataSource.transaction(async (manager) => {
      const existingToken = await manager.findOne(RefreshToken, {
        where: {
          token,
          revoked: false,
          expiresAt: MoreThan(new Date()),
        },
        relations: ['user'],
      });

      if (!existingToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Generate new tokens first
      const payload = {
        sub: existingToken.user.id,
        email: existingToken.user.email,
        role: existingToken.user.role,
      };
      const accessToken = this.jwtService.sign(payload);
      const refreshTokenValue = randomUUID();
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(
        refreshTokenExpiry.getDate() +
          parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '7'), 10),
      );

      const newRefreshToken = manager.create(RefreshToken, {
        token: refreshTokenValue,
        userId: existingToken.user.id,
        expiresAt: refreshTokenExpiry,
        ipAddress: meta?.ipAddress || null,
        deviceInfo: meta?.deviceInfo || null,
      });

      // Save new token, then revoke old — all in same transaction
      await manager.save(RefreshToken, newRefreshToken);
      existingToken.revoked = true;
      await manager.save(RefreshToken, existingToken);

      return {
        accessToken,
        refreshToken: refreshTokenValue,
      };
    });
  }

  async logout(refreshTokenValue: string) {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue, revoked: false },
    });

    if (token) {
      token.revoked = true;
      await this.refreshTokenRepository.save(token);
    }

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for social login accounts',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.update(user.id, { passwordHash });

    // Same reasoning as reset-password: someone who learned the old password
    // may well be holding a refresh token minted with it, and changing the
    // password has to be the thing that evicts them. A fresh pair is returned
    // so the caller who did the changing is not logged out by their own action.
    await this.refreshTokenRepository.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );
    const tokens = await this.generateTokens(user);

    return { message: 'Password changed successfully', ...tokens };
  }

  async socialLogin(
    idToken: string,
    meta?: { ipAddress?: string; deviceInfo?: string },
  ) {
    const decodedToken = await this.firebaseService.verifyIdToken(idToken);

    const email = decodedToken.email;
    if (!email) {
      throw new BadRequestException(
        'Email is required. Please ensure your social account has a verified email.',
      );
    }

    const firebaseUid = decodedToken.uid;
    const provider = this.mapFirebaseProvider(
      decodedToken.firebase.sign_in_provider,
    );
    const name = decodedToken.name || '';
    const [firstName, ...lastParts] = name.split(' ');
    const lastName = lastParts.join(' ') || '';
    const rawAvatar = decodedToken.picture || undefined;

    // Validate avatar URL — only accept HTTPS URLs
    const avatar =
      rawAvatar && /^https:\/\/.+/.test(rawAvatar) ? rawAvatar : undefined;

    // Look up by firebaseUid first, then by email
    let user = await this.usersService.findByFirebaseUid(firebaseUid);

    if (!user) {
      user = await this.usersService.findByEmail(email);
    }

    if (user) {
      // Link Firebase account if not yet linked
      if (!user.firebaseUid) {
        await this.usersService.update(user.id, { firebaseUid });
      }
      // Update avatar from social profile if user doesn't have one
      if (!user.avatar && avatar) {
        await this.usersService.update(user.id, { avatar });
      }
      // Ensure user is active and email-verified (Firebase verified it)
      if (
        !user.emailVerified ||
        user.status === UserStatus.PENDING_VERIFICATION
      ) {
        await this.usersService.update(user.id, {
          emailVerified: true,
          status: UserStatus.ACTIVE,
        });
      }
      // Reload user after updates
      user = await this.usersService.findById(user.id);
    } else {
      // New user — create account
      user = await this.usersService.create({
        email,
        passwordHash: null,
        firstName: firstName || '',
        lastName: lastName || '',
        firebaseUid,
        authProvider: provider,
        avatar,
        role: UserRole.PERSONAL,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      });

      await this.adminNotifications.notifyAdmins({
        messageKey: 'admin_user_registered',
        type: NotificationType.ADMIN_USER,
        bodyParams: [
          `${user.firstName} ${user.lastName}`.trim() || user.email,
          user.role,
          user.email,
        ],
        data: {
          userId: user.id,
          role: user.role,
          authProvider: provider,
          entityType: 'user',
        },
      });
    }

    if (!user) {
      throw new BadRequestException('Failed to create or retrieve user');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support for assistance.',
      );
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });
    const tokens = await this.generateTokens(user, meta);
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  private mapFirebaseProvider(signInProvider: string): AuthProvider {
    switch (signInProvider) {
      case 'google.com':
        return AuthProvider.GOOGLE;
      case 'facebook.com':
        return AuthProvider.FACEBOOK;
      case 'apple.com':
        return AuthProvider.APPLE;
      default:
        return AuthProvider.LOCAL;
    }
  }

  private async generateTokens(
    user: User,
    meta?: { ipAddress?: string; deviceInfo?: string },
  ) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenValue = randomUUID();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() +
        parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '7'), 10),
    );

    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenValue,
      userId: user.id,
      expiresAt: refreshTokenExpiry,
      ipAddress: meta?.ipAddress || null,
      deviceInfo: meta?.deviceInfo || null,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  /**
   * Issues a fresh OTP of `type`, mails it, and returns the plaintext code.
   *
   * Throws `ServiceUnavailableException` if the mail could not be handed to a
   * transport, having first removed the row it just wrote — otherwise the dead
   * code would sit there tripping the cooldown and locking the user out of
   * retrying the very request that failed.
   */
  private async generateAndSaveOtp(user: User, type: OtpType): Promise<string> {
    // Invalidate any existing unused OTPs of this type
    await this.otpCodeRepository.update(
      { userId: user.id, type, used: false },
      { used: true },
    );

    // Cryptographically secure 6-digit OTP. Drawn from the full 000000–999999
    // range and padded rather than `randomInt(100000, 999999)`, whose exclusive
    // upper bound and no-leading-zeros floor between them cut the space by a
    // tenth and made every code start with a non-zero digit.
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    const otpCode = await this.otpCodeRepository.save(
      this.otpCodeRepository.create({
        codeHash: await bcrypt.hash(code, 10),
        type,
        expiresAt,
        userId: user.id,
      }),
    );

    // Send OTP via email
    if (
      type === OtpType.EMAIL_VERIFICATION ||
      type === OtpType.PASSWORD_RESET
    ) {
      const emailType =
        type === OtpType.EMAIL_VERIFICATION
          ? 'email_verification'
          : 'password_reset';
      try {
        await this.emailService.sendOtpEmail(user.email, code, emailType);
      } catch (error) {
        await this.otpCodeRepository.delete({ id: otpCode.id });
        this.logger.error(
          `Could not deliver a ${type} code to user ${user.id}: ${error?.message || error}`,
        );
        throw new ServiceUnavailableException(
          'We could not send the email right now. Please try again in a moment.',
        );
      }
    }

    return code;
  }

  /**
   * Seconds left before `userId` may be sent another OTP of `type`, or 0.
   */
  private async otpCooldownRemaining(
    userId: string,
    type: OtpType,
  ): Promise<number> {
    const lastOtp = await this.otpCodeRepository.findOne({
      where: { userId, type },
      order: { createdAt: 'DESC' },
    });
    if (!lastOtp) return 0;

    const elapsed = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
    return elapsed >= OTP_COOLDOWN_SECONDS
      ? 0
      : Math.ceil(OTP_COOLDOWN_SECONDS - elapsed);
  }

  /**
   * Checks `code` against the newest live OTP of `type` and marks it used.
   *
   * Every failure — no code pending, wrong code, too many tries already —
   * reports the same thing to the caller, so the only way to learn anything
   * from this endpoint is to guess the code correctly.
   */
  private async consumeOtp(
    user: User,
    type: OtpType,
    code: string,
  ): Promise<OtpCode> {
    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        type,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpCode) {
      await bcrypt.compare(code, ABSENT_OTP_HASH);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    if (otpCode.attempts >= MAX_OTP_ATTEMPTS) {
      // Lock out — invalidate the OTP
      await this.otpCodeRepository.update({ id: otpCode.id }, { used: true });
      throw new BadRequestException(
        'Too many failed attempts. Please request a new code.',
      );
    }

    if (!(await bcrypt.compare(code, otpCode.codeHash))) {
      // Incremented in the database rather than read-modify-written: two
      // guesses racing on the same row would otherwise both see `attempts = n`
      // and both store `n + 1`, buying an extra try for every request in flight.
      await this.otpCodeRepository.increment({ id: otpCode.id }, 'attempts', 1);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    await this.otpCodeRepository.update({ id: otpCode.id }, { used: true });
    otpCode.used = true;
    return otpCode;
  }

  generateVerificationToken(email: string): string {
    return this.jwtService.sign(
      { email, purpose: 'otp_verification' },
      { expiresIn: '10m' },
    );
  }

  resolveEmailFromToken(token: string): string {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.purpose !== 'otp_verification') {
        throw new BadRequestException('Invalid verification token');
      }
      return payload.email;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or expired verification token');
    }
  }
}
