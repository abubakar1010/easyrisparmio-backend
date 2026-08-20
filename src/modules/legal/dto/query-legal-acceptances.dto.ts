import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryLegalAcceptancesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by document slug', example: 'terms-conditions' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slug?: string;

  @ApiPropertyOptional({ description: 'Filter by accepted version', example: '2.1' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;

  @ApiPropertyOptional({ description: 'Filter by user' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
