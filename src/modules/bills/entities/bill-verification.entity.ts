import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnergyBill } from './energy-bill.entity';
import { BillFile } from './bill-file.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  RESOLVED = 'resolved',
}

@Entity('bill_verifications')
export class BillVerification extends BaseEntity {
  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ name: 'admin_message', type: 'text' })
  adminMessage: string;

  @Column({ name: 'missing_fields', type: 'jsonb', default: '[]' })
  missingFields: string[];

  @Column({ name: 'require_reupload', type: 'boolean', default: false })
  requireReupload: boolean;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ name: 'user_message', type: 'text', nullable: true })
  userMessage: string | null;

  @Column({ name: 'user_data', type: 'jsonb', nullable: true })
  userData: Record<string, any> | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => EnergyBill, (bill) => bill.verifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @OneToMany(() => BillFile, (f) => f.verification)
  files: BillFile[];
}
