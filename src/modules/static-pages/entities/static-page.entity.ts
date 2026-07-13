import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('static_pages')
@Index('UQ_static_page_slug_locale', ['slug', 'locale'], { unique: true })
export class StaticPage extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 5, default: 'it' })
  locale: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
