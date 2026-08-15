import { DataSource } from 'typeorm';
import { Offer } from '../../../modules/offers/entities/offer.entity';
import { OfferPriceVersion } from '../../../modules/offers/entities/offer-price-version.entity';
import {
  EnergyType,
  MarketType,
  OfferPaymentMethod,
  UserTarget,
} from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';
import { SeedContext } from '../seed-context';

/**
 * Helper to find a supplier by code from the seed context.
 * Returns undefined if not found (offer will be skipped).
 */
function supplierByCode(ctx: SeedContext, code: string) {
  return ctx.suppliers.find((s) => s.supplierCode === code);
}

export async function seedOffers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Offer);
  const admin = ctx.users.admin;

  const offersData = [
    // ── Enel Energia ────────────────────────────────────────────────
    {
      name: 'Enel Luce Fissa 24',
      description:
        'Offerta a prezzo fisso per 24 mesi sulla componente energia elettrica. Ideale per chi cerca stabilità e protezione dalle oscillazioni del mercato. Bolletta digitale e gestione online tramite app.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.083,
      fixedMonthlyFee: 8.5,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-ENEL-LF24',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo bloccato 24 mesi',
        'Zero costi di attivazione',
        'Bolletta digitale inclusa',
        'Gestione completa da app',
      ],
      compensation: 'Bonus di €50 in bolletta dopo 3 mesi di attivazione',
      supplierCode: 'ENEL',
    },
    {
      name: 'Enel Gas Casa Sicura',
      description:
        'Offerta gas a prezzo fisso per uso domestico. Prezzo bloccato per 12 mesi con assistenza caldaia gratuita per il primo anno. Ideale per riscaldamento autonomo.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.44,
      fixedMonthlyFee: 6.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-ENEL-GCS',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Assistenza caldaia inclusa',
        'Prezzo fisso 12 mesi',
        'Sconto 10% primo bimestre',
        'Nessun costo di attivazione',
      ],
      compensation: 'Sconto del 10% sul primo bimestre',
      supplierCode: 'ENEL',
    },
    {
      name: 'Enel Dual Casa',
      description:
        'Offerta combinata luce e gas a prezzo fisso per clienti residenziali. Un unico fornitore, un\'unica bolletta. Risparmio garantito rispetto al mercato tutelato.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.079,
      pricePerSmc: 0.42,
      fixedMonthlyFee: 12.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2027-02-28'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-ENEL-DC',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Luce e gas in un\'unica bolletta',
        'Prezzo fisso 12 mesi',
        'Zero costi di attivazione',
        'Risparmio medio 120€/anno',
      ],
      compensation: 'Cashback di €30 sulla prima bolletta',
      supplierCode: 'ENEL',
    },

    // ── Eni Plenitude ────────────────────────────────────────────────
    {
      name: 'Eni Trend Casa Luce',
      description:
        'Offerta a prezzo variabile indicizzato al PUN (Prezzo Unico Nazionale). Per chi vuole beneficiare delle oscillazioni al ribasso del mercato energetico all\'ingrosso.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.VARIABLE,
      spread: 0.015,
      fixedMonthlyFee: 5.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-ENI-TCL',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo indicizzato PUN',
        'Spread competitivo 0,015 €/kWh',
        'App di monitoraggio consumi',
        'Nessun vincolo di durata',
      ],
      compensation: 'Bonus fedeltà di €40 dopo 6 mesi',
      supplierCode: 'ENI',
    },
    {
      name: 'Eni Gas Relax',
      description:
        'Gas naturale a prezzo fisso per 12 mesi. Offerta pensata per famiglie con riscaldamento autonomo. Prezzo trasparente senza sorprese in bolletta.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.46,
      fixedMonthlyFee: 5.5,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-15'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-ENI-GR',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Bolletta trasparente',
        'Assistenza dedicata',
        'Zero costi nascosti',
      ],
      compensation: 'Sconto €25 sulla prima bolletta gas',
      supplierCode: 'ENI',
    },
    {
      name: 'Eni Business Dual Pro',
      description:
        'Offerta combinata luce e gas per le aziende, indicizzata ai mercati all\'ingrosso (PUN + PSV). Consulente energetico dedicato incluso nel prezzo.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.INDEXED,
      spread: 0.012,
      fixedMonthlyFee: 18.0,
      activationCost: 0,
      contractDurationDays: 1095,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-15'),
      target: UserTarget.BUSINESS,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-ENI-BDP',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Consulente dedicato',
        'Report mensile consumi',
        'Energia 100% verde certificata GO',
        'Fatturazione personalizzata',
      ],
      compensation: 'Gift card da €60 per nuovi clienti dual',
      supplierCode: 'ENI',
    },

    // ── A2A Energia ──────────────────────────────────────────────────
    {
      name: 'A2A Click Luce Verde',
      description:
        'Offerta 100% energia rinnovabile a prezzo fisso. Certificata con Garanzia d\'Origine (GO). Per chi vuole ridurre la propria impronta di carbonio senza rinunciare al risparmio.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.091,
      fixedMonthlyFee: 7.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-A2A-CLV',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        '100% energia verde certificata',
        'Garanzia d\'Origine (GO)',
        'Zero emissioni CO2',
        'Prezzo fisso 12 mesi',
      ],
      compensation: 'Bonus di €35 per attivazione online',
      supplierCode: 'A2A',
    },
    {
      name: 'A2A Gas Naturale Casa',
      description:
        'Gas naturale per uso domestico a tariffa fissa. Offerta pensata per le famiglie lombarde con prezzo competitivo e gestione semplificata tramite area clienti online.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.43,
      fixedMonthlyFee: 5.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-A2A-GNC',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Area clienti online',
        'Pagamento con RID bancario',
        'Assistenza telefonica dedicata',
      ],
      compensation: 'Sconto 15% sul primo trimestre',
      supplierCode: 'A2A',
    },

    // ── Edison Energia ───────────────────────────────────────────────
    {
      name: 'Edison World Luce',
      description:
        'Energia elettrica a prezzo fisso per 24 mesi con sconto in bolletta e servizio Edison World incluso: assistenza elettricista, idraulico e fabbro.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.082,
      fixedMonthlyFee: 9.0,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-EDISON-WL',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo bloccato 24 mesi',
        'Servizio casa Edison World',
        'Assistenza elettricista inclusa',
        'Bonus fedeltà al rinnovo',
      ],
      compensation: "Buono Amazon da €50 all'attivazione",
      supplierCode: 'EDISON',
    },
    {
      name: 'Edison Business Energia',
      description:
        'Offerta luce e gas per PMI e grandi aziende a prezzo indicizzato. Energy manager dedicato e report di efficienza energetica mensili.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.INDEXED,
      spread: 0.01,
      fixedMonthlyFee: 22.0,
      activationCost: 0,
      contractDurationDays: 1095,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.BUSINESS,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-EDISON-BE',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Energy manager dedicato',
        'Report mensile efficienza',
        'Contratto 36 mesi',
        'Fatturazione elettronica',
      ],
      compensation: 'Rimborso di €20 sulla prima bolletta',
      supplierCode: 'EDISON',
    },

    // ── Sorgenia ─────────────────────────────────────────────────────
    {
      name: 'Sorgenia Next Energy Luce',
      description:
        'Offerta luce 100% verde a prezzo variabile indicizzato al PUN. Gestione completamente digitale tramite app. Energia certificata da fonti rinnovabili.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.VARIABLE,
      spread: 0.018,
      fixedMonthlyFee: 0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-SORG-NEL',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        '100% energia verde',
        'Zero costi fissi mensili',
        'Gestione 100% digitale',
        'Prezzo indicizzato PUN',
      ],
      compensation: 'Credito di €45 in bolletta verde',
      supplierCode: 'SORGENIA',
    },
    {
      name: 'Sorgenia Next Energy Gas',
      description:
        'Gas naturale a prezzo variabile indicizzato al PSV. Gestione completamente digitale, nessun costo fisso mensile. Trasparenza totale in bolletta.',
      energyType: EnergyType.GAS,
      marketType: MarketType.VARIABLE,
      spread: 0.05,
      fixedMonthlyFee: 0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-SORG-NEG',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Zero costi fissi mensili',
        'Prezzo indicizzato PSV',
        'Gestione 100% digitale',
        'Bolletta senza sorprese',
      ],
      compensation: 'Cashback di €30 sulla prima bolletta gas',
      supplierCode: 'SORGENIA',
    },

    // ── Iren Mercato ─────────────────────────────────────────────────
    {
      name: 'Iren 10 Per Te Luce',
      description:
        'Offerta luce a prezzo fisso con sconto del 10% rispetto al servizio di tutela. Attivazione online rapida e assistenza clienti dedicata.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.078,
      fixedMonthlyFee: 6.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-IREN-10L',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Sconto 10% su tutela',
        'Prezzo fisso 12 mesi',
        'Attivazione online',
        'App IrenYou inclusa',
      ],
      compensation: 'Bonus benvenuto di €25',
      supplierCode: 'IREN',
    },
    {
      name: 'Iren Gas Smart',
      description:
        'Gas naturale a tariffa fissa competitiva per famiglie. Include il servizio Smart Gas per il monitoraggio dei consumi da remoto.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.41,
      fixedMonthlyFee: 5.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-IREN-GS',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Monitoraggio Smart Gas',
        'Nessun costo di attivazione',
        'Bolletta digitale',
      ],
      compensation: 'Sconto del 5% per 6 mesi',
      supplierCode: 'IREN',
    },

    // ── E.ON Energia ─────────────────────────────────────────────────
    {
      name: 'E.ON Luce e Gas Together',
      description:
        'Offerta combinata luce e gas a prezzo fisso con sconto esclusivo per chi attiva entrambe le forniture. Risparmio garantito e prezzo bloccato per 24 mesi.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.076,
      pricePerSmc: 0.40,
      fixedMonthlyFee: 10.0,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-EON-LGT',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Sconto dual fuel',
        'Prezzo bloccato 24 mesi',
        'Un\'unica bolletta',
        'Servizio clienti premium',
      ],
      compensation: 'Credito di €55 per contratto dual',
      supplierCode: 'EON',
    },

    // ── Acea Energia ─────────────────────────────────────────────────
    {
      name: 'Acea Unica Luce',
      description:
        'Energia elettrica a prezzo fisso per clienti residenziali del Lazio e centro Italia. Prezzo competitivo con bolletta chiara e trasparente.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.084,
      fixedMonthlyFee: 7.5,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2027-02-28'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-ACEA-UL',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Bolletta chiara e semplice',
        'App MyAcea inclusa',
        'Pagamento flessibile',
      ],
      compensation: 'Sconto di €20 sulla prima bolletta',
      supplierCode: 'ACEA',
    },

    // ── Engie Italia ─────────────────────────────────────────────────
    {
      name: 'Engie Simply Gas',
      description:
        'Gas naturale a prezzo fisso senza complicazioni. Offerta semplice e trasparente con prezzo bloccato per 12 mesi e attivazione gratuita.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.42,
      fixedMonthlyFee: 4.5,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-ENGIE-SG',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Zero costi di attivazione',
        'Bolletta semplificata',
        'Assistenza multicanale',
      ],
      compensation: 'Buono da €40 per nuovi clienti',
      supplierCode: 'ENGIE',
    },

    // ── Illumia ──────────────────────────────────────────────────────
    {
      name: 'Illumia Luce Wow',
      description:
        'Energia elettrica 100% da fonti rinnovabili a prezzo fisso. Offerta pensata per chi vuole risparmiare e rispettare l\'ambiente. Certificata con Garanzia d\'Origine.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.088,
      fixedMonthlyFee: 5.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-ILL-LW',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        '100% energia rinnovabile',
        'Prezzo fisso 12 mesi',
        'Certificazione GO',
        'Basso costo fisso mensile',
      ],
      compensation: 'Cashback di €35 sulla prima bolletta',
      supplierCode: 'ILLUMIA',
    },

    // ── Wekiwi ───────────────────────────────────────────────────────
    {
      name: 'Wekiwi Energia a Consumo',
      description:
        'Luce a prezzo variabile con modello pay-per-use. Scegli la tua carica mensile e paga solo quello che consumi. Sconto per chi prevede bene i consumi.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.VARIABLE,
      spread: 0.02,
      fixedMonthlyFee: 0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-WEK-EC',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Modello pay-per-use',
        'Zero costi fissi',
        'Sconto carica anticipata',
        'App per gestione consumi',
      ],
      compensation: 'Bonus di €25 per attivazione digitale',
      supplierCode: 'WEKIWI',
    },

    // ── Alperia Energy ───────────────────────────────────────────────
    {
      name: 'Alperia Smart Strom',
      description:
        'Energia elettrica 100% da fonti rinnovabili alpine (idroelettrico). Prezzo fisso per 24 mesi. Prodotta localmente dagli impianti idroelettrici dell\'Alto Adige.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.075,
      fixedMonthlyFee: 6.0,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-ALP-SS',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        '100% idroelettrico alpino',
        'Prezzo bloccato 24 mesi',
        'Energia a km zero',
        'Certificazione GO rinnovabile',
      ],
      compensation: 'Sconto €30 per energia verde',
      supplierCode: 'ALPERIA',
    },

    // ── Dolomiti Energia ─────────────────────────────────────────────
    {
      name: 'Dolomiti Luce 100% Pulita',
      description:
        'Energia elettrica 100% da fonti rinnovabili prodotta dalle centrali idroelettriche del Trentino. Offerta a prezzo fisso con la garanzia della qualità Dolomiti.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.077,
      fixedMonthlyFee: 5.5,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-DOL-L100',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        '100% energia pulita del Trentino',
        'Prezzo fisso 12 mesi',
        'Zero emissioni CO2',
        'Certificazione 100% rinnovabile',
      ],
      compensation: 'Buono da €20 per nuovi clienti',
      supplierCode: 'DOLOMITI',
    },

    // ── Pulsee (Axpo) ────────────────────────────────────────────────
    {
      name: 'Pulsee Luce Fix Clean',
      description:
        'Offerta luce digitale a prezzo fisso. 100% online, nessun intermediario. Energia certificata verde con Garanzia d\'Origine. Gestione completa tramite app.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.08,
      fixedMonthlyFee: 4.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2027-02-28'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-PUL-LFC',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Energia verde certificata GO',
        '100% digitale',
        'Costo fisso mensile basso',
        'Prezzo fisso 12 mesi',
      ],
      compensation: 'Credito di €40 per attivazione app',
      supplierCode: 'PULSEE',
    },

    // ── NeN ──────────────────────────────────────────────────────────
    {
      name: 'NeN Luce ad Abbonamento',
      description:
        'Luce in abbonamento: rata mensile fissa calcolata sul tuo consumo stimato. Nessuna bolletta a sorpresa, conguaglio una volta l\'anno. 100% green.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.086,
      fixedMonthlyFee: 0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-NEN-LA',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Rata fissa mensile',
        'Nessuna bolletta a sorpresa',
        '100% energia verde',
        'Conguaglio annuale',
      ],
      compensation: 'Sconto del 10% per 3 mesi',
      supplierCode: 'NEN',
    },
    {
      name: 'NeN Gas ad Abbonamento',
      description:
        'Gas in abbonamento: rata mensile fissa calcolata sul tuo consumo stimato. Nessuna bolletta a sorpresa, conguaglio una volta l\'anno.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.48,
      fixedMonthlyFee: 0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-NEN-GA',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Rata fissa mensile',
        'Nessuna bolletta a sorpresa',
        'Prezzo trasparente',
        'Conguaglio annuale',
      ],
      compensation: 'Cashback di €50 per dual',
      supplierCode: 'NEN',
    },

    // ── Green Network ────────────────────────────────────────────────
    {
      name: 'Green Network Placet Verde',
      description:
        'Offerta PLACET (Prezzo Libero A Condizioni Equiparate di Tutela) con energia 100% verde. Condizioni contrattuali standard definite da ARERA.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.09,
      fixedMonthlyFee: 3.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: true,
      isActive: true,
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2027-03-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-GN-PV',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Offerta PLACET regolamentata',
        '100% energia verde',
        'Condizioni standard ARERA',
        'Costo fisso mensile minimo',
      ],
      compensation: 'Bonus verde di €35',
      supplierCode: 'GREENNETWORK',
    },

    // ── Optima Italia ────────────────────────────────────────────────
    {
      name: 'Optima Tutto Incluso',
      description:
        'Luce, gas, internet e telefono in un\'unica bolletta. Rata mensile fissa senza sorprese. Ideale per chi vuole semplificare la gestione delle utenze domestiche.',
      energyType: EnergyType.DUAL,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.095,
      pricePerSmc: 0.50,
      fixedMonthlyFee: 15.0,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.DIRECT_DEBIT,
      offerCode: 'SEED-OPT-TI',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Luce + gas + internet + telefono',
        'Un\'unica bolletta mensile',
        'Rata fissa senza sorprese',
        'Assistenza dedicata',
      ],
      compensation: 'Sconto €45 sulla prima bolletta',
      supplierCode: 'OPTIMA',
    },

    // ── Estra Energie ────────────────────────────────────────────────
    {
      name: 'Estra Casa Gas',
      description:
        'Gas naturale a prezzo fisso per clienti residenziali del centro Italia. Offerta con prezzo bloccato 12 mesi e assistenza clienti locale.',
      energyType: EnergyType.GAS,
      marketType: MarketType.FIXED,
      pricePerSmc: 0.45,
      fixedMonthlyFee: 4.0,
      activationCost: 0,
      contractDurationDays: 365,
      isGreenEnergy: false,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      target: UserTarget.PERSONAL,
      paymentMethod: OfferPaymentMethod.POSTAL_ORDER,
      offerCode: 'SEED-ESTRA-CG',
      offerStatus: OfferStatus.ACTIVE,
      highlights: [
        'Prezzo fisso 12 mesi',
        'Assistenza locale',
        'Bolletta digitale',
        'Nessun costo di attivazione',
      ],
      compensation: 'Credito di €25 per nuovi clienti',
      supplierCode: 'ESTRA',
    },

    // ── Expired/Expiring offers for test diversity ───────────────────
    {
      name: 'Enel Luce Fissa 24 v2 (Draft)',
      description:
        'Versione aggiornata dell\'offerta Luce Fissa 24 con prezzo ridotto. In fase di approvazione.',
      energyType: EnergyType.ELECTRICITY,
      marketType: MarketType.FIXED,
      pricePerKwh: 0.075,
      fixedMonthlyFee: 7.5,
      activationCost: 0,
      contractDurationDays: 730,
      isGreenEnergy: false,
      isActive: false,
      validFrom: new Date('2026-07-01'),
      target: UserTarget.BOTH,
      paymentMethod: OfferPaymentMethod.BOTH,
      offerCode: 'SEED-ENEL-LF24-V2',
      offerStatus: OfferStatus.DRAFT,
      version: 2,
      highlights: [
        'Prezzo ridotto rispetto a v1',
        'Prezzo bloccato 24 mesi',
        'Bolletta digitale inclusa',
      ],
      compensation: 'Bonus test di €15',
      supplierCode: 'ENEL',
    },
  ];

  for (const { supplierCode, ...data } of offersData) {
    const supplier = supplierByCode(ctx, supplierCode);
    if (!supplier) {
      console.log(
        `  Skipped offer "${data.name}" — supplier ${supplierCode} not found`,
      );
      continue;
    }

    let offer = await repo.findOne({
      where: { offerCode: data.offerCode },
      withDeleted: true,
    });
    if (!offer) {
      offer = await repo.save(
        repo.create({
          ...data,
          supplierId: supplier.id,
          createdBy: admin.id,
        }),
      );
      console.log(`  Created offer: ${data.name}`);
    } else {
      console.log(`  Offer already exists: ${data.name}`);
    }
    ctx.offers.push(offer);
  }

  // Link the draft v2 offer to its parent (Luce Fissa 24)
  const parentOffer = ctx.offers.find(
    (o) => o.offerCode === 'SEED-ENEL-LF24',
  );
  const childOffer = ctx.offers.find(
    (o) => o.offerCode === 'SEED-ENEL-LF24-V2',
  );
  if (parentOffer && childOffer && !childOffer.parentOfferId) {
    await repo.update(childOffer.id, { parentOfferId: parentOffer.id });
    console.log('  Linked Luce Fissa 24 v2 → parent Luce Fissa 24');
  }
}

export async function seedOfferPriceVersions(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(OfferPriceVersion);

  const luceFissa = ctx.offers.find((o) => o.offerCode === 'SEED-ENEL-LF24');
  const gasCasa = ctx.offers.find((o) => o.offerCode === 'SEED-ENEL-GCS');
  const eonDual = ctx.offers.find((o) => o.offerCode === 'SEED-EON-LGT');
  const admin = ctx.users.admin;

  const versionsData = [
    // Enel Luce Fissa 24 — previous pricing
    ...(luceFissa
      ? [
          {
            offerId: luceFissa.id,
            versionLabel: 'v1.0',
            pricePerKwh: 0.092,
            fixedMonthlyFee: 9.0,
            activationCost: 0,
            validFrom: new Date('2025-07-01'),
            validUntil: new Date('2025-12-31'),
            isCurrent: false,
            createdBy: admin.id,
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
            pricePerKwh: 0.083,
            fixedMonthlyFee: 8.5,
            activationCost: 0,
            validFrom: new Date('2026-01-01'),
            isCurrent: true,
            createdBy: admin.id,
            priceData: {
              f1: 0.096,
              f2: 0.083,
              f3: 0.07,
              note: 'Tariffa trioraria corrente — F1 ore di punta, F2 ore intermedie, F3 ore fuori punta',
            },
          },
        ]
      : []),

    // Enel Gas Casa Sicura — current pricing
    ...(gasCasa
      ? [
          {
            offerId: gasCasa.id,
            versionLabel: 'v1.0',
            pricePerSmc: 0.44,
            fixedMonthlyFee: 6.0,
            activationCost: 0,
            validFrom: new Date('2026-01-01'),
            isCurrent: true,
            createdBy: admin.id,
            priceData: {
              baseSmc: 0.44,
              scaglione1: {
                maxSmc: 120,
                price: 0.41,
                note: 'C1 — consumi fino a 120 SMc/anno',
              },
              scaglione2: {
                maxSmc: 480,
                price: 0.44,
                note: 'C2 — consumi 121-480 SMc/anno',
              },
              scaglione3: {
                minSmc: 480,
                price: 0.47,
                note: 'C3 — consumi oltre 480 SMc/anno',
              },
            },
          },
        ]
      : []),

    // E.ON Dual — current pricing with both kWh and SMc
    ...(eonDual
      ? [
          {
            offerId: eonDual.id,
            versionLabel: 'v1.0',
            pricePerKwh: 0.076,
            pricePerSmc: 0.4,
            fixedMonthlyFee: 10.0,
            activationCost: 0,
            validFrom: new Date('2026-01-01'),
            isCurrent: true,
            createdBy: admin.id,
            priceData: {
              electricity: {
                f1: 0.089,
                f2: 0.076,
                f3: 0.063,
              },
              gas: {
                baseSmc: 0.4,
              },
              note: 'Tariffa combinata luce+gas con sconto dual fuel',
            },
          },
        ]
      : []),
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
