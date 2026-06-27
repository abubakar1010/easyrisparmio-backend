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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus, Commodity } from '../../../common/enums/supplier.enum';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier brand name', example: 'Enel Energia', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Legal entity name', example: 'Enel Energia S.p.A.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional({ description: 'Tax ID / Codice Fiscale / Partita IVA', example: 'IT06655971007', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ description: 'URL of the supplier logo', example: 'https://cdn.easyresparmio.it/logos/enel-energia.png', maxLength: 500 })
  @IsOptional()
  @IsUrl()
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

  @ApiPropertyOptional({ description: 'Supplier status', example: 'active', enum: SupplierStatus, default: SupplierStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({ description: 'Commodity type', example: 'electricity', enum: Commodity })
  @IsOptional()
  @IsEnum(Commodity)
  commodity?: Commodity;

  @ApiPropertyOptional({ description: 'Primary contact name', example: 'Marco Bianchi', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional({ description: 'Contact email', example: 'info@enelenergia.it', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+39 800 900 860', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Website URL', example: 'https://www.enelenergia.it', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'Street address', example: 'Viale Regina Margherita 137', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  streetAddress?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Roma', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'ZIP / Postal code', example: '00198', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'Italy', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'IBAN for billing', example: 'IT60X0542811101000000123456', maxLength: 34 })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @ApiPropertyOptional({ description: 'Commission per electricity contract (EUR)', example: 45.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionElectricity?: number;

  @ApiPropertyOptional({ description: 'Commission per gas contract (EUR)', example: 38.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionGas?: number;

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
}
