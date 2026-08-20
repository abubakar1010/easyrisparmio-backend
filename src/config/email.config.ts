import { registerAs } from '@nestjs/config';

/**
 * Reads a boolean env var, falling back when it is unset or empty.
 *
 * `Boolean(process.env.X)` is wrong here: the string "false" is truthy, so an
 * explicit opt-out would silently read as an opt-in.
 */
const asBool = (value: string | undefined, fallback: boolean): boolean =>
  !value ? fallback : value.trim().toLowerCase() === 'true';

export default registerAs('email', () => {
  const appName = process.env.APP_NAME || 'EasyRisparmio';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  // Port 465 speaks TLS from the first byte; every other port (587, 25, 2525)
  // opens in the clear and upgrades through STARTTLS.
  const secure = asBool(process.env.SMTP_SECURE, port === 465);

  const user = (process.env.SMTP_USER || '').trim();

  // Google presents app passwords grouped in fours ("abcd efgh ijkl mnop").
  // The spaces are presentation only and AUTH fails if they are sent.
  const password = (process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');

  return {
    appName,

    smtpHost: (process.env.SMTP_HOST || '').trim(),
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: user,
    smtpPassword: password,

    // Authenticating over a session the server declined to upgrade would put the
    // password on the wire in the clear, so STARTTLS is mandatory whenever we
    // log in. Without credentials there is nothing to protect, which keeps
    // local catch-all servers (Mailhog, maildev) usable.
    requireTls: asBool(process.env.SMTP_REQUIRE_TLS, !secure && !!user),

    // Only ever turned off for a relay with a self-signed certificate.
    rejectUnauthorized: asBool(process.env.SMTP_REJECT_UNAUTHORIZED, true),

    // Gmail rewrites From to the authenticated account unless the address is a
    // verified "Send mail as" alias, so defaulting to the login is the option
    // that always arrives.
    fromAddress: process.env.EMAIL_FROM || (user ? `${appName} <${user}>` : ''),
    replyTo: process.env.EMAIL_REPLY_TO || '',
  };
});
