import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('admin_settings')
export class AdminSettings extends BaseEntity {
  @Column({ name: 'auto_send_offers', type: 'boolean', default: false })
  autoSendOffers: boolean;

  @Column({ name: 'max_recommended_offers', type: 'int', default: 3 })
  maxRecommendedOffers: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;
}
