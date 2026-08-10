import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ContractDocumentType } from '../../../common/enums/contract.enum';
import { Contract } from './contract.entity';
import { User } from '../../users/entities/user.entity';

@Entity('contract_documents')
export class ContractDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: ContractDocumentType,
  })
  documentType: ContractDocumentType;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Contract, (contract) => contract.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;
}
