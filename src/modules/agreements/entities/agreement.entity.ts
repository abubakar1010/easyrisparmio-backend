import { Entity, Column, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserTarget } from '../../../common/enums/offer.enum';
import { User } from '../../users/entities/user.entity';

@Entity('agreements')
export class Agreement extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'partner_name', type: 'varchar', length: 255 })
  partnerName: string;

  @Column({ name: 'partner_logo_url', type: 'varchar', length: 500, nullable: true })
  partnerLogoUrl: string | null;

  @Column({ name: 'discount_description', type: 'text', nullable: true })
  discountDescription: string | null;

  @Column({ name: 'terms_url', type: 'varchar', length: 500, nullable: true })
  termsUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'target_audience', type: 'enum', enum: UserTarget, default: UserTarget.BOTH })
  targetAudience: UserTarget;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
