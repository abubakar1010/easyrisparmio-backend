import { registerAs } from '@nestjs/config';

/**
 * Prefixes of the placeholder secrets shipped in `.env.example`. That file is
 * committed, so a deployment still signing with one of these can have its
 * tokens — including `role: ADMIN` ones — forged by anyone who can read the
 * repository. Refuse to boot rather than mint forgeable tokens.
 */
const PLACEHOLDER_PREFIXES = ['your-super-secret', 'change_me', 'changeme'];

const MIN_SECRET_LENGTH = 32;

const HOW_TO_GENERATE = 'Generate one with: openssl rand -hex 32';

function requireStrongSecret(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  const normalised = value.trim().toLowerCase();
  if (PLACEHOLDER_PREFIXES.some((prefix) => normalised.startsWith(prefix))) {
    throw new Error(
      `${name} is still set to the placeholder value from .env.example. ` +
        `.env.example is committed, so this secret is public and tokens signed ` +
        `with it can be forged. ${HOW_TO_GENERATE}`,
    );
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters ` +
        `(got ${value.length}). ${HOW_TO_GENERATE}`,
    );
  }

  return value;
}

export default registerAs('jwt', () => {
  const secret = requireStrongSecret(process.env.JWT_SECRET, 'JWT_SECRET');
  const refreshSecret = requireStrongSecret(
    process.env.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
  );

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  };
});
