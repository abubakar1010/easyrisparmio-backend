import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/notification.enum';

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'FCM registration token for the device' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @ApiProperty({
    enum: Platform,
    description: 'Device platform. "web" is the admin dashboard.',
  })
  @IsEnum(Platform)
  platform: Platform;
}
