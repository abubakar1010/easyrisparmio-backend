import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
      throw new Error('Firebase is not configured');
    }
    return getAuth(this.firebaseApp).verifyIdToken(idToken);
  }
}
