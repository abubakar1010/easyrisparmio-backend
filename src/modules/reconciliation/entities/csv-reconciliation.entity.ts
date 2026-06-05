import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReconciliationStatus } from '../../../common/enums/reconciliation.enum';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';

@Entity('csv_reconciliations')
export class CsvReconciliation extends BaseEntity {
  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'enum', enum: ReconciliationStatus, default: ReconciliationStatus.PENDING })
  status: ReconciliationStatus;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'successful_matches', type: 'int', default: 0 })
  successfulMatches: number;

  @Column({ name: 'not_found_count', type: 'int', default: 0 })
  notFoundCount: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalValue: number | null;

  @Column({ name: 'processing_started_at', type: 'timestamptz', nullable: true })
  processingStartedAt: Date | null;

  @Column({ name: 'processing_completed_at', type: 'timestamptz', nullable: true })
  processingCompletedAt: Date | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @OneToMany('CsvReconciliationRow', 'reconciliation')
  rows: any[];
}
