import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '../../../common/enums/user.enum';

export class ResendOtpDto {
  @ApiProperty({
    description: 'Email address of the user requesting a new OTP',
    example: 'mario.rossi@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

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
