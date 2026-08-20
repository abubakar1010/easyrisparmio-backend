import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/transformers/to-boolean.transformer';

export class QueryStaticPagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by slug', example: 'privacy-policy' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Filter by locale', example: 'it' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
