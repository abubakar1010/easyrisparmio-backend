import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../../../common/enums/user.enum';
import { NormalizeEmail } from '../../../common/transformers/normalize-email.transformer';

export class VerifyOtpDto {
  @ApiPropertyOptional({
    description:
      'Email address of the user. Required if verificationToken is not provided.',
    example: 'mario.rossi@email.com',
  })
  @ValidateIf((o) => !o.verificationToken)
  @NormalizeEmail()
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
    description: '6-digit OTP code received via email or SMS',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;

  @ApiProperty({
    description: 'Type of OTP verification',
    enum: OtpType,
    example: OtpType.EMAIL_VERIFICATION,
    enumName: 'OtpType',
  })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;
}
