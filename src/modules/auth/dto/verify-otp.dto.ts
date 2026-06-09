import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '../../../common/enums/user.enum';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address of the user verifying the OTP',
    example: 'mario.rossi@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: '6-digit OTP code received via email or SMS',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
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
