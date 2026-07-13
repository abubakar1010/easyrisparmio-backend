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
