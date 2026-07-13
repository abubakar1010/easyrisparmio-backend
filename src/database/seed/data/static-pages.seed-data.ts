import { DataSource } from 'typeorm';
import { StaticPage } from '../../../modules/static-pages/entities/static-page.entity';

export async function seedStaticPages(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(StaticPage);

  const pagesData = [
    // ── Privacy Policy (Italian) ──
    {
      slug: 'privacy-policy',
      title: 'Informativa sulla Privacy',
      locale: 'it',
      isActive: true,
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
      await repo.save(repo.create(data));
      console.log(`  Created static page: ${data.slug} (${data.locale})`);
    } else {
      console.log(`  Static page already exists: ${data.slug} (${data.locale})`);
    }
  }
}
