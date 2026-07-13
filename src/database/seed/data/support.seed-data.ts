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

    // ── Offerte e Tariffe ─────────────────────────────────────────
    {
      category: 'Offerte e Tariffe',
      question: 'Che differenza c\'è tra tariffa fissa e variabile?',
      answer:
        'Con una tariffa a prezzo fisso, il costo dell\'energia al kWh o SMc resta invariato per tutta la durata del contratto (solitamente 12 o 24 mesi), proteggendoti da eventuali rialzi. Con una tariffa a prezzo variabile (indicizzata), il costo segue l\'andamento del mercato (indice PUN per la luce, PSV/TTF per il gas): può scendere nei periodi favorevoli ma anche salire. EasyRisparmio ti consiglia la tipologia più adatta in base al tuo profilo di consumo.',
      sortOrder: 11,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Offerte e Tariffe',
      question: 'Cosa sono le offerte Dual (luce + gas)?',
      answer:
        'Le offerte Dual combinano luce e gas in un unico contratto con lo stesso fornitore. Spesso offrono condizioni più vantaggiose rispetto a contratti separati, come sconti aggiuntivi sul prezzo dell\'energia o bonus di benvenuto. Su EasyRisparmio puoi confrontare sia offerte singole che Dual per trovare la combinazione più conveniente.',
      sortOrder: 12,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Offerte e Tariffe',
      question: 'Cosa significa tariffa monoraria, bioraria e trioraria?',
      answer:
        'La tariffa monoraria prevede lo stesso prezzo dell\'energia a qualsiasi ora del giorno. La bioraria distingue tra fascia F1 (lun-ven 8:00-19:00, prezzo più alto) e F23 (sera, notte, weekend, prezzo più basso). La trioraria aggiunge la fascia F2 (lun-ven 7:00-8:00 e 19:00-23:00, sab 7:00-23:00) e F3 (notte e domenica). Se consumi principalmente di sera e nel weekend, una tariffa bioraria o trioraria può farti risparmiare.',
      sortOrder: 13,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Offerte e Tariffe',
      question: 'Come vengono calcolate le offerte consigliate?',
      answer:
        'Le offerte consigliate vengono calcolate in base ai tuoi dati reali di consumo estratti dalla bolletta. Il nostro algoritmo confronta il tuo costo attuale per kWh o SMc con le tariffe di tutti i fornitori presenti sulla piattaforma, considerando il tipo di tariffa, la fascia oraria di consumo e la tua zona geografica. Il risparmio stimato è calcolato su base annua proiettando i tuoi consumi attuali.',
      sortOrder: 14,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Account e Registrazione ───────────────────────────────────
    {
      category: 'Account e Registrazione',
      question: 'Come mi registro su EasyRisparmio?',
      answer:
        'Puoi registrarti scaricando l\'app e creando un account con email e password, oppure accedendo rapidamente con Google, Facebook o Apple. Durante la registrazione scegli se sei un utente personale o business. La registrazione è gratuita e ti permette subito di caricare bollette e confrontare offerte.',
      sortOrder: 15,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Account e Registrazione',
      question: 'Come recupero la mia password?',
      answer:
        'Dalla schermata di login, tocca "Password dimenticata" e inserisci l\'email associata al tuo account. Riceverai un\'email con un codice OTP di verifica. Inserisci il codice nell\'app e crea una nuova password. Il codice ha una validità limitata per motivi di sicurezza. Se non ricevi l\'email, controlla la cartella spam o contatta il supporto.',
      sortOrder: 16,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Account e Registrazione',
      question: 'Posso collegare il mio account social dopo la registrazione?',
      answer:
        'Sì, se ti sei registrato con email e password, puoi successivamente collegare il tuo account Google, Facebook o Apple dalle impostazioni del profilo. Questo ti permetterà di accedere più rapidamente in futuro. Se accedi con un account social che ha la stessa email di un account esistente, i due account verranno collegati automaticamente.',
      sortOrder: 17,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Account e Registrazione',
      question: 'Come modifico i dati del mio profilo?',
      answer:
        'Puoi modificare i tuoi dati personali (nome, cognome, telefono, indirizzo) dalla sezione "Profilo" dell\'app. Per gli utenti business è possibile aggiornare anche la ragione sociale, la Partita IVA e i dati del legale rappresentante. L\'email di registrazione non può essere modificata per motivi di sicurezza.',
      sortOrder: 18,
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
      sortOrder: 19,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.PERSONAL,
    },
    {
      category: 'Documenti',
      question: 'Quali documenti servono per le utenze business?',
      answer:
        'Per le utenze business sono necessari: visura camerale recente (non più di 6 mesi), documento d\'identità del legale rappresentante, codice fiscale aziendale e Partita IVA, ultima bolletta di ciascun punto di fornitura con codici POD/PDR, e IBAN aziendale. Se il richiedente non è il legale rappresentante, è necessaria anche una delega firmata con copia del documento del delegante.',
      sortOrder: 20,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },
    {
      category: 'Documenti',
      question: 'Come carico i documenti richiesti?',
      answer:
        'Dalla sezione "I miei documenti" nell\'app, puoi caricare foto o file PDF di ogni documento richiesto. Assicurati che le immagini siano leggibili e che tutti i dati siano visibili. I documenti vengono verificati dal nostro team e riceverai una notifica in caso di problemi. La dimensione massima per file è di 10 MB.',
      sortOrder: 21,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Contratti e Pratiche ──────────────────────────────────────
    {
      category: 'Contratti e Pratiche',
      question: 'Come seguo lo stato della mia pratica?',
      answer:
        'Puoi monitorare lo stato della tua pratica in tempo reale dalla sezione "Le mie pratiche" nell\'app. Ogni pratica passa attraverso diverse fasi: presa in carico, verifica documenti, invio al fornitore, conferma attivazione. Riceverai notifiche push ad ogni cambio di stato. In caso di problemi o documenti mancanti, verrai contattato tempestivamente.',
      sortOrder: 22,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Contratti e Pratiche',
      question: 'Posso annullare una pratica già avviata?',
      answer:
        'Sì, puoi annullare la pratica in qualsiasi momento prima della conferma definitiva da parte del fornitore. Inoltre, hai diritto di recesso entro 14 giorni dalla firma del contratto senza alcuna penale, come previsto dal Codice del Consumo. Per annullare, contatta il supporto tramite l\'app o apri un ticket nella sezione assistenza.',
      sortOrder: 23,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Contratti e Pratiche',
      question: 'Quando riceverò la prima bolletta dal nuovo fornitore?',
      answer:
        'La prima bolletta dal nuovo fornitore arriverà generalmente entro 1-2 mesi dall\'attivazione della fornitura. Il periodo esatto dipende dal ciclo di fatturazione del nuovo fornitore. L\'ultima bolletta dal vecchio fornitore conterrà i consumi fino alla data di passaggio e potrebbe arrivare con un leggero ritardo.',
      sortOrder: 24,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Utenze Business ───────────────────────────────────────────
    {
      category: 'Utenze Business',
      question: 'Posso gestire più punti di fornitura con un unico account?',
      answer:
        'Sì, gli account business possono gestire più punti di fornitura (POD/PDR) da un unico account. Puoi caricare le bollette di ogni sede o filiale e ricevere analisi e offerte personalizzate per ciascun punto di fornitura. Questo ti permette di avere una visione completa dei costi energetici della tua azienda.',
      sortOrder: 25,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },
    {
      category: 'Utenze Business',
      question: 'Le offerte business sono diverse da quelle residenziali?',
      answer:
        'Sì, le offerte business sono studiate per i profili di consumo delle aziende, generalmente più elevati rispetto alle utenze domestiche. Offrono spesso condizioni diverse in termini di prezzo al kWh/SMc, opzioni di fatturazione, servizi aggiuntivi e condizioni contrattuali. Su EasyRisparmio le offerte vengono filtrate automaticamente in base al tuo tipo di account.',
      sortOrder: 26,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },
    {
      category: 'Utenze Business',
      question: 'Cos\'è la Partita IVA e perché è necessaria?',
      answer:
        'La Partita IVA è il codice identificativo fiscale dell\'azienda, necessario per stipulare contratti di fornitura energetica business. È richiesta per emettere fatture con IVA detraibile e per accedere alle tariffe dedicate alle imprese. Inserisci la Partita IVA nel tuo profilo business per ricevere offerte e preventivi corretti.',
      sortOrder: 27,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BUSINESS,
    },

    // ── Programma Referral ────────────────────────────────────────
    {
      category: 'Programma Referral',
      question: 'Come funziona il programma di referral?',
      answer:
        'Con il programma referral di EasyRisparmio puoi invitare amici e conoscenti a utilizzare la piattaforma. Condividi il tuo codice referral personale: quando un invitato si registra, carica una bolletta e completa un cambio fornitore, sia tu che l\'invitato riceverete un bonus. Puoi monitorare lo stato dei tuoi inviti e i bonus maturati nella sezione "Referral" dell\'app.',
      sortOrder: 28,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Programma Referral',
      question: 'Dove trovo il mio codice referral?',
      answer:
        'Il tuo codice referral personale è disponibile nella sezione "Referral" dell\'app, accessibile dal menu principale. Puoi copiarlo e condividerlo tramite WhatsApp, email, SMS o qualsiasi altro canale. Il codice è univoco e associato al tuo account.',
      sortOrder: 29,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Sicurezza e Privacy ───────────────────────────────────────
    {
      category: 'Sicurezza e Privacy',
      question: 'I miei dati personali sono al sicuro?',
      answer:
        'Sì, la sicurezza dei tuoi dati è la nostra priorità. Utilizziamo protocolli di crittografia avanzati per proteggere tutte le comunicazioni e i dati archiviati. I documenti caricati sono accessibili solo al nostro team autorizzato. Trattiamo i tuoi dati in conformità al GDPR (Regolamento UE 2016/679) e alla normativa italiana sulla privacy. Puoi consultare la nostra informativa privacy completa nelle impostazioni dell\'app.',
      sortOrder: 30,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Sicurezza e Privacy',
      question: 'Come posso eliminare il mio account?',
      answer:
        'Puoi richiedere la cancellazione del tuo account dalla sezione "Impostazioni" dell\'app o contattando il supporto. La cancellazione comporta l\'eliminazione di tutti i dati personali entro 30 giorni, come previsto dal GDPR. Eventuali pratiche in corso dovranno essere completate o annullate prima della cancellazione.',
      sortOrder: 31,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Supporto ──────────────────────────────────────────────────
    {
      category: 'Supporto',
      question: 'Come contatto il supporto clienti?',
      answer:
        'Puoi contattare il nostro team di supporto in diversi modi: apri un ticket dalla sezione "Assistenza" dell\'app per ricevere supporto scritto con tracciamento della richiesta, invia un\'email a supporto@easyresparmio.it, oppure chiama il numero verde 800 123 456. Il servizio è attivo dal lunedì al venerdì, dalle 9:00 alle 18:00.',
      sortOrder: 32,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Supporto',
      question: 'Come apro un ticket di assistenza?',
      answer:
        'Dalla sezione "Assistenza" dell\'app, tocca "Nuovo ticket", seleziona l\'argomento (supporto tecnico, fatturazione, cambio fornitore o generale), scrivi una descrizione del problema e invia. Puoi allegare immagini o documenti per aiutarci a risolvere più velocemente. Riceverai una notifica ad ogni risposta del nostro team.',
      sortOrder: 33,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Supporto',
      question: 'Entro quanto tempo riceverò una risposta?',
      answer:
        'Il nostro team risponde generalmente entro 24 ore lavorative. I ticket con priorità alta (problemi di fatturazione, errori nelle pratiche) vengono gestiti con precedenza. Puoi controllare lo stato del tuo ticket in qualsiasi momento dalla sezione "I miei ticket" nell\'app.',
      sortOrder: 34,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },

    // ── Mercato Energetico ────────────────────────────────────────
    {
      category: 'Mercato Energetico',
      question: 'Cos\'è il mercato libero dell\'energia?',
      answer:
        'Il mercato libero dell\'energia permette ai consumatori di scegliere liberamente il proprio fornitore di luce e gas, selezionando l\'offerta più adatta alle proprie esigenze. A differenza del vecchio servizio di maggior tutela (terminato per i clienti domestici a luglio 2024), nel mercato libero i prezzi sono stabiliti dai singoli fornitori in concorrenza tra loro. EasyRisparmio ti aiuta a orientarti tra le offerte per trovare quella più conveniente.',
      sortOrder: 35,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Mercato Energetico',
      question: 'Cos\'è il PUN e come influenza la mia bolletta?',
      answer:
        'Il PUN (Prezzo Unico Nazionale) è il prezzo di riferimento dell\'energia elettrica all\'ingrosso in Italia, determinato dal GME (Gestore dei Mercati Energetici). Le tariffe a prezzo variabile (indicizzate) seguono l\'andamento del PUN: quando il PUN sale, il costo in bolletta aumenta, e viceversa. EasyRisparmio monitora gli indici di mercato per consigliarti il momento migliore per scegliere tra tariffa fissa e variabile.',
      sortOrder: 36,
      isActive: true,
      locale: 'it',
      targetAudience: UserTarget.BOTH,
    },
    {
      category: 'Mercato Energetico',
      question: 'Cosa sono gli oneri di sistema in bolletta?',
      answer:
        'Gli oneri di sistema sono costi stabiliti dall\'ARERA (Autorità di Regolazione per Energia Reti e Ambiente) e sono uguali per tutti i fornitori. Finanziano il sistema energetico nazionale: incentivi alle fonti rinnovabili, costi di smantellamento delle centrali nucleari, bonus sociali e altri servizi. Questa componente non cambia con il cambio fornitore; ciò che puoi risparmiare è sulla componente di materia energia.',
      sortOrder: 37,
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
