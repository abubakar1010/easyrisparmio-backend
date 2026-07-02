import { DataSource } from 'typeorm';
import { CsvReconciliation } from '../../../modules/reconciliation/entities/csv-reconciliation.entity';
import { CsvReconciliationRow } from '../../../modules/reconciliation/entities/csv-reconciliation-row.entity';
import {
  ReconciliationStatus,
  ReconRowStatus,
} from '../../../common/enums/reconciliation.enum';
import { SeedContext } from '../seed-context';

export async function seedCsvReconciliations(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CsvReconciliation);
  const admin = ctx.users.admin;
  const enel = ctx.suppliers[0];

  const reconcData = {
    supplierId: enel.id,
    fileUrl: '/uploads/reconciliation/seed-enel-202602.csv',
    fileName: 'enel_reconciliation_202602.csv',
    status: ReconciliationStatus.COMPLETED,
    totalRows: 3,
    successfulMatches: 2,
    notFoundCount: 1,
    errorCount: 0,
    totalValue: 4685.5,
    processingStartedAt: new Date('2026-06-20T08:00:00Z'),
    processingCompletedAt: new Date('2026-06-20T08:02:30Z'),
    uploadedById: admin.id,
  };

  let recon = await repo.findOne({
    where: { fileName: reconcData.fileName },
  });
  if (!recon) {
    recon = await repo.save(repo.create(reconcData));
    console.log(`  Created reconciliation: ${reconcData.fileName}`);
  } else {
    console.log(`  Reconciliation already exists: ${reconcData.fileName}`);
  }
  ctx.reconciliations.push(recon);
}

export async function seedCsvReconciliationRows(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(CsvReconciliationRow);
  const reconciliation = ctx.reconciliations[0];

  const rowsData = [
    {
      reconciliationId: reconciliation.id,
      rowNumber: 1,
      csvPod: 'IT001E98765432',
      csvStatus: 'ATTIVO',
      csvRawData: {
        pod: 'IT001E98765432',
        cliente: 'ROSSI MARCO',
        stato: 'ATTIVO',
        consumo_kwh: 520,
      },
      status: ReconRowStatus.MATCHED,
      matchedContractId: ctx.contracts.length > 0 ? ctx.contracts[0].id : null,
    },
    {
      reconciliationId: reconciliation.id,
      rowNumber: 2,
      csvPod: 'IT001E99999999',
      csvStatus: 'ATTIVO',
      csvRawData: {
        pod: 'IT001E99999999',
        cliente: 'SCONOSCIUTO',
        stato: 'ATTIVO',
        consumo_kwh: 310,
      },
      status: ReconRowStatus.NOT_FOUND,
      possibleMatchInfo:
        'Nessun contatore trovato con questo codice POD nel sistema.',
    },
    {
      reconciliationId: reconciliation.id,
      rowNumber: 3,
      csvPod: 'IT001E22222222',
      csvStatus: 'ATTIVO',
      csvRawData: {
        pod: 'IT001E22222222',
        cliente: 'ROSSI COSTRUZIONI SRL',
        stato: 'ATTIVO',
        consumo_kwh: 12500,
      },
      status: ReconRowStatus.MATCHED,
    },
  ];

  for (const data of rowsData) {
    const existing = await repo.findOne({
      where: {
        reconciliationId: data.reconciliationId,
        rowNumber: data.rowNumber,
      },
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(
        `  Created reconciliation row: #${data.rowNumber} ${data.csvPod}`,
      );
    } else {
      console.log(
        `  Reconciliation row already exists: #${data.rowNumber} ${data.csvPod}`,
      );
    }
  }
}
