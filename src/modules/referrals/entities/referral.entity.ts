import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReferralStatus } from '../../../common/enums/referral.enum';
import { User } from '../../users/entities/user.entity';

@Entity('referrals')
export class Referral extends BaseEntity {
  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId: string;

  @Column({ name: 'referral_code', type: 'varchar', length: 20, unique: true })
  referralCode: string;

  @Column({ name: 'referred_email', type: 'varchar', length: 255, nullable: true })
  referredEmail: string | null;

  @Column({ name: 'referred_phone', type: 'varchar', length: 20, nullable: true })
  referredPhone: string | null;

  @Column({ name: 'referred_user_id', type: 'uuid', nullable: true })
  referredUserId: string | null;

  @Column({ type: 'enum', enum: ReferralStatus, default: ReferralStatus.PENDING })
  status: ReferralStatus;

  @Column({ name: 'reward_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  rewardAmount: number | null;

  @Column({ name: 'reward_credited_at', type: 'timestamptz', nullable: true })
  rewardCreditedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User;
}
