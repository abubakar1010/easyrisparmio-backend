import { IsEmail, IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../../../common/enums/user.enum';

export class ResendOtpDto {
  @ApiPropertyOptional({
    description:
      'Email address of the user. Required if verificationToken is not provided.',
    example: 'mario.rossi@email.com',
  })
  @ValidateIf((o) => !o.verificationToken)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Signed token received from register or login (403) response. Use this instead of email.',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  verificationToken?: string;

  @ApiProperty({
    description: 'Type of OTP to resend',
    enum: [OtpType.EMAIL_VERIFICATION, OtpType.PASSWORD_RESET],
    example: OtpType.EMAIL_VERIFICATION,
    enumName: 'OtpType',
  })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;
}
