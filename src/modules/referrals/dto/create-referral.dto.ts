import { IsOptional, IsEmail, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsPhoneNumber } from '../../../common/validators/is-phone-number.validator';

export class CreateReferralDto {
  @ApiPropertyOptional({
    description: 'Email address of the person being invited',
    example: 'friend@email.com',
  })
  @IsOptional()
  @IsEmail()
  referredEmail?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the person being invited',
    example: '+393339876543',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsPhoneNumber()
  referredPhone?: string;
}
