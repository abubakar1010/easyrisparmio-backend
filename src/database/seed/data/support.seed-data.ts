import { DataSource } from 'typeorm';
import { Faq } from '../../../modules/support/entities/faq.entity';
import { SupportTicket } from '../../../modules/support/entities/support-ticket.entity';
import { TicketMessage } from '../../../modules/support/entities/ticket-message.entity';
import { SupportTopic } from '../../../modules/support/entities/support-topic.entity';
import { UserTarget } from '../../../common/enums/offer.enum';
import {
  TicketStatus,
  TicketPriority,
} from '../../../common/enums/support.enum';
import { SeedContext } from '../seed-context';

export async function seedSupportTopics(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(SupportTopic);

  const topicsData = [
    {
      name: 'Supporto Tecnico',
      description: 'Problemi tecnici con l\'app o la piattaforma',
      isActive: true,
      sortOrder: 0,
      icon: 'settings',
    },
    {
      name: 'Fatturazione e Pagamenti',
      description: 'Domande su bollette, fatture e pagamenti',
      isActive: true,
      sortOrder: 1,
      icon: 'receipt',
    },
    {
      name: 'Cambio Fornitore',
      description: 'Informazioni e assistenza sul cambio fornitore',
      isActive: true,
      sortOrder: 2,
      icon: 'swap',
    },
    {
      name: 'Generale',
      description: 'Domande generali e richieste di informazioni',
      isActive: true,
      sortOrder: 3,
      icon: 'help',
    },
  ];

  for (const data of topicsData) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created support topic: ${data.name}`);
    } else {
      console.log(`  Support topic already exists: ${data.name}`);
    }
  }
}

export async function seedFaqs(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Faq);

  const faqsData = [
    // ── Cambio Fornitore ──────────────────────────────────────────
    {
      category: 'Cambio Fornitore',
      question: 'Come funziona il cambio fornitore di energia?',
      answer:
        'Il cambio fornitore è completamente gratuito e senza interruzione del servizio. Basta caricare una bolletta recente, confrontare le offerte disponibili e scegliere quella più conveniente. EasyRisparmio si occupa di tutta la pratica: dalla raccolta dei documenti alla comunicazione con il nuovo fornitore. Il passaggio avviene in media in 4-6 settimane.',
      sortOrder: 1,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Cambio Fornitore',
      question: 'Quanto tempo ci vuole per completare il passaggio?',
      answer:
        'Il tempo medio per il cambio fornitore è di 4-6 settimane dalla data di firma del contratto. Durante questo periodo, il servizio non viene mai interrotto: continui a ricevere energia dal fornitore attuale fino all\'attivazione del nuovo contratto. Riceverai notifiche sullo stato di avanzamento della pratica direttamente nell\'app.',
      sortOrder: 2,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Cambio Fornitore',
      question: 'Ci sono costi o penali per cambiare fornitore?',
      answer:
        'No, il cambio fornitore è sempre gratuito per i clienti del mercato libero. Non sono previste penali di uscita dal contratto attuale, salvo rari casi di contratti business con clausole specifiche. Il servizio EasyRisparmio è completamente gratuito per l\'utente finale.',
      sortOrder: 3,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Cambio Fornitore',
      question: 'Posso tornare al vecchio fornitore se non sono soddisfatto?',
      answer:
        'Sì, puoi cambiare fornitore in qualsiasi momento senza vincoli. Se non sei soddisfatto del nuovo fornitore, puoi avviare un nuovo cambio tramite EasyRisparmio. Inoltre, hai sempre il diritto di recesso entro 14 giorni dalla firma del contratto.',
      sortOrder: 4,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Cambio Fornitore',
      question: 'Il cambio fornitore comporta l\'interruzione della fornitura?',
      answer:
        'Assolutamente no. Il cambio fornitore non comporta mai interruzioni del servizio. Il contatore resta lo stesso, così come la rete di distribuzione. Cambia solo l\'azienda che ti fattura l\'energia. Il passaggio avviene in modo trasparente e automatico.',
      sortOrder: 5,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Bollette ───────────────────────────────────────────────────
    {
      category: 'Bollette',
      question: 'Come leggo la mia bolletta della luce?',
      answer:
        'La bolletta della luce si compone di quattro voci principali: spesa per la materia energia (il costo effettivo dell\'elettricità), trasporto e gestione del contatore (costi di rete), oneri di sistema (costi regolamentati) e imposte (IVA e accise). Carica la tua bolletta su EasyRisparmio e il nostro sistema AI la analizzerà in dettaglio, evidenziando eventuali anomalie e opportunità di risparmio.',
      sortOrder: 6,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Bollette',
      question: 'Come leggo la mia bolletta del gas?',
      answer:
        'La bolletta del gas è strutturata in modo simile a quella della luce: spesa per la materia gas naturale, trasporto e gestione del contatore, oneri di sistema e imposte. I consumi sono espressi in SMc (Standard metri cubi). Il costo unitario varia in base alla classe di consumo (da C1 a C5). Caricando la bolletta sull\'app, otterrai un\'analisi dettagliata con confronto rispetto alle tariffe di mercato.',
      sortOrder: 7,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Bollette',
      question: 'Come funziona l\'analisi AI della bolletta?',
      answer:
        'Dopo aver caricato la bolletta (foto o PDF), il nostro sistema di intelligenza artificiale estrae automaticamente tutti i dati chiave: fornitore attuale, tipo di tariffa, consumi, codice POD/PDR e importi. L\'analisi identifica il costo medio per kWh o SMc, lo confronta con le migliori offerte sul mercato e calcola il potenziale risparmio annuo. Riceverai un report dettagliato con le offerte più convenienti per il tuo profilo di consumo.',
      sortOrder: 8,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Bollette',
      question: 'Quali formati di bolletta posso caricare?',
      answer:
        'Puoi caricare la bolletta in formato PDF o come foto (JPG, PNG). Assicurati che l\'immagine sia nitida e leggibile, con tutte le pagine incluse. Per ottenere i risultati migliori dall\'analisi, carica la bolletta più recente e completa. La dimensione massima del file è di 10 MB.',
      sortOrder: 9,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Bollette',
      question: 'Cos\'è il codice POD e dove lo trovo?',
      answer:
        'Il codice POD (Point of Delivery) è il codice identificativo univoco del tuo punto di fornitura elettrica. È composto da 14-15 caratteri e inizia sempre con "IT". Lo trovi sulla prima pagina della bolletta della luce, nella sezione "Dati fornitura" o "Dati tecnici". Il codice PDR è l\'equivalente per il gas naturale e ha 14 cifre.',
      sortOrder: 10,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Documenti ─────────────────────────────────────────────────
    {
      category: 'Documenti',
      question: 'Quali documenti servono per il cambio fornitore (utenza domestica)?',
      answer:
        'Per avviare la pratica di cambio fornitore come utente personale, sono necessari: documento d\'identità valido (carta d\'identità o passaporto), codice fiscale, ultima bolletta con il codice POD (luce) e/o PDR (gas), e l\'IBAN per la domiciliazione bancaria (se prevista dall\'offerta). Puoi caricare tutti i documenti direttamente dall\'app.',
      sortOrder: 11,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Documenti',
      question: 'Quali documenti servono per le utenze business?',
      answer:
        'Per le utenze business sono necessari: visura camerale recente (non più di 6 mesi), documento d\'identità del legale rappresentante, codice fiscale aziendale e Partita IVA, ultima bolletta di ciascun punto di fornitura con codici POD/PDR, e IBAN aziendale. Se il richiedente non è il legale rappresentante, è necessaria anche una delega firmata con copia del documento del delegante.',
      sortOrder: 12,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },
    {
      category: 'Documenti',
      question: 'Come carico i documenti richiesti?',
      answer:
        'Dalla sezione "I miei documenti" nell\'app, puoi caricare foto o file PDF di ogni documento richiesto. Assicurati che le immagini siano leggibili e che tutti i dati siano visibili. I documenti vengono verificati dal nostro team e riceverai una notifica in caso di problemi. La dimensione massima per file è di 10 MB.',
      sortOrder: 13,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Documenti',
      question: 'Quanto tempo sono validi i documenti caricati?',
      answer:
        'Il documento d\'identità deve essere in corso di validità al momento del caricamento. La visura camerale (per utenze business) deve essere stata emessa negli ultimi 6 mesi. La bolletta deve essere la più recente disponibile, preferibilmente degli ultimi 3 mesi. Se un documento risulta scaduto o non valido, riceverai una notifica con la richiesta di aggiornamento.',
      sortOrder: 14,
      isActive: true,
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
  const topicRepo = ds.getRepository(SupportTopic);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];
  const admin = ctx.users.admin;

  // Fetch topics for assignment
  const topics = await topicRepo.find();
  const topicByName = (name: string) =>
    topics.find((t) => t.name === name)?.id || topics[0]?.id;

  if (topics.length === 0) {
    console.log('  No support topics found, skipping ticket seed');
    return;
  }

  const ticketsData = [
    {
      userId: marco.id,
      assignedAgentId: admin.id,
      subject: 'Problema con la bolletta di gennaio',
      topicId: topicByName('Fatturazione e Pagamenti'),
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
    },
    {
      userId: laura.id,
      assignedAgentId: admin.id,
      subject: 'Cambio fornitore non completato',
      topicId: topicByName('Cambio Fornitore'),
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.IN_PROGRESS,
    },
    {
      userId: giuseppe.id,
      subject: 'Richiesta informazioni offerta business',
      topicId: topicByName('Generale'),
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
