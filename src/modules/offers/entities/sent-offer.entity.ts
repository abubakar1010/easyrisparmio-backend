import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';
import { Offer } from './offer.entity';

@Entity('sent_offers')
@Unique(['billId', 'offerId'])
@Index(['userId'])
export class SentOffer extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId: string | null;

  @Column({
    name: 'estimated_savings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedSavings: number | null;

  @Column({ name: 'sent_by', type: 'varchar', length: 20 })
  sentBy: string;

  @Column({ name: 'offer_snapshot', type: 'jsonb', nullable: true })
  offerSnapshot: Record<string, any> | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => EnergyBill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @ManyToOne(() => Offer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;
}
