import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({
    description: 'Firebase ID token obtained from the mobile app after social sign-in (Google, Facebook, or Apple)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20v...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;
}
