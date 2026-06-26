import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address (must be unique)',
    example: 'mario.rossi@email.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'User password (min 8 chars, must include uppercase, lowercase, number, and special character)',
    example: 'StrongP@ss1',
    minLength: 8,
    required: true,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  @Matches(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one special character',
  })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'Mario',
    maxLength: 100,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Rossi',
    maxLength: 100,
    required: true,
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
    required: true,
  })
  @IsEnum([UserRole.PERSONAL, UserRole.BUSINESS], {
    message: 'Role must be personal or business',
  })
  @IsNotEmpty()
  role: UserRole.PERSONAL | UserRole.BUSINESS;

  @ApiPropertyOptional({
    description: 'Referral code from an existing user',
    example: 'AB3KX7WN',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  // ─── Business fields (required only when role is "business") ───

  @ApiPropertyOptional({
    description:
      'Company legal name — *required* when `role` is `business`',
    example: 'Rossi S.r.l.',
    maxLength: 255,
  })
  @ValidateIf((o) => o.role === UserRole.BUSINESS)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({
    description:
      'Partita IVA — Italian VAT number, exactly 11 digits — *required* when `role` is `business`',
    example: '12345678901',
  })
  @ValidateIf((o) => o.role === UserRole.BUSINESS)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'Partita IVA must be exactly 11 digits' })
  partitaIva?: string;

  @ApiPropertyOptional({
    description: 'PEC certified email address (business only)',
    example: 'rossi@pec.it',
  })
  @IsOptional()
  @IsEmail()
  pecEmail?: string;

  @ApiPropertyOptional({
    description: 'Name of the legal representative (business only)',
    example: 'Mario Rossi',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalRepresentative?: string;

  @ApiPropertyOptional({
    description: 'Company type, e.g. S.r.l., S.p.A. (business only)',
    example: 'S.r.l.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @ApiPropertyOptional({
    description: 'ATECO economic activity code (business only)',
    example: '35.11.00',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  atecoCode?: string;
}
