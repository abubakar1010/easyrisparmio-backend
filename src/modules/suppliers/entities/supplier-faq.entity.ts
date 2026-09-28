import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Supplier } from './supplier.entity';

/**
 * A question and answer the admin writes about one supplier. Shown to the
 * customer in the FAQ section of the utility details for every supply that
 * supplier serves — it replaced the generic category FAQs that section used to
 * show, so each supplier's customers read answers about their own supplier.
 */
@Entity('supplier_faqs')
@Index('IDX_supplier_faqs_supplier_id_sort_order', ['supplierId', 'sortOrder'])
export class SupplierFaq extends BaseEntity {
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
