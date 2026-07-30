import { IsDateString, IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarketIndexDto {
  @ApiProperty({ example: 'PUN', description: 'Market index name (e.g. PUN, PSV, GME)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  indexName: string;

  @ApiProperty({ example: 0.1245, description: 'Index value' })
  @IsNumber()
  @IsNotEmpty()
  value: number;

  @ApiProperty({ example: 'EUR/kWh', description: 'Unit of measurement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit: string;

  @ApiProperty({ example: '2026-06-24', description: 'Date of the index value (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
