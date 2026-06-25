import { DataSource } from 'typeorm';
import { Meter } from '../../../modules/meters/entities/meter.entity';
import { UtilityType, MeterStatus } from '../../../common/enums/utility.enum';
import { SeedContext } from '../seed-context';

export async function seedMeters(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Meter);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const admin = ctx.users.admin;
  const [enel, eni, a2a] = ctx.suppliers;
  // addresses: [marco-residential, marco-supply, laura-residential, giuseppe-legal]
  const marcoSupplyAddr = ctx.addresses[1];
  const lauraAddr = ctx.addresses[2];
  const giuseppeAddr = ctx.addresses[3];

  const metersData = [
    {
      userId: marco.id,
      utilityType: UtilityType.ELECTRICITY,
      meterCode: 'IT001E98765432',
      supplierId: enel.id,
      status: MeterStatus.ACTIVE,
      annualConsumption: 2800.0,
      consumptionUnit: 'kWh',
      contractedPowerKw: 3.0,
      addressId: marcoSupplyAddr.id,
      activationDate: new Date('2024-03-15'),
      createdBy: admin.id,
    },
    {
      userId: marco.id,
      utilityType: UtilityType.GAS,
      meterCode: '12345678901234',
      supplierId: eni.id,
      status: MeterStatus.ACTIVE,
      annualConsumption: 1200.0,
      consumptionUnit: 'Smc',
      addressId: marcoSupplyAddr.id,
      activationDate: new Date('2024-03-15'),
      createdBy: admin.id,
    },
    {
      userId: laura.id,
      utilityType: UtilityType.ELECTRICITY,
      meterCode: 'IT001E11111111',
      status: MeterStatus.PENDING,
      annualConsumption: 3200.0,
      consumptionUnit: 'kWh',
      contractedPowerKw: 4.5,
      addressId: lauraAddr.id,
      createdBy: admin.id,
    },
    {
      userId: giuseppe.id,
      utilityType: UtilityType.ELECTRICITY,
      meterCode: 'IT001E22222222',
      supplierId: a2a.id,
      status: MeterStatus.ACTIVE,
      annualConsumption: 45000.0,
      consumptionUnit: 'kWh',
      contractedPowerKw: 30.0,
      addressId: giuseppeAddr.id,
      activationDate: new Date('2023-09-01'),
      notes: 'Contatore trifase per uso industriale',
      createdBy: admin.id,
    },
  ];

  for (const data of metersData) {
    let meter = await repo.findOne({
      where: { meterCode: data.meterCode, utilityType: data.utilityType },
      withDeleted: true,
    });
    if (!meter) {
      meter = await repo.save(repo.create(data));
      console.log(`  Created meter: ${data.meterCode} (${data.utilityType})`);
    } else {
      console.log(
        `  Meter already exists: ${data.meterCode} (${data.utilityType})`,
      );
    }
    ctx.meters.push(meter);
  }
}
