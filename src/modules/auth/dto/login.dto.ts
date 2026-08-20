import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/transformers/normalize-email.transformer';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'mario.rossi@email.com',
  })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'StrongP@ss1',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
