import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT || '3000', 10),
  env: process.env.APP_ENV || 'development',
  name: process.env.APP_NAME || 'EasyRisparmio',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  // Where a web-push notification opens. Defaults to the frontend URL so a
  // deployment that only sets FRONTEND_URL still deep-links correctly.
  dashboardUrl:
    process.env.DASHBOARD_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3001',
  uploadDest: process.env.UPLOAD_DEST || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  // Deep Linking
  backendDomain: process.env.BACKEND_DOMAIN || 'http://localhost:3000',
  androidSha256Fingerprint: process.env.ANDROID_SHA256_FINGERPRINT || '',
  appleTeamId: process.env.APPLE_TEAM_ID || '',
  playStoreUrl: process.env.PLAY_STORE_URL || '',
  appStoreUrl: process.env.APP_STORE_URL || '',
}));
