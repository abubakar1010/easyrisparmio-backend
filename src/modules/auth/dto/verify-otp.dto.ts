import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '../../../common/enums/user.enum';

export class VerifyOtpDto {
  @ApiProperty({ example: 'mario.rossi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;

  @ApiProperty({ enum: OtpType, example: OtpType.EMAIL_VERIFICATION })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;
}
