import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryActivityLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by entity type (e.g. user, bill, contract, case, offer, supplier)' })
  @IsOptional()
  @IsString()
  entityType?: string;
}
