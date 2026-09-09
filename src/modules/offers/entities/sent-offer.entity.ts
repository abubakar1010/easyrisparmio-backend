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
@Index(['billId', 'displayOrder'])
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

  /**
   * Where this offer sits in the list the customer sees, lowest first.
   *
   * The admin arranges the offers for a bill by hand in the dashboard, and that
   * arrangement is the only thing that decides the order in the app — no price
   * or savings sort is laid over it. Dense per bill (0, 1, 2 …): a reorder
   * rewrites the whole run, so the positions stay contiguous and the offer at 0
   * is always the one shown first.
   */
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

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
