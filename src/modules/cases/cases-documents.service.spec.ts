import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { CasesService } from './cases.service';
import { CaseDocument } from './entities/case-document.entity';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentRejectionReason, DocumentType } from '../../common/enums/user.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';

/**
 * Covers the identity document review loop: an admin verifies or rejects a
 * document, a rejection tells the customer why, and the customer's replacement
 * points back at the rejected one and tells the admins it is ready again.
 */

const OWNER = { id: '00000000-0000-4000-8000-000000000001', role: UserRole.PERSONAL };
const STRANGER = { id: '00000000-0000-4000-8000-000000000002', role: UserRole.PERSONAL };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', role: UserRole.ADMIN };
const CASE = { id: 'case-1', userId: OWNER.id, billId: 'bill-1', caseNumber: 'SW-20260928-00001' };

function makeService(initial: Partial<CaseDocument>[] = []) {
  const documents: CaseDocument[] = initial.map((d) => ({ ...d }) as CaseDocument);
  const events: { type: string; metadata?: Record<string, unknown> }[] = [];
  const notified: { event: string; args: unknown[] }[] = [];
  let nextId = 1;

  const matches = (row: CaseDocument, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v);

  const documentRepository = {
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      documents.find((d) => matches(d, where)) ?? null,
    create: (data: Partial<CaseDocument>) => ({ ...data }) as CaseDocument,
    save: async (row: CaseDocument) => {
      if (!row.id) {
        row.id = `new-${nextId++}`;
        documents.push(row);
      }
      return row;
    },
  };

  const record =
    (event: string) =>
    async (...args: unknown[]) => {
      notified.push({ event, args });
    };

  const service = new CasesService(
    { findOne: async () => ({ ...CASE }) } as never,
    documentRepository as never,
    {
      create: (d: { eventType: string; metadata?: Record<string, unknown> }) => d,
      save: async (d: { eventType: string; metadata?: Record<string, unknown> }) => {
        events.push({ type: d.eventType, metadata: d.metadata });
        return d;
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      documentRejected: record('documentRejected'),
      adminDocumentResubmitted: record('adminDocumentResubmitted'),
    } as never,
    {} as never,
  );

  return { service, documents, events, notified };
}

const idDoc = (overrides: Partial<CaseDocument> = {}): Partial<CaseDocument> => ({
  id: 'doc-1',
  caseId: CASE.id,
  documentType: DocumentType.IDENTITY_DOCUMENT,
  fileName: 'carta-identita.jpg',
  fileUrl: 'uploads/doc-1.jpg',
  verified: false,
  replacesDocumentId: null,
  rejectedAt: null,
  ...overrides,
});

describe('CasesService.rejectDocument', () => {
  it('records the reason and note, logs it and notifies the customer', async () => {
    const { service, documents, events, notified } = makeService([idDoc()]);

    await service.rejectDocument(CASE.id, 'doc-1', ADMIN.id, DocumentRejectionReason.EXPIRED, '  Scaduta nel 2025. ');

    expect(documents[0]).toMatchObject({
      verified: false,
      rejectedById: ADMIN.id,
      rejectionReason: DocumentRejectionReason.EXPIRED,
      rejectionNote: 'Scaduta nel 2025.',
    });
    expect(documents[0].rejectedAt).toBeInstanceOf(Date);
    expect(events).toContainEqual(
      expect.objectContaining({ type: CaseEventType.DOCUMENT_REJECTED }),
    );
    expect(notified).toEqual([
      { event: 'documentRejected', args: [documents[0], expect.objectContaining({ id: CASE.id })] },
    ]);
  });

  it('takes back an earlier verification', async () => {
    const { service, documents } = makeService([
      idDoc({ verified: true, verifiedById: ADMIN.id, verifiedAt: new Date() }),
    ]);

    await service.rejectDocument(CASE.id, 'doc-1', ADMIN.id, DocumentRejectionReason.UNREADABLE);

    expect(documents[0]).toMatchObject({ verified: false, verifiedById: null, verifiedAt: null });
    expect(documents[0].rejectionNote).toBeNull();
  });

  it('refuses a document that has already been replaced', async () => {
    const { service, notified } = makeService([
      idDoc({ rejectedAt: new Date() }),
      idDoc({ id: 'doc-2', replacesDocumentId: 'doc-1' }),
    ]);

    await expect(
      service.rejectDocument(CASE.id, 'doc-1', ADMIN.id, DocumentRejectionReason.OTHER, 'x'),
    ).rejects.toThrow(BadRequestException);
    expect(notified).toHaveLength(0);
  });
});

describe('CasesService.verifyDocument', () => {
  it('clears a rejection made by mistake', async () => {
    const { service, documents } = makeService([
      idDoc({
        rejectedAt: new Date(),
        rejectedById: ADMIN.id,
        rejectionReason: DocumentRejectionReason.INCOMPLETE,
        rejectionNote: 'Manca il retro',
      }),
    ]);

    await service.verifyDocument(CASE.id, 'doc-1', ADMIN.id);

    expect(documents[0]).toMatchObject({
      verified: true,
      rejectedAt: null,
      rejectedById: null,
      rejectionReason: null,
      rejectionNote: null,
    });
  });
});

describe('CasesService.uploadDocument — replacing a rejected document', () => {
  const upload = (
    service: CasesService,
    uploader: { id: string; role: UserRole },
    replacesDocumentId?: string,
  ) =>
    service.uploadDocument(
      CASE.id,
      uploader,
      DocumentType.IDENTITY_DOCUMENT,
      'uploads/new.jpg',
      'nuova.jpg',
      replacesDocumentId,
    );

  it('links the replacement and tells the admins it is back in review', async () => {
    const { service, notified } = makeService([idDoc({ rejectedAt: new Date() })]);

    const saved = await upload(service, OWNER, 'doc-1');

    expect(saved.replacesDocumentId).toBe('doc-1');
    expect(notified).toEqual([
      {
        event: 'adminDocumentResubmitted',
        args: [expect.objectContaining({ id: 'doc-1' }), expect.objectContaining({ id: CASE.id })],
      },
    ]);
  });

  it('refuses to replace a document nobody rejected', async () => {
    const { service } = makeService([idDoc()]);
    await expect(upload(service, OWNER, 'doc-1')).rejects.toThrow(BadRequestException);
  });

  it('refuses an upload to somebody else\'s case', async () => {
    const { service } = makeService();
    await expect(upload(service, STRANGER)).rejects.toThrow(ForbiddenException);
  });

  it('lets an admin upload on the customer\'s behalf without notifying the admins', async () => {
    const { service, notified } = makeService([idDoc({ rejectedAt: new Date() })]);
    await upload(service, ADMIN, 'doc-1');
    expect(notified).toHaveLength(0);
  });

  it('notifies nobody for an unprompted upload', async () => {
    const { service, notified } = makeService();
    const saved = await upload(service, OWNER);
    expect(saved.replacesDocumentId).toBeNull();
    expect(notified).toHaveLength(0);
  });
});
