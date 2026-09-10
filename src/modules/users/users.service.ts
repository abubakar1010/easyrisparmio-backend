import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
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
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, OtpType } from '../../common/enums/user.enum';
import {
  AddressType,
  accountAddressTypeFor,
  addressTypeRoleMismatchMessage,
  isAddressTypeAllowedFor,
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
            // One account, one tax identifier: a company is identified by the
            // Partita IVA on its company row, so the user row's tax code stays
            // empty on a business account. `CreateUserDto` refuses one outright;
            // this is what makes the rule true of the row as well as the request.
            codiceFiscale:
              dto.role === UserRole.BUSINESS
                ? undefined
                : dto.codiceFiscale || undefined,
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
              addressType: this.resolveAccountAddressType(
                dto.role,
                dto.address.addressType,
              ),
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

  /**
   * One account, one tax identifier.
   *
   * A personal account is identified by its holder's Codice Fiscale and a
   * business account by the company's Partita IVA. Neither may carry the other,
   * so a request offering the wrong one is refused by name rather than quietly
   * dropped — an admin who typed a VAT number into the tax code box has made a
   * mistake worth hearing about, and a silent drop reads as a save that worked.
   *
   * Checked here rather than on `UpdateUserDto`, because a PATCH need not carry
   * `role`: the app's own profile save sends none, and the rule has to be read
   * against the role actually stored.
   */
  private assertTaxIdsMatchRole(
    isBusiness: boolean,
    dto: { codiceFiscale?: string | null; partitaIva?: string | null },
  ): void {
    if (isBusiness && dto.codiceFiscale) {
      throw new BadRequestException(
        'A business account is identified by its Partita IVA and does not carry a Codice Fiscale',
      );
    }
    if (!isBusiness && dto.partitaIva) {
      throw new BadRequestException(
        'A personal account is identified by its Codice Fiscale and does not carry a Partita IVA',
      );
    }
  }

  /**
   * The type the account's own address is written under, refusing the one the
   * role cannot hold.
   *
   * A default alone was not enough. `addressType` is an accepted field, so an
   * explicit `residential` on a business account was stored verbatim — the
   * exact state the two types exist to make impossible, and one nothing
   * downstream could detect once written. Omitted, the role decides; sent, it
   * has to agree with the role or the request is refused by name.
   */
  private resolveAccountAddressType(
    role: UserRole,
    requested?: AddressType,
  ): AddressType {
    if (requested === undefined) {
      return accountAddressTypeFor(role);
    }
    if (!isAddressTypeAllowedFor(role, requested)) {
      throw new BadRequestException(addressTypeRoleMismatchMessage(role));
    }
    return requested;
  }

  /**
   * Writes an address onto an account, replacing the one of the same type it
   * already holds.
   *
   * `UpdateUserDto` inherits `address` from the create DTO, so both PATCH
   * routes accepted one, validated it, and answered 200 — while the value went
   * onto a property no column is mapped to and was dropped when the entity was
   * saved. An admin correcting a customer's address watched it save and revert.
   *
   * The row is matched on `(userId, addressType)` rather than on `isPrimary`.
   * An account can hold a supply and a billing address as well, and more than
   * one of them can carry the primary flag, so matching on the flag would have
   * let an edited residence overwrite a supply point.
   *
   * The type still comes from {@link resolveAccountAddressType}, so an address
   * cannot arrive through this door under a type the role may not hold.
   */
  private async writeUserAddress(
    manager: EntityManager,
    userId: string,
    role: UserRole,
    dto: CreateAddressDto,
  ): Promise<void> {
    const addressType = this.resolveAccountAddressType(role, dto.addressType);

    const existing = await manager.findOne(UserAddress, {
      where: { userId, addressType },
    });

    await manager.save(UserAddress, {
      ...(existing ?? {}),
      userId,
      addressType,
      streetAddress: dto.streetAddress,
      city: dto.city,
      postalCode: dto.postalCode,
      province: dto.province || null,
      country: dto.country || 'IT',
      // An existing row keeps the flag it was filed under — an admin fixing a
      // typo in a street name is not saying anything about which address is
      // the primary one. A new row matches what `adminCreateUser` writes.
      isPrimary: dto.isPrimary ?? existing?.isPrimary ?? true,
    });
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
      // Pulled out of the spread deliberately: `address` is a table of its own,
      // and left in `userData` it was assigned onto the entity as a property
      // with no column behind it, which is exactly how the edit went missing.
      address,
      ...userData
    } = dto;

    // An account is opened as a person or as a company and stays that way for
    // its whole life: no route moves it between the two, for an admin no more
    // than for the customer. `role` is off `UpdateUserDto` and the global pipe
    // runs with `forbidNonWhitelisted`, so a request carrying one is refused
    // before it arrives; this is the same rule where it cannot be routed
    // around, since `userData` is spread straight onto the entity below.
    delete (userData as { role?: unknown }).role;

    // The stored role, then, and only ever the stored role.
    const isBusiness = user.role === UserRole.BUSINESS;

    // Which tax identifier the account may carry follows from that same stored
    // role: a personal account its Codice Fiscale, a company its Partita IVA.
    this.assertTaxIdsMatchRole(isBusiness, dto);

    // A company's identifying details may be corrected, never introduced onto
    // an account that is not one. Sent to a personal account they name nothing
    // this account can hold, so they are refused rather than dropped — silently
    // ignoring them is a 200 that saved none of what the admin typed.
    if (
      !isBusiness &&
      (companyName ||
        legalRepresentative ||
        companyType ||
        atecoCode ||
        jobRole ||
        pecEmail)
    ) {
      throw new BadRequestException(
        'Company details belong to a business account. This account is personal, and an account type never changes',
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
    // a corrected VAT number — whose other half never landed.
    try {
      await this.dataSource.transaction(async (manager) => {
        Object.assign(user, userData);
        // A company keeps no personal tax code. The role cannot move, so this
        // is an invariant rather than a conversion: it holds the line for rows
        // that predate the rule and still carry one.
        if (isBusiness) {
          user.codiceFiscale = null as unknown as string;
        }
        await manager.save(User, user);

        // Filed under the type the account's own — unchanging — role calls for:
        // `legal`, the registered office, for a company, `residential` for a
        // person. Nothing retypes an existing row here any more, because
        // nothing can put it under the wrong type in the first place.
        if (address) {
          await this.writeUserAddress(manager, user.id, user.role, address);
        }

        // Update business profile if business fields are provided
        if (isBusiness) {
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

    // The account's own role decides which tax identifier it may send: a
    // personal account its Codice Fiscale, a company its Partita IVA.
    this.assertTaxIdsMatchRole(user.role === UserRole.BUSINESS, dto);

    // Only allow users to update certain fields on their own profile.
    //
    // `role` is not among them, and deliberately: the account type is settled
    // when the account is created and stays that way for its whole life. A
    // customer who registered as one type and needs the other registers again.
    const allowedFields: Partial<User> = {};
    if (dto.firstName !== undefined) allowedFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) allowedFields.lastName = dto.lastName;
    if (dto.phone !== undefined) allowedFields.phone = dto.phone;
    if (dto.codiceFiscale !== undefined && user.role !== UserRole.BUSINESS) {
      allowedFields.codiceFiscale = dto.codiceFiscale;
    }
    if (dto.avatar !== undefined) allowedFields.avatar = dto.avatar;

    Object.assign(user, allowedFields);
    await this.userRepository.save(user);

    // Accepted here for the same reason it is accepted on the admin route: the
    // DTO advertises it, so silently dropping it is a 200 that did nothing.
    // The role is the stored one — a customer cannot change their own account
    // type, so their own address can only ever be filed under the type that
    // type calls for.
    if (dto.address) {
      await this.writeUserAddress(
        this.dataSource.manager,
        userId,
        user.role,
        dto.address,
      );
    }

    // Update business profile fields if applicable. Only for the accounts that
    // registered as a business — a personal account never grows a company row,
    // because its type does not change.
    if (user.role === UserRole.BUSINESS) {
      const businessData: Partial<BusinessProfile> = {};
      // companyName and partitaIva were missing here, so the app could PATCH
      // them, get a 200, and see nothing change.
      if (dto.companyName !== undefined) businessData.companyName = dto.companyName;
      if (dto.partitaIva !== undefined) businessData.partitaIva = dto.partitaIva;
      if (dto.legalRepresentative !== undefined) businessData.legalRepresentative = dto.legalRepresentative;
      if (dto.companyType !== undefined) businessData.companyType = dto.companyType;
      if (dto.atecoCode !== undefined) businessData.atecoCode = dto.atecoCode;
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
          // A business account can end up without a company row — the social
          // sign-up path creates one from a provider profile that carries no
          // company details at all. Let the app fill it in rather than
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
