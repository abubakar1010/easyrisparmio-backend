import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import emailConfig from '../../config/email.config';
import { EmailDeliveryError, EmailService } from './email.service';

jest.mock('nodemailer');

const createTransport = nodemailer.createTransport as unknown as jest.Mock;

/**
 * Every env var the email config reads. Cleared before each build so a value
 * leaking in from the developer's shell cannot change what a test asserts.
 */
const EMAIL_ENV_KEYS = [
  'APP_NAME',
  'EMAIL_FROM',
  'EMAIL_REPLY_TO',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_REQUIRE_TLS',
  'SMTP_REJECT_UNAUTHORIZED',
];

const GMAIL: Record<string, string> = {
  APP_NAME: 'EasyRisparmio',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'noreply@easyrisparmio.it',
  SMTP_PASSWORD: 'abcdefghijklmnop',
};

describe('EmailService', () => {
  const originalEnv = { ...process.env };

  let sendMail: jest.Mock;
  let verify: jest.Mock;
  let close: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    sendMail = jest.fn().mockResolvedValue({ messageId: 'test' });
    verify = jest.fn().mockResolvedValue(true);
    close = jest.fn();
    createTransport.mockReturnValue({ sendMail, verify, close });

    // The service logs failures by design; keep the test output readable.
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const buildService = (
    env: Record<string, string>,
    appEnv = 'production',
  ): EmailService => {
    for (const key of EMAIL_ENV_KEYS) delete process.env[key];
    Object.assign(process.env, env);

    const values = { email: emailConfig(), app: { env: appEnv } };
    const configService = {
      get: (path: string) =>
        path
          .split('.')
          .reduce<any>(
            (value, key) => (value == null ? value : value[key]),
            values,
          ),
    } as unknown as ConfigService;

    return new EmailService(configService);
  };

  const transportOptions = () => createTransport.mock.calls[0][0];
  const sentMessage = () => sendMail.mock.calls[0][0];

  describe('transport options', () => {
    it('upgrades through STARTTLS and authenticates on port 587', () => {
      buildService(GMAIL);

      expect(transportOptions()).toMatchObject({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'noreply@easyrisparmio.it', pass: 'abcdefghijklmnop' },
      });
    });

    it('uses implicit TLS on port 465 without forcing STARTTLS', () => {
      buildService({ ...GMAIL, SMTP_HOST: 'smtp.zoho.eu', SMTP_PORT: '465' });

      expect(transportOptions()).toMatchObject({
        secure: true,
        requireTLS: false,
      });
    });

    it('honours an explicit SMTP_SECURE over the port-derived default', () => {
      buildService({ ...GMAIL, SMTP_PORT: '465', SMTP_SECURE: 'false' });

      // "false" is a truthy string — a naive Boolean() read would flip this.
      expect(transportOptions().secure).toBe(false);
    });

    it('strips the display spaces from a Gmail app password', () => {
      buildService({ ...GMAIL, SMTP_PASSWORD: 'abcd efgh ijkl mnop' });

      expect(transportOptions().auth.pass).toBe('abcdefghijklmnop');
    });

    it('sends unauthenticated and without STARTTLS when no user is set', () => {
      buildService({ SMTP_HOST: 'localhost', SMTP_PORT: '1025' });

      expect(transportOptions()).toMatchObject({
        auth: undefined,
        requireTLS: false,
      });
    });

    it('verifies certificates unless explicitly told not to', () => {
      buildService(GMAIL);
      expect(transportOptions().tls.rejectUnauthorized).toBe(true);

      createTransport.mockClear();
      buildService({ ...GMAIL, SMTP_REJECT_UNAUTHORIZED: 'false' });
      expect(transportOptions().tls.rejectUnauthorized).toBe(false);
    });

    it('builds no transport when SMTP_HOST is empty', () => {
      buildService({ SMTP_USER: 'someone@example.com' });

      expect(createTransport).not.toHaveBeenCalled();
    });
  });

  describe('sender address', () => {
    it('falls back to the authenticated account when EMAIL_FROM is unset', async () => {
      const service = buildService(GMAIL);
      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'email_verification',
      );

      expect(sentMessage().from).toBe(
        'EasyRisparmio <noreply@easyrisparmio.it>',
      );
    });

    it('prefers an explicit EMAIL_FROM', async () => {
      const service = buildService({
        ...GMAIL,
        EMAIL_FROM: 'EasyRisparmio <noreply@easyresparmio.it>',
      });
      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'email_verification',
      );

      expect(sentMessage().from).toBe(
        'EasyRisparmio <noreply@easyresparmio.it>',
      );
    });

    it('warns when EMAIL_FROM does not match the account domain', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');
      const service = buildService({
        ...GMAIL,
        EMAIL_FROM: 'EasyRisparmio <noreply@easyresparmio.it>',
      });

      await service.onModuleInit();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('does not match the SMTP account domain'),
      );
    });
  });

  describe('message shape', () => {
    it('sends a text alternative alongside the HTML', async () => {
      const service = buildService(GMAIL);
      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'email_verification',
      );

      const message = sentMessage();
      expect(message.html).toContain('123456');
      expect(message.text).toContain('123456');
      expect(message.text).not.toContain('<div');
    });

    it('gives each message a unique reference so Gmail does not thread them', async () => {
      const service = buildService(GMAIL);

      await service.sendOtpEmail(
        'user@example.com',
        '111111',
        'email_verification',
      );
      await service.sendOtpEmail(
        'user@example.com',
        '222222',
        'email_verification',
      );

      const first = sendMail.mock.calls[0][0].headers['X-Entity-Ref-ID'];
      const second = sendMail.mock.calls[1][0].headers['X-Entity-Ref-ID'];
      expect(first).toBeTruthy();
      expect(first).not.toBe(second);
    });

    it('uses the Italian templates by default and English on request', async () => {
      const service = buildService(GMAIL);

      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'password_reset',
      );
      expect(sendMail.mock.calls[0][0].subject).toContain(
        'Codice di reset password',
      );

      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'password_reset',
        'en',
      );
      expect(sendMail.mock.calls[1][0].subject).toContain(
        'Password reset code',
      );
    });
  });

  describe('delivery failures', () => {
    it('retries once when the connection drops', async () => {
      const service = buildService(GMAIL);
      sendMail
        .mockRejectedValueOnce(
          Object.assign(new Error('closed'), { code: 'ECONNECTION' }),
        )
        .mockResolvedValueOnce({ messageId: 'test' });

      await service.sendOtpEmail(
        'user@example.com',
        '123456',
        'email_verification',
      );

      expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('does not retry a message the server rejected outright', async () => {
      const service = buildService(GMAIL);
      sendMail.mockRejectedValue(
        Object.assign(new Error('550 no such user'), { responseCode: 550 }),
      );

      await expect(
        service.sendOtpEmail(
          'nobody@example.com',
          '123456',
          'email_verification',
        ),
      ).rejects.toBeInstanceOf(EmailDeliveryError);

      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('gives up after the retry and reports the reason', async () => {
      const service = buildService(GMAIL);
      sendMail.mockRejectedValue(
        Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }),
      );

      await expect(
        service.sendOtpEmail(
          'user@example.com',
          '123456',
          'email_verification',
        ),
      ).rejects.toThrow('timed out');

      expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('fails loudly outside development when SMTP is not configured', async () => {
      const service = buildService({}, 'production');

      await expect(
        service.sendOtpEmail(
          'user@example.com',
          '123456',
          'email_verification',
        ),
      ).rejects.toBeInstanceOf(EmailDeliveryError);
    });

    it('logs the code instead of failing in development', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');
      const service = buildService({}, 'development');

      await expect(
        service.sendOtpEmail(
          'user@example.com',
          '123456',
          'email_verification',
        ),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('123456'));
    });
  });

  describe('lifecycle', () => {
    it('authenticates once at startup', async () => {
      const service = buildService(GMAIL);
      await service.onModuleInit();

      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('keeps booting when the credentials are wrong', async () => {
      const error = jest.spyOn(Logger.prototype, 'error');
      const service = buildService(GMAIL);
      verify.mockRejectedValue(
        new Error('535 Username and Password not accepted'),
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('SMTP verification failed'),
      );
    });

    it('closes the pool on shutdown so the process can exit', () => {
      const service = buildService(GMAIL);
      service.onModuleDestroy();

      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
