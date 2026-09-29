import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DocumentRejectionReason, DocumentType } from '../../../common/enums/user.enum';
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
  verifiedById: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /**
   * Set when an admin turns the document down. A rejected document is kept, not
   * deleted: the customer's replacement points back at it, and the pair is the
   * record of what was asked for and what came back. Verifying clears these.
   */
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'rejected_by_id', type: 'uuid', nullable: true })
  rejectedById: string | null;

  @Column({
    name: 'rejection_reason',
    type: 'enum',
    enum: DocumentRejectionReason,
    nullable: true,
  })
  rejectionReason: DocumentRejectionReason | null;

  /** The admin's own words, shown to the customer beside the reason. */
  @Column({ name: 'rejection_note', type: 'text', nullable: true })
  rejectionNote: string | null;

  /**
   * The rejected document this one was uploaded to replace. Several files may
   * point at the same one — a new ID often arrives as a front and a back — and
   * a rejected document with at least one replacement is back in review.
   */
  @Column({ name: 'replaces_document_id', type: 'uuid', nullable: true })
  replacesDocumentId: string | null;

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

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'rejected_by_id' })
  rejectedBy: User;

  @ManyToOne(() => CaseDocument, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replaces_document_id' })
  replacesDocument: CaseDocument;
}
