import {
  Entity,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ContractStatus, ContractDeliveryMethod } from '../../../common/enums/contract.enum';
import { SwitchCase } from '../../cases/entities/switch-case.entity';
import { User } from '../../users/entities/user.entity';
import { Offer } from '../../offers/entities/offer.entity';

@Entity('contracts')
export class Contract extends BaseEntity {
  @Column({ name: 'case_id', type: 'uuid', unique: true })
  caseId: string;

  @Column({ name: 'offer_id', type: 'uuid' })
  offerId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'contract_number', type: 'varchar', length: 100, unique: true })
  contractNumber: string;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ name: 'pod_pdr_number', type: 'varchar', length: 50, nullable: true })
  podPdrNumber: string;

  @Column({ name: 'activation_date', type: 'date', nullable: true })
  activationDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date;

  @Column({ name: 'signed_document_url', type: 'varchar', length: 500, nullable: true })
  signedDocumentUrl: string;

  @Column({
    name: 'delivery_method',
    type: 'enum',
    enum: ContractDeliveryMethod,
    nullable: true,
  })
  deliveryMethod: ContractDeliveryMethod | null;

  @Column({ name: 'document_url', type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null;

  @Column({
    name: 'monthly_estimate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  monthlyEstimate: number;

  @Column({ name: 'renewal_date', type: 'date', nullable: true })
  renewalDate: Date | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToOne(() => SwitchCase, (switchCase) => switchCase.contract, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  switchCase: SwitchCase;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Offer, { eager: false })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;
}
