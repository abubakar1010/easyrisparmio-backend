import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload for the self-service account upgrade a personal user performs from
 * the mobile profile screen. Only the company details are asked for — the
 * personal fields are already on the account.
 */
export class UpgradeToBusinessDto {
  @ApiProperty({
    description: 'Company legal name',
    example: 'Rossi S.r.l.',
    minLength: 2,
    maxLength: 255,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  companyName: string;

  @ApiProperty({
    description:
      'Partita IVA — Italian VAT number, exactly 11 digits. Must not already ' +
      'belong to another account.',
    example: '12345678901',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s/g, '').replace(/^IT/i, '') : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'Partita IVA must be exactly 11 digits' })
  partitaIva: string;

  @ApiPropertyOptional({
    description: 'Position the account holder holds in the company',
    example: 'CEO / Founder',
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobRole?: string;

  @ApiProperty({
    description:
      'Acceptance of the business terms and of data processing for corporate ' +
      'account management. Must be true.',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'The business terms must be accepted' })
  acceptedTerms: boolean;
}
