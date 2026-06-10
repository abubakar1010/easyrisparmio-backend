import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsUrl,
  IsArray,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnergyType, MarketType, UserTarget } from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';

export class CreateOfferDto {
  @ApiProperty({ description: 'Offer name', example: 'Casa Luce Fix 12', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Offer description', example: 'Fixed-price electricity plan for residential customers with 12-month lock-in' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: EnergyType, description: 'Energy type', example: EnergyType.ELECTRICITY })
  @IsEnum(EnergyType)
  energyType: EnergyType;

  @ApiProperty({ enum: MarketType, description: 'Market pricing model', example: MarketType.FIXED })
  @IsEnum(MarketType)
  marketType: MarketType;

  @ApiPropertyOptional({ description: 'Price per kWh for electricity', example: 0.085 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  pricePerKwh?: number;

  @ApiPropertyOptional({ description: 'Price per standard cubic meter for gas', example: 0.45 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  pricePerSmc?: number;

  @ApiProperty({ description: 'Fixed monthly fee', example: 9.9, default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedMonthlyFee: number;

  @ApiProperty({ description: 'One-time activation cost', example: 0, default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  activationCost: number;

  @ApiProperty({ description: 'Contract duration in months', example: 12 })
  @IsInt()
  @Min(1)
  contractDurationMonths: number;

  @ApiPropertyOptional({ description: 'Whether the energy is from green sources', example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isGreenEnergy?: boolean;

  @ApiProperty({ description: 'Start date of offer validity (ISO 8601)', example: '2026-01-01' })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ description: 'End date of offer validity (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'URL to terms and conditions', example: 'https://www.enelenergia.it/terms/casa-luce-fix', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  termsUrl?: string;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Target user type', example: UserTarget.PERSONAL, default: UserTarget.BOTH })
  @IsOptional()
  @IsEnum(UserTarget)
  target?: UserTarget;

  @ApiPropertyOptional({ description: 'Highlight bullet points', example: ['Fixed price for 12 months', 'No activation fee', '100% green energy'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiProperty({ description: 'Supplier UUID', example: 's1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Unique offer code for tracking', example: 'CLF-12-2026', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  offerCode?: string;

  @ApiPropertyOptional({ enum: OfferStatus, description: 'Offer status (defaults to draft)', example: OfferStatus.DRAFT, default: OfferStatus.DRAFT })
  @IsOptional()
  @IsEnum(OfferStatus)
  offerStatus?: OfferStatus;
}
