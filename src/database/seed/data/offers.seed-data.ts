import { DataSource } from 'typeorm';
import { Offer } from '../../../modules/offers/entities/offer.entity';
import { OfferPriceVersion } from '../../../modules/offers/entities/offer-price-version.entity';
import {
  EnergyType,
  MarketType,
  UserTarget,
} from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';
import { SeedContext } from '../seed-context';

export async function seedOffers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Offer);
  const [enel, eni, a2a, edison] = ctx.suppliers;
  const admin = ctx.users.admin;

  const offersData = [
    {
      name: 'Luce Fissa 24',
      description:
        'Offerta a prezzo fisso per 24 mesi sulla componente energia. Ideale per chi cerca stabilità e sicurezza nei costi della bolletta.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.085,
      fixedMonthlyFee: 8.5,
      activationCost: 0,
      contractDurationMonths: 24,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      offerCode: 'SEED-ENEL-LF24',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo bloccato 24 mesi',
        'Zero costi di attivazione',
        'Bolletta digitale inclusa',
      ],
      supplierId: enel.id,
      createdBy: admin.id,
    },
    {
      name: 'Gas Casa',
      description:
        'Offerta gas a prezzo fisso per uso domestico. Inclusa assistenza caldaia gratuita per il primo anno.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.45,
      fixedMonthlyFee: 6.0,
      activationCost: 0,
      contractDurationMonths: 12,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      offerCode: 'SEED-ENEL-GC',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Assistenza caldaia inclusa',
        'Prezzo fisso 12 mesi',
        'Sconto 10% primo mese',
      ],
      supplierId: enel.id,
      createdBy: admin.id,
    },
    {
      name: 'Trend Casa Luce',
      description:
        'Offerta a prezzo variabile indicizzato al PUN. Per chi vuole beneficiare delle oscillazioni di mercato.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.VARIABLE,
      pricePerKwh: 0.075,
      fixedMonthlyFee: 5.0,
      activationCost: 25.0,
      contractDurationMonths: 12,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      target: UserTarget.PERSONAL,
      offerCode: 'SEED-ENI-TCL',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo indicizzato PUN',
        'App di monitoraggio inclusa',
        'Nessun vincolo',
      ],
      supplierId: eni.id,
      createdBy: admin.id,
    },
    {
      name: 'Dual Business Pro',
      description:
        'Offerta combinata luce e gas per le aziende, indicizzata ai mercati all\'ingrosso. Consulente dedicato incluso.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.INDEXED,
      pricePerKwh: 0.065,
      pricePerSmc: 0.38,
      fixedMonthlyFee: 15.0,
      activationCost: 0,
      contractDurationMonths: 36,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-15'),
      target: UserTarget.BUSINESS,
      offerCode: 'SEED-ENI-DBP',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Consulente dedicato',
        'Report mensile consumi',
        'Energia 100% verde',
        'Fatturazione personalizzata',
      ],
      supplierId: eni.id,
      createdBy: admin.id,
    },
    {
      name: 'Click Luce Verde',
      description:
        'Offerta 100% energia rinnovabile a prezzo fisso. Certificata con Garanzia d\'Origine.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.095,
      fixedMonthlyFee: 7.0,
      activationCost: 0,
      contractDurationMonths: 12,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-09-30'),
      target: UserTarget.BOTH,
      offerCode: 'SEED-A2A-CLV',
      offerStatus: OfferStatus.EXPIRING,
      highlights: [
        '100% energia verde',
        'Certificazione GO',
        'Zero emissioni CO2',
      ],
      supplierId: a2a.id,
      createdBy: admin.id,
    },
  ];

  for (const data of offersData) {
    let offer = await repo.findOne({
      where: { offerCode: data.offerCode },
      withDeleted: true,
    });
    if (!offer) {
      offer = await repo.save(repo.create(data));
      console.log(`  Created offer: ${data.name}`);
    } else {
      console.log(`  Offer already exists: ${data.name}`);
    }
    ctx.offers.push(offer);
  }

  // Create a versioned offer (child of Luce Fissa 24) to test parentOfferId
  const parentOffer = ctx.offers[0]; // Luce Fissa 24
  const childOfferCode = 'SEED-ENEL-LF24-V2';
  let childOffer = await repo.findOne({
    where: { offerCode: childOfferCode },
    withDeleted: true,
  });
  if (!childOffer) {
    childOffer = await repo.save(
      repo.create({
        name: 'Luce Fissa 24 v2',
        description: 'Versione aggiornata con prezzo ridotto.',
        energyType: EnergyType.ELECTRICITY,
        marketType: MarketType.FIXED,
        pricePerKwh: 0.079,
        fixedMonthlyFee: 7.5,
        activationCost: 0,
        contractDurationMonths: 24,
        isGreenEnergy: false,
        isActive: false,
        validFrom: new Date('2026-07-01'),
        target: UserTarget.BOTH,
        offerCode: childOfferCode,
        offerStatus: OfferStatus.DRAFT,
        version: 2,
        parentOfferId: parentOffer.id,
        supplierId: enel.id,
        createdBy: admin.id,
      }),
    );
    console.log('  Created offer: Luce Fissa 24 v2 (child)');
  } else {
    console.log('  Offer already exists: Luce Fissa 24 v2 (child)');
  }
  ctx.offers.push(childOffer);
}

export async function seedOfferPriceVersions(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(OfferPriceVersion);
  const luceFissa = ctx.offers[0]; // Luce Fissa 24
  const gasCasa = ctx.offers[1]; // Gas Casa

  const versionsData = [
    {
      offerId: luceFissa.id,
      versionLabel: 'v1.0',
      pricePerKwh: 0.092,
      fixedMonthlyFee: 9.0,
      activationCost: 0,
      validFrom: new Date('2025-07-01'),
      validUntil: new Date('2025-12-31'),
      isCurrent: false,
      priceData: {
        f1: 0.105,
        f2: 0.092,
        f3: 0.078,
        note: 'Tariffa trioraria precedente',
      },
    },
    {
      offerId: luceFissa.id,
      versionLabel: 'v2.0',
      pricePerKwh: 0.085,
      fixedMonthlyFee: 8.5,
      activationCost: 0,
      validFrom: new Date('2026-01-01'),
      isCurrent: true,
      priceData: {
        f1: 0.098,
        f2: 0.085,
        f3: 0.072,
        note: 'Tariffa trioraria corrente',
      },
    },
    {
      offerId: gasCasa.id,
      versionLabel: 'v1.0',
      pricePerSmc: 0.45,
      fixedMonthlyFee: 6.0,
      activationCost: 0,
      validFrom: new Date('2026-01-01'),
      isCurrent: true,
      priceData: {
        baseSmc: 0.45,
        scaglione1: { maxSmc: 120, price: 0.42 },
        scaglione2: { maxSmc: 480, price: 0.45 },
        scaglione3: { minSmc: 480, price: 0.48 },
      },
    },
  ];

  for (const data of versionsData) {
    const existing = await repo.findOne({
      where: { offerId: data.offerId, versionLabel: data.versionLabel },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(
        `  Created price version: ${data.versionLabel} for offer ${data.offerId.substring(0, 8)}...`,
      );
    } else {
      console.log(
        `  Price version already exists: ${data.versionLabel} for offer ${data.offerId.substring(0, 8)}...`,
      );
    }
  }
}
