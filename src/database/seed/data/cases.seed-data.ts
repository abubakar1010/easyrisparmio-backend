import { DataSource } from 'typeorm';
import { SwitchCase } from '../../../modules/cases/entities/switch-case.entity';
import { CaseEvent } from '../../../modules/cases/entities/case-event.entity';
import { CaseDocument } from '../../../modules/cases/entities/case-document.entity';
import { Contract } from '../../../modules/contracts/entities/contract.entity';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';
import { CaseType } from '../../../common/enums/case-type.enum';
import { CaseEventType } from '../../../common/enums/case-event.enum';
import { ContractStatus } from '../../../common/enums/contract.enum';
import { DocumentType } from '../../../common/enums/user.enum';
import { SeedContext } from '../seed-context';

export async function seedSwitchCases(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(SwitchCase);
  const marco = ctx.users.personal[0];
  const giuseppe = ctx.users.business[0];
  const admin = ctx.users.admin;
  const [enel, eni, a2a] = ctx.suppliers;

  const casesData = [
    {
      userId: marco.id,
      billId: ctx.bills[0].id, // Marco's electricity bill
      selectedOfferId: ctx.offers[2].id, // Trend Casa Luce (Eni)
      assignedAgentId: admin.id,
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      caseNumber: 'SEED-CASE-001',
      caseType: CaseType.SWITCH,
      notes: 'Cliente vuole passare a tariffa variabile per risparmiare.',
      internalNotes: 'Verificare documenti entro fine settimana.',
      slaDaysTotal: 30,
      slaDeadline: new Date('2026-07-15T23:59:59Z'),
      estimatedAnnualValue: 2200.0,
      fromSupplierId: enel.id,
      toSupplierId: eni.id,
    },
    {
      userId: marco.id,
      billId: ctx.bills[1].id, // Marco's gas bill
      selectedOfferId: ctx.offers[1].id, // Gas Casa (Enel)
      assignedAgentId: admin.id,
      status: CaseStatus.CONTRACT_SIGNED,
      priority: CasePriority.LOW,
      caseNumber: 'SEED-CASE-002',
      caseType: CaseType.SWITCH,
      notes: 'Passaggio gas completato. Contratto firmato.',
      slaDaysTotal: 30,
      estimatedAnnualValue: 1140.0,
      fromSupplierId: eni.id,
      toSupplierId: enel.id,
    },
    {
      userId: giuseppe.id,
      billId: ctx.bills[3].id, // Giuseppe's electricity bill
      selectedOfferId: ctx.offers[3].id, // Dual Business Pro (Eni)
      assignedAgentId: admin.id,
      status: CaseStatus.NEW,
      priority: CasePriority.HIGH,
      caseNumber: 'SEED-CASE-003',
      caseType: CaseType.NEW_ACTIVATION,
      notes: 'Nuova attivazione per utenza business con alto consumo.',
      internalNotes:
        'Lead ad alto valore. Seguire con priorità. Consumo annuo >45 MWh.',
      slaDaysTotal: 14,
      slaDeadline: new Date('2026-07-09T23:59:59Z'),
      estimatedAnnualValue: 54000.0,
      fromSupplierId: a2a.id,
      toSupplierId: eni.id,
    },
  ];

  for (const data of casesData) {
    let switchCase = await repo.findOne({
      where: { caseNumber: data.caseNumber },
      withDeleted: true,
    });
    if (!switchCase) {
      switchCase = await repo.save(repo.create(data));
      console.log(`  Created case: ${data.caseNumber}`);
    } else {
      console.log(`  Case already exists: ${data.caseNumber}`);
    }
    ctx.cases.push(switchCase);
  }
}

export async function seedCaseEvents(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CaseEvent);
  const admin = ctx.users.admin;
  const marco = ctx.users.personal[0];

  const eventsData = [
    {
      caseId: ctx.cases[0].id, // SEED-CASE-001
      eventType: CaseEventType.STATUS_CHANGE,
      title: 'Stato aggiornato',
      description: 'Pratica presa in carico e assegnata.',
      oldStatus: CaseStatus.NEW,
      newStatus: CaseStatus.IN_PROGRESS,
      actorId: admin.id,
      actorLabel: 'Admin EasyRisparmio',
    },
    {
      caseId: ctx.cases[0].id,
      eventType: CaseEventType.DOCUMENT_UPLOADED,
      title: 'Documento caricato',
      description: 'Bolletta elettricità caricata dal cliente.',
      actorId: marco.id,
      actorLabel: 'Marco Rossi',
    },
    {
      caseId: ctx.cases[1].id, // SEED-CASE-002
      eventType: CaseEventType.CONTRACT_SIGNED,
      title: 'Contratto firmato',
      description:
        'Il cliente ha firmato il contratto Gas Casa con Enel Energia.',
      oldStatus: CaseStatus.CONTRACT_SENT,
      newStatus: CaseStatus.CONTRACT_SIGNED,
      actorId: marco.id,
      actorLabel: 'Marco Rossi',
    },
    {
      caseId: ctx.cases[2].id, // SEED-CASE-003
      eventType: CaseEventType.SYSTEM_EVENT,
      title: 'Caso creato',
      description: 'Caso creato automaticamente dal sistema.',
      newStatus: CaseStatus.NEW,
      metadata: { source: 'automatic', triggerBillId: ctx.bills[3].id },
    },
  ];

  for (const data of eventsData) {
    const count = await repo.count({
      where: { caseId: data.caseId, eventType: data.eventType, title: data.title },
    });
    if (count === 0) {
      await repo.save(repo.create(data));
      console.log(`  Created case event: ${data.title}`);
    } else {
      console.log(`  Case event already exists: ${data.title}`);
    }
  }
}

export async function seedCaseDocuments(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CaseDocument);
  const admin = ctx.users.admin;
  const marco = ctx.users.personal[0];

  const documentsData = [
    {
      caseId: ctx.cases[0].id, // SEED-CASE-001
      documentType: DocumentType.BILL,
      fileUrl: '/uploads/documents/seed-case001-bill.pdf',
      fileName: 'bolletta_enel_gen2026.pdf',
      uploadedById: marco.id,
      verified: false,
      fileSizeBytes: 245000,
      mimeType: 'application/pdf',
    },
    {
      caseId: ctx.cases[0].id,
      documentType: DocumentType.ID_CARD,
      fileUrl: '/uploads/documents/seed-case001-id.pdf',
      fileName: 'carta_identita_rossi.pdf',
      uploadedById: marco.id,
      verified: true,
      verifiedById: admin.id,
      verifiedAt: new Date('2026-06-18T10:30:00Z'),
      fileSizeBytes: 180000,
      mimeType: 'application/pdf',
    },
    {
      caseId: ctx.cases[1].id, // SEED-CASE-002
      documentType: DocumentType.SIGNED_CONTRACT,
      fileUrl: '/uploads/documents/seed-case002-contract.pdf',
      fileName: 'contratto_firmato_gas_casa.pdf',
      uploadedById: admin.id,
      verified: true,
      verifiedById: admin.id,
      verifiedAt: new Date('2026-06-05T14:00:00Z'),
      fileSizeBytes: 520000,
      mimeType: 'application/pdf',
    },
  ];

  for (const data of documentsData) {
    const existing = await repo.findOne({
      where: { caseId: data.caseId, documentType: data.documentType },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created case document: ${data.fileName}`);
    } else {
      console.log(`  Case document already exists: ${data.fileName}`);
    }
  }
}

export async function seedContracts(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Contract);
  const marco = ctx.users.personal[0];

  const contractsData = [
    {
      caseId: ctx.cases[1].id, // SEED-CASE-002 (CONTRACT_SIGNED)
      offerId: ctx.offers[1].id, // Gas Casa
      userId: marco.id,
      contractNumber: 'SEED-CTR-001',
      status: ContractStatus.SIGNED,
      podPdrNumber: '12345678901234',
      activationDate: new Date('2026-07-01'),
      expiryDate: new Date('2027-07-01'),
      signedAt: new Date('2026-06-05T14:00:00Z'),
      signedDocumentUrl: '/uploads/documents/seed-case002-contract.pdf',
      monthlyEstimate: 47.65,
    },
  ];

  for (const data of contractsData) {
    let contract = await repo.findOne({
      where: { contractNumber: data.contractNumber },
      withDeleted: true,
    });
    if (!contract) {
      contract = await repo.save(repo.create(data));
      console.log(`  Created contract: ${data.contractNumber}`);
    } else {
      console.log(`  Contract already exists: ${data.contractNumber}`);
    }
    ctx.contracts.push(contract);
  }
}
