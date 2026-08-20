import { DataSource } from 'typeorm';
import { Agreement } from '../../../modules/agreements/entities/agreement.entity';
import { UserTarget } from '../../../common/enums/offer.enum';
import { SeedContext } from '../seed-context';

export async function seedAgreements(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Agreement);
  const admin = ctx.users.admin;

  const agreementsData = [
    {
      title: '20% di Sconto su Tutta la Pizza',
      description:
        "L'Antica Pizzeria Da Michele, fondata nel 1870 a Napoli, è rinomata in tutto il mondo per la sua pizza margherita preparata con ingredienti freschi e la tradizionale cottura nel forno a legna. Grazie alla convenzione EasyRisparmio, tutti i nostri clienti possono gustare le migliori pizze napoletane a prezzo scontato.",
      partnerName: "L'Antica Pizzeria Da Michele",
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '20% di sconto su tutto il menu pizza. Codice: EASY20',
      termsUrl: 'https://www.damichele.net',
      address: 'Via Cesare Sersale 1, 80139 Napoli NA, Italia',
      isActive: true,
      targetAudience: UserTarget.PERSONAL,
      validFrom: new Date('2026-01-15'),
      validUntil: new Date('2026-12-31'),
      sortOrder: 1,
      createdBy: admin.id,
    },
    {
      title: '15% su Pranzo e Cena',
      description:
        'Osteria Francescana dello Chef Massimo Bottura, tre stelle Michelin a Modena. Cucina italiana contemporanea che reinterpreta i classici emiliani con creatività e rispetto della tradizione. Convenzione esclusiva per i clienti EasyRisparmio.',
      partnerName: 'Osteria Francescana',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '15% di sconto sul conto pranzo e cena. Codice: BOTTURA15',
      termsUrl: 'https://www.osteriafrancescana.it',
      address: 'Via Stella 22, 41121 Modena MO, Italia',
      isActive: true,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2026-11-30'),
      sortOrder: 2,
      createdBy: admin.id,
    },
    {
      title: 'Catering Aziendale Scontato 25%',
      description:
        "Eataly offre un servizio di catering aziendale con prodotti italiani di alta qualità, dalla pasta fresca ai formaggi DOP. L'accordo è riservato alle aziende clienti EasyRisparmio per eventi aziendali, meeting e pranzi di lavoro.",
      partnerName: 'Eataly',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '25% di sconto sul servizio catering aziendale. Codice: EATBIZ25',
      termsUrl: 'https://www.eataly.net',
      address: 'Piazza XXV Aprile 10, 20121 Milano MI, Italia',
      isActive: true,
      targetAudience: UserTarget.BUSINESS,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      sortOrder: 3,
      createdBy: admin.id,
    },
    {
      title: '10% su Gelato Artigianale',
      description:
        'Grom, la famosa gelateria artigianale fondata a Torino, utilizza solo ingredienti naturali e frutta di stagione. Sconto valido in tutti i punti vendita Grom in Italia per tutti i clienti EasyRisparmio.',
      partnerName: 'Grom Gelato',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '10% di sconto su tutti i gusti e le vaschette. Codice: GROM10',
      termsUrl: 'https://www.grom.it',
      address: 'Via della Maddalena 30, 10122 Torino TO, Italia',
      isActive: true,
      targetAudience: UserTarget.PERSONAL,
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-09-30'),
      sortOrder: 4,
      createdBy: admin.id,
    },
    {
      title: 'Sconto 30% sul Primo Ordine',
      description:
        'Rossopomodoro porta la tradizione della cucina napoletana autentica in tutta Italia. Pizze cotte nel forno a legna, pasta fresca fatta a mano e ingredienti DOP. Sconto speciale di benvenuto per i nuovi clienti EasyRisparmio.',
      partnerName: 'Rossopomodoro',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '30% di sconto sul primo ordine in qualsiasi sede. Codice: ROSSO30',
      termsUrl: 'https://www.rossopomodoro.it',
      address: 'Via Partenope 1, 80121 Napoli NA, Italia',
      isActive: true,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2027-02-28'),
      sortOrder: 5,
      createdBy: admin.id,
    },
    {
      title: 'Cena Business con Vino Incluso',
      description:
        "Il Ristorante Cracco, guidato dallo Chef Carlo Cracco nel cuore di Milano in Galleria Vittorio Emanuele II, offre un'esperienza gastronomica di altissimo livello. Convenzione riservata alle aziende per cene di rappresentanza e incontri d'affari.",
      partnerName: 'Ristorante Cracco',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=400&fit=crop&q=80',
      discountDescription:
        'Bottiglia di vino inclusa per tavoli business da 4+ persone. Codice: CRACCO4BIZ',
      termsUrl: 'https://www.ristorantecracco.it',
      address: 'Galleria Vittorio Emanuele II, 20121 Milano MI, Italia',
      isActive: true,
      targetAudience: UserTarget.BUSINESS,
      validFrom: new Date('2026-01-15'),
      validUntil: new Date('2026-12-15'),
      sortOrder: 6,
      createdBy: admin.id,
    },
    {
      title: 'Colazione Gratuita con Brunch',
      description:
        "Caffè Florian, il caffè più antico d'Italia fondato nel 1720 in Piazza San Marco a Venezia. Un'esperienza unica tra storia e gusto. Ogni brunch prenotato include la colazione completa in omaggio per i clienti EasyRisparmio.",
      partnerName: 'Caffè Florian',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop&q=80',
      discountDescription:
        'Colazione gratuita con prenotazione brunch weekend. Codice: FLORIAN0',
      termsUrl: 'https://www.caffeflorian.com',
      address: 'Piazza San Marco 57, 30124 Venezia VE, Italia',
      isActive: true,
      targetAudience: UserTarget.PERSONAL,
      validFrom: new Date('2026-05-01'),
      validUntil: new Date('2026-10-31'),
      sortOrder: 7,
      createdBy: admin.id,
    },
    {
      title: '15% su Menu Degustazione',
      description:
        "Le Calandre, ristorante tre stelle Michelin dei fratelli Alajmo a Rubano (Padova). Cucina d'avanguardia che celebra le materie prime del territorio veneto. Sconto esclusivo sul menu degustazione per i clienti EasyRisparmio.",
      partnerName: 'Le Calandre',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '15% di sconto sul menu degustazione da 8 portate. Codice: CALANDRE15',
      termsUrl: 'https://www.alajmo.it/le-calandre',
      address: 'Via Liguria 1, 35030 Sarmeola di Rubano PD, Italia',
      isActive: false,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2025-06-01'),
      validUntil: new Date('2025-12-31'),
      sortOrder: 8,
      createdBy: admin.id,
    },
    {
      title: 'Iscrizione Gratuita + 20% sull’Abbonamento Annuale',
      description:
        'Virgin Active gestisce club fitness premium in tutta Italia con piscine, aree functional training, oltre 100 corsi a settimana e personal trainer qualificati. La convenzione EasyRisparmio azzera la quota di iscrizione e sconta l’abbonamento annuale in tutti i club aderenti.',
      partnerName: 'Virgin Active Italia',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop&q=80',
      discountDescription:
        'Quota di iscrizione gratuita (valore 150€) + 20% di sconto sull’abbonamento annuale. Codice: EASYFIT20',
      termsUrl: 'https://www.virginactive.it',
      address: 'Viale Bligny 39, 20136 Milano MI, Italia',
      isActive: true,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2026-09-01'),
      validUntil: new Date('2027-08-31'),
      sortOrder: 9,
      createdBy: admin.id,
    },
    {
      title: 'Sconto Carburante 5 Cent al Litro',
      description:
        'Q8 (Kuwait Petroleum Italia) conta oltre 2.800 stazioni di servizio sul territorio nazionale. Con la convenzione EasyRisparmio i clienti ottengono uno sconto immediato sul rifornimento di benzina e diesel presso tutte le stazioni Q8 e Q8 Easy aderenti, cumulabile con la app Q8.',
      partnerName: 'Q8 - Kuwait Petroleum Italia',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1545262810-77515befe149?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '5 centesimi di sconto al litro su benzina e diesel self-service, fino a 100 litri al mese. Codice: EASYQ8',
      termsUrl: 'https://www.q8.it',
      address: 'Viale dell’Oceano Indiano 13, 00144 Roma RM, Italia',
      isActive: true,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2026-06-01'),
      validUntil: new Date('2027-05-31'),
      sortOrder: 10,
      createdBy: admin.id,
    },
    {
      title: '30% sulle Lenti da Vista + Visita Gratuita',
      description:
        'Salmoiraghi & Viganò, catena ottica italiana attiva dal 1865 con più di 400 negozi, offre occhiali da vista e da sole delle migliori marche. La convenzione EasyRisparmio include il controllo della vista gratuito con optometrista e uno sconto dedicato sulle lenti oftalmiche.',
      partnerName: 'Salmoiraghi & Viganò',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '30% di sconto sulle lenti da vista e controllo della vista gratuito in negozio. Codice: EASYVISTA30',
      termsUrl: 'https://www.salmoiraghievigano.it',
      address: 'Corso Vittorio Emanuele II 30, 20122 Milano MI, Italia',
      isActive: true,
      targetAudience: UserTarget.PERSONAL,
      validFrom: new Date('2026-03-15'),
      validUntil: new Date('2026-12-31'),
      sortOrder: 11,
      createdBy: admin.id,
    },
    {
      title: '15% su Abbigliamento e Attrezzatura Sportiva',
      description:
        'Decathlon Italia propone attrezzatura e abbigliamento per oltre 70 sport a prezzi accessibili, con i marchi propri Quechua, Domyos, Kipsta e Btwin. Lo sconto EasyRisparmio è valido nei negozi fisici e sull’e-commerce, esclusi i prodotti già in promozione.',
      partnerName: 'Decathlon Italia',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '15% di sconto su abbigliamento e attrezzatura, in negozio e online. Spesa minima 50€. Codice: EASYSPORT15',
      termsUrl: 'https://www.decathlon.it',
      address: 'Via Enrico Fermi 8, 20090 Assago MI, Italia',
      isActive: true,
      targetAudience: UserTarget.BOTH,
      validFrom: new Date('2026-07-01'),
      validUntil: new Date('2027-06-30'),
      sortOrder: 12,
      createdBy: admin.id,
    },
    {
      title: 'Noleggio Aziendale -20% e Secondo Guidatore Gratis',
      description:
        'Europcar Italia mette a disposizione una flotta aziendale con oltre 400 punti di noleggio in Italia, inclusi aeroporti e stazioni ferroviarie. La convenzione è riservata alle aziende clienti EasyRisparmio per trasferte di lavoro e noleggi a breve termine.',
      partnerName: 'Europcar Italia',
      partnerLogoUrl:
        'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=400&fit=crop&q=80',
      discountDescription:
        '20% di sconto sulle tariffe business e secondo guidatore incluso senza costi aggiuntivi. Codice: EASYBIZCAR',
      termsUrl: 'https://www.europcar.it',
      address: 'Via Antonio Cechov 50, 20151 Milano MI, Italia',
      isActive: true,
      targetAudience: UserTarget.BUSINESS,
      validFrom: new Date('2026-02-01'),
      validUntil: new Date('2027-01-31'),
      sortOrder: 13,
      createdBy: admin.id,
    },
  ];

  for (const data of agreementsData) {
    const existing = await repo.findOne({
      where: { title: data.title },
      withDeleted: true,
    });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created agreement: ${data.title}`);
    } else {
      console.log(`  Agreement already exists: ${data.title}`);
    }
  }
}
