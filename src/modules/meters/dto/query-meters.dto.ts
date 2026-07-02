import { IsOptional, IsEnum, IsBooleanString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UtilityType } from '../../../common/enums/utility.enum';

export class QueryMetersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UtilityType, description: 'Filter by utility type' })
  @IsOptional()
  @IsEnum(UtilityType)
  utilityType?: UtilityType;

  @ApiPropertyOptional({ description: 'Filter by active status (true/false)' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
