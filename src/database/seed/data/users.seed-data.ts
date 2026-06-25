import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../../modules/users/entities/user.entity';
import { BusinessProfile } from '../../../modules/users/entities/business-profile.entity';
import { UserAddress } from '../../../modules/users/entities/user-address.entity';
import { UserPreference } from '../../../modules/users/entities/user-preference.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { UserStatus, AuthProvider } from '../../../common/enums/user.enum';
import { AddressType } from '../../../common/enums/address.enum';
import {
  PaymentMethod,
  InvoiceDelivery,
  LanguagePref,
} from '../../../common/enums/payment.enum';
import { SeedContext } from '../seed-context';

export async function seedUsers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const userRepo = ds.getRepository(User);
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const usersData = [
    {
      email: 'admin@easyresparmio.it',
      firstName: 'Admin',
      lastName: 'EasyRisparmio',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      authProvider: AuthProvider.LOCAL,
      passwordHash,
      referralCode: 'SEED-ADMIN',
      phone: '+39 02 1234567',
    },
    {
      email: 'marco.rossi@email.it',
      firstName: 'Marco',
      lastName: 'Rossi',
      role: UserRole.PERSONAL,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      authProvider: AuthProvider.LOCAL,
      passwordHash,
      referralCode: 'SEED-MARCO',
      phone: '+39 333 1234567',
      codiceFiscale: 'RSSMRC85M01H501Z',
      lastLoginAt: new Date('2026-06-20T10:30:00Z'),
    },
    {
      email: 'laura.bianchi@email.it',
      firstName: 'Laura',
      lastName: 'Bianchi',
      role: UserRole.PERSONAL,
      status: UserStatus.PENDING_VERIFICATION,
      emailVerified: false,
      authProvider: AuthProvider.LOCAL,
      passwordHash,
      referralCode: 'SEED-LAURA',
      phone: '+39 347 9876543',
      codiceFiscale: 'BNCLRA90A41F839X',
    },
    {
      email: 'giuseppe.verdi@business.it',
      firstName: 'Giuseppe',
      lastName: 'Verdi',
      role: UserRole.BUSINESS,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      authProvider: AuthProvider.GOOGLE,
      passwordHash: null,
      referralCode: 'SEED-GIUSEPPE',
      phone: '+39 340 5551234',
      firebaseUid: 'seed-firebase-giuseppe-001',
      lastLoginAt: new Date('2026-06-22T14:00:00Z'),
    },
    {
      email: 'anna.ferrari@business.it',
      firstName: 'Anna',
      lastName: 'Ferrari',
      role: UserRole.BUSINESS,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      authProvider: AuthProvider.LOCAL,
      passwordHash,
      referralCode: 'SEED-ANNA',
      phone: '+39 338 7771234',
      codiceFiscale: 'FRRNNA88D52L219P',
      lastLoginAt: new Date('2026-06-18T09:15:00Z'),
    },
  ];

  for (const data of usersData) {
    let user = await userRepo.findOne({
      where: { email: data.email },
      withDeleted: true,
    });
    if (!user) {
      user = await userRepo.save(userRepo.create(data));
      console.log(`  Created user: ${data.email}`);
    } else {
      console.log(`  User already exists: ${data.email}`);
    }

    if (data.role === UserRole.ADMIN) ctx.users.admin = user;
    else if (data.role === UserRole.PERSONAL) ctx.users.personal.push(user);
    else if (data.role === UserRole.BUSINESS) ctx.users.business.push(user);
  }
}

export async function seedBusinessProfiles(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(BusinessProfile);

  const profilesData = [
    {
      userId: ctx.users.business[0].id, // Giuseppe
      companyName: 'Rossi Costruzioni SRL',
      partitaIva: '01234567890',
      pecEmail: 'rossicostruzioni@pec.it',
      legalRepresentative: 'Giuseppe Verdi',
      companyType: 'SRL',
      atecoCode: '43.21.01',
      employeeCount: 25,
      annualRevenueRange: '1M-5M',
    },
    {
      userId: ctx.users.business[1].id, // Anna
      companyName: 'Ferrari Consulting SAS',
      partitaIva: '09876543210',
      pecEmail: 'ferrariconsulting@pec.it',
      legalRepresentative: 'Anna Ferrari',
      companyType: 'SAS',
      atecoCode: '70.22.09',
      employeeCount: 8,
      annualRevenueRange: '500K-1M',
    },
  ];

  for (const data of profilesData) {
    const existing = await repo.findOne({
      where: { partitaIva: data.partitaIva },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created business profile: ${data.companyName}`);
    } else {
      console.log(`  Business profile already exists: ${data.companyName}`);
    }
  }
}

export async function seedUserAddresses(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(UserAddress);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];

  const addressesData = [
    {
      userId: marco.id,
      addressType: AddressType.RESIDENTIAL,
      streetAddress: 'Via Roma 42',
      city: 'Roma',
      province: 'RM',
      postalCode: '00185',
      country: 'IT',
      isPrimary: true,
    },
    {
      userId: marco.id,
      addressType: AddressType.SUPPLY,
      streetAddress: 'Via Milano 15',
      city: 'Milano',
      province: 'MI',
      postalCode: '20121',
      country: 'IT',
      isPrimary: false,
    },
    {
      userId: laura.id,
      addressType: AddressType.RESIDENTIAL,
      streetAddress: 'Corso Umberto I 88',
      city: 'Napoli',
      province: 'NA',
      postalCode: '80138',
      country: 'IT',
      isPrimary: true,
    },
    {
      userId: giuseppe.id,
      addressType: AddressType.LEGAL,
      streetAddress: 'Via Po 22',
      city: 'Torino',
      province: 'TO',
      postalCode: '10123',
      country: 'IT',
      isPrimary: true,
    },
  ];

  for (const data of addressesData) {
    const existing = await repo.findOne({
      where: {
        userId: data.userId,
        addressType: data.addressType,
        streetAddress: data.streetAddress,
      },
    });
    if (!existing) {
      const addr = await repo.save(repo.create(data));
      ctx.addresses.push(addr);
      console.log(`  Created address: ${data.streetAddress}, ${data.city}`);
    } else {
      ctx.addresses.push(existing);
      console.log(
        `  Address already exists: ${data.streetAddress}, ${data.city}`,
      );
    }
  }
}

export async function seedUserPreferences(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(UserPreference);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];

  const prefsData = [
    {
      userId: marco.id,
      paymentMethod: PaymentMethod.RID_BANCARIO,
      invoiceDelivery: InvoiceDelivery.DIGITAL,
      language: LanguagePref.ITALIANO,
      contactPreference: 'email',
      marketingConsent: true,
      gdprConsentAt: new Date('2026-01-15T10:00:00Z'),
      iban: 'IT60X0542811101000000123456',
    },
    {
      userId: laura.id,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      invoiceDelivery: InvoiceDelivery.PAPER,
      language: LanguagePref.ITALIANO,
      contactPreference: 'phone',
      marketingConsent: false,
      gdprConsentAt: new Date('2026-03-10T14:30:00Z'),
    },
    {
      userId: giuseppe.id,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      invoiceDelivery: InvoiceDelivery.DIGITAL,
      language: LanguagePref.ENGLISH,
      contactPreference: 'email',
      marketingConsent: true,
      gdprConsentAt: new Date('2026-02-20T09:00:00Z'),
      iban: 'IT40S0542811101000000654321',
    },
  ];

  for (const data of prefsData) {
    const existing = await repo.findOne({ where: { userId: data.userId } });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created preferences for userId: ${data.userId}`);
    } else {
      console.log(`  Preferences already exist for userId: ${data.userId}`);
    }
  }
}
