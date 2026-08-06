import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnergyBill } from './energy-bill.entity';
import { BillVerification } from './bill-verification.entity';

@Entity('bill_files')
export class BillFile extends BaseEntity {
  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number | null;

  @Column({ name: 'verification_id', type: 'uuid', nullable: true })
  verificationId: string | null;

  @ManyToOne(() => EnergyBill, (bill) => bill.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @ManyToOne(() => BillVerification, (v) => v.files, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'verification_id' })
  verification: BillVerification;
}
