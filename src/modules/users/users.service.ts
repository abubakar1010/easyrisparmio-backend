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
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType } from '../../common/enums/user.enum';
import {
  AddressType,
  defaultAddressTypeFor,
} from '../../common/enums/address.enum';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BusinessProfile)
    private readonly businessProfileRepository: Repository<BusinessProfile>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  /**
   * A unique-constraint violation restated as the 409 the caller can act on.
   *
   * `users.email` and `business_profiles.partita_iva` are both unique, and both
   * are values the admin types into the customer form. Left unmapped they reach
   * the dashboard as a 500 that says nothing about which field to correct.
   * Anything else is returned unchanged, so a genuine failure is never
   * disguised as a conflict.
   */
  private asUniqueConflict(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code?: string }).code === '23505'
    ) {
      const detail =
        (error as QueryFailedError & { driverError?: { detail?: string } })
          .driverError?.detail ?? '';
      if (detail.includes('partita_iva')) {
        return new ConflictException(
          'This Partita IVA is already registered to another account',
        );
      }
      if (detail.includes('email')) {
        return new ConflictException('Email already registered');
      }
      // A unique column the detail does not name — another driver, or a column
      // this path does not set by hand. Still a conflict, and a 409 the admin
      // can retry from beats a 500 that says nothing at all.
      return new ConflictException(
        'A customer with these details already exists',
      );
    }
    return error;
  }

  async adminCreateUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // A Partita IVA identifies exactly one company and the column is unique.
    // Checking before anything is written turns what would surface as a 500
    // into a message the customer form can put under the field.
    if (dto.role === UserRole.BUSINESS && dto.partitaIva) {
      const taken = await this.businessProfileRepository.findOne({
        where: { partitaIva: dto.partitaIva },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException(
          'This Partita IVA is already registered to another account',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Account, company and address are written together, the way registration
    // writes them. Saved one after another, a company row that failed — a
    // Partita IVA claimed between the check above and here — left the account
    // behind at `role: business` with no company, on an email that was now
    // taken and that the admin could never enter again.
    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          User,
          manager.create(User, {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            role: dto.role,
            status: dto.status || UserStatus.ACTIVE,
            codiceFiscale: dto.codiceFiscale,
            emailVerified: true, // Admin-created users are pre-verified
          }),
        );

        if (dto.role === UserRole.BUSINESS && dto.companyName) {
          await manager.save(
            BusinessProfile,
            manager.create(BusinessProfile, {
              userId: created.id,
              companyName: dto.companyName,
              partitaIva: dto.partitaIva,
              legalRepresentative: dto.legalRepresentative,
              companyType: dto.companyType,
              atecoCode: dto.atecoCode,
              // Accepted by the DTO and written by every other path that
              // touches the company row. Dropping it here silently lost a
              // value the admin had already typed.
              jobRole: dto.jobRole || null,
              pecEmail: dto.pecEmail || null,
            }),
          );
        }

        if (dto.address) {
          await manager.save(
            UserAddress,
            manager.create(UserAddress, {
              userId: created.id,
              streetAddress: dto.address.streetAddress,
              city: dto.address.city,
              postalCode: dto.address.postalCode,
              province: dto.address.province || null,
              country: dto.address.country || 'IT',
              // A company has a registered office, not a residence. Left to a
              // flat `residential` default, every business address an admin
              // created was stored under a type that said the company lived
              // there, and nothing downstream could tell a sede legale from a
              // home address.
              addressType:
                dto.address.addressType ?? defaultAddressTypeFor(dto.role),
              isPrimary: true,
            }),
          );
        }

        return created;
      });
    } catch (error) {
      // Lost a race on one of the unique columns after the pre-checks passed.
      throw this.asUniqueConflict(error);
    }

    return (await this.findById(user.id))!;
  }

  /**
   * The admins a case or a ticket can be assigned to.
   *
   * Separate from {@link findAll}, which exists to list *clients* and excludes
   * admins outright — an assignee picker needs exactly the rows that list drops,
   * and it needs all of them at once rather than a page of them. Suspended and
   * deleted accounts are left out: assigning work to someone who can no longer
   * log in reads on the board as handled when it is not.
   */
  async findAgents(): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>[]> {
    return this.userRepository.find({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: ['id', 'firstName', 'lastName', 'email'],
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
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

  /**
   * The two loaders that include `passwordHash`, which is `select: false`.
   *
   * Deliberately separate methods rather than a flag on the ordinary finders:
   * the hash then travels only where a caller has named it, and every such
   * caller is findable with one grep. Both are for authentication flows that
   * compare a password — nothing that builds a response should call them.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    if (!email) return null;
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.businessProfile', 'businessProfile')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
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

    const {
      companyName,
      partitaIva,
      legalRepresentative,
      companyType,
      atecoCode,
      jobRole,
      pecEmail,
      ...userData
    } = dto;

    // What the account is about to become, which is not always what it is now:
    // the customer form sends `role` on every save.
    const nextRole = userData.role ?? user.role;
    const becomingPersonal =
      user.role === UserRole.BUSINESS && nextRole !== UserRole.BUSINESS;
    const becomingBusiness =
      user.role !== UserRole.BUSINESS && nextRole === UserRole.BUSINESS;

    // Turning an account into a company needs the two things that identify one.
    // `UpdateUserDto` is a PartialType, so its `ValidateIf` on the create DTO
    // never fires for a field the request simply omits — which is how a PATCH
    // carrying nothing but `role: business` used to produce a business account
    // with no company row at all, invisible until the switch flow went looking
    // for a Partita IVA and found none.
    if (becomingBusiness && !user.businessProfile && !(companyName && partitaIva)) {
      throw new BadRequestException(
        'Company name and Partita IVA are both required to turn this account into a business',
      );
    }

    // The same unique column as on create, checked before anything is written:
    // a VAT that already belongs to another company comes back as a message the
    // form can put under the field, rather than a 500 raised once the account
    // row has already been saved.
    if (partitaIva) {
      const takenBy = await this.businessProfileRepository.findOne({
        where: { partitaIva, userId: Not(id) },
        select: { id: true },
      });
      if (takenBy) {
        throw new ConflictException(
          'This Partita IVA is already registered to another account',
        );
      }
    }

    // The account row and the company row move together. Saved separately, a
    // company row that failed left the account carrying an edit — a new email,
    // a switch to business — whose other half never landed.
    try {
      await this.dataSource.transaction(async (manager) => {
        const profileToDrop = becomingPersonal ? user.businessProfile : null;
        if (profileToDrop) {
          // Detached before the account is saved, not only deleted after:
          // `User.businessProfile` cascades, so leaving the loaded row hanging
          // off the entity would have the save write it straight back.
          user.businessProfile = null as unknown as BusinessProfile;
        }

        Object.assign(user, userData);
        await manager.save(User, user);

        // A company that is no longer a company does not keep its company row.
        // Left behind it was invisible — nothing reads `businessProfile` on a
        // personal account — while its Partita IVA went on holding the unique
        // index, so the real company could never register that VAT again. It
        // goes inside the same transaction as the role change, because a row
        // deleted next to a role that then failed to save is worse than either.
        if (profileToDrop) {
          await manager.delete(BusinessProfile, { userId: user.id });
        }

        // Update business profile if business fields are provided
        if (nextRole === UserRole.BUSINESS) {
          const businessData: Partial<BusinessProfile> = {};
          if (companyName !== undefined) businessData.companyName = companyName;
          if (partitaIva !== undefined) businessData.partitaIva = partitaIva;
          if (legalRepresentative !== undefined) businessData.legalRepresentative = legalRepresentative;
          if (companyType !== undefined) businessData.companyType = companyType;
          if (atecoCode !== undefined) businessData.atecoCode = atecoCode;
          if (jobRole !== undefined) businessData.jobRole = jobRole || null;
          // Clears on null or an empty string: an admin correcting a PEC
          // entered against the wrong company needs a way to say "none".
          if (pecEmail !== undefined) businessData.pecEmail = pecEmail || null;

          if (Object.keys(businessData).length > 0) {
            if (user.businessProfile) {
              Object.assign(user.businessProfile, businessData);
              await manager.save(BusinessProfile, user.businessProfile);
            } else {
              await manager.save(
                BusinessProfile,
                manager.create(BusinessProfile, {
                  userId: user.id,
                  ...businessData,
                } as Partial<BusinessProfile>),
              );
            }
          }
        }
      });
    } catch (error) {
      throw this.asUniqueConflict(error);
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
      if (dto.legalRepresentative !== undefined) businessData.legalRepresentative = dto.legalRepresentative;
      if (dto.companyType !== undefined) businessData.companyType = dto.companyType;
      if (dto.atecoCode !== undefined) businessData.atecoCode = dto.atecoCode;
      // The switch-to-business sheet captures the job role, so the profile
      // screen has to be able to correct it afterwards like any other field.
      // An empty string clears it rather than storing a blank.
      if (dto.jobRole !== undefined) businessData.jobRole = dto.jobRole || null;
      // The address an invoice is delivered to. Null or an empty string clears
      // it — a company that has changed PEC provider needs to be able to blank
      // the old one from the app.
      if (dto.pecEmail !== undefined) businessData.pecEmail = dto.pecEmail || null;

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
}
