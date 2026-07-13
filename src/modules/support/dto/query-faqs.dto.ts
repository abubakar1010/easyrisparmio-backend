import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserTarget } from '../../../common/enums/offer.enum';

export class QueryFaqsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by FAQ category', example: 'billing' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Filter by target audience' })
  @IsOptional()
  @IsEnum(UserTarget)
  targetAudience?: UserTarget;

  @ApiPropertyOptional({ description: 'Filter by locale', example: 'it' })
  @IsOptional()
  @IsString()
  locale?: string;
}
