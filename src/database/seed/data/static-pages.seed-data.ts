import { DataSource } from 'typeorm';
import { StaticPage } from '../../../modules/static-pages/entities/static-page.entity';
import { LegalAudience } from '../../../common/enums/legal.enum';

export async function seedStaticPages(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(StaticPage);

  const pagesData: Array<Partial<StaticPage>> = [
    // ── Privacy Policy (Italian) ──
    {
      slug: 'privacy-policy',
      title: 'Informativa sulla Privacy',
      locale: 'it',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.ALL,
      content: `
<h2>Informativa sulla Privacy</h2>
<p>La presente Informativa sulla Privacy descrive come EasyRisparmio ("noi", "nostro" o "la Società") raccoglie, utilizza e protegge i dati personali degli utenti in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR - Regolamento UE 2016/679) e il Codice in materia di protezione dei dati personali (D.Lgs. 196/2003, come modificato dal D.Lgs. 101/2018).</p>

<h3>1. Titolare del Trattamento</h3>
<p>Il Titolare del trattamento dei dati personali è EasyRisparmio S.r.l., con sede legale in Italia. Per qualsiasi richiesta relativa al trattamento dei dati personali, è possibile contattarci all'indirizzo email: privacy@easyresparmio.it</p>

<h3>2. Dati Raccolti</h3>
<p>Raccogliamo le seguenti categorie di dati personali:</p>
<ul>
  <li><strong>Dati identificativi:</strong> nome, cognome, codice fiscale, partita IVA (per utenti business)</li>
  <li><strong>Dati di contatto:</strong> indirizzo email, numero di telefono, indirizzo di residenza</li>
  <li><strong>Dati relativi alle utenze:</strong> codice POD (energia elettrica), codice PDR (gas), dati di consumo, importi delle bollette</li>
  <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di dispositivo, sistema operativo, dati di navigazione</li>
</ul>

<h3>3. Finalità del Trattamento</h3>
<p>I dati personali sono trattati per le seguenti finalità:</p>
<ul>
  <li>Gestione dell'account utente e autenticazione</li>
  <li>Analisi delle bollette energetiche e confronto delle offerte</li>
  <li>Gestione della pratica di cambio fornitore</li>
  <li>Invio di comunicazioni relative al servizio</li>
  <li>Miglioramento dei nostri servizi e analisi statistiche aggregate</li>
</ul>

<h3>4. Base Giuridica</h3>
<p>Il trattamento dei dati è basato su: esecuzione del contratto di servizio, consenso dell'utente, adempimento di obblighi legali e legittimo interesse del Titolare.</p>

<h3>5. Conservazione dei Dati</h3>
<p>I dati personali sono conservati per il tempo necessario al raggiungimento delle finalità per cui sono stati raccolti, e comunque non oltre i termini previsti dalla normativa vigente. I dati relativi alle pratiche di switching vengono conservati per 10 anni dalla chiusura della pratica.</p>

<h3>6. Diritti dell'Interessato</h3>
<p>In conformità con gli articoli 15-22 del GDPR, l'utente ha diritto di:</p>
<ul>
  <li>Accedere ai propri dati personali</li>
  <li>Richiedere la rettifica o la cancellazione dei dati</li>
  <li>Limitare o opporsi al trattamento</li>
  <li>Richiedere la portabilità dei dati</li>
  <li>Revocare il consenso in qualsiasi momento</li>
  <li>Proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali</li>
</ul>

<h3>7. Sicurezza dei Dati</h3>
<p>Adottiamo misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita, distruzione o alterazione, inclusa la crittografia dei dati in transito e a riposo.</p>
`.trim(),
    },

    // ── Privacy Policy (English) ──
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      locale: 'en',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.ALL,
      content: `
<h2>Privacy Policy</h2>
<p>This Privacy Policy describes how EasyRisparmio ("we", "our" or "the Company") collects, uses, and protects users' personal data in compliance with the General Data Protection Regulation (GDPR - EU Regulation 2016/679) and the Italian Data Protection Code (Legislative Decree 196/2003, as amended by Legislative Decree 101/2018).</p>

<h3>1. Data Controller</h3>
<p>The Data Controller is EasyRisparmio S.r.l., with registered office in Italy. For any request regarding personal data processing, you can contact us at: privacy@easyresparmio.it</p>

<h3>2. Data Collected</h3>
<p>We collect the following categories of personal data:</p>
<ul>
  <li><strong>Identification data:</strong> first name, last name, tax code (codice fiscale), VAT number (for business users)</li>
  <li><strong>Contact data:</strong> email address, phone number, residential address</li>
  <li><strong>Utility data:</strong> POD code (electricity), PDR code (gas), consumption data, bill amounts</li>
  <li><strong>Technical data:</strong> IP address, device type, operating system, browsing data</li>
</ul>

<h3>3. Processing Purposes</h3>
<p>Personal data is processed for the following purposes:</p>
<ul>
  <li>User account management and authentication</li>
  <li>Energy bill analysis and offer comparison</li>
  <li>Supplier switching process management</li>
  <li>Service-related communications</li>
  <li>Service improvement and aggregate statistical analysis</li>
</ul>

<h3>4. Legal Basis</h3>
<p>Data processing is based on: performance of the service contract, user consent, compliance with legal obligations, and legitimate interest of the Controller.</p>

<h3>5. Data Retention</h3>
<p>Personal data is retained for the time necessary to fulfill the purposes for which it was collected, and in any case no longer than the terms required by applicable law. Switching case data is retained for 10 years from case closure.</p>

<h3>6. Data Subject Rights</h3>
<p>In accordance with Articles 15-22 of the GDPR, users have the right to:</p>
<ul>
  <li>Access their personal data</li>
  <li>Request rectification or erasure of data</li>
  <li>Restrict or object to processing</li>
  <li>Request data portability</li>
  <li>Withdraw consent at any time</li>
  <li>Lodge a complaint with the Italian Data Protection Authority (Garante)</li>
</ul>

<h3>7. Data Security</h3>
<p>We implement appropriate technical and organizational measures to protect personal data from unauthorized access, loss, destruction, or alteration, including encryption of data in transit and at rest.</p>
`.trim(),
    },

    // ── Terms & Conditions (Italian) ──
    {
      slug: 'terms-conditions',
      title: 'Termini e Condizioni',
      locale: 'it',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.ALL,
      content: `
<h2>Termini e Condizioni di Utilizzo</h2>
<p>I presenti Termini e Condizioni regolano l'utilizzo dell'applicazione mobile e della piattaforma web EasyRisparmio. Utilizzando i nostri servizi, l'utente accetta integralmente le presenti condizioni.</p>

<h3>1. Descrizione del Servizio</h3>
<p>EasyRisparmio è una piattaforma di confronto e switching per utenze energetiche (luce e gas) che permette agli utenti di:</p>
<ul>
  <li>Caricare e analizzare le proprie bollette energetiche tramite tecnologia OCR</li>
  <li>Confrontare le offerte dei principali fornitori di energia italiani</li>
  <li>Avviare e gestire la pratica di cambio fornitore</li>
  <li>Monitorare i propri consumi e risparmi</li>
</ul>

<h3>2. Registrazione e Account</h3>
<p>Per accedere ai servizi è necessario creare un account fornendo dati veritieri e completi. L'utente è responsabile della riservatezza delle proprie credenziali di accesso e di tutte le attività svolte tramite il proprio account.</p>

<h3>3. Obblighi dell'Utente</h3>
<p>L'utente si impegna a:</p>
<ul>
  <li>Fornire informazioni accurate e aggiornate</li>
  <li>Non utilizzare il servizio per scopi illeciti o fraudolenti</li>
  <li>Non tentare di accedere in modo non autorizzato ai sistemi della piattaforma</li>
  <li>Rispettare i diritti di proprietà intellettuale di EasyRisparmio</li>
</ul>

<h3>4. Processo di Switching</h3>
<p>EasyRisparmio agisce come intermediario nel processo di cambio fornitore. Il contratto di fornitura viene stipulato direttamente tra l'utente e il nuovo fornitore. EasyRisparmio non è responsabile per variazioni di prezzo, interruzioni del servizio o inadempimenti del fornitore.</p>

<h3>5. Limitazione di Responsabilità</h3>
<p>EasyRisparmio si impegna a fornire informazioni accurate e aggiornate, ma non garantisce l'assenza di errori. Le analisi e i confronti hanno carattere indicativo e non costituiscono consulenza finanziaria o contrattuale.</p>

<h3>6. Proprietà Intellettuale</h3>
<p>Tutti i contenuti della piattaforma, inclusi testi, grafica, loghi, algoritmi e software, sono di proprietà esclusiva di EasyRisparmio e sono protetti dalle leggi sul diritto d'autore.</p>

<h3>7. Modifiche ai Termini</h3>
<p>EasyRisparmio si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno comunicate tramite l'app e entreranno in vigore dalla data di pubblicazione.</p>

<h3>8. Legge Applicabile e Foro Competente</h3>
<p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente il Foro del luogo di residenza del consumatore, ai sensi del D.Lgs. 206/2005 (Codice del Consumo).</p>
`.trim(),
    },

    // ── Terms & Conditions (English) ──
    {
      slug: 'terms-conditions',
      title: 'Terms and Conditions',
      locale: 'en',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.ALL,
      content: `
<h2>Terms and Conditions of Use</h2>
<p>These Terms and Conditions govern the use of the EasyRisparmio mobile application and web platform. By using our services, the user fully accepts these conditions.</p>

<h3>1. Service Description</h3>
<p>EasyRisparmio is a comparison and switching platform for energy utilities (electricity and gas) that allows users to:</p>
<ul>
  <li>Upload and analyze energy bills using OCR technology</li>
  <li>Compare offers from major Italian energy suppliers</li>
  <li>Initiate and manage the supplier switching process</li>
  <li>Monitor consumption and savings</li>
</ul>

<h3>2. Registration and Account</h3>
<p>To access the services, users must create an account by providing truthful and complete information. Users are responsible for maintaining the confidentiality of their login credentials and all activities performed through their account.</p>

<h3>3. User Obligations</h3>
<p>Users agree to:</p>
<ul>
  <li>Provide accurate and up-to-date information</li>
  <li>Not use the service for unlawful or fraudulent purposes</li>
  <li>Not attempt unauthorized access to platform systems</li>
  <li>Respect EasyRisparmio's intellectual property rights</li>
</ul>

<h3>4. Switching Process</h3>
<p>EasyRisparmio acts as an intermediary in the supplier switching process. The supply contract is entered into directly between the user and the new supplier. EasyRisparmio is not responsible for price changes, service interruptions, or supplier defaults.</p>

<h3>5. Limitation of Liability</h3>
<p>EasyRisparmio strives to provide accurate and up-to-date information but does not guarantee the absence of errors. Analyses and comparisons are indicative and do not constitute financial or contractual advice.</p>

<h3>6. Intellectual Property</h3>
<p>All platform content, including text, graphics, logos, algorithms, and software, is the exclusive property of EasyRisparmio and is protected by copyright laws.</p>

<h3>7. Changes to Terms</h3>
<p>EasyRisparmio reserves the right to modify these Terms at any time. Changes will be communicated through the app and will take effect from the date of publication.</p>

<h3>8. Applicable Law and Jurisdiction</h3>
<p>These Terms are governed by Italian law. For any dispute, the court of the consumer's place of residence shall have jurisdiction, pursuant to Legislative Decree 206/2005 (Consumer Code).</p>
`.trim(),
    },

    // ── Business Terms & Conditions (Italian) ──
    {
      slug: 'business-terms-conditions',
      title: 'Termini e Condizioni Business',
      locale: 'it',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.BUSINESS,
      content: `
<h2>Termini e Condizioni Business</h2>
<p>I presenti Termini e Condizioni Business ("Condizioni Business") disciplinano l'utilizzo della piattaforma EasyRisparmio da parte di soggetti titolari di Partita IVA — imprese individuali, societa, liberi professionisti ed enti — e integrano i Termini e Condizioni generali, che restano applicabili per quanto non espressamente derogato.</p>

<h3>1. Ambito di Applicazione</h3>
<p>Le presenti Condizioni si applicano a ogni account registrato o convertito in profilo business. L'utente dichiara di agire nell'esercizio della propria attivita imprenditoriale, commerciale, artigianale o professionale e non in qualita di consumatore ai sensi dell'art. 3 del D.Lgs. 206/2005.</p>

<h3>2. Titolarita dell'Account e Poteri di Rappresentanza</h3>
<p>Chi registra un account business dichiara e garantisce di avere il potere di rappresentare l'impresa indicata e di impegnarla contrattualmente. L'impresa risponde di ogni attivita svolta tramite l'account, comprese le richieste di cambio fornitore avviate dai propri incaricati.</p>
<ul>
  <li>La Partita IVA fornita deve essere valida, attiva e riferita all'impresa titolare dell'account</li>
  <li>Una stessa Partita IVA puo essere associata a un solo account</li>
  <li>Le variazioni di ragione sociale, sede legale o rappresentante legale devono essere comunicate tempestivamente</li>
</ul>

<h3>3. Fornitura di Energia per Uso Non Domestico</h3>
<p>Le offerte presentate agli account business riguardano forniture per uso non domestico. Prezzi, componenti fiscali, accise e aliquote IVA differiscono da quelle applicate alle utenze domestiche, cosi come le condizioni di recesso e le garanzie richieste dal fornitore.</p>
<p>Per ogni punto di fornitura l'utente e tenuto a fornire codice POD (energia elettrica) o PDR (gas), potenza impegnata, consumi storici e destinazione d'uso corretti. Dati non veritieri possono comportare il rifiuto della pratica da parte del fornitore o la riapplicazione retroattiva di tariffe diverse.</p>

<h3>4. Punti di Fornitura Multipli</h3>
<p>L'account business puo gestire piu punti di fornitura. Ogni pratica di switching e trattata autonomamente: tempistiche, esiti ed eventuali contestazioni riguardano il singolo POD o PDR e non l'insieme delle utenze aziendali.</p>

<h3>5. Diritto di Recesso</h3>
<p>Il diritto di recesso di quattordici giorni previsto dal Codice del Consumo non si applica ai contratti conclusi da soggetti che agiscono nell'esercizio della propria attivita professionale. Restano ferme le facolta di recesso previste dal contratto di fornitura sottoscritto con il fornitore e dalla delibera ARERA applicabile.</p>

<h3>6. Ruolo di EasyRisparmio e Remunerazione</h3>
<p>EasyRisparmio opera come intermediario e segnalatore. Il contratto di fornitura e stipulato direttamente tra l'impresa e il fornitore prescelto. Il servizio e gratuito per l'utente: EasyRisparmio percepisce una provvigione dal fornitore a fronte delle attivazioni andate a buon fine, circostanza che l'utente dichiara di conoscere e accettare.</p>

<h3>7. Documentazione e Verifiche</h3>
<p>Per l'attivazione delle pratiche business puo essere richiesta documentazione aggiuntiva: visura camerale, documento del legale rappresentante, ultima bolletta, dichiarazione di accisa e, ove previsto, attestazione di regolarita contributiva. L'utente autorizza EasyRisparmio a trasmettere tale documentazione al fornitore selezionato ai soli fini della pratica.</p>

<h3>8. Fatturazione Elettronica e PEC</h3>
<p>L'utente si impegna a fornire codice destinatario SDI o indirizzo PEC corretti per la fatturazione elettronica. EasyRisparmio non risponde di ritardi o mancati recapiti dovuti a recapiti telematici errati o non attivi.</p>

<h3>9. Trattamento dei Dati Aziendali</h3>
<p>I dati dell'impresa e dei suoi referenti sono trattati secondo l'Informativa sulla Privacy. Per gli account business il trattamento include la comunicazione dei dati ai fornitori di energia ai fini della valutazione del merito creditizio e della stipula del contratto di fornitura.</p>

<h3>10. Limitazione di Responsabilita</h3>
<p>Le analisi, i confronti e le stime di risparmio hanno carattere indicativo e si basano sui dati forniti dall'utente e sulle condizioni di mercato al momento dell'elaborazione. EasyRisparmio non risponde del mancato conseguimento del risparmio stimato, ne di variazioni di prezzo, indicizzazioni PUN/GME o inadempimenti imputabili al fornitore.</p>
<p>Nei rapporti con utenti business, e salvo dolo o colpa grave, la responsabilita complessiva di EasyRisparmio e in ogni caso limitata all'importo delle provvigioni percepite in relazione alla pratica contestata.</p>

<h3>11. Modifiche alle Condizioni</h3>
<p>EasyRisparmio puo modificare le presenti Condizioni Business. Le modifiche sostanziali sono pubblicate con una nuova versione del documento e sottoposte nuovamente all'accettazione dell'utente al primo accesso successivo alla pubblicazione. Il mancato consenso impedisce l'ulteriore utilizzo dei servizi business.</p>

<h3>12. Legge Applicabile e Foro Competente</h3>
<p>Le presenti Condizioni sono regolate dalla legge italiana. Per ogni controversia derivante dal rapporto tra EasyRisparmio e l'utente business sara competente in via esclusiva il Foro di Milano.</p>
`.trim(),
    },

    // ── Business Terms & Conditions (English) ──
    {
      slug: 'business-terms-conditions',
      title: 'Business Terms and Conditions',
      locale: 'en',
      isActive: true,
      version: '1.0',
      requiresAcceptance: true,
      audience: LegalAudience.BUSINESS,
      content: `
<h2>Business Terms and Conditions</h2>
<p>These Business Terms and Conditions ("Business Terms") govern use of the EasyRisparmio platform by VAT-registered entities — sole traders, companies, self-employed professionals and organisations — and supplement the general Terms and Conditions, which continue to apply except where expressly varied here.</p>

<h3>1. Scope</h3>
<p>These Business Terms apply to every account registered as, or converted to, a business profile. The user declares that they are acting in the course of their business, commercial, craft or professional activity and not as a consumer within the meaning of art. 3 of Legislative Decree 206/2005.</p>

<h3>2. Account Ownership and Authority</h3>
<p>Whoever registers a business account represents and warrants that they are authorised to act for the company named and to bind it contractually. The company is responsible for all activity carried out through the account, including switching requests started by its staff.</p>
<ul>
  <li>The Partita IVA provided must be valid, active and belong to the account holder</li>
  <li>A given Partita IVA may be linked to one account only</li>
  <li>Changes of company name, registered office or legal representative must be notified promptly</li>
</ul>

<h3>3. Non-Domestic Energy Supply</h3>
<p>Offers shown to business accounts relate to non-domestic supply. Prices, tax components, excise duties and VAT rates differ from those applied to household utilities, as do withdrawal terms and any security the supplier requires.</p>
<p>For each delivery point the user must provide an accurate POD (electricity) or PDR (gas) code, contracted power, historical consumption and intended use. Inaccurate data may cause the supplier to reject the case or to reapply different tariffs retroactively.</p>

<h3>4. Multiple Delivery Points</h3>
<p>A business account may manage several delivery points. Each switching case is handled independently: timescales, outcomes and any disputes concern the individual POD or PDR, not the company's utilities as a whole.</p>

<h3>5. Right of Withdrawal</h3>
<p>The fourteen-day right of withdrawal under the Italian Consumer Code does not apply to contracts entered into by parties acting in the course of their professional activity. Any withdrawal rights set out in the supply contract signed with the supplier, and under the applicable ARERA resolution, remain unaffected.</p>

<h3>6. EasyRisparmio's Role and Remuneration</h3>
<p>EasyRisparmio acts as an intermediary and introducer. The supply contract is entered into directly between the company and the chosen supplier. The service is free of charge to the user: EasyRisparmio receives a commission from the supplier for successful activations, which the user acknowledges and accepts.</p>

<h3>7. Documentation and Checks</h3>
<p>Business cases may require additional documentation: a chamber of commerce extract, the legal representative's identity document, the most recent bill, an excise declaration and, where applicable, proof of social security compliance. The user authorises EasyRisparmio to pass this documentation to the selected supplier solely for the purposes of the case.</p>

<h3>8. Electronic Invoicing and PEC</h3>
<p>The user undertakes to provide a correct SDI recipient code or PEC address for electronic invoicing. EasyRisparmio is not liable for delays or failed delivery caused by incorrect or inactive electronic addresses.</p>

<h3>9. Processing of Company Data</h3>
<p>Company data and that of its contacts is processed in accordance with the Privacy Policy. For business accounts, processing includes disclosure to energy suppliers for creditworthiness assessment and for entering into the supply contract.</p>

<h3>10. Limitation of Liability</h3>
<p>Analyses, comparisons and savings estimates are indicative and are based on the data supplied by the user and on market conditions at the time of processing. EasyRisparmio is not liable for savings that do not materialise, nor for price changes, PUN/GME indexation or defaults attributable to the supplier.</p>
<p>In dealings with business users, and save for wilful misconduct or gross negligence, EasyRisparmio's total liability is in any event limited to the commission received in relation to the case in dispute.</p>

<h3>11. Changes to These Terms</h3>
<p>EasyRisparmio may amend these Business Terms. Material changes are published as a new version of the document and put to the user for acceptance again on their next sign-in after publication. Declining prevents further use of the business services.</p>

<h3>12. Governing Law and Jurisdiction</h3>
<p>These Terms are governed by Italian law. The courts of Milan have exclusive jurisdiction over any dispute arising from the relationship between EasyRisparmio and the business user.</p>
`.trim(),
    },

    // ── About Us (Italian) ──
    {
      slug: 'about-us',
      title: 'Chi Siamo',
      locale: 'it',
      isActive: true,
      content: `
<h2>Chi Siamo</h2>
<p>EasyRisparmio è la piattaforma italiana che semplifica il risparmio sulle bollette energetiche. La nostra missione è rendere il mercato dell'energia accessibile e trasparente per tutti.</p>

<h3>La Nostra Missione</h3>
<p>Crediamo che ogni consumatore meriti di pagare il giusto prezzo per l'energia. Per questo abbiamo creato una piattaforma che analizza le bollette, confronta le offerte dei fornitori e gestisce l'intero processo di switching, tutto in modo semplice e gratuito.</p>

<h3>Come Funziona</h3>
<ul>
  <li><strong>Carica la bolletta:</strong> Scatta una foto o carica il PDF della tua bolletta. La nostra tecnologia OCR estrae automaticamente tutti i dati</li>
  <li><strong>Confronta le offerte:</strong> Il nostro algoritmo analizza il tuo profilo di consumo e ti mostra le offerte più vantaggiose disponibili sul mercato</li>
  <li><strong>Risparmia:</strong> Se trovi un'offerta migliore, gestiamo noi tutto il processo di cambio fornitore. Zero burocrazia, zero interruzioni</li>
</ul>

<h3>I Nostri Valori</h3>
<ul>
  <li><strong>Trasparenza:</strong> Nessun costo nascosto, nessuna sorpresa. Mostriamo sempre tutti i dettagli delle offerte</li>
  <li><strong>Semplicità:</strong> Tecnologia avanzata al servizio della semplicità d'uso</li>
  <li><strong>Indipendenza:</strong> Confrontiamo le offerte in modo imparziale, senza favorire alcun fornitore</li>
  <li><strong>Sicurezza:</strong> I tuoi dati sono protetti con i più alti standard di sicurezza e nel pieno rispetto del GDPR</li>
</ul>

<h3>Contattaci</h3>
<p>Hai domande o suggerimenti? Il nostro team di supporto è sempre a disposizione. Puoi contattarci direttamente dall'app nella sezione Supporto.</p>
`.trim(),
    },

    // ── About Us (English) ──
    {
      slug: 'about-us',
      title: 'About Us',
      locale: 'en',
      isActive: true,
      content: `
<h2>About Us</h2>
<p>EasyRisparmio is the Italian platform that simplifies saving on energy bills. Our mission is to make the energy market accessible and transparent for everyone.</p>

<h3>Our Mission</h3>
<p>We believe every consumer deserves to pay a fair price for energy. That's why we created a platform that analyzes bills, compares supplier offers, and manages the entire switching process — all simply and free of charge.</p>

<h3>How It Works</h3>
<ul>
  <li><strong>Upload your bill:</strong> Take a photo or upload a PDF of your bill. Our OCR technology automatically extracts all the data</li>
  <li><strong>Compare offers:</strong> Our algorithm analyzes your consumption profile and shows you the most advantageous offers available on the market</li>
  <li><strong>Save:</strong> If you find a better offer, we handle the entire supplier switching process. Zero paperwork, zero interruptions</li>
</ul>

<h3>Our Values</h3>
<ul>
  <li><strong>Transparency:</strong> No hidden costs, no surprises. We always show all offer details</li>
  <li><strong>Simplicity:</strong> Advanced technology in the service of ease of use</li>
  <li><strong>Independence:</strong> We compare offers impartially, without favoring any supplier</li>
  <li><strong>Security:</strong> Your data is protected with the highest security standards in full compliance with GDPR</li>
</ul>

<h3>Contact Us</h3>
<p>Have questions or suggestions? Our support team is always available. You can contact us directly from the app in the Support section.</p>
`.trim(),
    },
  ];

  for (const data of pagesData) {
    const existing = await repo.findOne({
      where: { slug: data.slug, locale: data.locale },
    });

    if (!existing) {
      await repo.save(
        repo.create({
          ...data,
          publishedAt: data.requiresAcceptance ? new Date() : null,
        }),
      );
      console.log(`  Created static page: ${data.slug} (${data.locale})`);
      continue;
    }

    // Pages seeded before consent tracking existed carry no publication date.
    // Backfilling the version metadata — and nothing else — turns them into
    // proper agreements without touching text an admin may have since edited,
    // and skips any page that has already been published.
    if (data.requiresAcceptance && existing.publishedAt === null) {
      existing.version = existing.version || data.version || '1.0';
      existing.requiresAcceptance = true;
      existing.audience = data.audience!;
      existing.publishedAt = existing.createdAt ?? new Date();
      await repo.save(existing);
      console.log(
        `  Static page updated with version metadata: ${data.slug} (${data.locale}) v${existing.version}`,
      );
    } else {
      console.log(`  Static page already exists: ${data.slug} (${data.locale})`);
    }
  }
}
