import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';

/** The two roles a person can pick for themselves on the sign-up screen. */
export enum SocialSignupRole {
  PERSONAL = UserRole.PERSONAL,
  BUSINESS = UserRole.BUSINESS,
}

export class SocialLoginDto {
  @ApiProperty({
    description: 'Firebase ID token obtained from the mobile app after social sign-in (Google, Facebook, or Apple)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20v...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;

  @ApiPropertyOptional({
    description:
      'Account type to create, sent by the sign-up screen when the user picked ' +
      '"business" before tapping a social provider. Applied only when this call ' +
      'creates the account — it is ignored for an account that already exists, so ' +
      'it can never change the role of an existing user. Defaults to `personal`. ' +
      'A business account created this way has no company profile yet; the app ' +
      'collects the company name and Partita IVA on the personal-data screen.',
    enum: SocialSignupRole,
    example: SocialSignupRole.BUSINESS,
  })
  @IsOptional()
  @IsEnum(SocialSignupRole)
  role?: SocialSignupRole;

  @ApiPropertyOptional({
    description:
      'Whether this call may create an account when no account matches the ' +
      'social profile. Defaults to `true`, which is what the sign-up screen ' +
      'wants. The *sign-in* screen sends `false`: it has no account type to ' +
      'ask for, and the account type is chosen at sign-up and never changes, ' +
      'so an account created there would be stuck on the `personal` default ' +
      'forever. With `false` and no matching account the call fails with 404 ' +
      'and the app sends the user to sign up, where the question is asked.',
    example: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allowSignUp?: boolean;
}
