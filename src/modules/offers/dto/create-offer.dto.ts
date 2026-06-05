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

export class CreateOfferDto {
  @ApiProperty({ description: 'Offer name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Offer description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: EnergyType, description: 'Energy type' })
  @IsEnum(EnergyType)
  energyType: EnergyType;

  @ApiProperty({ enum: MarketType, description: 'Market type' })
  @IsEnum(MarketType)
  marketType: MarketType;

  @ApiPropertyOptional({ description: 'Price per kWh for electricity' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  pricePerKwh?: number;

  @ApiPropertyOptional({ description: 'Price per standard cubic meter for gas' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  pricePerSmc?: number;

  @ApiProperty({ description: 'Fixed monthly fee', default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedMonthlyFee: number;

  @ApiProperty({ description: 'One-time activation cost', default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  activationCost: number;

  @ApiProperty({ description: 'Contract duration in months' })
  @IsInt()
  @Min(1)
  contractDurationMonths: number;

  @ApiPropertyOptional({ description: 'Whether the energy is from green sources', default: false })
  @IsOptional()
  @IsBoolean()
  isGreenEnergy?: boolean;

  @ApiProperty({ description: 'Start date of offer validity' })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ description: 'End date of offer validity' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'URL to terms and conditions' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  termsUrl?: string;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Target user type', default: UserTarget.BOTH })
  @IsOptional()
  @IsEnum(UserTarget)
  target?: UserTarget;

  @ApiPropertyOptional({ description: 'Highlight bullet points', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  supplierId: string;
}
