import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: App | null = null;

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

    if (!getApps().length) {
      this.firebaseApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log('Firebase Admin SDK initialized');
    } else {
      this.firebaseApp = getApps()[0];
    }
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new BadRequestException(
        'Firebase is not configured. Social login is unavailable.',
      );
    }
    try {
      return await getAuth(this.firebaseApp).verifyIdToken(idToken);
    } catch (error) {
      const code = (error as any)?.code;
      if (code === 'auth/id-token-expired') {
        throw new BadRequestException(
          'Firebase ID token has expired. Please try again.',
        );
      }
      throw new BadRequestException(
        'Firebase token verification failed. Please try again.',
      );
    }
  }
}
