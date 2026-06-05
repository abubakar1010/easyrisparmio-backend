import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillType } from '../../../common/enums/bill.enum';

export class UploadBillDto {
  @ApiProperty({ enum: BillType, description: 'Type of energy bill' })
  @IsEnum(BillType)
  billType: BillType;

  @ApiPropertyOptional({ description: 'POD number for electricity bills' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  podNumber?: string;

  @ApiPropertyOptional({ description: 'PDR number for gas bills' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pdrNumber?: string;
}
