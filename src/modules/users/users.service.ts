import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreference } from './entities/user-preference.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { OtpCode } from '../auth/entities/otp-code.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType } from '../../common/enums/user.enum';
import { AddressType } from '../../common/enums/address.enum';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BusinessProfile)
    private readonly businessProfileRepository: Repository<BusinessProfile>,
    @InjectRepository(UserAddress)
    private readonly addressRepository: Repository<UserAddress>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,
    private readonly emailService: EmailService,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async adminCreateUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      status: dto.status || UserStatus.ACTIVE,
      codiceFiscale: dto.codiceFiscale,
      emailVerified: true, // Admin-created users are pre-verified
    });

    if (dto.role === UserRole.BUSINESS && dto.companyName && dto.partitaIva) {
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

    // Create address if provided
    if (dto.address) {
      const address = this.addressRepository.create({
        userId: user.id,
        streetAddress: dto.address.streetAddress,
        city: dto.address.city,
        postalCode: dto.address.postalCode,
        province: dto.address.province || null,
        country: dto.address.country || 'IT',
        addressType: dto.address.addressType || AddressType.RESIDENTIAL,
        isPrimary: true,
      });
      await this.addressRepository.save(address);
    }

    return (await this.findById(user.id))!;
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResponseDto<User>> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.businessProfile', 'businessProfile');

    // Include bill count as virtual property
    qb.loadRelationCountAndMap('user.billCount', 'user.bills');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.email) LIKE LOWER(:search) OR LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [users, total] = await qb.getManyAndCount();

    // Strip password hashes from results
    const sanitized = users.map((u) => {
      const { passwordHash: _, ...rest } = u;
      return rest as User;
    });

    return new PaginatedResponseDto(sanitized, total, query.page, query.limit);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['businessProfile', 'addresses', 'preferences'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['businessProfile'],
    });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { firebaseUid },
      relations: ['businessProfile'],
    });
  }

  async findByReferralCode(referralCode: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { referralCode },
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  async adminUpdateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { companyName, partitaIva, pecEmail, legalRepresentative, companyType, atecoCode, ...userData } = dto;

    Object.assign(user, userData);
    await this.userRepository.save(user);

    // Update business profile if business fields are provided
    if (user.role === UserRole.BUSINESS) {
      const businessData: Partial<BusinessProfile> = {};
      if (companyName !== undefined) businessData.companyName = companyName;
      if (partitaIva !== undefined) businessData.partitaIva = partitaIva;
      if (pecEmail !== undefined) businessData.pecEmail = pecEmail;
      if (legalRepresentative !== undefined) businessData.legalRepresentative = legalRepresentative;
      if (companyType !== undefined) businessData.companyType = companyType;
      if (atecoCode !== undefined) businessData.atecoCode = atecoCode;

      if (Object.keys(businessData).length > 0) {
        if (user.businessProfile) {
          Object.assign(user.businessProfile, businessData);
          await this.businessProfileRepository.save(user.businessProfile);
        } else {
          const profile = this.businessProfileRepository.create({
            userId: user.id,
            ...businessData,
          } as Partial<BusinessProfile>);
          await this.businessProfileRepository.save(profile);
        }
      }
    }

    return (await this.findById(id))!;
  }

  async softDelete(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.INACTIVE;
    return this.userRepository.save(user);
  }

  async toggleStatus(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = user.status === UserStatus.ACTIVE
      ? UserStatus.SUSPENDED
      : UserStatus.ACTIVE;

    return this.userRepository.save(user);
  }

  async getPreferences(userId: string): Promise<UserPreference | null> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.preferenceRepository.findOne({ where: { userId } });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<UserPreference> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let preferences = await this.preferenceRepository.findOne({ where: { userId } });

    if (!preferences) {
      preferences = this.preferenceRepository.create({ userId, ...dto });
    } else {
      Object.assign(preferences, dto);
    }

    return this.preferenceRepository.save(preferences);
  }

  async adminResetPassword(userId: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Invalidate existing unused PASSWORD_RESET OTPs
    await this.otpCodeRepository.update(
      { userId: user.id, type: OtpType.PASSWORD_RESET, used: false },
      { used: true },
    );

    // Generate 6-digit OTP
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpCode = this.otpCodeRepository.create({
      code,
      type: OtpType.PASSWORD_RESET,
      expiresAt,
      userId: user.id,
    });
    await this.otpCodeRepository.save(otpCode);

    // Send password reset email
    await this.emailService.sendOtpEmail(user.email, code, 'password_reset');

    return { message: 'Password reset code sent to user email' };
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow users to update certain fields on their own profile
    const allowedFields: Partial<User> = {};
    if (dto.firstName !== undefined) allowedFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) allowedFields.lastName = dto.lastName;
    if (dto.phone !== undefined) allowedFields.phone = dto.phone;
    if (dto.codiceFiscale !== undefined) allowedFields.codiceFiscale = dto.codiceFiscale;

    Object.assign(user, allowedFields);
    await this.userRepository.save(user);

    // Update business profile fields if applicable
    if (user.role === UserRole.BUSINESS) {
      const businessData: Partial<BusinessProfile> = {};
      if (dto.pecEmail !== undefined) businessData.pecEmail = dto.pecEmail;
      if (dto.legalRepresentative !== undefined) businessData.legalRepresentative = dto.legalRepresentative;
      if (dto.companyType !== undefined) businessData.companyType = dto.companyType;
      if (dto.atecoCode !== undefined) businessData.atecoCode = dto.atecoCode;

      if (Object.keys(businessData).length > 0 && user.businessProfile) {
        Object.assign(user.businessProfile, businessData);
        await this.businessProfileRepository.save(user.businessProfile);
      }
    }

    return (await this.findById(userId))!;
  }
}
