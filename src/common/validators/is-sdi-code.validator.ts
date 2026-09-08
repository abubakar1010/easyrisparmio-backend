import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Codice Destinatario — the seven-character address the Sistema di
 * Interscambio routes an electronic invoice to.
 *
 * The same rule lives in the mobile app (`lib/core/utils/tax_id_validator.dart`)
 * and in the dashboard (`src/utils/italianTaxId.ts`), for the reason the tax-ID
 * rules are mirrored there: a code a client accepts and this constraint refuses
 * strands the customer on the form, and one it waves through is an invoice the
 * supplier cannot deliver.
 *
 * Seven characters, letters and digits, upper case. `0000000` is the value the
 * Agenzia delle Entrate defines for a recipient with no SDI channel — those are
 * invoiced by PEC instead — so it is a legitimate code rather than a blank to
 * reject, and it passes for exactly that reason.
 */
const SDI_CODE_PATTERN = /^[A-Z0-9]{7}$/;

/** The placeholder for a recipient reached by PEC rather than through SDI. */
export const SDI_CODE_NO_CHANNEL = '0000000';

/** The value as it is stored and compared: no whitespace, upper case. */
export const normalizeSdiCode = (value: string): string =>
  value.replace(/\s/g, '').toUpperCase();

export const isValidSdiCode = (value: string): boolean =>
  SDI_CODE_PATTERN.test(normalizeSdiCode(value));

@ValidatorConstraint({ async: false })
export class IsSdiCodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidSdiCode(value);
  }

  defaultMessage(): string {
    return 'Codice Destinatario must be exactly 7 letters or digits — use 0000000 for a recipient invoiced by PEC';
  }
}

/** A field that holds an SDI recipient code and nothing else. */
export const IsSdiCode =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSdiCodeConstraint,
    });
  };
