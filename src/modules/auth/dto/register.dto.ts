import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address (must be unique)',
    example: 'mario.rossi@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'StrongP@ss1',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'Mario',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Rossi',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+393331234567',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({
    description: 'User role (admin is not allowed for registration)',
    enum: [UserRole.PERSONAL, UserRole.BUSINESS],
    example: UserRole.PERSONAL,
  })
  @IsEnum([UserRole.PERSONAL, UserRole.BUSINESS], {
    message: 'Role must be personal or business',
  })
  @IsNotEmpty()
  role: UserRole.PERSONAL | UserRole.BUSINESS;

  @ApiPropertyOptional({
    description: 'Referral code from an existing user (optional)',
    example: 'AB3KX7WN',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}

export class RegisterBusinessDto extends RegisterDto {
  @ApiProperty({
    description: 'Company legal name',
    example: 'Rossi S.r.l.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({
    description: 'Partita IVA (Italian VAT number, exactly 11 digits)',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'Partita IVA must be exactly 11 digits' })
  partitaIva: string;

  @ApiPropertyOptional({
    description: 'PEC certified email address',
    example: 'rossi@pec.it',
  })
  @IsOptional()
  @IsEmail()
  pecEmail?: string;

  @ApiPropertyOptional({
    description: 'Name of the legal representative',
    example: 'Mario Rossi',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalRepresentative?: string;

  @ApiPropertyOptional({
    description: 'Company type (e.g. S.r.l., S.p.A., etc.)',
    example: 'S.r.l.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @ApiPropertyOptional({
    description: 'ATECO economic activity code',
    example: '35.11.00',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  atecoCode?: string;
}
