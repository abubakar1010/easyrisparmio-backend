import { DataSource } from 'typeorm';
import { Faq } from '../../../modules/support/entities/faq.entity';
import { SupportTicket } from '../../../modules/support/entities/support-ticket.entity';
import { TicketMessage } from '../../../modules/support/entities/ticket-message.entity';
import { UserTarget } from '../../../common/enums/offer.enum';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../../common/enums/support.enum';
import { SeedContext } from '../seed-context';

export async function seedFaqs(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Faq);

  const faqsData = [
    {
      category: 'Cambio Fornitore',
      question: 'Come funziona il cambio fornitore di energia?',
      answer:
        'Il cambio fornitore è completamente gratuito e senza interruzione del servizio. Basta caricare una bolletta recente, confrontare le offerte disponibili e avviare la pratica. Il passaggio richiede in media 4-6 settimane.',
      sortOrder: 1,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Cambio Fornitore',
      question: 'Quanto tempo ci vuole per completare il passaggio?',
      answer:
        'Il tempo medio per il cambio fornitore è di 4-6 settimane dalla data di firma del contratto. Durante questo periodo, il servizio non viene mai interrotto.',
      sortOrder: 2,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Bollette',
      question: 'Come leggo la mia bolletta della luce?',
      answer:
        'La bolletta si compone di diverse voci: spesa per la materia energia, trasporto e gestione del contatore, oneri di sistema e imposte. Carica la tua bolletta sulla piattaforma e la analizzeremo gratuitamente per te.',
      sortOrder: 3,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Documenti',
      question: 'Quali documenti servono per le aziende?',
      answer:
        'Per le utenze business sono necessari: visura camerale, documento di identità del legale rappresentante, codice fiscale aziendale, ultima bolletta e codice POD/PDR. Eventuali deleghe se il richiedente non è il legale rappresentante.',
      sortOrder: 4,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },
    {
      category: 'Supporto',
      question: 'Come contatto il supporto clienti?',
      answer:
        'Puoi contattarci tramite il modulo di supporto nell\'app, via email a supporto@easyresparmio.it o chiamando il numero verde 800 123 456. Il servizio è attivo dal lunedì al venerdì, dalle 9:00 alle 18:00.',
      sortOrder: 5,
      isActive: false,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
  ];

  for (const data of faqsData) {
    const existing = await repo.findOne({ where: { question: data.question } });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created FAQ: ${data.question.substring(0, 50)}...`);
    } else {
      console.log(
        `  FAQ already exists: ${data.question.substring(0, 50)}...`,
      );
    }
  }
}

export async function seedSupportTickets(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(SupportTicket);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const admin = ctx.users.admin;

  const ticketsData = [
    {
      userId: marco.id,
      assignedAgentId: admin.id,
      subject: 'Problema con la bolletta di gennaio',
      category: TicketCategory.BILLING_PAYMENTS,
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
    },
    {
      userId: laura.id,
      assignedAgentId: admin.id,
      subject: 'Cambio fornitore non completato',
      category: TicketCategory.SWITCHING,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.IN_PROGRESS,
    },
    {
      userId: giuseppe.id,
      subject: 'Richiesta informazioni offerta business',
      category: TicketCategory.GENERAL,
      priority: TicketPriority.LOW,
      status: TicketStatus.RESOLVED,
      resolvedAt: new Date('2026-06-15T16:00:00Z'),
    },
  ];

  for (const data of ticketsData) {
    let ticket = await repo.findOne({
      where: { userId: data.userId, subject: data.subject },
    });
    if (!ticket) {
      ticket = await repo.save(repo.create(data));
      console.log(`  Created ticket: ${data.subject}`);
    } else {
      console.log(`  Ticket already exists: ${data.subject}`);
    }
    ctx.tickets.push(ticket);
  }
}

export async function seedTicketMessages(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(TicketMessage);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const admin = ctx.users.admin;

  const messagesData = [
    {
      ticketId: ctx.tickets[0].id,
      senderId: marco.id,
      message:
        'La mia bolletta di gennaio sembra troppo alta per il consumo effettivo. Ho controllato il contatore e i kWh non corrispondono.',
    },
    {
      ticketId: ctx.tickets[0].id,
      senderId: admin.id,
      message:
        'Buongiorno Marco, stiamo verificando la sua bolletta. Le chiediamo cortesemente di inviarci una foto del contatore per un confronto.',
    },
    {
      ticketId: ctx.tickets[1].id,
      senderId: laura.id,
      message:
        'Ho avviato il cambio fornitore 2 settimane fa ma non ho ricevuto alcuna conferma. Potete verificare lo stato della pratica?',
    },
    {
      ticketId: ctx.tickets[2].id,
      senderId: giuseppe.id,
      message:
        'Vorrei sapere i dettagli dell\'offerta Dual Business di Eni per la mia azienda con 3 punti di fornitura.',
    },
  ];

  for (const data of messagesData) {
    const count = await repo.count({
      where: { ticketId: data.ticketId, senderId: data.senderId },
    });
    if (count === 0) {
      await repo.save(repo.create(data));
      console.log(
        `  Created ticket message for ticket: ${data.ticketId.substring(0, 8)}...`,
      );
    } else {
      console.log(
        `  Ticket message already exists for ticket: ${data.ticketId.substring(0, 8)}...`,
      );
    }
  }
}
