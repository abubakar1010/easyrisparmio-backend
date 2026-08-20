import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreference } from './entities/user-preference.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { OtpCode } from '../auth/entities/otp-code.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpgradeToBusinessDto } from './dto/upgrade-to-business.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType } from '../../common/enums/user.enum';
import { AddressType } from '../../common/enums/address.enum';
import { EmailService } from '../email/email.service';
import { LegalService } from '../legal/legal.service';
import {
  LegalAcceptanceSource,
  LegalSlug,
} from '../../common/enums/legal.enum';

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
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly emailService: EmailService,
    private readonly legalService: LegalService,
    private readonly dataSource: DataSource,
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

    // Exclude admin users from client list
    qb.andWhere('user.role != :adminRole', { adminRole: UserRole.ADMIN });

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

  /**
   * Case-insensitive on purpose: every auth flow resolves the account through
   * this method, and an address is not case-sensitive in its domain part — nor,
   * for every mailbox provider that matters here, in its local part. Matching
   * exactly meant a user who signed up as `Mario@x.it` and typed `mario@x.it`
   * into forgot-password got the "if the email is registered..." reply and no
   * email, with nothing in the logs to say why.
   *
   * `NormalizeEmail` folds incoming addresses at the DTO boundary and a pre-sync
   * migration folded the stored ones; this keeps rows that predate both — or
   * that a collision left untouched — reachable.
   */
  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.businessProfile', 'businessProfile')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
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

  async adminResetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Directly hash and set the new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    // An admin reaches for this when an account is in trouble, so the sessions
    // opened with the old password have to go with it — otherwise whoever
    // prompted the reset keeps a working refresh token for another seven days.
    await this.refreshTokenRepository.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );
    // Same for any reset code in flight: it would still be redeemable against
    // the account the admin has just secured.
    await this.otpCodeRepository.update(
      { userId: user.id, type: OtpType.PASSWORD_RESET, used: false },
      { used: true },
    );

    return { message: 'Password has been reset successfully' };
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
    if (dto.avatar !== undefined) allowedFields.avatar = dto.avatar;

    Object.assign(user, allowedFields);
    await this.userRepository.save(user);

    // Update business profile fields if applicable
    if (user.role === UserRole.BUSINESS) {
      const businessData: Partial<BusinessProfile> = {};
      // companyName and partitaIva were missing here, so the app could PATCH
      // them, get a 200, and see nothing change.
      if (dto.companyName !== undefined) businessData.companyName = dto.companyName;
      if (dto.partitaIva !== undefined) businessData.partitaIva = dto.partitaIva;
      if (dto.pecEmail !== undefined) businessData.pecEmail = dto.pecEmail;
      if (dto.legalRepresentative !== undefined) businessData.legalRepresentative = dto.legalRepresentative;
      if (dto.companyType !== undefined) businessData.companyType = dto.companyType;
      if (dto.atecoCode !== undefined) businessData.atecoCode = dto.atecoCode;

      if (Object.keys(businessData).length > 0) {
        if (dto.partitaIva !== undefined) {
          const takenBy = await this.businessProfileRepository.findOne({
            where: { partitaIva: dto.partitaIva, userId: Not(userId) },
            select: { id: true },
          });
          if (takenBy) {
            throw new ConflictException(
              'This Partita IVA is already registered to another account',
            );
          }
        }

        if (user.businessProfile) {
          Object.assign(user.businessProfile, businessData);
          await this.businessProfileRepository.save(user.businessProfile);
        } else if (businessData.companyName && businessData.partitaIva) {
          // A business account can end up without a company row — an admin
          // setting the role by hand, or an account left behind by the old
          // non-transactional registration. Let the app repair it instead of
          // silently dropping the edit.
          await this.businessProfileRepository.save(
            this.businessProfileRepository.create({
              userId,
              ...businessData,
            } as Partial<BusinessProfile>),
          );
        } else {
          throw new BadRequestException(
            'Company name and Partita IVA are both required to create the company profile',
          );
        }
      }
    }

    return (await this.findById(userId))!;
  }

  // ─── Self-service account type switching ──────────────────

  /**
   * Turns a personal account into a business one: stores the company details
   * and flips the role. Idempotent — a business user re-submitting the sheet
   * updates the details it already has instead of erroring, so a double tap or
   * a retry after a dropped response cannot leave the account half-switched.
   *
   * The role change and the profile write share a transaction: a user whose
   * role says `business` but who has no company row would fail every business
   * flow downstream with no way to fix it from the app.
   */
  async upgradeToBusiness(
    userId: string,
    dto: UpgradeToBusinessDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Administrator accounts cannot be switched to business',
      );
    }

    // A Partita IVA identifies exactly one company, and the column is unique.
    // Checking first turns what would surface as a 500 into a message the app
    // can put under the field.
    const takenBy = await this.businessProfileRepository.findOne({
      where: { partitaIva: dto.partitaIva, userId: Not(userId) },
      select: { id: true },
    });
    if (takenBy) {
      throw new ConflictException(
        'This Partita IVA is already registered to another account',
      );
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(BusinessProfile, {
          where: { userId },
        });

        if (existing) {
          existing.companyName = dto.companyName;
          existing.partitaIva = dto.partitaIva;
          // Left untouched when the sheet omits the optional role, so a value
          // captured earlier is not wiped by a later edit.
          if (dto.jobRole !== undefined) {
            existing.jobRole = dto.jobRole || null;
          }
          await manager.save(BusinessProfile, existing);
        } else {
          await manager.save(
            BusinessProfile,
            manager.create(BusinessProfile, {
              userId,
              companyName: dto.companyName,
              partitaIva: dto.partitaIva,
              jobRole: dto.jobRole || null,
            }),
          );
        }

        await manager.update(User, { id: userId }, { role: UserRole.BUSINESS });
      });
    } catch (error) {
      // Lost the race against a concurrent registration of the same VAT.
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'This Partita IVA is already registered to another account',
        );
      }
      throw error;
    }

    // The upgrade sheet's checkbox binds the account to the business terms, so
    // it is recorded at the version in force. Personal-account documents are
    // left alone: those acceptances already exist from registration.
    await this.legalService.recordAcceptanceFor(
      userId,
      UserRole.BUSINESS,
      [LegalSlug.BUSINESS_TERMS_CONDITIONS],
      LegalAcceptanceSource.BUSINESS_UPGRADE,
    );

    return (await this.findById(userId))!;
  }

  /**
   * Flips a business account back to personal. The company row is deliberately
   * kept: switching back to business is then one tap with the details already
   * filled in, and cases opened while the account was a business keep the
   * company they were opened under.
   *
   * Idempotent for the same reason as the upgrade — a personal account calling
   * this gets its profile back, not an error.
   */
  async switchToPersonal(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Administrator accounts cannot be switched to personal',
      );
    }

    if (user.role !== UserRole.PERSONAL) {
      await this.userRepository.update(
        { id: userId },
        { role: UserRole.PERSONAL },
      );
    }

    return (await this.findById(userId))!;
  }
}
