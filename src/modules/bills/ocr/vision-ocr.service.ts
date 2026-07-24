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
- Usually in the header/logo area at the top of the first page.
- Common suppliers: Enel Energia, Servizio Elettrico Nazionale, Eni Plenitude, A2A Energia, Edison Energia, Hera Comm, Iren Mercato, Iren Luce Gas e Servizi, Acea Energia, E.ON Energia, Sorgenia, Engie Italia, Illumia, Wekiwi, Green Network, Optima, Duferco Energia.

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
  "supplyAddress": "string or null",
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
    'Supply Address (indirizzo di fornitura): The address where energy is delivered. Look in "Dati fornitura", "Ubicazione fornitura". NOT the postal/billing address.',
  'codiceFiscale/partitaIva':
    'Tax Identifier: Look for EITHER Codice Fiscale (16 alphanumeric chars, near "C.F.", "Codice Fiscale") OR Partita IVA (11 digits, near "P.IVA", "Partita IVA"). Check "Dati cliente" or "Dati anagrafici" section.',
  codiceFiscale:
    'Codice Fiscale: 16 alphanumeric characters. Look in "Dati cliente", "Dati anagrafici" near labels "Codice Fiscale", "C.F.", "CF".',
  partitaIva:
    'Partita IVA: 11 digits (strip any "IT" prefix). Look in "Dati cliente", "Dati fatturazione" near labels "Partita IVA", "P.IVA", "P.I.".',
};

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
        response_format: { type: 'json_object' },
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

    return JSON.parse(content);
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
      .map((f) =>
        f === 'codiceFiscale/partitaIva'
          ? '"codiceFiscale", "partitaIva"'
          : `"${f}"`,
      )
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

    return JSON.parse(content);
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
    let codiceFiscale = sanitizeString(parsed.codiceFiscale);
    let partitaIva = sanitizeString(parsed.partitaIva);
    const contractNumber = sanitizeString(parsed.contractNumber);
    const meterNumber = sanitizeString(parsed.meterNumber);
    const customerName = sanitizeString(parsed.customerName);

    // 2. Format validation — invalid formats become null
    podNumber = validatePod(podNumber);
    pdrNumber = validatePdr(pdrNumber);
    codiceFiscale = validateCodiceFiscale(codiceFiscale);
    partitaIva = validatePartitaIva(partitaIva);

    // 3. Date validation and normalization
    billingPeriodStart = validateAndNormalizeDate(billingPeriodStart);
    billingPeriodEnd = validateAndNormalizeDate(billingPeriodEnd);

    // Swap dates if start > end
    if (billingPeriodStart && billingPeriodEnd && billingPeriodStart > billingPeriodEnd) {
      [billingPeriodStart, billingPeriodEnd] = [billingPeriodEnd, billingPeriodStart];
    }

    // 4. Numeric range validation
    totalAmount = validateNumericRange(totalAmount, 'totalAmount');
    consumptionKwh = validateNumericRange(consumptionKwh, 'consumptionKwh');
    consumptionSmc = validateNumericRange(consumptionSmc, 'consumptionSmc');
    costPerUnit = validateNumericRange(costPerUnit, 'costPerUnit');
    fixedCharges = validateNumericRange(fixedCharges, 'fixedCharges');
    taxes = validateNumericRange(taxes, 'taxes');

    // 5. Build confidence map
    const rawConfidence = parsed.confidence || {};
    const confidence: FieldConfidence = {};
    const fieldNames = [
      'supplierName', 'podNumber', 'pdrNumber', 'totalAmount',
      'consumptionKwh', 'consumptionSmc', 'costPerUnit', 'fixedCharges',
      'taxes', 'billingPeriodStart', 'billingPeriodEnd', 'supplyAddress',
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

    // 7. Compute overall confidence
    const overallConfidence = this.computeOverallConfidence(confidence);

    return {
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
      codiceFiscale: codiceFiscale ?? null,
      partitaIva: partitaIva ?? null,
      contractNumber: contractNumber ?? null,
      meterNumber: meterNumber ?? null,
      customerName: customerName ?? null,
      confidence,
      overallConfidence,
      rawResponse: parsed,
    };
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
      'supplyAddress', 'codiceFiscale', 'partitaIva',
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

  // ─── Private: Confidence Computation ─────────────────────

  private computeOverallConfidence(
    confidence: FieldConfidence,
  ): 'high' | 'medium' | 'low' {
    const confValues = Object.values(confidence).filter(
      (v) => v != null,
    ) as string[];
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
