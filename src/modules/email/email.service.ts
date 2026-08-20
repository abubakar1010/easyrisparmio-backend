import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';

/**
 * Raised when an OTP could not be handed to a mail transport.
 *
 * Callers translate this into a 5xx rather than reporting success: the whole
 * point of the OTP flows is that the user goes and reads the code, so a silent
 * failure strands them on a code-entry screen for a message that never arrives.
 */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

/**
 * Nodemailer error codes that describe a broken connection rather than a
 * rejected message. A 5xx reply — bad credentials, unknown recipient — is
 * settled, and retrying it only holds up the HTTP request that triggered it.
 */
const TRANSIENT_CODES = new Set([
  'ECONNECTION',
  'ECONNRESET',
  'EDNS',
  'ESOCKET',
  'ETIMEDOUT',
]);

const MAX_SEND_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

type OtpEmailType = 'email_verification' | 'password_reset';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transporter | null = null;

  private readonly appName: string;
  private readonly fromAddress: string;
  private readonly replyTo: string;

  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly requireTls: boolean;
  private readonly user: string;

  constructor(private readonly configService: ConfigService) {
    this.appName =
      this.configService.get<string>('email.appName') || 'EasyRisparmio';
    this.fromAddress =
      this.configService.get<string>('email.fromAddress') || '';
    this.replyTo = this.configService.get<string>('email.replyTo') || '';

    this.host = this.configService.get<string>('email.smtpHost') || '';
    this.port = this.configService.get<number>('email.smtpPort') ?? 587;
    this.secure = this.configService.get<boolean>('email.smtpSecure') ?? false;
    this.requireTls =
      this.configService.get<boolean>('email.requireTls') ?? false;
    this.user = this.configService.get<string>('email.smtpUser') || '';

    if (!this.host) {
      return;
    }

    const password = this.configService.get<string>('email.smtpPassword') || '';
    const rejectUnauthorized =
      this.configService.get<boolean>('email.rejectUnauthorized') ?? true;

    this.transport = nodemailer.createTransport({
      // OTP sends sit on the HTTP request path, and a fresh TLS handshake plus
      // AUTH against Gmail costs the best part of a second. Holding a small
      // pool open pays that once instead of once per registration.
      pool: true,
      maxConnections: 3,
      maxMessages: 50,

      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: this.user ? { user: this.user, pass: password } : undefined,
      requireTLS: this.requireTls,
      tls: { rejectUnauthorized, minVersion: 'TLSv1.2' },

      // Bounded so a black-holed relay fails the request in seconds rather than
      // holding the connection until the client gives up.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  /**
   * Opens a connection and authenticates once at boot.
   *
   * Deliberately non-fatal: a mistyped app password should be a loud line in
   * the startup log, not a crash that takes the whole API down with it.
   */
  async onModuleInit(): Promise<void> {
    if (!this.transport) {
      const message =
        'SMTP is not configured (SMTP_HOST is empty) — no email can be delivered';
      if (this.isDevelopment()) {
        this.logger.warn(
          `${message}. OTP codes will be printed to this console.`,
        );
      } else {
        this.logger.error(message);
      }
      return;
    }

    if (!this.fromAddress) {
      this.logger.error(
        'Neither EMAIL_FROM nor SMTP_USER is set — messages will have no From address and will be rejected',
      );
    }

    try {
      await this.transport.verify();
      this.logger.log(`SMTP ready: ${this.describeTransport()}`);
    } catch (error) {
      this.logger.error(
        `SMTP verification failed for ${this.describeTransport()}: ` +
          `${this.reasonFor(error)}. Emails will fail until this is fixed.`,
      );
    }

    this.warnOnSenderMismatch();
  }

  /**
   * Pooled connections are kept open between sends, and an open socket keeps
   * the event loop alive — without this, short-lived processes such as the
   * `email:test` script would never exit.
   */
  onModuleDestroy(): void {
    this.transport?.close();
  }

  private isDevelopment(): boolean {
    return this.configService.get('app.env') === 'development';
  }

  private describeTransport(): string {
    const encryption = this.secure
      ? 'implicit TLS'
      : this.requireTls
        ? 'STARTTLS'
        : 'no TLS';
    const auth = this.user ? `auth as ${this.user}` : 'no auth';
    return `${this.host}:${this.port} (${encryption}, ${auth})`;
  }

  private reasonFor(error: unknown): string {
    return (error as Error)?.message ?? String(error);
  }

  /** Domain part of a bare address or a `Name <addr@host>` pair. */
  private domainOf(address: string): string {
    const angled = address.match(/<([^>]+)>/);
    const bare = (angled ? angled[1] : address).trim();
    const at = bare.lastIndexOf('@');
    return at === -1 ? '' : bare.slice(at + 1).toLowerCase();
  }

  /**
   * Gmail rewrites From to the authenticated account unless the address is a
   * verified "Send mail as" alias, so a mismatch here usually means recipients
   * see something other than what EMAIL_FROM says.
   */
  private warnOnSenderMismatch(): void {
    if (!this.user || !this.fromAddress) return;

    const from = this.domainOf(this.fromAddress);
    const login = this.domainOf(this.user);
    if (!from || !login || from === login) return;

    this.logger.warn(
      `EMAIL_FROM (${from}) does not match the SMTP account domain (${login}). ` +
        'Most providers rewrite or reject such messages unless the address is ' +
        'registered as a verified sender alias on the account.',
    );
  }

  private isTransient(error: unknown): boolean {
    const { code, responseCode } = (error ?? {}) as {
      code?: string;
      responseCode?: number;
    };
    if (code && TRANSIENT_CODES.has(code)) return true;
    return (
      typeof responseCode === 'number' &&
      responseCode >= 400 &&
      responseCode < 500
    );
  }

  /**
   * Hands one message to the transport, retrying once if the connection —
   * rather than the message — was the problem.
   */
  private async sendMail(message: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!this.transport) {
      throw new EmailDeliveryError('SMTP is not configured');
    }

    const payload: SendMailOptions = {
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      // A text alternative is the cheapest deliverability win available:
      // HTML-only messages carry a real spam-score penalty.
      text: message.text,
      html: message.html,
      // Gmail threads by subject, and a resent OTP that collapses into the
      // previous message leaves the user reading a code that no longer works.
      headers: { 'X-Entity-Ref-ID': randomUUID() },
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
    };

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
      try {
        await this.transport.sendMail(payload);
        return;
      } catch (error) {
        const reason = this.reasonFor(error);

        if (attempt === MAX_SEND_ATTEMPTS || !this.isTransient(error)) {
          this.logger.error(
            `Failed to send "${message.subject}" to ${message.to} via SMTP: ${reason}`,
          );
          throw new EmailDeliveryError(reason);
        }

        this.logger.warn(
          `SMTP send to ${message.to} failed (${reason}) — retrying once`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  private getOtpEmailContent(type: OtpEmailType, locale: string = 'it') {
    const templates = {
      en: {
        email_verification: {
          subject: `${this.appName} — Verify your email`,
          heading: 'Verify your email address',
          instruction:
            'Use the code below to verify your email and activate your account.',
          expiry: 'This code expires in 10 minutes.',
          footer: `You received this email because an account was registered on ${this.appName} with this address. If you didn't request this, you can safely ignore it.`,
        },
        password_reset: {
          subject: `${this.appName} — Password reset code`,
          heading: 'Reset your password',
          instruction:
            'Use the code below to reset your password. If you did not request this, ignore this email.',
          expiry: 'This code expires in 10 minutes.',
          footer: `You received this email because an account was registered on ${this.appName} with this address. If you didn't request this, you can safely ignore it.`,
        },
      },
      it: {
        email_verification: {
          subject: `${this.appName} — Verifica la tua email`,
          heading: 'Verifica il tuo indirizzo email',
          instruction:
            'Usa il codice qui sotto per verificare la tua email e attivare il tuo account.',
          expiry: 'Questo codice scade tra 10 minuti.',
          footer: `Hai ricevuto questa email perché un account è stato registrato su ${this.appName} con questo indirizzo. Se non hai effettuato questa richiesta, puoi ignorare questo messaggio.`,
        },
        password_reset: {
          subject: `${this.appName} — Codice di reset password`,
          heading: 'Reimposta la tua password',
          instruction:
            'Usa il codice qui sotto per reimpostare la tua password. Se non hai effettuato questa richiesta, ignora questa email.',
          expiry: 'Questo codice scade tra 10 minuti.',
          footer: `Hai ricevuto questa email perché un account è stato registrato su ${this.appName} con questo indirizzo. Se non hai effettuato questa richiesta, puoi ignorare questo messaggio.`,
        },
      },
    };

    const lang = locale in templates ? locale : 'it';
    return templates[lang][type];
  }

  async sendOtpEmail(
    to: string,
    code: string,
    type: OtpEmailType,
    locale: string = 'it',
  ): Promise<void> {
    const content = this.getOtpEmailContent(type, locale);

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #6D28D9; margin-bottom: 8px;">${this.appName}</h2>
        <h3 style="color: #1f2937; margin-top: 0;">${content.heading}</h3>
        <p style="color: #4b5563; line-height: 1.6;">${content.instruction}</p>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #6D28D9;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">${content.expiry}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          ${content.footer}
        </p>
      </div>
    `;

    const text = [
      this.appName,
      '',
      content.heading,
      '',
      content.instruction,
      '',
      code,
      '',
      content.expiry,
      '',
      content.footer,
    ].join('\n');

    if (this.transport) {
      await this.sendMail({ to, subject: content.subject, html, text });
      this.logger.log(`OTP email sent to ${to} via SMTP (${type})`);
      return;
    }

    // No transport configured. Locally that is a developer who has not filled in
    // credentials yet, and the code goes to the console so they are not blocked;
    // anywhere else it means the deployment is misconfigured, and telling the
    // user "we sent you a code" would be a lie.
    if (this.isDevelopment()) {
      this.logger.warn(
        `[EMAIL NOT SENT — no SMTP transport] To: ${to} | Subject: ${content.subject} | OTP: ${code}`,
      );
      return;
    }

    this.logger.error(
      `SMTP is not configured — cannot deliver ${type} OTP to ${to}`,
    );
    throw new EmailDeliveryError('SMTP is not configured');
  }
}
