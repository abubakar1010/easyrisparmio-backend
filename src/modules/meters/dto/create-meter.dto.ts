import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UtilityType, MeterStatus } from '../../../common/enums/utility.enum';

export class CreateMeterDto {
  @ApiProperty({ description: 'User who owns this meter', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: UtilityType, description: 'Type of utility', example: UtilityType.ELECTRICITY })
  @IsEnum(UtilityType)
  @IsNotEmpty()
  utilityType: UtilityType;

  @ApiProperty({ description: 'Meter code (POD for electricity, PDR for gas)', example: 'IT001E556779', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  meterCode: string;

  @ApiPropertyOptional({ description: 'Supplier ID', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: MeterStatus, description: 'Meter status (defaults to active)', example: MeterStatus.ACTIVE })
  @IsOptional()
  @IsEnum(MeterStatus)
  status?: MeterStatus;

  @ApiPropertyOptional({ description: 'Annual consumption', example: 12500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  annualConsumption?: number;

  @ApiPropertyOptional({ description: 'Unit of consumption (kWh, Smc, Liters, GB)', example: 'kWh', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  consumptionUnit?: string;

  @ApiPropertyOptional({ description: 'Contracted power in kW (electricity only)', example: 3.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  contractedPowerKw?: number;

  @ApiPropertyOptional({ description: 'Address ID where meter is located', example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ description: 'Meter activation date (ISO 8601)', example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  activationDate?: string;

  @ApiPropertyOptional({ description: 'Admin notes', example: 'Verified via supplier portal' })
  @IsOptional()
  @IsString()
  notes?: string;
}
