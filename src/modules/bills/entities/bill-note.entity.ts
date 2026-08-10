import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnergyBill } from './energy-bill.entity';
import { User } from '../../users/entities/user.entity';

@Entity('bill_notes')
export class BillNote extends BaseEntity {
  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => EnergyBill, (bill) => bill.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
