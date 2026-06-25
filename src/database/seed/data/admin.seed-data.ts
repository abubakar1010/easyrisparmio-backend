import { DataSource } from 'typeorm';
import { AdminSettings } from '../../../modules/dashboard/entities/admin-settings.entity';
import { AdminAlert } from '../../../modules/alerts/entities/admin-alert.entity';
import {
  AlertType,
  AlertSeverity,
  AlertStatus,
} from '../../../common/enums/alert.enum';
import { SeedContext } from '../seed-context';

export async function seedAdminSettings(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(AdminSettings);

  const count = await repo.count();
  if (count === 0) {
    await repo.save(
      repo.create({
        autoSendOffers: false,
        maxRecommendedOffers: 3,
      }),
    );
    console.log('  Created admin settings');
  } else {
    console.log('  Admin settings already exist');
  }
}

export async function seedAdminAlerts(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(AdminAlert);
  const admin = ctx.users.admin;
  const marco = ctx.users.personal[0];

  const alertsData = [
    {
      alertType: AlertType.CONTRACT_EXPIRING,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACTIVE,
      title: 'Contratto in scadenza - Marco Rossi',
      description:
        'Il contratto gas di Marco Rossi scade tra 30 giorni. Verificare possibilità di rinnovo.',
      entityType: 'Contract',
      expiresAt: new Date('2026-07-25T00:00:00Z'),
    },
    {
      alertType: AlertType.HIGH_VALUE_LEAD,
      severity: AlertSeverity.INFO,
      status: AlertStatus.ACKNOWLEDGED,
      title: 'Lead ad alto valore - Rossi Costruzioni',
      description:
        'Nuova richiesta da azienda con consumo annuo stimato > 500 MWh.',
      entityType: 'SwitchCase',
      acknowledgedById: admin.id,
      acknowledgedAt: new Date('2026-06-20T11:00:00Z'),
    },
    {
      alertType: AlertType.SLA_BREACH,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.RESOLVED,
      title: 'Violazione SLA - Caso #SEED-CASE-001',
      description:
        'Il caso ha superato la scadenza SLA di 2 giorni. Pratica risolta con priorità.',
      entityType: 'SwitchCase',
      resolvedById: admin.id,
      resolvedAt: new Date('2026-06-22T14:30:00Z'),
      relatedData: { caseNumber: 'SEED-CASE-001', daysOverdue: 2 },
    },
  ];

  for (const data of alertsData) {
    const existing = await repo.findOne({ where: { title: data.title } });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created alert: ${data.title}`);
    } else {
      console.log(`  Alert already exists: ${data.title}`);
    }
  }
}
