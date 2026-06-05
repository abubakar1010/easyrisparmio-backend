import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'mario.rossi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongP@ss1', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Mario' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Rossi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: '+393331234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PERSONAL })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'RSSMRA85M01H501Z', description: 'Codice Fiscale (16 chars)' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i, {
    message: 'Invalid Codice Fiscale format',
  })
  codiceFiscale?: string;

  @ApiPropertyOptional({ example: 'Rossi S.r.l.', description: 'Required for business users' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ example: '12345678901', description: 'Partita IVA (11 digits)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'Partita IVA must be exactly 11 digits' })
  partitaIva?: string;

  @ApiPropertyOptional({ example: 'rossi@pec.it' })
  @IsOptional()
  @IsEmail()
  pecEmail?: string;

  @ApiPropertyOptional({ example: 'Mario Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalRepresentative?: string;

  @ApiPropertyOptional({ example: 'S.r.l.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @ApiPropertyOptional({ example: '35.11.00' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  atecoCode?: string;
}
