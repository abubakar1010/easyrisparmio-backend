import { NestFactory } from '@nestjs/core';
import { DataSource, Not } from 'typeorm';
import { AppModule } from '../../app.module';
import { User } from '../../modules/users/entities/user.entity';
import { UserAddress } from '../../modules/users/entities/user-address.entity';
import { UserPreference } from '../../modules/users/entities/user-preference.entity';
import { BusinessProfile } from '../../modules/users/entities/business-profile.entity';
import { EnergyBill } from '../../modules/bills/entities/energy-bill.entity';
import { BillAnalysis } from '../../modules/bills/entities/bill-analysis.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { SupportTicket } from '../../modules/support/entities/support-ticket.entity';
import { TicketMessage } from '../../modules/support/entities/ticket-message.entity';
import { Supplier } from '../../modules/suppliers/entities/supplier.entity';
import { UserRole } from '../../common/enums/role.enum';
import { AddressType } from '../../common/enums/address.enum';
import {
  PaymentMethod,
  InvoiceDelivery,
  LanguagePref,
} from '../../common/enums/payment.enum';
import { BillType, BillStatus } from '../../common/enums/bill.enum';
import { MarketType } from '../../common/enums/offer.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../common/enums/support.enum';

// ── Italian data pools for realistic generation ──

const ITALIAN_STREETS = [
  'Via Roma', 'Via Milano', 'Corso Vittorio Emanuele', 'Via Garibaldi',
  'Via Dante', 'Via Mazzini', 'Via Verdi', 'Corso Italia',
  'Via Cavour', 'Via Leopardi', 'Via Marconi', 'Via dei Mille',
  'Via Nazionale', 'Viale della Libertà', 'Via Pascoli', 'Via Petrarca',
  'Via XX Settembre', 'Via Gramsci', 'Via Matteotti', 'Via De Gasperi',
];

const ITALIAN_CITIES: { city: string; province: string; postalCode: string }[] = [
  { city: 'Roma', province: 'RM', postalCode: '00185' },
  { city: 'Milano', province: 'MI', postalCode: '20121' },
  { city: 'Napoli', province: 'NA', postalCode: '80138' },
  { city: 'Torino', province: 'TO', postalCode: '10123' },
  { city: 'Firenze', province: 'FI', postalCode: '50122' },
  { city: 'Bologna', province: 'BO', postalCode: '40126' },
  { city: 'Genova', province: 'GE', postalCode: '16121' },
  { city: 'Palermo', province: 'PA', postalCode: '90133' },
  { city: 'Bari', province: 'BA', postalCode: '70121' },
  { city: 'Catania', province: 'CT', postalCode: '95124' },
  { city: 'Venezia', province: 'VE', postalCode: '30124' },
  { city: 'Verona', province: 'VR', postalCode: '37121' },
  { city: 'Padova', province: 'PD', postalCode: '35122' },
  { city: 'Trieste', province: 'TS', postalCode: '34121' },
  { city: 'Brescia', province: 'BS', postalCode: '25121' },
];

const COMPANY_TYPES = ['SRL', 'SAS', 'SPA', 'SRLS', 'SS'];
const ATECO_CODES = [
  '43.21.01', '70.22.09', '62.01.00', '47.11.40', '56.10.11',
  '41.20.00', '46.69.99', '25.11.00', '10.71.10', '55.10.00',
];
const REVENUE_RANGES = ['<100K', '100K-500K', '500K-1M', '1M-5M', '5M-10M'];

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generatePodNumber(): string {
  const digits = Array.from({ length: 8 }, () => randomInt(0, 9)).join('');
  return `IT001E${digits}`;
}

function generatePdrNumber(): string {
  return Array.from({ length: 14 }, () => randomInt(0, 9)).join('');
}

function generatePartitaIva(): string {
  return Array.from({ length: 11 }, () => randomInt(0, 9)).join('');
}

// ── Per-user seeding functions ──

async function seedAddressForUser(
  ds: DataSource,
  user: User,
): Promise<void> {
  const repo = ds.getRepository(UserAddress);

  const existing = await repo.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`    Address already exists for: ${user.email}`);
    return;
  }

  const location = pick(ITALIAN_CITIES);
  const addressType =
    user.role === UserRole.BUSINESS ? AddressType.LEGAL : AddressType.RESIDENTIAL;

  await repo.save(
    repo.create({
      userId: user.id,
      addressType,
      streetAddress: `${pick(ITALIAN_STREETS)} ${randomInt(1, 200)}`,
      city: location.city,
      province: location.province,
      postalCode: location.postalCode,
      country: 'IT',
      isPrimary: true,
    }),
  );
  console.log(`    Created address for: ${user.email} (${location.city})`);
}

async function seedPreferencesForUser(
  ds: DataSource,
  user: User,
): Promise<void> {
  const repo = ds.getRepository(UserPreference);

  const existing = await repo.findOne({ where: { userId: user.id } });
  if (existing) {
    console.log(`    Preferences already exist for: ${user.email}`);
    return;
  }

  const paymentMethods = [
    PaymentMethod.RID_BANCARIO,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.POSTAL_ORDER,
  ];

  await repo.save(
    repo.create({
      userId: user.id,
      paymentMethod: pick(paymentMethods),
      invoiceDelivery: pick([InvoiceDelivery.DIGITAL, InvoiceDelivery.PAPER]),
      language: LanguagePref.ITALIANO,
      contactPreference: pick(['email', 'phone', 'sms']),
      marketingConsent: Math.random() > 0.5,
      gdprConsentAt: new Date(),
    }),
  );
  console.log(`    Created preferences for: ${user.email}`);
}

async function seedBusinessProfileForUser(
  ds: DataSource,
  user: User,
): Promise<void> {
  if (user.role !== UserRole.BUSINESS) return;

  const repo = ds.getRepository(BusinessProfile);

  const existing = await repo.findOne({ where: { userId: user.id } });
  if (existing) {
    console.log(`    Business profile already exists for: ${user.email}`);
    return;
  }

  const companyName = `${user.lastName} ${pick(['Costruzioni', 'Consulting', 'Trading', 'Services', 'Logistica', 'Tech', 'Energia', 'Impianti'])} ${pick(COMPANY_TYPES)}`;

  await repo.save(
    repo.create({
      userId: user.id,
      companyName,
      partitaIva: generatePartitaIva(),
      pecEmail: `${user.lastName.toLowerCase()}@pec.it`,
      legalRepresentative: `${user.firstName} ${user.lastName}`,
      companyType: pick(COMPANY_TYPES),
      atecoCode: pick(ATECO_CODES),
      employeeCount: randomInt(2, 100),
      annualRevenueRange: pick(REVENUE_RANGES),
    }),
  );
  console.log(`    Created business profile for: ${user.email} (${companyName})`);
}

async function seedBillsForUser(
  ds: DataSource,
  user: User,
  suppliers: Supplier[],
): Promise<EnergyBill[]> {
  const repo = ds.getRepository(EnergyBill);

  const existingBills = await repo.find({ where: { userId: user.id }, withDeleted: true });
  if (existingBills.length > 0) {
    console.log(`    Bills already exist for: ${user.email} (${existingBills.length})`);
    return existingBills;
  }

  const bills: EnergyBill[] = [];
  const isBusiness = user.role === UserRole.BUSINESS;
  const billCount = isBusiness ? randomInt(1, 3) : randomInt(1, 2);
  const statuses = [BillStatus.UPLOADED, BillStatus.ANALYZING, BillStatus.ANALYZED];

  for (let i = 0; i < billCount; i++) {
    const billType = i === 0 ? BillType.ELECTRICITY : pick([BillType.ELECTRICITY, BillType.GAS]);
    const isElectricity = billType === BillType.ELECTRICITY;
    const status = pick(statuses);
    const supplier = pick(suppliers);

    const consumptionKwh = isElectricity
      ? (isBusiness ? randomDecimal(3000, 15000) : randomDecimal(200, 800))
      : undefined;
    const consumptionSmc = !isElectricity ? randomDecimal(80, 400) : undefined;
    const costPerUnit = isElectricity ? randomDecimal(0.07, 0.15, 6) : randomDecimal(0.35, 0.55, 6);
    const consumption = isElectricity ? consumptionKwh! : consumptionSmc!;
    const fixedCharges = isBusiness ? randomDecimal(100, 350) : randomDecimal(15, 50);
    const taxes = randomDecimal(15, 150);
    const totalAmount = parseFloat((consumption * costPerUnit + fixedCharges + taxes).toFixed(2));

    const periodStart = new Date(`2026-0${randomInt(1, 4)}-01`);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 2);
    periodEnd.setDate(0); // last day of prev month

    const billData: Partial<EnergyBill> = {
      userId: user.id,
      supplierId: status !== BillStatus.UPLOADED ? supplier.id : undefined,
      fileUrl: `/uploads/bills/seed-${user.id.substring(0, 8)}-${billType}-${i}.pdf`,
      billType,
      status,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      totalAmount,
      costPerUnit: status !== BillStatus.UPLOADED ? costPerUnit : undefined,
      fixedCharges: status !== BillStatus.UPLOADED ? fixedCharges : undefined,
      taxes: status !== BillStatus.UPLOADED ? taxes : undefined,
    };

    if (isElectricity) {
      billData.podNumber = generatePodNumber();
      billData.consumptionKwh = consumptionKwh;
    } else {
      billData.pdrNumber = generatePdrNumber();
      billData.consumptionSmc = consumptionSmc;
    }

    if (status === BillStatus.ANALYZED) {
      billData.rawAnalysisData = {
        ocrConfidence: randomDecimal(0.85, 0.97),
        extractedFields: {
          ...(isElectricity
            ? { pod: billData.podNumber, totalKwh: consumptionKwh }
            : { pdr: billData.pdrNumber, totalSmc: consumptionSmc }),
          totalAmount,
        },
      };
    }

    const bill = await repo.save(repo.create(billData));
    bills.push(bill);
    console.log(`    Created bill: ${billType} (${status}) for ${user.email} — €${totalAmount}`);
  }

  return bills;
}

async function seedBillAnalysesForUser(
  ds: DataSource,
  bills: EnergyBill[],
  userEmail: string,
): Promise<void> {
  const repo = ds.getRepository(BillAnalysis);

  const analyzedBills = bills.filter((b) => b.status === BillStatus.ANALYZED);
  if (analyzedBills.length === 0) return;

  for (const bill of analyzedBills) {
    const existing = await repo.findOne({ where: { billId: bill.id } });
    if (existing) {
      console.log(`    Bill analysis already exists for bill: ${bill.id.substring(0, 8)}...`);
      continue;
    }

    const isElectricity = bill.billType === BillType.ELECTRICITY;
    const savingsPercentage = randomDecimal(5, 25);
    const potentialSavings = parseFloat(
      ((bill.totalAmount * savingsPercentage) / 100).toFixed(2),
    );

    await repo.save(
      repo.create({
        billId: bill.id,
        potentialSavings,
        currentMonthlyAvg: parseFloat((bill.totalAmount / 2).toFixed(2)),
        recommendedMarketType: pick([MarketType.FIXED, MarketType.VARIABLE]),
        analysisSummary: isElectricity
          ? `La bolletta presenta un costo unitario di ${bill.costPerUnit} €/kWh. Passando a un'offerta più competitiva si potrebbe risparmiare circa ${potentialSavings} EUR.`
          : `Il contratto gas ha un costo di ${bill.costPerUnit} €/smc. Un'offerta alternativa potrebbe generare un risparmio di ${potentialSavings} EUR.`,
        analysisDetails: {
          ...(isElectricity
            ? {
                currentPricePerKwh: bill.costPerUnit,
                marketAvgPricePerKwh: randomDecimal(0.07, 0.1, 4),
              }
            : {
                currentPricePerSmc: bill.costPerUnit,
                marketAvgPricePerSmc: randomDecimal(0.35, 0.45, 4),
              }),
          savingsPercentage,
          consumptionProfile: isElectricity ? 'standard domestico' : 'riscaldamento autonomo',
        },
        confidenceScore: randomDecimal(0.78, 0.95),
        recommendedOffers: [],
        offersSentToUser: Math.random() > 0.5,
      }),
    );
    console.log(`    Created bill analysis for ${userEmail} (${bill.billType})`);
  }
}

async function seedNotificationsForUser(
  ds: DataSource,
  user: User,
): Promise<void> {
  const repo = ds.getRepository(Notification);

  const existing = await repo.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`    Notifications already exist for: ${user.email} (${existing})`);
    return;
  }

  const notifications = [
    {
      userId: user.id,
      title: 'Benvenuto su EasyRisparmio',
      body: `Ciao ${user.firstName}, benvenuto sulla piattaforma! Carica la tua prima bolletta per iniziare a risparmiare.`,
      type: NotificationType.GENERAL,
      isRead: true,
      readAt: new Date(),
    },
    {
      userId: user.id,
      title: 'Nuova offerta disponibile',
      body: 'Abbiamo trovato un\'offerta che potrebbe farti risparmiare. Scoprila ora!',
      type: NotificationType.OFFER_AVAILABLE,
      isRead: false,
    },
  ];

  for (const data of notifications) {
    await repo.save(repo.create(data));
  }
  console.log(`    Created ${notifications.length} notifications for: ${user.email}`);
}

async function seedSupportTicketForUser(
  ds: DataSource,
  user: User,
  admin: User | null,
): Promise<void> {
  const repo = ds.getRepository(SupportTicket);
  const msgRepo = ds.getRepository(TicketMessage);

  const existing = await repo.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`    Support ticket already exists for: ${user.email}`);
    return;
  }

  const subjects = [
    { subject: 'Problema con la bolletta', category: TicketCategory.BILLING_PAYMENTS },
    { subject: 'Informazioni cambio fornitore', category: TicketCategory.SWITCHING },
    { subject: 'Problema tecnico con l\'app', category: TicketCategory.TECHNICAL_SUPPORT },
    { subject: 'Richiesta informazioni generali', category: TicketCategory.GENERAL },
  ];

  const chosen = pick(subjects);
  const status = pick([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED]);

  const ticket = await repo.save(
    repo.create({
      userId: user.id,
      assignedAgentId: admin?.id,
      subject: chosen.subject,
      category: chosen.category,
      priority: pick([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH]),
      status,
      ...(status === TicketStatus.RESOLVED
        ? { resolvedAt: new Date() }
        : {}),
    }),
  );

  // Add an initial message from the user
  await msgRepo.save(
    msgRepo.create({
      ticketId: ticket.id,
      senderId: user.id,
      message: `Buongiorno, avrei bisogno di assistenza riguardo: ${chosen.subject.toLowerCase()}.`,
    }),
  );

  console.log(`    Created support ticket for: ${user.email} (${chosen.subject})`);
}

// ── Main runner ──

async function run(): Promise<void> {
  process.env.SKIP_AUTO_SEED = 'true';

  console.log('\n========================================');
  console.log('  EasyRisparmio — Seed All Existing Users');
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);

  try {
    const userRepo = ds.getRepository(User);
    const supplierRepo = ds.getRepository(Supplier);

    // Fetch all non-admin users
    const users = await userRepo.find({
      where: { role: Not(UserRole.ADMIN) },
    });

    // Find admin for ticket assignment
    const admin = await userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });

    // Fetch suppliers for bill seeding
    const suppliers = await supplierRepo.find();

    if (users.length === 0) {
      console.log('  No users found. Run the main seed first: npm run seed');
      await app.close();
      process.exit(0);
    }

    if (suppliers.length === 0) {
      console.log('  No suppliers found. Run the main seed first: npm run seed');
      await app.close();
      process.exit(0);
    }

    console.log(`  Found ${users.length} user(s) to seed data for.\n`);

    let seededCount = 0;

    for (const user of users) {
      console.log(`\n  [${++seededCount}/${users.length}] ${user.email} (${user.role})`);

      // Level 0: Address
      await seedAddressForUser(ds, user);

      // Level 0: Preferences
      await seedPreferencesForUser(ds, user);

      // Level 0: Business profile (if business user)
      await seedBusinessProfileForUser(ds, user);

      // Level 1: Bills
      const bills = await seedBillsForUser(ds, user, suppliers);

      // Level 2: Bill analyses (for analyzed bills)
      await seedBillAnalysesForUser(ds, bills, user.email);

      // Level 1: Notifications
      await seedNotificationsForUser(ds, user);

      // Level 1: Support ticket + message
      await seedSupportTicketForUser(ds, user, admin);
    }

    console.log('\n========================================');
    console.log(`  Done! Seeded data for ${seededCount} user(s).`);
    console.log('========================================\n');
  } catch (error) {
    console.error('\n  Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }

  process.exit(0);
}

run();
