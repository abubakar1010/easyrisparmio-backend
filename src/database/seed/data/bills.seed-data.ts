import { DataSource } from 'typeorm';
import { EnergyBill } from '../../../modules/bills/entities/energy-bill.entity';
import { BillAnalysis } from '../../../modules/bills/entities/bill-analysis.entity';
import { BillType, BillStatus } from '../../../common/enums/bill.enum';
import { MarketType } from '../../../common/enums/offer.enum';
import { SeedContext } from '../seed-context';

export async function seedEnergyBills(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(EnergyBill);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const [enel, eni, a2a] = ctx.suppliers;

  const billsData = [
    {
      userId: marco.id,
      supplierId: enel.id,
      meterId: ctx.meters[0].id, // Marco's electricity meter
      fileUrl: '/uploads/bills/seed-marco-electricity-jan.pdf',
      billType: BillType.ELECTRICITY,
      status: BillStatus.ANALYZED,
      podNumber: 'IT001E98765432',
      billingPeriodStart: new Date('2026-01-01'),
      billingPeriodEnd: new Date('2026-02-28'),
      totalAmount: 185.5,
      consumptionKwh: 520.0,
      costPerUnit: 0.098,
      fixedCharges: 32.5,
      taxes: 28.4,
      rawAnalysisData: {
        ocrConfidence: 0.94,
        extractedFields: {
          pod: 'IT001E98765432',
          totalKwh: 520,
          totalAmount: 185.5,
        },
      },
    },
    {
      userId: marco.id,
      supplierId: eni.id,
      meterId: ctx.meters[1].id, // Marco's gas meter
      fileUrl: '/uploads/bills/seed-marco-gas-jan.pdf',
      billType: BillType.GAS,
      status: BillStatus.ANALYZED,
      pdrNumber: '12345678901234',
      billingPeriodStart: new Date('2026-01-01'),
      billingPeriodEnd: new Date('2026-02-28'),
      totalAmount: 95.3,
      consumptionSmc: 180.0,
      costPerUnit: 0.42,
      fixedCharges: 18.0,
      taxes: 12.7,
      rawAnalysisData: {
        ocrConfidence: 0.91,
        extractedFields: {
          pdr: '12345678901234',
          totalSmc: 180,
          totalAmount: 95.3,
        },
      },
    },
    {
      userId: laura.id,
      fileUrl: '/uploads/bills/seed-laura-electricity.pdf',
      billType: BillType.ELECTRICITY,
      status: BillStatus.UPLOADED,
      podNumber: 'IT001E11111111',
      billingPeriodStart: new Date('2025-12-01'),
      billingPeriodEnd: new Date('2026-01-31'),
      totalAmount: 210.0,
      consumptionKwh: 620.0,
    },
    {
      userId: giuseppe.id,
      supplierId: a2a.id,
      meterId: ctx.meters[3].id, // Giuseppe's electricity meter
      fileUrl: '/uploads/bills/seed-giuseppe-electricity.pdf',
      billType: BillType.ELECTRICITY,
      status: BillStatus.ANALYZING,
      podNumber: 'IT001E22222222',
      billingPeriodStart: new Date('2026-01-01'),
      billingPeriodEnd: new Date('2026-02-28'),
      totalAmount: 4500.0,
      consumptionKwh: 12500.0,
      costPerUnit: 0.092,
      fixedCharges: 250.0,
      taxes: 580.0,
    },
  ];

  for (const data of billsData) {
    let bill = await repo.findOne({
      where: {
        userId: data.userId,
        billType: data.billType,
        billingPeriodStart: data.billingPeriodStart,
      },
      withDeleted: true,
    });
    if (!bill) {
      bill = await repo.save(repo.create(data));
      console.log(
        `  Created bill: ${data.billType} for user ${data.userId.substring(0, 8)}...`,
      );
    } else {
      console.log(
        `  Bill already exists: ${data.billType} for user ${data.userId.substring(0, 8)}...`,
      );
    }
    ctx.bills.push(bill);
  }
}

export async function seedBillAnalyses(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(BillAnalysis);

  const analysesData = [
    {
      billId: ctx.bills[0].id, // Marco's electricity bill
      potentialSavings: 32.5,
      currentMonthlyAvg: 92.75,
      recommendedMarketType: MarketType.VARIABLE,
      analysisSummary:
        'La bolletta presenta un costo unitario superiore alla media di mercato. Il passaggio a un\'offerta a prezzo variabile potrebbe generare un risparmio stimato di 32,50 EUR/bimestre.',
      analysisDetails: {
        currentPricePerKwh: 0.098,
        marketAvgPricePerKwh: 0.082,
        savingsPercentage: 17.5,
        consumptionProfile: 'standard domestico',
        peakHoursPercentage: 35,
      },
      confidenceScore: 0.87,
      recommendedOffers: [
        { offerCode: 'SEED-ENI-TCL', estimatedSaving: 32.5 },
        { offerCode: 'SEED-A2A-CLV', estimatedSaving: 18.2 },
      ],
      offersSentToUser: true,
    },
    {
      billId: ctx.bills[1].id, // Marco's gas bill
      potentialSavings: 15.0,
      currentMonthlyAvg: 47.65,
      recommendedMarketType: MarketType.FIXED,
      analysisSummary:
        'Il contratto gas attuale ha un prezzo nella media. Tuttavia, un\'offerta a prezzo fisso garantirebbe protezione da eventuali rialzi invernali.',
      analysisDetails: {
        currentPricePerSmc: 0.42,
        marketAvgPricePerSmc: 0.4,
        savingsPercentage: 7.9,
        consumptionProfile: 'riscaldamento autonomo',
        heatingType: 'caldaia condensazione',
      },
      confidenceScore: 0.82,
      recommendedOffers: [
        { offerCode: 'SEED-ENEL-GC', estimatedSaving: 15.0 },
      ],
      offersSentToUser: false,
    },
  ];

  for (const data of analysesData) {
    const existing = await repo.findOne({
      where: { billId: data.billId },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(
        `  Created bill analysis for bill: ${data.billId.substring(0, 8)}...`,
      );
    } else {
      console.log(
        `  Bill analysis already exists for bill: ${data.billId.substring(0, 8)}...`,
      );
    }
  }
}
