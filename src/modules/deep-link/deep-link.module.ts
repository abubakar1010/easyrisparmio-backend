import { Module } from '@nestjs/common';
import { DeepLinkController } from './deep-link.controller';
import { DeepLinkService } from './deep-link.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [DeepLinkController],
  providers: [DeepLinkService],
})
export class DeepLinkModule {}
