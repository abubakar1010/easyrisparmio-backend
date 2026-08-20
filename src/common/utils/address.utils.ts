/**
 * The five fields every address in the system is stored as — street, civic
 * number, city, CAP and province.
 *
 * Supply, residential and shipping addresses on a case already use this shape,
 * and a bill's supply address now does too, so the address the OCR reads and
 * the address the customer confirms are the same five columns end to end.
 */
export interface AddressParts {
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  postalCode: string | null;
  province: string | null;
}

/** A CAP is always five digits. */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/**
 * The official two-letter sigle, mirroring the mobile app's `ItalianProvinces`.
 *
 * Only the parser uses this: a bare two-letter token at the end of an address
 * line is a province if it is one of these and a truncated street name if it is
 * not, and there is no other way to tell the two apart.
 */
const PROVINCE_SIGLE = new Set([
  'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN',
  'BG', 'BI', 'BO', 'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CE', 'CT', 'CZ',
  'CH', 'CO', 'CS', 'CR', 'KR', 'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC',
  'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'AQ', 'SP', 'LT', 'LE', 'LC', 'LI',
  'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'ME', 'MI', 'MO', 'MB', 'NA', 'NO',
  'NU', 'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT',
  'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA',
  'SS', 'SV', 'SI', 'SR', 'SO', 'SU', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN',
  'TV', 'TS', 'UD', 'VA', 'VE', 'VB', 'VC', 'VR', 'VV', 'VI', 'VT',
]);

/**
 * Province is free text — stored exactly as it was typed, with only surrounding
 * whitespace removed and blanks collapsed to null.
 */
export function normalizeProvince(value?: string | null): string | null {
  const province = value?.trim();
  return province ? province : null;
}

/**
 * Keeps a CAP only when it is five digits. A partial read (`2010`) is worse
 * than nothing here: it would sit in the form looking filled in and get sent to
 * the supplier unchecked.
 */
export function normalizePostalCode(value?: string | null): string | null {
  const cap = value?.trim();
  if (!cap) return null;
  return POSTAL_CODE_PATTERN.test(cap) ? cap : null;
}

function clean(value?: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * Renders the five fields back as one line — `Via Roma 10, 20100 Milano (MI)`.
 *
 * Everything that only ever displays the address (the utilities list, the
 * client drawer, the mobile bill card) keeps reading a single string, so the
 * split into five columns stays invisible to them.
 */
export function composeAddressLine(parts: Partial<AddressParts>): string | null {
  const streetLine = [clean(parts.street), clean(parts.streetNumber)]
    .filter(Boolean)
    .join(' ');

  const cityBase = [clean(parts.postalCode), clean(parts.city)]
    .filter(Boolean)
    .join(' ');

  const province = clean(parts.province);
  const cityLine = province
    ? cityBase
      ? `${cityBase} (${province})`
      : `(${province})`
    : cityBase;

  const line = [streetLine, cityLine].filter(Boolean).join(', ');
  return line || null;
}

/** True when at least one of the five fields carries something. */
export function hasAddressParts(parts: Partial<AddressParts>): boolean {
  return Boolean(
    clean(parts.street) ||
      clean(parts.streetNumber) ||
      clean(parts.city) ||
      clean(parts.postalCode) ||
      clean(parts.province),
  );
}

/** The five keys, in the order they read. */
export const ADDRESS_PART_KEYS = [
  'street', 'streetNumber', 'city', 'postalCode', 'province',
] as const;

/**
 * Makes a printed address line and its five parts agree.
 *
 * Either half can arrive alone or incomplete: the model is asked for both but a
 * second pass answers narrowly, a bill that prints the address as free text
 * yields a line the model will not commit to splitting, and rows stored before
 * the five columns existed have only the line. Any part that is missing is
 * recovered from the line, and the line is then re-rendered from the parts so
 * the two describe one address.
 *
 * A part the caller already holds is never overwritten — the line only fills
 * gaps. `recovered` names the parts that came from the split, which the caller
 * uses to mark them as the guesses they are.
 */
export function reconcileAddress(
  line: string | null | undefined,
  parts: Partial<AddressParts>,
): {
  line: string | null;
  parts: AddressParts;
  recovered: (typeof ADDRESS_PART_KEYS)[number][];
} {
  const merged: AddressParts = {
    street: clean(parts.street) || null,
    streetNumber: clean(parts.streetNumber) || null,
    city: clean(parts.city) || null,
    postalCode: normalizePostalCode(parts.postalCode),
    province: normalizeProvince(parts.province),
  };

  const recovered: (typeof ADDRESS_PART_KEYS)[number][] = [];
  const printed = clean(line) || null;

  if (printed) {
    const parsed = parseAddressLine(printed);
    for (const key of ADDRESS_PART_KEYS) {
      if (!merged[key] && parsed[key]) {
        merged[key] = parsed[key];
        recovered.push(key);
      }
    }
  }

  // Falling back to the printed line matters: a line nothing can be split out
  // of would otherwise be thrown away along with the only address there is.
  return { line: composeAddressLine(merged) ?? printed, parts: merged, recovered };
}

function trimSeparators(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,\-–]+/, '')
    .replace(/[\s,\-–]+$/, '')
    .trim();
}

/**
 * Bills are usually printed in caps; title-case them back so a pre-filled form
 * does not shout. Mixed-case input is left exactly as it was read.
 */
function normalizeCase(value: string): string {
  if (!value) return value;
  if (value !== value.toUpperCase()) return value;
  return value
    .split(' ')
    .map((word) =>
      word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(' ');
}

/**
 * Best-effort split of a single address line — `VIA ROMA 10, 20100 MILANO (MI)`
 * — into the five fields. Port of the mobile app's `AddressData.parse`, so a
 * line parsed on either side lands on the same five values.
 *
 * This is only ever a fallback: the model is asked for the five fields
 * directly, and this runs when it returned the line but not the parts, or when
 * backfilling a bill stored before the columns existed. The result is always
 * shown back in editable fields, so a bad split costs a correction rather than
 * producing data nobody can fix.
 */
export function parseAddressLine(raw?: string | null): AddressParts {
  const empty: AddressParts = {
    street: null,
    streetNumber: null,
    city: null,
    postalCode: null,
    province: null,
  };

  let text = clean(raw);
  if (!text) return empty;

  // Province — `(MI)` anywhere, otherwise a trailing two-letter token.
  let province = '';
  const paren = /\(\s*([A-Za-z]{2})\s*\)/.exec(text);
  if (paren && PROVINCE_SIGLE.has(paren[1].toUpperCase())) {
    province = paren[1].toUpperCase();
    text = text.slice(0, paren.index) + ' ' + text.slice(paren.index + paren[0].length);
  } else {
    const trailing = /[\s,\-]([A-Za-z]{2})\s*$/.exec(text);
    if (trailing && PROVINCE_SIGLE.has(trailing[1].toUpperCase())) {
      province = trailing[1].toUpperCase();
      text = text.slice(0, trailing.index);
    }
  }

  // CAP — the first standalone five-digit group splits street from city.
  let postalCode = '';
  let streetPart = text;
  let cityPart = '';
  const cap = /(?<!\d)(\d{5})(?!\d)/.exec(text);
  if (cap) {
    postalCode = cap[1];
    streetPart = text.slice(0, cap.index);
    cityPart = text.slice(cap.index + cap[0].length);
  } else {
    // No CAP: only trust a trailing comma-separated chunk as the city when it
    // holds no digits, so `Via Roma, 10` is not read as city "10".
    const comma = text.lastIndexOf(',');
    if (comma > 0) {
      const tail = text.slice(comma + 1);
      if (tail.trim() && !/\d/.test(tail)) {
        streetPart = text.slice(0, comma);
        cityPart = tail;
      }
    }
  }

  // Civic number — a trailing number token on the street part.
  let street = trimSeparators(streetPart);
  let streetNumber = '';
  const number = /[,\s]+(\d+\s*[/-]?\s*[A-Za-z]?(?:\s?(?:bis|ter))?)\s*$/i.exec(street);
  if (number) {
    streetNumber = number[1].replace(/\s+/g, '').trim();
    street = trimSeparators(street.slice(0, number.index));
  }

  const city = trimSeparators(cityPart.replace(/[()]/g, ' '));

  return {
    street: normalizeCase(street) || null,
    streetNumber: streetNumber.toUpperCase() || null,
    city: normalizeCase(city) || null,
    postalCode: postalCode || null,
    province: province || null,
  };
}
