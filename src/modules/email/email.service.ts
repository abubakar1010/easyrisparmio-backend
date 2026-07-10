import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private smtpTransport: Transporter | null = null;
  private fromAddress: string;
  private appName: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('email.fromAddress') ||
      'EasyRisparmio <noreply@easyresparmio.it>';
    this.appName =
      this.configService.get<string>('email.appName') || 'EasyRisparmio';

    const smtpHost = this.configService.get<string>('email.smtpHost');
    const smtpPort = this.configService.get<number>('email.smtpPort');

    if (smtpHost) {
      // Development: use SMTP (Mailhog)
      this.smtpTransport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        ignoreTLS: true,
      });
      this.logger.log(
        `SMTP email transport initialized (${smtpHost}:${smtpPort})`,
      );
    } else {
      // Production: use Resend
      const apiKey = this.configService.get<string>('email.resendApiKey');
      if (apiKey) {
        this.resend = new Resend(apiKey);
        this.logger.log('Resend email service initialized');
      } else {
        this.logger.warn(
          'No email transport configured — emails will be logged to console only',
        );
      }
    }
  }

  private getOtpEmailContent(
    type: 'email_verification' | 'password_reset',
    locale: string = 'it',
  ) {
    const templates = {
      en: {
        email_verification: {
          subject: `${this.appName} — Verify your email`,
          heading: 'Verify your email address',
          instruction: 'Use the code below to verify your email and activate your account.',
          expiry: 'This code expires in 10 minutes.',
          footer: `You received this email because an account was registered on ${this.appName} with this address. If you didn't request this, you can safely ignore it.`,
        },
        password_reset: {
          subject: `${this.appName} — Password reset code`,
          heading: 'Reset your password',
          instruction: 'Use the code below to reset your password. If you did not request this, ignore this email.',
          expiry: 'This code expires in 10 minutes.',
          footer: `You received this email because an account was registered on ${this.appName} with this address. If you didn't request this, you can safely ignore it.`,
        },
      },
      it: {
        email_verification: {
          subject: `${this.appName} — Verifica la tua email`,
          heading: 'Verifica il tuo indirizzo email',
          instruction: 'Usa il codice qui sotto per verificare la tua email e attivare il tuo account.',
          expiry: 'Questo codice scade tra 10 minuti.',
          footer: `Hai ricevuto questa email perché un account è stato registrato su ${this.appName} con questo indirizzo. Se non hai effettuato questa richiesta, puoi ignorare questo messaggio.`,
        },
        password_reset: {
          subject: `${this.appName} — Codice di reset password`,
          heading: 'Reimposta la tua password',
          instruction: 'Usa il codice qui sotto per reimpostare la tua password. Se non hai effettuato questa richiesta, ignora questa email.',
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
    type: 'email_verification' | 'password_reset',
    locale: string = 'it',
  ): Promise<void> {
    const content = this.getOtpEmailContent(type, locale);
    const subject = content.subject;
    const heading = content.heading;
    const instruction = content.instruction;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #6D28D9; margin-bottom: 8px;">${this.appName}</h2>
        <h3 style="color: #1f2937; margin-top: 0;">${heading}</h3>
        <p style="color: #4b5563; line-height: 1.6;">${instruction}</p>
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

    // SMTP (Mailhog in dev)
    if (this.smtpTransport) {
      try {
        await this.smtpTransport.sendMail({
          from: this.fromAddress,
          to,
          subject,
          html,
        });
        this.logger.log(`OTP email sent to ${to} via SMTP (${type})`);
      } catch (error) {
        this.logger.error(
          `Failed to send OTP email to ${to} via SMTP: ${error.message}`,
        );
      }
      return;
    }

    // Resend (production)
    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.fromAddress,
          to,
          subject,
          html,
        });
        this.logger.log(`OTP email sent to ${to} via Resend (${type})`);
      } catch (error) {
        this.logger.error(
          `Failed to send OTP email to ${to} via Resend: ${error.message}`,
        );
      }
      return;
    }

    // No transport configured
    this.logger.warn(
      `[EMAIL NOT SENT — no transport] To: ${to} | Subject: ${subject} | OTP: ${code}`,
    );
  }
}
