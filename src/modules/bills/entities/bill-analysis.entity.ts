import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MarketType } from '../../../common/enums/offer.enum';
import { EnergyBill } from './energy-bill.entity';

@Entity('bill_analyses')
export class BillAnalysis extends BaseEntity {
  @Column({
    name: 'potential_savings',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  potentialSavings: number;

  @Column({
    name: 'current_monthly_avg',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  currentMonthlyAvg: number;

  @Column({
    name: 'recommended_market_type',
    type: 'enum',
    enum: MarketType,
  })
  recommendedMarketType: MarketType;

  @Column({ name: 'analysis_summary', type: 'text' })
  analysisSummary: string;

  @Column({ name: 'analysis_details', type: 'jsonb', nullable: true })
  analysisDetails: Record<string, any>;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore: number | null;

  @Column({ name: 'recommended_offers', type: 'jsonb', nullable: true })
  recommendedOffers: any[] | null;

  @OneToOne(() => EnergyBill, (bill) => bill.analysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;
}
