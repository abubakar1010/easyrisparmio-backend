import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReconRowStatus } from '../../../common/enums/reconciliation.enum';
import { CsvReconciliation } from './csv-reconciliation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('csv_reconciliation_rows')
export class CsvReconciliationRow extends BaseEntity {
  @Column({ name: 'reconciliation_id', type: 'uuid' })
  reconciliationId: string;

  @Column({ name: 'row_number', type: 'int' })
  rowNumber: number;

  @Column({ name: 'csv_pod', type: 'varchar', length: 50 })
  csvPod: string;

  @Column({ name: 'csv_status', type: 'varchar', length: 50 })
  csvStatus: string;

  @Column({ name: 'csv_raw_data', type: 'jsonb', nullable: true })
  csvRawData: Record<string, any> | null;

  @Column({ type: 'enum', enum: ReconRowStatus, default: ReconRowStatus.MATCHED })
  status: ReconRowStatus;

  @Column({ name: 'matched_meter_id', type: 'uuid', nullable: true })
  matchedMeterId: string | null;

  @Column({ name: 'matched_contract_id', type: 'uuid', nullable: true })
  matchedContractId: string | null;

  @Column({ name: 'possible_match_info', type: 'varchar', length: 500, nullable: true })
  possibleMatchInfo: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => CsvReconciliation, (r) => r.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_id' })
  reconciliation: CsvReconciliation;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User;
}
