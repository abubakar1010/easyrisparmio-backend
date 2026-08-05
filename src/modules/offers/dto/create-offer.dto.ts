import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
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

  @ApiPropertyOptional({ description: 'Spread markup on market index for variable/indexed offers', example: 0.012 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  spread?: number;

  @ApiProperty({ description: 'Fixed monthly fee', example: 9.9, default: 0 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  fixedMonthlyFee: number;

  @ApiProperty({ description: 'One-time activation cost', example: 0, default: 0 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  activationCost: number;

  @ApiProperty({ description: 'Contract duration in days', example: 365 })
  @IsInt()
  @Min(1)
  contractDurationDays: number;

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

  @ApiPropertyOptional({ description: 'URL or path to terms and conditions document (uploaded via /upload endpoint)', example: '/uploads/3f8a9b2c-d4e5-6f78-90ab-cdef12345678.pdf', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  termsUrl?: string;

  @ApiPropertyOptional({ description: 'URL to economic conditions document (uploaded via /upload endpoint)', example: '/uploads/3f8a9b2c-d4e5-6f78-90ab-cdef12345678.pdf', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  economicConditionsUrl?: string;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Target user type', example: UserTarget.PERSONAL, default: UserTarget.BOTH })
  @IsOptional()
  @IsEnum(UserTarget)
  target?: UserTarget;

  @ApiPropertyOptional({ description: 'Highlight bullet points', example: ['Fixed price for 12 months', 'No activation fee', '100% green energy'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({
    description: 'Translated offer names by locale',
    example: { it: 'Casa Luce Fix 12', en: 'Home Light Fix 12' },
  })
  @IsOptional()
  nameI18n?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Translated offer descriptions by locale',
    example: { it: 'Piano luce a prezzo fisso', en: 'Fixed-price electricity plan' },
  })
  @IsOptional()
  descriptionI18n?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Translated highlight bullet points by locale',
    example: { it: ['Prezzo fisso 12 mesi'], en: ['Fixed price 12 months'] },
  })
  @IsOptional()
  highlightsI18n?: Record<string, string[]>;

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
