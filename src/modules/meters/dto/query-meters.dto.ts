import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UtilityType, MeterStatus } from '../../../common/enums/utility.enum';

export class QueryMetersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UtilityType, description: 'Filter by utility type' })
  @IsOptional()
  @IsEnum(UtilityType)
  utilityType?: UtilityType;

  @ApiPropertyOptional({ enum: MeterStatus, description: 'Filter by meter status' })
  @IsOptional()
  @IsEnum(MeterStatus)
  status?: MeterStatus;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
