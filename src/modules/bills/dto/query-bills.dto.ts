import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { BillType, BillStatus } from '../../../common/enums/bill.enum';

export class QueryBillsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BillType, description: 'Filter by bill type' })
  @IsOptional()
  @IsEnum(BillType)
  billType?: BillType;

  @ApiPropertyOptional({ enum: BillStatus, description: 'Filter by bill status' })
  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @ApiPropertyOptional({ description: 'Filter bills from this date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter bills until this date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
