import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('business_profiles')
export class BusinessProfile extends BaseEntity {
  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string;

  @Column({ name: 'partita_iva', type: 'varchar', length: 11, unique: true })
  partitaIva: string;

  @Column({ name: 'pec_email', type: 'varchar', length: 255, nullable: true })
  pecEmail: string;

  @Column({ name: 'legal_representative', type: 'varchar', length: 255, nullable: true })
  legalRepresentative: string;

  @Column({ name: 'company_type', type: 'varchar', length: 100, nullable: true })
  companyType: string;

  @Column({ name: 'ateco_code', type: 'varchar', length: 10, nullable: true })
  atecoCode: string;

  @Column({ name: 'employee_count', type: 'int', nullable: true })
  employeeCount: number | null;

  @Column({ name: 'annual_revenue_range', type: 'varchar', length: 50, nullable: true })
  annualRevenueRange: string | null;

  @OneToOne(() => User, (user) => user.businessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
