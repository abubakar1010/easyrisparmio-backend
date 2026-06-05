import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../users/entities/user.entity';
import { BusinessProfile } from '../users/entities/business-profile.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpCode } from './entities/otp-code.entity';
import { RegisterDto, RegisterBusinessDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';
import { OtpType } from '../../common/enums/user.enum';
import { UsersService } from '../users/users.service';

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
  ) {}

  async register(dto: RegisterDto | RegisterBusinessDto) {
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

    if (dto.role === UserRole.BUSINESS && 'companyName' in dto) {
      const businessDto = dto as RegisterBusinessDto;
      const businessProfile = this.businessProfileRepository.create({
        userId: user.id,
        companyName: businessDto.companyName,
        partitaIva: businessDto.partitaIva,
        pecEmail: businessDto.pecEmail,
        legalRepresentative: businessDto.legalRepresentative,
        companyType: businessDto.companyType,
        atecoCode: businessDto.atecoCode,
      });
      await this.businessProfileRepository.save(businessProfile);
    }

    await this.generateAndSaveOtp(user, OtpType.EMAIL_VERIFICATION);

    const { passwordHash: _, ...result } = user;
    return {
      message: 'Registration successful. Please verify your email.',
      user: result,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(user: User) {
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const tokens = await this.generateTokens(user);
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        code: dto.code,
        type: dto.type,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!otpCode) {
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
      throw new BadRequestException('Invalid request');
    }

    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        code: dto.code,
        type: OtpType.PASSWORD_RESET,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!otpCode) {
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

  async refreshToken(token: string) {
    const existingToken = await this.refreshTokenRepository.findOne({
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

    // Revoke old token
    existingToken.revoked = true;
    await this.refreshTokenRepository.save(existingToken);

    // Generate new tokens
    const tokens = await this.generateTokens(existingToken.user);

    return tokens;
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenValue = uuidv4();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() +
        parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '7'), 10),
    );

    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenValue,
      userId: user.id,
      expiresAt: refreshTokenExpiry,
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

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP valid for 10 minutes

    const otpCode = this.otpCodeRepository.create({
      code,
      type,
      expiresAt,
      userId: user.id,
    });
    await this.otpCodeRepository.save(otpCode);

    // TODO: Send OTP via email/SMS service
    return code;
  }
}
