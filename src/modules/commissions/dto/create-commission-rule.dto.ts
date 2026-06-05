import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnergyType } from '../../../common/enums/offer.enum';

export class CreateCommissionRuleDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsNotEmpty()
  @IsUUID()
  supplierId: string;

  @ApiProperty({ enum: EnergyType, description: 'Energy type' })
  @IsNotEmpty()
  @IsEnum(EnergyType)
  energyType: EnergyType;

  @ApiProperty({ description: 'Commission amount in EUR' })
  @IsNotEmpty()
  @IsNumber()
  commissionAmount: number;

  @ApiPropertyOptional({ description: 'Commission percentage (alternative to fixed amount)' })
  @IsOptional()
  @IsNumber()
  commissionPercentage?: number;

  @ApiPropertyOptional({ description: 'Whether the rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
