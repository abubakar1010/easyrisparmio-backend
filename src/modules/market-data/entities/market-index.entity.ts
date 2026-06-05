import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('market_indices')
@Index(['indexName', 'date'], { unique: true })
export class MarketIndex {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'index_name', type: 'varchar', length: 50 })
  indexName: string;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  value: number;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
