import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DocumentType } from '../../../common/enums/user.enum';
import { SwitchCase } from './switch-case.entity';
import { User } from '../../users/entities/user.entity';

@Entity('case_documents')
export class CaseDocument extends BaseEntity {
  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ name: 'verified_by_id', type: 'uuid', nullable: true })
  verifiedById: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @ManyToOne(() => SwitchCase, (switchCase) => switchCase.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  switchCase: SwitchCase;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy: User;
}
