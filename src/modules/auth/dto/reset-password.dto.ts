import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address of the account to reset. Response does not reveal whether the email exists.',
    example: 'mario.rossi@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiPropertyOptional({
    description: 'Signed reset token received from verify-otp (preferred). If provided, email and code are not required.',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  @IsOptional()
  @IsString()
  resetToken?: string;

  @ApiPropertyOptional({
    description: 'Email address of the account to reset. Required if resetToken is not provided.',
    example: 'mario.rossi@email.com',
  })
  @ValidateIf((o) => !o.resetToken)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({
    description: '6-digit OTP code received from the forgot-password request. Required if resetToken is not provided.',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @ValidateIf((o) => !o.resetToken)
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code?: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'NewStrongP@ss1',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;
}
