import {
  IsString,
  IsOptional,
  IsNumber,
  IsUrl,
  IsEmail,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier name', example: 'Enel Energia', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

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

  @ApiPropertyOptional({ description: 'Contact email', example: 'info@enelenergia.it', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+39023456789', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Website URL', example: 'https://www.enelenergia.it', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'Unique supplier code', example: 'ENEL-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierCode?: string;
}
