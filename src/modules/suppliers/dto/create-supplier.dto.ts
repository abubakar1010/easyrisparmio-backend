import {
  IsString,
  IsOptional,
  IsNumber,
  IsUrl,
  IsEmail,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
  Max,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus, Commodity } from '../../../common/enums/supplier.enum';
import { IsPhoneNumber } from '../../../common/validators/is-phone-number.validator';
import { IsItalianTaxId } from '../../../common/validators/is-italian-tax-id.validator';
import { IsItalianIban } from '../../../common/validators/is-italian-iban.validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier brand name', example: 'Enel Energia', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Brand name is required' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Legal entity name', example: 'Enel Energia S.p.A.', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Legal name is required' })
  @MaxLength(255)
  legalName: string;

  @ApiProperty({ description: 'Italian Tax ID — Codice Fiscale (16 chars) or Partita IVA (11 digits, optionally prefixed IT)', example: 'IT06655971007', maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Tax ID is required' })
  @MaxLength(50)
  @IsItalianTaxId()
  taxId: string;

  @ApiPropertyOptional({ description: 'URL or relative path of the supplier logo/icon', example: '/uploads/enel-energia.png', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Supplier description', example: 'Leading Italian energy supplier since 1962' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Supplier rating (0-5)', example: 4.5, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiProperty({ description: 'Supplier status', example: 'active', enum: SupplierStatus })
  @IsEnum(SupplierStatus, { message: 'Status must be one of: active, warning, inactive' })
  status: SupplierStatus;

  @ApiProperty({ description: 'Commodity type', example: 'electricity', enum: Commodity })
  @IsEnum(Commodity, { message: 'Commodity must be one of: electricity, gas, dual' })
  commodity: Commodity;

  @ApiProperty({ description: 'Primary contact name', example: 'Marco Bianchi', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Contact name is required' })
  @MaxLength(255)
  contactName: string;

  @ApiProperty({ description: 'Contact email', example: 'info@enelenergia.it', maxLength: 255 })
  @IsEmail({}, { message: 'Enter a valid email address' })
  @IsNotEmpty({ message: 'Contact email is required' })
  @MaxLength(255)
  contactEmail: string;

  @ApiProperty({ description: 'Contact phone number (international format)', example: '+39800900860', maxLength: 20 })
  @IsString()
  @IsNotEmpty({ message: 'Contact phone number is required' })
  @MaxLength(20)
  @IsPhoneNumber()
  contactPhone: string;

  @ApiPropertyOptional({ description: 'Website URL', example: 'https://www.enelenergia.it', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @ApiProperty({ description: 'Street address', example: 'Viale Regina Margherita 137', maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  @MaxLength(500)
  streetAddress: string;

  @ApiProperty({ description: 'City', example: 'Roma', maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ description: 'Province', example: 'Roma', maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'Province is required' })
  @MaxLength(100)
  province: string;

  @ApiProperty({ description: 'Italian ZIP / CAP code (5 digits)', example: '00198', maxLength: 5 })
  @IsString()
  @IsNotEmpty({ message: 'ZIP code is required' })
  @Matches(/^\d{5}$/, { message: 'ZIP code must be a valid 5-digit Italian CAP (e.g., 00198)' })
  zipCode: string;

  @ApiProperty({ description: 'Italian IBAN (27 characters, starts with IT)', example: 'IT60X0542811101000000123456', maxLength: 34 })
  @IsString()
  @IsNotEmpty({ message: 'IBAN is required' })
  @MaxLength(34)
  @IsItalianIban()
  iban: string;

  @ApiPropertyOptional({ description: 'Contract start date (ISO 8601)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ description: 'Admin notes', example: 'Primary energy partner. Volume bonus reviewed quarterly.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Unique supplier code', example: 'ENEL-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierCode?: string;

  @ApiPropertyOptional({
    description: 'Instructions shown to the user for signing this supplier\'s contract',
    example: 'Print the attached form, sign every page, then upload it back here.',
  })
  @IsOptional()
  @IsString()
  contractSigningInstructions?: string;

  @ApiPropertyOptional({
    description: 'URL or relative path of the contract signing guideline document',
    example: '/uploads/enel-signing-guide.pdf',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractSigningDocumentUrl?: string;

  @ApiPropertyOptional({
    description: 'Original display name of the contract signing guideline document',
    example: 'enel-signing-guide.pdf',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contractSigningDocumentName?: string;
}
