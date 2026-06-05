import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CommissionCalcType } from '../../../common/enums/commission-calc.enum';
import { CommissionRule } from './commission-rule.entity';

@Entity('commission_tiers')
@Index(['ruleId', 'sortOrder'])
export class CommissionTier extends BaseEntity {
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @Column({ name: 'consumption_min_mwh', type: 'decimal', precision: 10, scale: 2 })
  consumptionMinMwh: number;

  @Column({ name: 'consumption_max_mwh', type: 'decimal', precision: 10, scale: 2, nullable: true })
  consumptionMaxMwh: number | null;

  @Column({ name: 'calc_type', type: 'enum', enum: CommissionCalcType })
  calcType: CommissionCalcType;

  @Column({ name: 'acquisition_per_pod', type: 'decimal', precision: 10, scale: 2, nullable: true })
  acquisitionPerPod: number | null;

  @Column({ name: 'acquisition_per_mwh', type: 'decimal', precision: 10, scale: 2, nullable: true })
  acquisitionPerMwh: number | null;

  @Column({ name: 'recurrent_base', type: 'decimal', precision: 10, scale: 2, nullable: true })
  recurrentBase: number | null;

  @Column({ name: 'recurrent_premium', type: 'decimal', precision: 10, scale: 2, nullable: true })
  recurrentPremium: number | null;

  @Column({ name: 'recurrent_green', type: 'decimal', precision: 10, scale: 2, nullable: true })
  recurrentGreen: number | null;

  @Column({ name: 'recurrent_from_month', type: 'int', default: 1 })
  recurrentFromMonth: number;

  @Column({ name: 'recurrent_to_month', type: 'int', nullable: true })
  recurrentToMonth: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => CommissionRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: CommissionRule;
}
