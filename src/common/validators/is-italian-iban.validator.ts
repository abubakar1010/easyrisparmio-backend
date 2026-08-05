import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates Italian IBAN format.
 * Italian IBAN: IT + 2 check digits + 1 CIN letter + 5 ABI digits + 5 CAB digits + 12 account chars = 27 characters total.
 * Example: IT60X0542811101000000123456
 */
@ValidatorConstraint({ async: false })
export class IsItalianIbanConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const cleaned = value.replace(/\s+/g, '').toUpperCase();

    // Italian IBAN must be exactly 27 characters starting with IT
    if (!/^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/.test(cleaned)) {
      return false;
    }

    // IBAN mod-97 check: move first 4 chars to end, convert letters to numbers, mod 97 must equal 1
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    const numericStr = rearranged
      .split('')
      .map((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 65 && code <= 90 ? (code - 55).toString() : ch;
      })
      .join('');

    // Process in chunks to avoid BigInt issues
    let remainder = 0;
    for (let i = 0; i < numericStr.length; i += 7) {
      const chunk = String(remainder) + numericStr.slice(i, i + 7);
      remainder = parseInt(chunk, 10) % 97;
    }

    return remainder === 1;
  }

  defaultMessage(): string {
    return 'IBAN must be a valid Italian IBAN (27 characters starting with IT, e.g., IT60X0542811101000000123456)';
  }
}

export function IsItalianIban(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsItalianIbanConstraint,
    });
  };
}
