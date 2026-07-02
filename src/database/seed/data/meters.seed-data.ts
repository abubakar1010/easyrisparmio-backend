import { DataSource } from 'typeorm';
import { Meter } from '../../../modules/meters/entities/meter.entity';
import { UtilityType } from '../../../common/enums/utility.enum';
import { SeedContext } from '../seed-context';

export async function seedMeters(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Meter);
  const admin = ctx.users.admin;

  const metersData = [
    {
      utilityType: UtilityType.ELECTRICITY,
      name: 'Electricity',
      description: 'Residential and business electricity supply',
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      utilityType: UtilityType.GAS,
      name: 'Gas',
      description: 'Natural gas supply for heating and cooking',
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      utilityType: UtilityType.WATER,
      name: 'Water',
      description: 'Municipal water supply service',
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      utilityType: UtilityType.INTERNET,
      name: 'Internet',
      description: 'Broadband internet connectivity',
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  ];

  for (const data of metersData) {
    let meter = await repo.findOne({
      where: { utilityType: data.utilityType },
      withDeleted: true,
    });
    if (!meter) {
      meter = await repo.save(repo.create(data));
      console.log(`  Created service type: ${data.name} (${data.utilityType})`);
    } else {
      console.log(
        `  Service type already exists: ${data.name} (${data.utilityType})`,
      );
    }
    ctx.meters.push(meter);
  }
}
