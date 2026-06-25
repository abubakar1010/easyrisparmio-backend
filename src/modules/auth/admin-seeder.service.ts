import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus, AuthProvider } from '../../common/enums/user.enum';

@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SKIP_AUTO_SEED === 'true') {
      this.logger.log('Skipping auto admin seed (SKIP_AUTO_SEED)');
      return;
    }
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.logger.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin seed.',
      );
      return;
    }

    const existingAdmin = await this.usersService.findByEmail(adminEmail);
    if (existingAdmin) {
      this.logger.log('Admin user already exists. Skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await this.usersService.create({
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'EasyRisparmio',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      authProvider: AuthProvider.LOCAL,
    });

    this.logger.log(`Admin user seeded: ${adminEmail}`);
  }
}
