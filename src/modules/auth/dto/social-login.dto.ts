import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({ description: 'Firebase ID token from the mobile app' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
