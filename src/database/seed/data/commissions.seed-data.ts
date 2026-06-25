import { DataSource } from 'typeorm';
import { CommissionRule } from '../../../modules/commissions/entities/commission-rule.entity';
import { CommissionTier } from '../../../modules/commissions/entities/commission-tier.entity';
import { Commission } from '../../../modules/commissions/entities/commission.entity';
import { EnergyType, UserTarget } from '../../../common/enums/offer.enum';
import { CommissionCalcType } from '../../../common/enums/commission-calc.enum';
import {
  CommissionStatus,
  CommissionType,
} from '../../../common/enums/commission.enum';
import { SeedContext } from '../seed-context';

export async function seedCommissionRules(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CommissionRule);
  const [enel, eni, a2a] = ctx.suppliers;
  const admin = ctx.users.admin;

  const rulesData = [
    {
      supplierId: enel.id,
      energyType: EnergyType.ELECTRICITY,
      commissionAmount: 50.0,
      commissionPercentage: 2.5,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.BOTH,
      createdBy: admin.id,
    },
    {
      supplierId: eni.id,
      energyType: EnergyType.GAS,
      commissionAmount: 35.0,
      commissionPercentage: 1.8,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      target: UserTarget.PERSONAL,
      createdBy: admin.id,
    },
    {
      supplierId: a2a.id,
      energyType: EnergyType.ELECTRICITY,
      commissionAmount: 45.0,
      commissionPercentage: 2.0,
      isActive: true,
      validFrom: new Date('2026-02-01'),
      target: UserTarget.BUSINESS,
      createdBy: admin.id,
    },
  ];

  for (const data of rulesData) {
    let rule = await repo.findOne({
      where: {
        supplierId: data.supplierId,
        energyType: data.energyType,
      },
    });
    if (!rule) {
      rule = await repo.save(repo.create(data));
      console.log(
        `  Created commission rule: ${data.energyType} for supplier ${data.supplierId.substring(0, 8)}...`,
      );
    } else {
      console.log(
        `  Commission rule already exists: ${data.energyType} for supplier ${data.supplierId.substring(0, 8)}...`,
      );
    }
    ctx.commissionRules.push(rule);
  }
}

export async function seedCommissionTiers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CommissionTier);
  const enelRule = ctx.commissionRules[0]; // Enel ELECTRICITY
  const eniRule = ctx.commissionRules[1]; // Eni GAS

  const tiersData = [
    {
      ruleId: enelRule.id,
      consumptionMinMwh: 0,
      consumptionMaxMwh: 1.0,
      calcType: CommissionCalcType.PER_POD,
      acquisitionPerPod: 30.0,
      sortOrder: 1,
    },
    {
      ruleId: enelRule.id,
      consumptionMinMwh: 1.0,
      consumptionMaxMwh: 5.0,
      calcType: CommissionCalcType.PER_MWH,
      acquisitionPerMwh: 15.0,
      sortOrder: 2,
    },
    {
      ruleId: enelRule.id,
      consumptionMinMwh: 5.0,
      consumptionMaxMwh: null as number | null,
      calcType: CommissionCalcType.PERCENTAGE,
      sortOrder: 3,
    },
    {
      ruleId: eniRule.id,
      consumptionMinMwh: 0,
      consumptionMaxMwh: 2.0,
      calcType: CommissionCalcType.FLAT,
      acquisitionPerPod: 25.0,
      recurrentBase: 5.0,
      recurrentFromMonth: 1,
      recurrentToMonth: 12,
      sortOrder: 1,
    },
  ];

  for (const data of tiersData) {
    const existing = await repo.findOne({
      where: { ruleId: data.ruleId, sortOrder: data.sortOrder },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(
        `  Created commission tier: ${data.calcType} (sortOrder: ${data.sortOrder})`,
      );
    } else {
      console.log(
        `  Commission tier already exists: ${data.calcType} (sortOrder: ${data.sortOrder})`,
      );
    }
  }
}

export async function seedCommissions(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Commission);
  const admin = ctx.users.admin;
  const [enel, eni] = ctx.suppliers;

  const commissionsData = [
    {
      agentId: admin.id,
      caseId: ctx.cases[1].id, // Case CONTRACT_SIGNED
      offerId: ctx.offers[1].id, // Gas Casa
      supplierId: enel.id,
      amount: 35.0,
      currency: 'EUR',
      status: CommissionStatus.APPROVED,
      commissionType: CommissionType.ACTIVATION,
      approvedAt: new Date('2026-06-10T10:00:00Z'),
      approvedById: admin.id,
      ruleId: ctx.commissionRules[0].id,
      notes: 'Commissione attivazione gas domestico',
    },
    {
      agentId: admin.id,
      caseId: ctx.cases[0].id, // Case IN_PROGRESS
      offerId: ctx.offers[2].id, // Trend Casa Luce
      supplierId: eni.id,
      amount: 50.0,
      currency: 'EUR',
      status: CommissionStatus.PENDING,
      commissionType: CommissionType.ACTIVATION,
      notes: 'In attesa di attivazione contratto',
    },
  ];

  for (const data of commissionsData) {
    const existing = await repo.findOne({
      where: { caseId: data.caseId, agentId: data.agentId },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(
        `  Created commission: ${data.status} ${data.amount} EUR`,
      );
    } else {
      console.log(
        `  Commission already exists for case: ${data.caseId.substring(0, 8)}...`,
      );
    }
  }
}
