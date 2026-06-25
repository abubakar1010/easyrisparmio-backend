import { DataSource } from 'typeorm';
import { Referral } from '../../../modules/referrals/entities/referral.entity';
import { ReferralStatus } from '../../../common/enums/referral.enum';
import { SeedContext } from '../seed-context';

export async function seedReferrals(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Referral);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const anna = ctx.users.business[1];

  const referralsData = [
    {
      referrerId: marco.id,
      referralCode: 'SEED-REF-001',
      referredEmail: 'laura.bianchi@email.it',
      referredUserId: laura.id,
      status: ReferralStatus.REGISTERED,
    },
    {
      referrerId: marco.id,
      referralCode: 'SEED-REF-002',
      referredEmail: 'amico@email.it',
      status: ReferralStatus.PENDING,
      expiresAt: new Date('2026-09-25T00:00:00Z'),
    },
    {
      referrerId: giuseppe.id,
      referralCode: 'SEED-REF-003',
      referredEmail: 'anna.ferrari@business.it',
      referredUserId: anna.id,
      status: ReferralStatus.REWARDED,
      rewardAmount: 25.0,
      rewardCreditedAt: new Date('2026-05-10T12:00:00Z'),
    },
  ];

  for (const data of referralsData) {
    const existing = await repo.findOne({
      where: { referralCode: data.referralCode },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created referral: ${data.referralCode}`);
    } else {
      console.log(`  Referral already exists: ${data.referralCode}`);
    }
  }
}
