import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { BillType } from '../../../common/enums/bill.enum';
import {
  BillExtractionResult,
  FieldConfidence,
} from '../dto/extract-bill.dto';
import {
  normalizePostalCode,
  normalizeProvince,
  reconcileAddress,
} from '../../../common/utils/address.utils';
import {
  parseItalianNumber,
  sanitizeString,
  validatePod,
  validatePdr,
  validateCodiceFiscale,
  validatePartitaIva,
  validateAndNormalizeDate,
  validateNumericRange,
  deriveFields,
  getMissingMandatoryFields,
} from './italian-bill.utils';

// ─── Enhanced Extraction Prompt ────────────────────────────

const EXTRACTION_PROMPT = `You are an expert at reading Italian energy bills (bollette luce e gas). You have deep knowledge of all major Italian energy suppliers, their bill layouts, and the ARERA-mandated bill structure.

## Italian Energy Bill Structure

Italian energy bills follow a semi-standard layout regulated by ARERA (Autorità di Regolazione per Energia Reti e Ambiente). Key sections to look for:

### Where to find each field:

**Supplier Name (fornitore)**
- The company that ISSUED this bill. Do NOT rely solely on a field labeled "Supplier" — many bills identify the issuer only through branding.
- Search the ENTIRE document: header/logo, footer, legal/corporate info, customer service section ("Servizio Clienti"), contact details, website URLs (e.g., eniplenitude.com, enel.it), email addresses, payment instructions, invoice issuer line, copyright notices.
- Look for company names near legal entity identifiers: S.p.A., S.r.l., Società Benefit, Ltd, GmbH, SAS. If the same company appears multiple times (branding, customer service, website, legal footer), that is the supplier.
- Return the customer-facing BRAND NAME, not the full legal entity. Strip S.p.A., S.r.l., Società Benefit, etc. Examples: "Eni Plenitude" (not "Eni Plenitude SpA Società Benefit"), "Enel Energia" (not "Enel Energia S.p.A."), "Edison Energia" (not "Edison Energia S.p.A.").
- Common suppliers: Enel Energia, Servizio Elettrico Nazionale, Eni Plenitude, A2A Energia, Edison Energia, Hera Comm, Iren Mercato, Iren Luce Gas e Servizi, Acea Energia, E.ON Energia, Sorgenia, Engie Italia, Illumia, Wekiwi, Green Network, Optima, Duferco Energia, Dolomiti Energia, Alperia, AGSM AIM Energia, Gruppo CVA, Repower.
- Confidence: "high" if logo/brand is visible AND name appears multiple times; "medium" if name appears only once (e.g., only in legal footer) with no conflicting companies; "low" if multiple companies appear and issuer is ambiguous.
- Only return null when NO issuing company can be identified anywhere on any page.

**POD (electricity) / PDR (gas)**
- Section: "Dati fornitura", "Dati del punto di prelievo" (electricity), "Dati del punto di riconsegna" (gas), "Dati tecnici", "Caratteristiche della fornitura"
- POD starts with IT followed by 3 chars + E + 8-10 digits (e.g., IT001E12345678). Look near labels: "POD", "Punto di Prelievo", "Codice POD", "Identificativo del punto"
- PDR is a 14-digit number. Look near labels: "PDR", "Punto di Riconsegna", "Codice PDR", "Matricola PDR"

**Total Amount (totale fattura)**
- Section: "Sintesi degli importi fatturati", "Quadro di sintesi", "Riepilogo importi", "Totale fattura", "Importo da pagare"
- This is the grand total the customer must pay. Look for the most prominent amount, often in bold or larger font.
- May also appear near "Totale da pagare", "Importo fattura", "Totale bolletta"

**Consumption (consumi)**
- Section: "Dettaglio consumi", "Letture e consumi", "Consumi fatturati", "Riepilogo consumi"
- Electricity: in kWh. Look for "kWh", "kilowattora", "Consumo totale", "Consumo fatturato", "Energia attiva"
- Gas: in Smc (standard cubic meters). Look for "Smc", "Standard metro cubo", "Consumo totale", "Volume fatturato"
- If multiple consumption rows exist (e.g., F1/F2/F3 time bands for electricity), SUM them for the total.

**Cost Per Unit (costo unitario)**
- May appear as "Prezzo energia", "Costo medio unitario", "PE" (prezzo energia), "Corrispettivo energia"
- Electricity: EUR/kWh. Gas: EUR/Smc.
- If not explicitly stated, it can be derived from consumption and variable cost components.

**Fixed Charges (quota fissa)**
- Section: "Spesa per il trasporto e la gestione del contatore", "Oneri di sistema", "Costi fissi"
- Include: quota fissa di commercializzazione, quota fissa trasporto, quota potenza, oneri di sistema (quota fissa portion)
- Sum ALL fixed components. These are charges that don't depend on consumption.
- Look for "quota fissa", "costi fissi", "componente fissa"

**Taxes (imposte)**
- Section: "Imposte", "Totale imposte e IVA", "Accise e addizionali"
- SUM ALL of these: Accise (excise duties), IVA (VAT, typically 10% residential / 22% business), Addizionali regionali/comunali
- Look for "Imposta erariale di consumo", "Accisa", "IVA", "Addizionale regionale", "Addizionale comunale", "Totale imposte"

**Billing Period**
- Section: "Periodo di fatturazione", "Periodo di riferimento", "Periodo"
- Usually displayed as "dal DD/MM/YYYY al DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
- Extract both start and end dates.

**Supply Address (indirizzo di fornitura)**
- Section: "Dati fornitura", "Indirizzo di fornitura", "Punto di fornitura", "Ubicazione fornitura"
- This is where the energy is delivered, NOT the billing/postal address.
- Return it BOTH as the single line exactly as printed (supplyAddress) AND split into five separate fields. Split it from the layout you can see — do not guess by cutting the string.
  - supplyStreet: the street name WITHOUT the civic number, keeping the type prefix. "VIA ROMA 42/A" gives "Via Roma". Also: Corso, Piazza, Viale, Largo, Strada, Vicolo, Localita, Frazione, Contrada, Borgo.
  - supplyStreetNumber: the civic number only — "42", "42/A", "42 bis", or "SNC" where the bill says so. Printed after the street or near "civico", "n.", "nr.".
  - supplyCity: the town or city (comune). Where a bill prints a hamlet and a comune (e.g. "Loc. Sassa - L'Aquila"), the comune is the city.
  - supplyPostalCode: the CAP — exactly 5 digits. Return null unless you can read all 5.
  - supplyProvince: the two-letter sigla in capitals (MI, RM, NA). Bills print it in brackets after the city, e.g. "20121 MILANO (MI)". Where only the full name is printed ("Milano"), return the sigla for it.
- Italian bills print this as "VIA ROMA 42 - 20121 MILANO (MI)", or across two lines with the street first and "CAP CITY (PR)" underneath.

**Customer Name (intestatario)**
- Section: "Dati cliente", "Intestatario", "Dati anagrafici del cliente"
- The name of the account holder. May include title (Sig., Sig.ra).

**Codice Fiscale**
- Section: "Dati cliente", "Dati anagrafici", "Codice fiscale"
- 16 alphanumeric characters: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
- Look near: "Codice Fiscale", "C.F.", "CF"

**Partita IVA**
- Section: "Dati cliente", "Dati fatturazione"
- 11 digits, may be prefixed with "IT"
- Look near: "Partita IVA", "P.IVA", "P.I.", "PI"
- Only present on business bills.

**Contract/Client Number**
- Section: "Dati contratto", "Riferimenti contratto"
- Look near: "Numero contratto", "Codice contratto", "Numero cliente", "Codice cliente", "Codice utente"

**Meter Number (matricola contatore)**
- Section: "Dati fornitura", "Dati tecnici"
- Look near: "Matricola", "Matricola contatore", "N. contatore", "Numero contatore"

## Number Format Rules

Italian bills use: period (.) for thousands separator, comma (,) for decimal separator.
- "1.250,50" means 1250.50
- "120,50" means 120.50
- "0,085000" means 0.085
- "10.000" means 10000

CRITICAL: You MUST convert all numbers to standard decimal format (use . as decimal separator, no thousands separator). Return plain numbers, NOT strings.

## Date Format Rules

Italian dates are DD/MM/YYYY or DD.MM.YYYY.
CRITICAL: Convert ALL dates to YYYY-MM-DD format.

## Output Format

Return a JSON object with exactly these fields (use null for any field you cannot find):

{
  "supplierName": "string or null",
  "podNumber": "string or null — format: IT + 3 chars + E + 8-10 digits",
  "pdrNumber": "string or null — exactly 14 digits",
  "totalAmount": number_or_null,
  "consumptionKwh": number_or_null,
  "consumptionSmc": number_or_null,
  "costPerUnit": number_or_null,
  "fixedCharges": number_or_null,
  "taxes": number_or_null,
  "billingPeriodStart": "YYYY-MM-DD or null",
  "billingPeriodEnd": "YYYY-MM-DD or null",
  "supplyAddress": "string or null — the full line as printed",
  "supplyStreet": "string or null — street name without the civic number",
  "supplyStreetNumber": "string or null — civic number only",
  "supplyCity": "string or null",
  "supplyPostalCode": "string or null — exactly 5 digits (CAP)",
  "supplyProvince": "string or null — two-letter sigla, uppercase",
  "codiceFiscale": "string or null — exactly 16 alphanumeric chars",
  "partitaIva": "string or null — exactly 11 digits (strip IT prefix)",
  "contractNumber": "string or null",
  "meterNumber": "string or null",
  "customerName": "string or null",
  "confidence": {
    "supplierName": "high|medium|low|null",
    "podNumber": "high|medium|low|null",
    "pdrNumber": "high|medium|low|null",
    "totalAmount": "high|medium|low|null",
    "consumptionKwh": "high|medium|low|null",
    "consumptionSmc": "high|medium|low|null",
    "costPerUnit": "high|medium|low|null",
    "fixedCharges": "high|medium|low|null",
    "taxes": "high|medium|low|null",
    "billingPeriodStart": "high|medium|low|null",
    "billingPeriodEnd": "high|medium|low|null",
    "supplyAddress": "high|medium|low|null",
    "supplyStreet": "high|medium|low|null",
    "supplyStreetNumber": "high|medium|low|null",
    "supplyCity": "high|medium|low|null",
    "supplyPostalCode": "high|medium|low|null",
    "supplyProvince": "high|medium|low|null",
    "codiceFiscale": "high|medium|low|null",
    "partitaIva": "high|medium|low|null",
    "contractNumber": "high|medium|low|null",
    "meterNumber": "high|medium|low|null",
    "customerName": "high|medium|low|null"
  }
}

## Confidence Rules
- "high": field clearly visible and unambiguous
- "medium": field found but partially obscured, or inferred from context
- "low": field barely readable or uncertain
- null: field not found at all

IMPORTANT: Examine ALL pages of the bill carefully. Customer data, tax identifiers, and supply details are often on pages 2-4.

Return ONLY the JSON object, no other text.`;

// ─── Second-Pass Field Guidance ────────────────────────────

const FIELD_GUIDANCE: Record<string, string> = {
  supplierName:
    'Supplier Name (fornitore): The company that ISSUED this bill. Look at ALL pages: header, logo, footer, legal/corporate section, customer service info ("Servizio Clienti"), contact details, website URLs (e.g., enel.it, eni.it, eniplenitude.com), email addresses, payment instructions, copyright notices. Look for text near "S.p.A.", "S.r.l.", "Società Benefit". Return the brand name only (e.g., "Eni Plenitude", not "Eni Plenitude SpA Società Benefit"). Do NOT return null unless no issuing company appears anywhere.',
  podNumber:
    'POD (Punto di Prelievo): Look in "Dati fornitura" or "Dati del punto di prelievo". Format: starts with "IT", followed by 3 chars, then "E", then 8-10 digits. Example: IT001E12345678. May also appear near the meter number or supply address.',
  pdrNumber:
    'PDR (Punto di Riconsegna): Look in "Dati fornitura" or "Dati del punto di riconsegna". It is a 14-digit number. May appear near labels like "PDR", "Matricola PDR", "Punto di Riconsegna".',
  totalAmount:
    'Total Amount: The grand total to pay. Look for "Totale fattura", "Importo da pagare", "Totale bolletta", "Importo fattura". Usually the most prominent number, often in bold. Check "Sintesi degli importi" or "Quadro di sintesi" sections.',
  consumptionKwh:
    'Electricity Consumption in kWh: Look in "Dettaglio consumi", "Riepilogo consumi", "Letture e consumi". Search for "kWh", "kilowattora", "Consumo totale", "Energia attiva". If time bands exist (F1/F2/F3), sum them.',
  consumptionSmc:
    'Gas Consumption in Smc: Look in "Dettaglio consumi", "Riepilogo consumi". Search for "Smc", "Standard metro cubo", "Consumo totale", "Volume fatturato".',
  fixedCharges:
    'Fixed Charges: Sum of all fixed components. Look in "Costi fissi", "Quota fissa", "Oneri fissi". Include: quota fissa commercializzazione, quota fissa trasporto, quota potenza.',
  taxes:
    'Taxes: Sum ALL tax items. Look in "Imposte" section. Include: Accise (excise), IVA (VAT), Addizionali regionali/comunali. Look for "Totale imposte", "Imposta erariale", "IVA".',
  billingPeriodStart:
    'Billing Period Start: Look for "Periodo di fatturazione", "Periodo di riferimento", "dal DD/MM/YYYY". Usually near the top of the bill or in the summary section.',
  billingPeriodEnd:
    'Billing Period End: The end date of the billing period. Look for "al DD/MM/YYYY" or the second date in a range.',
  supplyAddress:
    'Supply Address (indirizzo di fornitura): The address where energy is delivered. Look in "Dati fornitura", "Ubicazione fornitura" — NOT the postal/billing address. Return the full printed line as "supplyAddress" AND split it into "supplyStreet" (street name, no civic number), "supplyStreetNumber" (civic number only), "supplyCity" (the comune), "supplyPostalCode" (the 5-digit CAP) and "supplyProvince" (two-letter sigla, uppercase). Italian bills print it as "VIA ROMA 42 - 20121 MILANO (MI)", sometimes across two lines.',
  'codiceFiscale/partitaIva':
    'Tax Identifier: Look for EITHER Codice Fiscale (16 alphanumeric chars, near "C.F.", "Codice Fiscale") OR Partita IVA (11 digits, near "P.IVA", "Partita IVA"). Check "Dati cliente" or "Dati anagrafici" section.',
  codiceFiscale:
    'Codice Fiscale: 16 alphanumeric characters. Look in "Dati cliente", "Dati anagrafici" near labels "Codice Fiscale", "C.F.", "CF".',
  partitaIva:
    'Partita IVA: 11 digits (strip any "IT" prefix). Look in "Dati cliente", "Dati fatturazione" near labels "Partita IVA", "P.IVA", "P.I.".',
};

// ─── Enforced Response Schema (Structured Output) ─────────

const CONFIDENCE_FIELD = {
  type: ['string', 'null'] as const,
};

const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'bill_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        supplierName: { type: ['string', 'null'] },
        podNumber: { type: ['string', 'null'] },
        pdrNumber: { type: ['string', 'null'] },
        totalAmount: { type: ['number', 'null'] },
        consumptionKwh: { type: ['number', 'null'] },
        consumptionSmc: { type: ['number', 'null'] },
        costPerUnit: { type: ['number', 'null'] },
        fixedCharges: { type: ['number', 'null'] },
        taxes: { type: ['number', 'null'] },
        billingPeriodStart: { type: ['string', 'null'] },
        billingPeriodEnd: { type: ['string', 'null'] },
        supplyAddress: { type: ['string', 'null'] },
        supplyStreet: { type: ['string', 'null'] },
        supplyStreetNumber: { type: ['string', 'null'] },
        supplyCity: { type: ['string', 'null'] },
        supplyPostalCode: { type: ['string', 'null'] },
        supplyProvince: { type: ['string', 'null'] },
        codiceFiscale: { type: ['string', 'null'] },
        partitaIva: { type: ['string', 'null'] },
        contractNumber: { type: ['string', 'null'] },
        meterNumber: { type: ['string', 'null'] },
        customerName: { type: ['string', 'null'] },
        confidence: {
          type: 'object',
          properties: {
            supplierName: CONFIDENCE_FIELD,
            podNumber: CONFIDENCE_FIELD,
            pdrNumber: CONFIDENCE_FIELD,
            totalAmount: CONFIDENCE_FIELD,
            consumptionKwh: CONFIDENCE_FIELD,
            consumptionSmc: CONFIDENCE_FIELD,
            costPerUnit: CONFIDENCE_FIELD,
            fixedCharges: CONFIDENCE_FIELD,
            taxes: CONFIDENCE_FIELD,
            billingPeriodStart: CONFIDENCE_FIELD,
            billingPeriodEnd: CONFIDENCE_FIELD,
            supplyAddress: CONFIDENCE_FIELD,
            supplyStreet: CONFIDENCE_FIELD,
            supplyStreetNumber: CONFIDENCE_FIELD,
            supplyCity: CONFIDENCE_FIELD,
            supplyPostalCode: CONFIDENCE_FIELD,
            supplyProvince: CONFIDENCE_FIELD,
            codiceFiscale: CONFIDENCE_FIELD,
            partitaIva: CONFIDENCE_FIELD,
            contractNumber: CONFIDENCE_FIELD,
            meterNumber: CONFIDENCE_FIELD,
            customerName: CONFIDENCE_FIELD,
          },
          required: [
            'supplierName', 'podNumber', 'pdrNumber', 'totalAmount',
            'consumptionKwh', 'consumptionSmc', 'costPerUnit', 'fixedCharges',
            'taxes', 'billingPeriodStart', 'billingPeriodEnd', 'supplyAddress',
            'supplyStreet', 'supplyStreetNumber', 'supplyCity',
            'supplyPostalCode', 'supplyProvince',
            'codiceFiscale', 'partitaIva', 'contractNumber', 'meterNumber',
            'customerName',
          ],
          additionalProperties: false,
        },
      },
      required: [
        'supplierName', 'podNumber', 'pdrNumber', 'totalAmount',
        'consumptionKwh', 'consumptionSmc', 'costPerUnit', 'fixedCharges',
        'taxes', 'billingPeriodStart', 'billingPeriodEnd', 'supplyAddress',
        'supplyStreet', 'supplyStreetNumber', 'supplyCity',
        'supplyPostalCode', 'supplyProvince',
        'codiceFiscale', 'partitaIva', 'contractNumber', 'meterNumber',
        'customerName', 'confidence',
      ],
      additionalProperties: false,
    },
  },
};

// Known field names for response normalization
const KNOWN_FIELDS = new Set([
  'supplierName', 'podNumber', 'pdrNumber', 'totalAmount',
  'consumptionKwh', 'consumptionSmc', 'costPerUnit', 'fixedCharges',
  'taxes', 'billingPeriodStart', 'billingPeriodEnd', 'supplyAddress',
  'supplyStreet', 'supplyStreetNumber', 'supplyCity',
  'supplyPostalCode', 'supplyProvince',
  'codiceFiscale', 'partitaIva', 'contractNumber', 'meterNumber',
  'customerName', 'confidence',
]);

/**
 * The five parts of the supply address. `supplyAddress` is deliberately not one
 * of them: it is the whole address, and the overall-confidence score counts it
 * once on their behalf.
 */
const ADDRESS_PART_FIELDS = new Set([
  'supplyStreet', 'supplyStreetNumber', 'supplyCity',
  'supplyPostalCode', 'supplyProvince',
]);

// ─── Service ───────────────────────────────────────────────

@Injectable()
export class VisionOcrService {
  private readonly logger = new Logger(VisionOcrService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.openaiApiKey');
    this.openai = new OpenAI({ apiKey: apiKey || '' });
  }

  async extractFromImages(
    imageBuffers: Buffer[],
    billType: BillType,
  ): Promise<BillExtractionResult> {
    const model = this.configService.get<string>('ai.ocrModel') || 'gpt-4o';
    const timeout = this.configService.get<number>('ai.ocrTimeout') || 60000;

    const imageContent: OpenAI.ChatCompletionContentPart[] = imageBuffers.map(
      (buffer) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${buffer.toString('base64')}`,
          detail: 'high' as const,
        },
      }),
    );

    const billTypeHint =
      billType === BillType.ELECTRICITY
        ? 'This is an ELECTRICITY bill (bolletta luce / energia elettrica). ' +
          'Extract the POD number (NOT PDR). Extract consumption in kWh (NOT Smc). ' +
          'The cost per unit is EUR/kWh. Look for sections about "energia elettrica", "luce", "prelievo". ' +
          'If you see F1/F2/F3 consumption bands, sum all bands for the total kWh.'
        : 'This is a GAS bill (bolletta gas / gas naturale). ' +
          'Extract the PDR number (NOT POD). Extract consumption in Smc — standard cubic meters (NOT kWh). ' +
          'The cost per unit is EUR/Smc. Look for sections about "gas naturale", "gas metano", "riconsegna". ' +
          'The consumption may be labeled as "Volume" or "Smc fatturati".';

    try {
      // First pass: full extraction
      const rawResult = await this.callVisionApi(
        imageContent,
        billTypeHint,
        model,
        timeout,
      );
      const result = this.processRawExtraction(rawResult, billType);

      // Check for missing mandatory fields
      const missingFields = getMissingMandatoryFields(result, billType);

      if (missingFields.length > 0) {
        this.logger.log(
          `First pass missing ${missingFields.length} mandatory fields: ${missingFields.join(', ')}. Running second pass.`,
        );

        try {
          const secondPassResult = await this.secondPassExtraction(
            imageContent,
            missingFields,
            billType,
            model,
            timeout,
          );

          this.mergeSecondPassResult(result, secondPassResult, billType);
        } catch (error: any) {
          this.logger.warn(
            `Second pass extraction failed, using first pass results: ${error.message}`,
          );
        }
      }

      // Recompute overall confidence after all processing
      result.overallConfidence = this.computeOverallConfidence(
        result.confidence,
      );

      return result;
    } catch (error: any) {
      // Retry on transient errors
      if (this.isRetryable(error)) {
        this.logger.warn(
          `Retryable error from Vision API, retrying in 2s: ${error.message}`,
        );
        await this.delay(2000);

        try {
          const rawResult = await this.callVisionApi(
            imageContent,
            billTypeHint,
            model,
            timeout,
          );
          return this.processRawExtraction(rawResult, billType);
        } catch (retryError: any) {
          // Second retry with longer backoff
          if (this.isRetryable(retryError)) {
            this.logger.warn(
              `Second retryable error, retrying in 5s: ${retryError.message}`,
            );
            await this.delay(5000);
            const rawResult = await this.callVisionApi(
              imageContent,
              billTypeHint,
              model,
              timeout,
            );
            return this.processRawExtraction(rawResult, billType);
          }
          throw retryError;
        }
      }

      this.logger.error(
        `Vision API extraction failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async convertPdfToImages(filePath: string): Promise<Buffer[]> {
    const scale = this.configService.get<number>('ai.ocrScale') || 3.0;
    const maxPages = this.configService.get<number>('ai.ocrMaxPages') || 5;

    // pdf-to-img is ESM-only, use dynamic import
    const pdfToImg = await (Function(
      'return import("pdf-to-img")',
    )() as Promise<typeof import('pdf-to-img')>);

    const pdfBuffer = readFileSync(filePath);
    const doc = await pdfToImg.pdf(pdfBuffer, { scale });
    const pages: Buffer[] = [];

    const totalPages = Math.min(doc.length, maxPages);
    for (let i = 1; i <= totalPages; i++) {
      const pageBuffer = await doc.getPage(i);
      pages.push(Buffer.from(pageBuffer));
    }

    await doc.destroy();
    this.logger.debug(
      `Converted ${pages.length}/${doc.length} PDF pages to images (scale: ${scale})`,
    );
    return pages;
  }

  // ─── Private: Vision API Call ────────────────────────────

  private async callVisionApi(
    imageContent: OpenAI.ChatCompletionContentPart[],
    billTypeHint: string,
    model: string,
    timeout: number,
  ): Promise<Record<string, any>> {
    const response = await this.openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: billTypeHint },
              ...imageContent,
            ],
          },
        ],
        response_format: EXTRACTION_RESPONSE_SCHEMA as any,
        max_tokens:
          this.configService.get<number>('ai.ocrMaxTokens') || 4096,
        temperature: 0,
      },
      { timeout },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Vision API');
    }

    const parsed = JSON.parse(content);
    return this.normalizeResponse(parsed);
  }

  // ─── Private: Second Pass Extraction ─────────────────────

  private async secondPassExtraction(
    imageContent: OpenAI.ChatCompletionContentPart[],
    missingFields: string[],
    billType: BillType,
    model: string,
    timeout: number,
  ): Promise<Record<string, any>> {
    // Build focused guidance for each missing field
    const fieldInstructions = missingFields
      .map((field) => {
        const guidance = FIELD_GUIDANCE[field];
        return guidance ? `- ${guidance}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const fieldNames = missingFields
      .map((f) => {
        if (f === 'codiceFiscale/partitaIva') {
          return '"codiceFiscale", "partitaIva"';
        }
        // The address is one field to the caller but six on the wire: asking
        // only for the line would come back unsplit and land the admin with a
        // blank street, city and CAP to type out.
        if (f === 'supplyAddress') {
          return '"supplyAddress", "supplyStreet", "supplyStreetNumber", "supplyCity", "supplyPostalCode", "supplyProvince"';
        }
        return `"${f}"`;
      })
      .join(', ');

    const secondPassPrompt = `You are re-examining an Italian energy bill because the following fields were NOT found in the first analysis attempt. Look MORE CAREFULLY at ALL pages, including fine print, footnotes, headers, sidebars, and secondary pages.

MISSING FIELDS TO FIND:
${fieldInstructions}

IMPORTANT INSTRUCTIONS:
- Focus ONLY on finding the missing fields listed above.
- Look at EVERY page carefully, including page 2, 3, 4, and beyond.
- Check headers, footers, sidebars, and small print areas.
- For numeric values, convert Italian format (1.250,50) to standard decimal (1250.50).
- For dates, convert to YYYY-MM-DD format.

Return a JSON object with ONLY these fields: ${fieldNames}
Use null for any field you still cannot find.
Include a "confidence" object with confidence levels for each field.

Return ONLY the JSON object, no other text.`;

    const billTypeContext =
      billType === BillType.ELECTRICITY
        ? 'This is an ELECTRICITY bill (bolletta luce). Look for POD (not PDR) and kWh consumption.'
        : 'This is a GAS bill (bolletta gas). Look for PDR (not POD) and Smc consumption.';

    const response = await this.openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: secondPassPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: billTypeContext },
              ...imageContent,
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens:
          this.configService.get<number>('ai.ocrMaxTokens') || 4096,
        temperature: 0,
      },
      { timeout },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Vision API on second pass');
    }

    const parsed = JSON.parse(content);
    return this.normalizeResponse(parsed);
  }

  // ─── Private: Post-Processing Pipeline ───────────────────

  private processRawExtraction(
    parsed: Record<string, any>,
    billType: BillType,
  ): BillExtractionResult {
    // 1. Parse and sanitize all fields
    const supplierName = sanitizeString(parsed.supplierName);
    let podNumber = sanitizeString(parsed.podNumber);
    let pdrNumber = sanitizeString(parsed.pdrNumber);
    let totalAmount = parseItalianNumber(parsed.totalAmount);
    let consumptionKwh = parseItalianNumber(parsed.consumptionKwh);
    let consumptionSmc = parseItalianNumber(parsed.consumptionSmc);
    let costPerUnit = parseItalianNumber(parsed.costPerUnit);
    let fixedCharges = parseItalianNumber(parsed.fixedCharges);
    let taxes = parseItalianNumber(parsed.taxes);
    let billingPeriodStart = sanitizeString(parsed.billingPeriodStart);
    let billingPeriodEnd = sanitizeString(parsed.billingPeriodEnd);
    const supplyAddress = sanitizeString(parsed.supplyAddress);
    const supplyStreet = sanitizeString(parsed.supplyStreet);
    const supplyStreetNumber = sanitizeString(parsed.supplyStreetNumber);
    const supplyCity = sanitizeString(parsed.supplyCity);
    // A CAP that is not five digits is dropped rather than kept partial — it
    // would sit in the form looking filled in and reach the supplier unchecked.
    const supplyPostalCode = normalizePostalCode(sanitizeString(parsed.supplyPostalCode));
    const supplyProvince = normalizeProvince(sanitizeString(parsed.supplyProvince));
    let codiceFiscale = sanitizeString(parsed.codiceFiscale);
    let partitaIva = sanitizeString(parsed.partitaIva);
    const contractNumber = sanitizeString(parsed.contractNumber);
    const meterNumber = sanitizeString(parsed.meterNumber);
    const customerName = sanitizeString(parsed.customerName);

    // 2. Format validation — invalid formats become null (with debug logging)
    const rawPod = podNumber;
    podNumber = validatePod(podNumber);
    if (rawPod && !podNumber) this.logger.debug(`POD dropped by validation: "${rawPod}"`);

    const rawPdr = pdrNumber;
    pdrNumber = validatePdr(pdrNumber);
    if (rawPdr && !pdrNumber) this.logger.debug(`PDR dropped by validation: "${rawPdr}"`);

    const rawCf = codiceFiscale;
    codiceFiscale = validateCodiceFiscale(codiceFiscale);
    if (rawCf && !codiceFiscale) this.logger.debug(`Codice Fiscale dropped by validation: "${rawCf}"`);

    const rawPiva = partitaIva;
    partitaIva = validatePartitaIva(partitaIva);
    if (rawPiva && !partitaIva) this.logger.debug(`Partita IVA dropped by validation: "${rawPiva}"`);

    // 3. Date validation and normalization
    const rawStart = billingPeriodStart;
    billingPeriodStart = validateAndNormalizeDate(billingPeriodStart);
    if (rawStart && !billingPeriodStart) this.logger.debug(`Billing period start dropped by validation: "${rawStart}"`);

    const rawEnd = billingPeriodEnd;
    billingPeriodEnd = validateAndNormalizeDate(billingPeriodEnd);
    if (rawEnd && !billingPeriodEnd) this.logger.debug(`Billing period end dropped by validation: "${rawEnd}"`);

    // Swap dates if start > end
    if (billingPeriodStart && billingPeriodEnd && billingPeriodStart > billingPeriodEnd) {
      [billingPeriodStart, billingPeriodEnd] = [billingPeriodEnd, billingPeriodStart];
    }

    // 4. Numeric range validation (with debug logging)
    const numericFields = { totalAmount, consumptionKwh, consumptionSmc, costPerUnit, fixedCharges, taxes };
    totalAmount = validateNumericRange(totalAmount, 'totalAmount');
    consumptionKwh = validateNumericRange(consumptionKwh, 'consumptionKwh');
    consumptionSmc = validateNumericRange(consumptionSmc, 'consumptionSmc');
    costPerUnit = validateNumericRange(costPerUnit, 'costPerUnit');
    fixedCharges = validateNumericRange(fixedCharges, 'fixedCharges');
    taxes = validateNumericRange(taxes, 'taxes');

    for (const [field, raw] of Object.entries(numericFields)) {
      const validated = { totalAmount, consumptionKwh, consumptionSmc, costPerUnit, fixedCharges, taxes }[field];
      if (raw != null && validated == null) {
        this.logger.debug(`${field} dropped by range validation: ${raw}`);
      }
    }

    // 5. Build confidence map
    const rawConfidence = parsed.confidence || {};
    const confidence: FieldConfidence = {};
    const fieldNames = [
      'supplierName', 'podNumber', 'pdrNumber', 'totalAmount',
      'consumptionKwh', 'consumptionSmc', 'costPerUnit', 'fixedCharges',
      'taxes', 'billingPeriodStart', 'billingPeriodEnd', 'supplyAddress',
      'supplyStreet', 'supplyStreetNumber', 'supplyCity',
      'supplyPostalCode', 'supplyProvince',
      'codiceFiscale', 'partitaIva', 'contractNumber', 'meterNumber',
      'customerName',
    ] as const;

    for (const field of fieldNames) {
      const val = rawConfidence[field];
      (confidence as any)[field] = ['high', 'medium', 'low'].includes(val)
        ? val
        : null;
    }

    // 6. Field derivation for missing calculable fields
    const derivable: any = {
      totalAmount,
      consumptionKwh,
      consumptionSmc,
      costPerUnit,
      fixedCharges,
      taxes,
      confidence,
    };
    deriveFields(derivable, billType);

    // Apply derived values back
    costPerUnit = derivable.costPerUnit;
    fixedCharges = derivable.fixedCharges;
    taxes = derivable.taxes;

    // 7. Assemble, reconcile the supply address, then score
    const result: BillExtractionResult = {
      supplierName: supplierName ?? null,
      podNumber: podNumber ?? null,
      pdrNumber: pdrNumber ?? null,
      totalAmount: totalAmount ?? null,
      consumptionKwh: consumptionKwh ?? null,
      consumptionSmc: consumptionSmc ?? null,
      costPerUnit: costPerUnit ?? null,
      fixedCharges: fixedCharges ?? null,
      taxes: taxes ?? null,
      billingPeriodStart: billingPeriodStart ?? null,
      billingPeriodEnd: billingPeriodEnd ?? null,
      supplyAddress: supplyAddress ?? null,
      supplyStreet: supplyStreet ?? null,
      supplyStreetNumber: supplyStreetNumber ?? null,
      supplyCity: supplyCity ?? null,
      supplyPostalCode: supplyPostalCode ?? null,
      supplyProvince: supplyProvince ?? null,
      codiceFiscale: codiceFiscale ?? null,
      partitaIva: partitaIva ?? null,
      contractNumber: contractNumber ?? null,
      meterNumber: meterNumber ?? null,
      customerName: customerName ?? null,
      confidence,
      overallConfidence: 'low',
      rawResponse: parsed,
    };

    this.reconcileSupplyAddress(result);
    result.overallConfidence = this.computeOverallConfidence(result.confidence);

    return result;
  }

  // ─── Private: Supply Address Reconciliation ──────────────

  /**
   * Makes the printed line and its five parts agree.
   *
   * The model is asked for both, and either half can come back alone: a second
   * pass answers narrowly, and a bill that prints the address as free text gets
   * a line but no clean split. Whichever half is missing is derived from the
   * other, so a bill never reaches the admin with an address it holds in a form
   * nothing can edit.
   *
   * The parts are the source of truth once they exist — the line is only ever
   * rendered from them, which is what keeps the two from drifting apart on
   * later edits.
   */
  private reconcileSupplyAddress(result: BillExtractionResult): void {
    const { line, parts, recovered } = reconcileAddress(result.supplyAddress, {
      street: result.supplyStreet,
      streetNumber: result.supplyStreetNumber,
      city: result.supplyCity,
      postalCode: result.supplyPostalCode,
      province: result.supplyProvince,
    });

    result.supplyAddress = line;
    result.supplyStreet = parts.street;
    result.supplyStreetNumber = parts.streetNumber;
    result.supplyCity = parts.city;
    result.supplyPostalCode = parts.postalCode;
    result.supplyProvince = parts.province;

    if (recovered.length === 0) return;

    // A split guessed from punctuation is never as good as one the model read
    // off the layout, however clear the line itself was. Marking the recovered
    // parts "low" is what puts the warning badge in front of the admin.
    for (const key of recovered) {
      const field = `supply${key[0].toUpperCase()}${key.slice(1)}`;
      (result.confidence as any)[field] = 'low';
    }

    this.logger.debug(
      `Recovered ${recovered.join(', ')} by splitting the printed supply address`,
    );
  }

  // ─── Private: Merge Second Pass Results ──────────────────

  private mergeSecondPassResult(
    result: BillExtractionResult,
    secondPass: Record<string, any>,
    billType: BillType,
  ): void {
    const secondPassConfidence = secondPass.confidence || {};

    const stringFields = [
      'supplierName', 'podNumber', 'pdrNumber',
      'billingPeriodStart', 'billingPeriodEnd',
      'supplyAddress', 'supplyStreet', 'supplyStreetNumber', 'supplyCity',
      'supplyPostalCode', 'supplyProvince',
      'codiceFiscale', 'partitaIva',
      'contractNumber', 'meterNumber', 'customerName',
    ] as const;

    const numericFields = [
      'totalAmount', 'consumptionKwh', 'consumptionSmc',
      'costPerUnit', 'fixedCharges', 'taxes',
    ] as const;

    // Merge string fields — only fill nulls, don't overwrite
    for (const field of stringFields) {
      if ((result as any)[field] == null && secondPass[field] != null) {
        let val = sanitizeString(secondPass[field]);

        // Apply format validators where needed
        if (field === 'podNumber') val = validatePod(val);
        else if (field === 'pdrNumber') val = validatePdr(val);
        else if (field === 'codiceFiscale') val = validateCodiceFiscale(val);
        else if (field === 'partitaIva') val = validatePartitaIva(val);
        else if (field === 'supplyPostalCode') val = normalizePostalCode(val);
        else if (field === 'supplyProvince') val = normalizeProvince(val);
        else if (field === 'billingPeriodStart' || field === 'billingPeriodEnd')
          val = validateAndNormalizeDate(val);

        if (val != null) {
          (result as any)[field] = val;
          const confVal = secondPassConfidence[field];
          (result.confidence as any)[field] = ['high', 'medium', 'low'].includes(confVal)
            ? confVal
            : 'medium';
        }
      }
    }

    // Merge numeric fields — only fill nulls, don't overwrite
    for (const field of numericFields) {
      if ((result as any)[field] == null && secondPass[field] != null) {
        let val = parseItalianNumber(secondPass[field]);
        val = validateNumericRange(val, field);

        if (val != null) {
          (result as any)[field] = val;
          const confVal = secondPassConfidence[field];
          (result.confidence as any)[field] = ['high', 'medium', 'low'].includes(confVal)
            ? confVal
            : 'medium';
        }
      }
    }

    // Re-run derivation with merged data
    const derivable: any = {
      totalAmount: result.totalAmount,
      consumptionKwh: result.consumptionKwh,
      consumptionSmc: result.consumptionSmc,
      costPerUnit: result.costPerUnit,
      fixedCharges: result.fixedCharges,
      taxes: result.taxes,
      confidence: result.confidence,
    };
    deriveFields(derivable, billType);
    result.costPerUnit = derivable.costPerUnit;
    result.fixedCharges = derivable.fixedCharges;
    result.taxes = derivable.taxes;

    // The second pass may have supplied the line, some of the parts, or both —
    // reconcile again so they still describe the same address.
    this.reconcileSupplyAddress(result);

    // Fix date ordering after merge
    if (
      result.billingPeriodStart &&
      result.billingPeriodEnd &&
      result.billingPeriodStart > result.billingPeriodEnd
    ) {
      [result.billingPeriodStart, result.billingPeriodEnd] = [
        result.billingPeriodEnd,
        result.billingPeriodStart,
      ];
    }
  }

  // ─── Private: Response Normalization ─────────────────────

  /**
   * Normalize AI response: unwrap nested objects and convert snake_case to camelCase.
   * Ensures consistent field names regardless of AI output variations.
   */
  private normalizeResponse(parsed: Record<string, any>): Record<string, any> {
    // Unwrap nested response: if the AI wrapped fields in a sub-object like { "data": {...} }
    const keys = Object.keys(parsed);
    if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && parsed[keys[0]] !== null) {
      const inner = parsed[keys[0]];
      const innerKeys = Object.keys(inner);
      const hasKnownField = innerKeys.some((k) => KNOWN_FIELDS.has(k) || KNOWN_FIELDS.has(this.snakeToCamel(k)));
      if (hasKnownField) {
        this.logger.debug(`Unwrapped nested AI response from key "${keys[0]}"`);
        parsed = inner;
      }
    }

    // Convert snake_case keys to camelCase
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const camelKey = this.snakeToCamel(key);
      normalized[camelKey] = value;
    }

    // Normalize nested confidence object keys too
    if (normalized.confidence && typeof normalized.confidence === 'object') {
      const normalizedConf: Record<string, any> = {};
      for (const [key, value] of Object.entries(normalized.confidence)) {
        normalizedConf[this.snakeToCamel(key)] = value;
      }
      normalized.confidence = normalizedConf;
    }

    return normalized;
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  // ─── Private: Confidence Computation ─────────────────────

  private computeOverallConfidence(
    confidence: FieldConfidence,
  ): 'high' | 'medium' | 'low' {
    // The five address parts are excluded on purpose. They describe the same
    // one thing `supplyAddress` already stands for, and counting them would let
    // a single well-read address outvote every other field on the bill.
    const confValues = Object.entries(confidence)
      .filter(([field]) => !ADDRESS_PART_FIELDS.has(field))
      .map(([, value]) => value)
      .filter((v) => v != null) as string[];
    if (confValues.length === 0) return 'low';

    const highCount = confValues.filter((v) => v === 'high').length;
    const ratio = highCount / confValues.length;
    return ratio >= 0.6 ? 'high' : ratio >= 0.3 ? 'medium' : 'low';
  }

  // ─── Private: Helpers ────────────────────────────────────

  private isRetryable(error: any): boolean {
    const status = error?.status || error?.response?.status;
    return (
      status === 429 || status === 500 || status === 502 || status === 503
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
