import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

@ValidatorConstraint({ async: false })
export class IsPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const phone = parsePhoneNumberFromString(value);
    return phone !== undefined && phone.isValid();
  }

  defaultMessage(): string {
    return 'Phone number must be valid international format (e.g., +393331234567)';
  }
}

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPhoneNumberConstraint,
    });
  };
}
