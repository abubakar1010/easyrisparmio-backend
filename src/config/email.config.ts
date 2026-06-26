import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  fromAddress:
    process.env.EMAIL_FROM || 'EasyRisparmio <noreply@easyresparmio.it>',
  appName: process.env.APP_NAME || 'EasyRisparmio',

  // SMTP (used in development with Mailhog)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '1025', 10),
}));
