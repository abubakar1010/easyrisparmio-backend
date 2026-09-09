import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

/**
 * The password rule the product enforces everywhere an account holder sets one:
 * at least eight characters carrying a lower-case letter, an upper-case letter,
 * a digit and a symbol.
 *
 * The same rule is spelled out inline in `RegisterDto`, `ResetPasswordDto` and
 * `ChangePasswordDto`, and in the mobile app's sign-up and reset forms. It is
 * collected here because the two admin-side DTOs — creating a customer from the
 * dashboard, and resetting a customer's password from it — carried only
 * `@MinLength(8)`. An account the admin opened was therefore held to a weaker
 * rule than the very same account is held to the moment its owner changes their
 * own password, which is not a policy anyone chose.
 *
 * The dashboard applies the identical rule client-side — see
 * `src/utils/password.ts` there — so the admin is told by the form rather than
 * by a raw 400 from the save.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Every character the rule counts as a symbol. */
export const PASSWORD_SYMBOLS = /(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;

export function IsStrongPassword() {
  return applyDecorators(
    MinLength(PASSWORD_MIN_LENGTH),
    Matches(/(?=.*[a-z])/, {
      message: 'Password must contain at least one lowercase letter',
    }),
    Matches(/(?=.*[A-Z])/, {
      message: 'Password must contain at least one uppercase letter',
    }),
    Matches(/(?=.*\d)/, {
      message: 'Password must contain at least one number',
    }),
    Matches(PASSWORD_SYMBOLS, {
      message: 'Password must contain at least one special character',
    }),
  );
}
