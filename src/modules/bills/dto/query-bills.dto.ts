import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { BillType, BillStatus } from '../../../common/enums/bill.enum';
import { CaseStatus } from '../../../common/enums/case.enum';

export class QueryBillsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BillType, description: 'Filter by bill type', example: 'electricity' })
  @IsOptional()
  @IsEnum(BillType)
  billType?: BillType;

  @ApiPropertyOptional({ enum: BillStatus, description: 'Filter by bill status', example: 'analyzed' })
  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @ApiPropertyOptional({ enum: CaseStatus, description: 'Filter by case status', example: 'in_progress' })
  @IsOptional()
  @IsEnum(CaseStatus)
  caseStatus?: CaseStatus;

  @ApiPropertyOptional({ description: 'Filter bills from this date (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter bills until this date (ISO 8601)', example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
