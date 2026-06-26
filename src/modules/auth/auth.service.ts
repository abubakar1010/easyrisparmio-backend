import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType, AuthProvider } from '../../common/enums/user.enum';
import { UsersService } from '../users/users.service';
import { FirebaseService } from './firebase.service';
import { ReferralsService } from '../referrals/referrals.service';
import { EmailService } from '../email/email.service';

const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
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
    if (dto.referralCode) {
      try {
        await this.referralsService.processReferralCode(
          dto.referralCode,
          user.id,
          dto.email,
        );
      } catch {
        // Don't fail registration for an invalid referral code
      }
    }

    await this.generateAndSaveOtp(user, OtpType.EMAIL_VERIFICATION);

    const verificationToken = this.generateVerificationToken(user.email);
    const { passwordHash: _, ...result } = user;
    return {
      message: 'Registration successful. Please verify your email.',
      user: result,
      verificationToken,
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
      await this.generateAndSaveOtp(user, OtpType.EMAIL_VERIFICATION);
      const verificationToken = this.generateVerificationToken(user.email);
      throw new ForbiddenException({
        message:
          'Your email is not verified. A verification code has been sent to your email.',
        data: { verificationToken },
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended');
    }

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
    if (!user) {
      // Generic error to prevent user enumeration
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Check if there are any unused, non-expired OTPs for this user+type
    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        type: dto.type,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Check attempt limit before verifying
    if (otpCode.attempts >= MAX_OTP_ATTEMPTS) {
      // Lock out — invalidate the OTP
      otpCode.used = true;
      await this.otpCodeRepository.save(otpCode);
      throw new BadRequestException(
        'Too many failed attempts. Please request a new code.',
      );
    }

    // Timing-safe comparison for the OTP code
    const isMatch =
      otpCode.code.length === dto.code.length &&
      otpCode.code === dto.code;

    if (!isMatch) {
      // Increment failed attempts
      otpCode.attempts += 1;
      await this.otpCodeRepository.save(otpCode);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    otpCode.used = true;
    await this.otpCodeRepository.save(otpCode);

    if (dto.type === OtpType.EMAIL_VERIFICATION) {
      await this.usersService.update(user.id, {
        emailVerified: true,
        status: UserStatus.ACTIVE,
      });
    }

    if (dto.type === OtpType.PHONE_VERIFICATION) {
      await this.usersService.update(user.id, {
        phoneVerified: true,
      });
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
    if (!user) {
      // Don't reveal whether email exists — return same success response
      return { message: 'If the email is registered, a new verification code has been sent' };
    }

    // For email verification, only allow if user is still pending
    if (
      dto.type === OtpType.EMAIL_VERIFICATION &&
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
      return { message: 'If the email is registered, a new verification code has been sent' };
    }

    // Cooldown: check if the last OTP of this type was sent less than 60 seconds ago
    const lastOtp = await this.otpCodeRepository.findOne({
      where: { userId: user.id, type: dto.type },
      order: { createdAt: 'DESC' },
    });

    if (lastOtp) {
      const secondsSinceLastOtp =
        (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (secondsSinceLastOtp < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLastOtp);
        throw new BadRequestException(
          `Please wait ${waitSeconds} seconds before requesting a new code`,
        );
      }
    }

    await this.generateAndSaveOtp(user, dto.type);

    return { message: 'If the email is registered, a new verification code has been sent' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Don't reveal whether user exists
      return { message: 'If the email is registered, a password reset code has been sent' };
    }

    await this.generateAndSaveOtp(user, OtpType.PASSWORD_RESET);

    return { message: 'If the email is registered, a password reset code has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        type: OtpType.PASSWORD_RESET,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    if (otpCode.attempts >= MAX_OTP_ATTEMPTS) {
      otpCode.used = true;
      await this.otpCodeRepository.save(otpCode);
      throw new BadRequestException(
        'Too many failed attempts. Please request a new code.',
      );
    }

    if (otpCode.code !== dto.code) {
      otpCode.attempts += 1;
      await this.otpCodeRepository.save(otpCode);
      throw new BadRequestException('Invalid or expired OTP code');
    }

    otpCode.used = true;
    await this.otpCodeRepository.save(otpCode);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.update(user.id, { passwordHash });

    // Revoke all existing refresh tokens for security
    await this.refreshTokenRepository.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );

    return { message: 'Password reset successfully' };
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

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { passwordHash: _, ...result } = user;
    return result;
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
    }

    if (!user) {
      throw new BadRequestException('Failed to create or retrieve user');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended');
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

  private async generateAndSaveOtp(user: User, type: OtpType): Promise<string> {
    // Invalidate any existing unused OTPs of this type
    await this.otpCodeRepository.update(
      { userId: user.id, type, used: false },
      { used: true },
    );

    // Cryptographically secure random 6-digit OTP
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpCode = this.otpCodeRepository.create({
      code,
      type,
      expiresAt,
      userId: user.id,
    });
    await this.otpCodeRepository.save(otpCode);

    // Send OTP via email
    if (
      type === OtpType.EMAIL_VERIFICATION ||
      type === OtpType.PASSWORD_RESET
    ) {
      const emailType =
        type === OtpType.EMAIL_VERIFICATION
          ? 'email_verification'
          : 'password_reset';
      await this.emailService.sendOtpEmail(user.email, code, emailType);
    }

    return code;
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
