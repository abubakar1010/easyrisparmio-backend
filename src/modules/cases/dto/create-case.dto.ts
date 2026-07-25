import { IsUUID, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCaseDto {
  @ApiProperty({ description: 'ID of the energy bill for this switch case', example: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  billId: string;

  @ApiProperty({ description: 'ID of the selected offer', example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  selectedOfferId: string;

  @ApiPropertyOptional({ description: 'Residential street address (when different from delivery)', example: 'Via Roma 10' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialStreet?: string;

  @ApiPropertyOptional({ description: 'Residential city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialCity?: string;

  @ApiPropertyOptional({ description: 'Residential ZIP code', example: '20100' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  residentialZip?: string;

  @ApiPropertyOptional({ description: 'Residential province', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialProvince?: string;
}
