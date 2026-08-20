/**
 * Sends one real email through the configured SMTP relay.
 *
 *   npm run email:test -- someone@example.com
 *
 * Boots ConfigModule + EmailService only — no database, no feature modules —
 * so it can be run against a deployment before anything else works. Because it
 * goes through EmailService it also runs the startup `verify()`, which means a
 * wrong app password surfaces here with the provider's own error text.
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { randomInt } from 'crypto';

import appConfig from '../config/app.config';
import emailConfig from '../config/email.config';
import { EmailService } from '../modules/email/email.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, emailConfig],
      envFilePath: '.env',
    }),
  ],
  providers: [EmailService],
})
class EmailTestModule {}

async function main(): Promise<void> {
  const recipient = process.argv[2];

  if (!recipient || !recipient.includes('@')) {
    console.error('Usage: npm run email:test -- someone@example.com');
    process.exit(1);
  }

  const context = await NestFactory.createApplicationContext(EmailTestModule, {
    logger: ['log', 'warn', 'error'],
  });

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

  const host = context.get(ConfigService).get<string>('email.smtpHost');

  try {
    await context
      .get(EmailService)
      .sendOtpEmail(recipient, code, 'email_verification');

    console.log('');

    if (!host) {
      // The service falls back to the console in development rather than
      // failing, so a clean exit here does not mean anything was delivered.
      console.log('Nothing was sent: SMTP_HOST is empty, so the code above');
      console.log('was only logged. Fill in the SMTP_* values in .env and');
      console.log('run this again.');
      process.exitCode = 1;
      return;
    }

    console.log(`Handed to ${host} for delivery to ${recipient}.`);
    console.log(`The code in the message should read ${code}.`);
    console.log('');
    console.log('Check the inbox (and the spam folder). In Gmail, open');
    console.log('"Show original" to confirm SPF and DKIM pass and to see');
    console.log('which From address actually went out.');
  } catch (error) {
    console.error('');
    console.error(`Send failed: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void main();
