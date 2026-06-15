import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillType } from '../../../common/enums/bill.enum';

export class UploadBillDto {
  @ApiProperty({ enum: BillType, description: 'Type of energy bill', example: BillType.ELECTRICITY })
  @IsEnum(BillType)
  billType: BillType;

  @ApiPropertyOptional({ description: 'POD number for electricity bills', example: 'IT001E12345678', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  podNumber?: string;

  @ApiPropertyOptional({ description: 'PDR number for gas bills', example: 'GS002C87654321', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pdrNumber?: string;
}
