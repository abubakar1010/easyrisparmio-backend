import {
  Injectable,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: App | null = null;
  private projectId: string | undefined;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured. Social login will be unavailable.',
      );
      return;
    }

    this.projectId = projectId;

    if (!getApps().length) {
      this.firebaseApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log(`Firebase Admin SDK initialized for project ${projectId}`);
    } else {
      this.firebaseApp = getApps()[0];
    }
  }

  /**
   * Verifies a Firebase ID token minted by the mobile app.
   *
   * Every failure used to come back as one sentence — "Firebase token
   * verification failed" — with nothing written to the log. A misconfigured
   * client and an expired token were indistinguishable from the server side,
   * and social sign-in could be broken for every user on the platform without
   * leaving a single line to say so. The raw `auth/*` code is therefore logged
   * on the way past, and the codes that name a *server* misconfiguration are
   * separated from the ones the user can act on: a token signed for another
   * Firebase project is not something retrying will fix.
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new ServiceUnavailableException(
        'Social login is not available. Please sign in with your email and password.',
      );
    }
    try {
      return await getAuth(this.firebaseApp).verifyIdToken(idToken);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? 'unknown';
      const message = (error as Error)?.message ?? String(error);

      switch (code) {
        case 'auth/id-token-expired':
          this.logger.debug(`Expired Firebase ID token rejected: ${message}`);
          throw new UnauthorizedException(
            'Your sign-in session has expired. Please try again.',
          );

        case 'auth/id-token-revoked':
        case 'auth/user-disabled':
          this.logger.warn(`Firebase ID token no longer valid (${code})`);
          throw new UnauthorizedException(
            'This sign-in is no longer valid. Please sign in again.',
          );

        case 'auth/argument-error':
          // The overwhelmingly common cause: the app is configured against a
          // different Firebase project than FIREBASE_PROJECT_ID, so the token
          // audience never matches. Retrying cannot help, and the operator is
          // the only one who can fix it — so say which project we expect.
          this.logger.error(
            `Firebase ID token rejected as malformed or issued for another ` +
              `project. This server verifies tokens for project ` +
              `"${this.projectId}" — check that the mobile app's ` +
              `google-services.json / GoogleService-Info.plist belongs to the ` +
              `same project. Underlying error: ${message}`,
          );
          throw new UnauthorizedException(
            'This sign-in could not be verified. Please try again.',
          );

        default:
          this.logger.error(
            `Firebase ID token verification failed (${code}): ${message}`,
          );
          throw new UnauthorizedException(
            'Firebase token verification failed. Please try again.',
          );
      }
    }
  }
}
