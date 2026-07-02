import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UtilityType } from '../../../common/enums/utility.enum';

@Entity('meters')
@Index(['utilityType'], { unique: true, where: '"deleted_at" IS NULL' })
export class Meter extends BaseEntity {
  @Column({ name: 'utility_type', type: 'enum', enum: UtilityType })
  utilityType: UtilityType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;
}
