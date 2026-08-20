import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/transformers/to-boolean.transformer';

export class QueryTopicsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
