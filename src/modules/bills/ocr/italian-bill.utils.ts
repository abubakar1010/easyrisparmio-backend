import { BillType } from '../../../common/enums/bill.enum';

// ─── Italian Number Parsing ────────────────────────────────

/**
 * Parse a value that may be in Italian number format (1.250,50 = 1250.50).
 * Handles: plain numbers, Italian-formatted strings, currency-prefixed strings.
 */
export function parseItalianNumber(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;

  let str = String(val).trim();
  if (!str) return null;

  // Strip currency symbols, text, and whitespace variants
  str = str
    .replace(/€/g, '')
    .replace(/\bEUR\b/gi, '')
    .replace(/\beuro\b/gi, '')
    .replace(/[\u00A0\u202F]/g, '') // non-breaking spaces
    .replace(/\s+/g, ' ')
    .trim();

  if (!str) return null;

  // Handle negative in parentheses: (123,45) → -123,45
  const parenMatch = str.match(/^\((.+)\)$/);
  if (parenMatch) {
    str = '-' + parenMatch[1].trim();
  }

  // Detect Italian format:
  // If string has both '.' and ',' AND the last separator is ','
  // → '.' is thousands separator, ',' is decimal separator
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // Italian format: "1.250,50" → "1250.50"
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // English format: "1,250.50" → "1250.50"
      str = str.replace(/,/g, '');
    }
  } else if (lastComma >= 0 && lastDot < 0) {
    // Only comma present
    const afterComma = str.substring(lastComma + 1);
    const beforeComma = str.substring(0, lastComma).replace(/^-/, '');
    if (afterComma.length === 3 && beforeComma.length > 0 && beforeComma !== '0') {
      // Thousands separator in Italian context: "1,000" → "1000"
      str = str.replace(',', '');
    } else {
      // Decimal separator: "123,45" → "123.45", "0,085" → "0.085"
      str = str.replace(',', '.');
    }
  } else if (lastDot >= 0 && lastComma < 0) {
    // Only period present
    const afterDot = str.substring(lastDot + 1);
    const beforeDot = str.substring(0, lastDot).replace(/^-/, '');
    if (afterDot.length === 3 && beforeDot.length > 0 && beforeDot !== '0') {
      // Italian thousands separator: "1.000" → "1000"
      str = str.replace('.', '');
    }
    // Otherwise standard decimal format: "123.45" → leave as-is
  }

  // Remove any remaining non-numeric chars except . and -
  str = str.replace(/[^0-9.\-]/g, '');

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ─── String Sanitization ───────────────────────────────────

/**
 * Clean up a string value: trim, collapse spaces, remove control chars.
 */
export function sanitizeString(val: any): string | null {
  if (val == null) return null;
  let str = String(val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \n, \r, \t)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '') // zero-width chars, BOM, direction marks
    .replace(/[\u00A0\u202F]/g, ' ') // non-breaking spaces → regular space
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !str ||
    /^(null|n\/a|none|na|not\s*found|not\s*available|non\s*disponibile|non\s*trovato|-|—|–)$/i.test(str)
  ) {
    return null;
  }
  return str;
}

// ─── Format Validators ─────────────────────────────────────

/**
 * Validate and normalize an Italian POD number.
 * Format: IT + 3 alphanumeric + E + 8-10 digits (e.g., IT001E12345678)
 */
export function validatePod(pod: string | null): string | null {
  if (!pod) return null;
  // Strip common label prefixes before cleaning
  let cleaned = pod.trim();
  cleaned = cleaned.replace(/^(codice\s*pod|pod|punto\s*di\s*prelievo)\s*[:\-]?\s*/i, '');
  // Strip spaces, dashes, dots
  cleaned = cleaned.replace(/[\s\-\.]/g, '').toUpperCase();
  // Standard POD format
  if (/^IT\d{3}E\d{8,10}$/.test(cleaned)) {
    return cleaned;
  }
  // Some older PODs have slightly different format with letters in distributor code
  if (/^IT[A-Z0-9]{3}E\d{8,10}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validate and normalize an Italian PDR number.
 * Format: exactly 14 digits.
 */
export function validatePdr(pdr: string | null): string | null {
  if (!pdr) return null;
  let cleaned = pdr.trim();
  cleaned = cleaned.replace(/^(codice\s*pdr|pdr|punto\s*di\s*riconsegna|matricola\s*pdr)\s*[:\-]?\s*/i, '');
  cleaned = cleaned.replace(/[\s\-\.]/g, '');
  return /^\d{14}$/.test(cleaned) ? cleaned : null;
}

/**
 * Validate and normalize an Italian Codice Fiscale.
 * Format: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
 */
export function validateCodiceFiscale(cf: string | null): string | null {
  if (!cf) return null;
  let cleaned = cf.trim();
  cleaned = cleaned.replace(/^(codice\s*fiscale|cod\.?\s*fisc\.?|c\.?\s*f\.?)\s*[:\-]?\s*/i, '');
  cleaned = cleaned.replace(/[\s\-\.]/g, '').toUpperCase();
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cleaned) ? cleaned : null;
}

/**
 * Validate and normalize an Italian Partita IVA.
 * Format: 11 digits, optionally prefixed with "IT".
 */
export function validatePartitaIva(piva: string | null): string | null {
  if (!piva) return null;
  let cleaned = piva.trim();
  cleaned = cleaned.replace(/^(partita\s*iva|p\.?\s*iva|p\.?\s*i\.?)\s*[:\-]?\s*/i, '');
  cleaned = cleaned.replace(/[\s\-\.]/g, '').toUpperCase();
  // Strip IT prefix
  if (cleaned.startsWith('IT')) {
    cleaned = cleaned.substring(2);
  }
  return /^\d{11}$/.test(cleaned) ? cleaned : null;
}

// ─── Date Validation ───────────────────────────────────────

/**
 * Validate and normalize a date string to YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
 */
export function validateAndNormalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // Strip common Italian date prefixes
  let str = dateStr.trim();
  str = str.replace(/^(dal|al|del|from|to|data|in\s*data)\s+/i, '').trim();

  let year: number, month: number, day: number;

  // Try YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // Try DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
    const euMatch = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
    if (euMatch) {
      day = parseInt(euMatch[1], 10);
      month = parseInt(euMatch[2], 10);
      year = parseInt(euMatch[3], 10);
    } else {
      return null;
    }
  }

  // Validate ranges
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2015 || year > new Date().getFullYear() + 1) return null;

  // Validate actual date
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // invalid date like Feb 30
  }

  // Return YYYY-MM-DD
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// ─── Numeric Range Validation ──────────────────────────────

const NUMERIC_RANGES: Record<string, { min: number; max: number }> = {
  totalAmount: { min: 0.01, max: 50000 },
  consumptionKwh: { min: 0, max: 100000 },
  consumptionSmc: { min: 0, max: 50000 },
  costPerUnit: { min: 0.001, max: 5.0 },
  fixedCharges: { min: 0, max: 5000 },
  taxes: { min: 0, max: 25000 },
};

/**
 * Validate a numeric value falls within plausible range for the given field.
 * Returns the value if valid, null if out of range.
 */
export function validateNumericRange(
  val: number | null,
  field: string,
): number | null {
  if (val == null) return null;
  const range = NUMERIC_RANGES[field];
  if (!range) return val; // unknown field, pass through
  return val >= range.min && val <= range.max ? val : null;
}

// ─── Field Derivation ──────────────────────────────────────

interface DerivableFields {
  totalAmount?: number | null;
  consumptionKwh?: number | null;
  consumptionSmc?: number | null;
  costPerUnit?: number | null;
  fixedCharges?: number | null;
  taxes?: number | null;
  confidence?: Record<string, string | null>;
}

/**
 * Attempt to derive missing financial fields from other available fields.
 * Mutates the result object in place.
 */
export function deriveFields(
  result: DerivableFields,
  billType: BillType,
): void {
  const totalAmount = result.totalAmount ?? null;
  const consumption =
    billType === BillType.ELECTRICITY
      ? (result.consumptionKwh ?? null)
      : (result.consumptionSmc ?? null);
  const costPerUnit = result.costPerUnit ?? null;
  const fixedCharges = result.fixedCharges ?? null;
  const taxes = result.taxes ?? null;
  const conf = result.confidence ?? {};

  // Derive costPerUnit: (totalAmount - fixedCharges - taxes) / consumption
  if (
    costPerUnit == null &&
    totalAmount != null &&
    consumption != null &&
    consumption > 0 &&
    fixedCharges != null &&
    taxes != null
  ) {
    const variableCost = totalAmount - fixedCharges - taxes;
    if (variableCost > 0) {
      const derived = +(variableCost / consumption).toFixed(6);
      if (derived >= 0.001 && derived <= 5.0) {
        result.costPerUnit = derived;
        conf.costPerUnit = 'medium';
      }
    }
  }

  // Derive taxes: totalAmount - (consumption * costPerUnit) - fixedCharges
  if (
    taxes == null &&
    totalAmount != null &&
    consumption != null &&
    costPerUnit != null &&
    fixedCharges != null
  ) {
    const derived = +(totalAmount - consumption * costPerUnit - fixedCharges).toFixed(2);
    if (derived >= 0) {
      result.taxes = derived;
      conf.taxes = 'low';
    }
  }

  // Derive fixedCharges: totalAmount - (consumption * costPerUnit) - taxes
  if (
    fixedCharges == null &&
    totalAmount != null &&
    consumption != null &&
    costPerUnit != null &&
    taxes != null
  ) {
    const derived = +(totalAmount - consumption * costPerUnit - taxes).toFixed(2);
    if (derived >= 0) {
      result.fixedCharges = derived;
      conf.fixedCharges = 'low';
    }
  }

  result.confidence = conf;
}

// ─── Missing Mandatory Fields ──────────────────────────────

/**
 * Returns list of mandatory field names that are still null/undefined.
 * Mirrors the Flutter-side getMissingFields() logic.
 */
export function getMissingMandatoryFields(
  result: Record<string, any>,
  billType: BillType,
): string[] {
  const missing: string[] = [];
  const isElectricity = billType === BillType.ELECTRICITY;

  if (!result.supplierName) missing.push('supplierName');
  if (isElectricity && !result.podNumber) missing.push('podNumber');
  if (!isElectricity && !result.pdrNumber) missing.push('pdrNumber');
  if (result.totalAmount == null) missing.push('totalAmount');
  if (isElectricity && result.consumptionKwh == null) missing.push('consumptionKwh');
  if (!isElectricity && result.consumptionSmc == null) missing.push('consumptionSmc');
  if (result.fixedCharges == null) missing.push('fixedCharges');
  if (result.taxes == null) missing.push('taxes');
  if (!result.billingPeriodStart) missing.push('billingPeriodStart');
  if (!result.billingPeriodEnd) missing.push('billingPeriodEnd');
  // Street and city are what the switch actually needs; a bill that gave up
  // only a CAP or a province has not really given up an address. Reported under
  // the one name `supplyAddress` so the second pass asks for the whole block.
  if (!result.supplyStreet || !result.supplyCity) missing.push('supplyAddress');
  if (!result.codiceFiscale && !result.partitaIva) missing.push('codiceFiscale/partitaIva');

  return missing;
}
