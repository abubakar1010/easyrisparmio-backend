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

  @ApiProperty({ enum: [UserRole.PERSONAL, UserRole.BUSINESS], example: UserRole.PERSONAL })
  @IsEnum([UserRole.PERSONAL, UserRole.BUSINESS], {
    message: 'Role must be personal or business',
  })
  @IsNotEmpty()
  role: UserRole.PERSONAL | UserRole.BUSINESS;
}

export class RegisterBusinessDto extends RegisterDto {
  @ApiProperty({ example: 'Rossi S.r.l.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ example: '12345678901', description: 'Partita IVA (11 digits)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'Partita IVA must be exactly 11 digits' })
  partitaIva: string;

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

  @ApiPropertyOptional({ example: '35.11.00', description: 'ATECO activity code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  atecoCode?: string;
}
