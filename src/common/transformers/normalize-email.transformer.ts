import { Transform } from 'class-transformer';

/**
 * Trims and lower-cases an email before validation runs.
 *
 * Email lookups (`findByEmail`) are the identity spine of every auth flow —
 * login, OTP verification, resend and password reset all resolve the account by
 * address. Without this, `Mario.Rossi@Email.com` and `mario.rossi@email.com`
 * are two different accounts: registration would happily create both, and a
 * password reset typed in a different case than the one used at sign-up would
 * silently resolve to nothing (the anti-enumeration branch), leaving the user
 * staring at "we sent you a code" while no email was ever sent.
 *
 * Apply to every DTO field that carries a login email.
 */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
