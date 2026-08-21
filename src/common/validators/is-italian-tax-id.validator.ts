import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Italian tax identifiers — Codice Fiscale for a person, Partita IVA for a
 * company.
 *
 * The same rule lives in the mobile app (`lib/core/utils/tax_id_validator.dart`)
 * and in the dashboard (`src/utils/italianTaxId.ts`). All three have to reach
 * the same verdict: a code a client accepts and this constraint refuses strands
 * the customer on the request form with no way forward, and one it waves
 * through is a direct debit mandate the supplier bounces weeks later.
 *
 * Every DTO that takes a tax ID goes through the functions below rather than
 * its own `@Matches`. A shape-only rule on the account and a check-character
 * rule on the case is the worst of both: the code is accepted at registration
 * and then refused at the mandate, and by then the customer is looking at a
 * value the app itself told them was fine.
 *
 * Codice Fiscale: RSSMRA85T10A562S — six name letters, two year characters, the
 * month letter, two day characters, the Belfiore letter, three Belfiore
 * characters, the check character.
 * Partita IVA: 12345678901, optionally written IT12345678901.
 */

/** Eleven digits, optionally carrying the `IT` country prefix. */
const PARTITA_IVA_PATTERN = /^(IT)?\d{11}$/;

/**
 * The seven positions that hold a number accept a letter as well, because the
 * Agenzia delle Entrate substitutes one there whenever two people would
 * otherwise be issued the same code (omocodia: 0→L, 1→M, 2→N, 3→P, 4→Q, 5→R,
 * 6→S, 7→T, 8→U, 9→V). Those codes are on real identity cards, so a pattern
 * that insists on `\d` rejects a valid Codice Fiscale.
 *
 * The month is one of the twelve letters actually in use rather than any
 * letter, so a transposed month is caught by the shape rather than left to the
 * check character alone.
 */
const CODICE_FISCALE_PATTERN =
  /^[A-Z]{6}[\dLMNPQRSTUV]{2}[ABCDEHLMPRST][\dLMNPQRSTUV]{2}[A-Z][\dLMNPQRSTUV]{3}[A-Z]$/;

/** The digit each substitution letter stands for in an omocodia code. */
const OMOCODIA_DIGITS: Record<string, number> = {
  L: 0, M: 1, N: 2, P: 3, Q: 4, R: 5, S: 6, T: 7, U: 8, V: 9,
};

/** What each character contributes from an odd position (1st, 3rd, …). */
const ODD_VALUES: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** What each character contributes from an even position (2nd, 4th, …). */
const EVEN_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

/**
 * The value as it is stored and compared: no whitespace or separators, upper
 * case.
 *
 * Whitespace is stripped rather than trimmed, and punctuation with it: a tax ID
 * is printed in groups and pasted out of PDFs, and the clients normalise the
 * same way. If this only trimmed, a value they accept would come back a 400.
 */
export const normalizeTaxId = (value: string): string =>
  value.replace(/[\s.-]/g, '').toUpperCase();

/**
 * The number a numeric position holds, reading a substitution letter as the
 * digit it replaced.
 */
const digitAt = (cf: string, index: number): number => {
  const substituted = OMOCODIA_DIGITS[cf[index]];
  return substituted === undefined ? Number(cf[index]) : substituted;
};

/** A VAT number, verified against its Luhn-style check digit. */
export const isValidPartitaIva = (value: string): boolean => {
  const cleaned = normalizeTaxId(value);
  if (!PARTITA_IVA_PATTERN.test(cleaned)) return false;

  const digits = cleaned.replace(/^IT/, '');
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return sum % 10 === 0;
};

/** A personal tax code, verified against its check character (the CIN). */
export const isValidCodiceFiscale = (value: string): boolean => {
  const cleaned = normalizeTaxId(value);
  if (!CODICE_FISCALE_PATTERN.test(cleaned)) return false;

  // 1–31 for a man and 41–71 for a woman: the forty is what tells the two
  // apart. Nothing outside those ranges was ever issued, so a code carrying one
  // is a typo whatever its check character says.
  const day = digitAt(cleaned, 9) * 10 + digitAt(cleaned, 10);
  if (!((day >= 1 && day <= 31) || (day >= 41 && day <= 71))) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    sum += i % 2 === 0 ? ODD_VALUES[cleaned[i]] : EVEN_VALUES[cleaned[i]];
  }
  return cleaned[15] === String.fromCharCode(65 + (sum % 26));
};

/** Either form, for a field whose holder may be a person or a company. */
export const isValidItalianTaxId = (value: string): boolean =>
  isValidPartitaIva(value) || isValidCodiceFiscale(value);

@ValidatorConstraint({ async: false })
export class IsItalianTaxIdConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidItalianTaxId(value);
  }

  defaultMessage(): string {
    return 'Tax ID must be a valid Italian Codice Fiscale (16 characters) or Partita IVA (11 digits, optionally prefixed with IT)';
  }
}

@ValidatorConstraint({ async: false })
export class IsCodiceFiscaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCodiceFiscale(value);
  }

  defaultMessage(): string {
    return 'Codice Fiscale is not valid — check the 16 characters, the last one is derived from the other fifteen';
  }
}

@ValidatorConstraint({ async: false })
export class IsPartitaIvaConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidPartitaIva(value);
  }

  defaultMessage(): string {
    return 'Partita IVA is not valid — it must be 11 digits whose last one is derived from the other ten';
  }
}

const decoratorFor =
  (validator: new () => ValidatorConstraintInterface) =>
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator,
    });
  };

/** A field that takes either form. */
export const IsItalianTaxId = decoratorFor(IsItalianTaxIdConstraint);

/** A field that is a person's tax code and nothing else. */
export const IsCodiceFiscale = decoratorFor(IsCodiceFiscaleConstraint);

/** A field that is a company's VAT number and nothing else. */
export const IsPartitaIva = decoratorFor(IsPartitaIvaConstraint);
