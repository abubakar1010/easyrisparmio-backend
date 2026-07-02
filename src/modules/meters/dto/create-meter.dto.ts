import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UtilityType } from '../../../common/enums/utility.enum';

export class CreateMeterDto {
  @ApiProperty({ enum: UtilityType, description: 'Type of utility service', example: UtilityType.ELECTRICITY })
  @IsEnum(UtilityType)
  @IsNotEmpty()
  utilityType: UtilityType;

  @ApiProperty({ description: 'Service type display name', example: 'Electricity', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Service type description', example: 'Residential and business electricity supply' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether this service type is currently offered (defaults to true)', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
