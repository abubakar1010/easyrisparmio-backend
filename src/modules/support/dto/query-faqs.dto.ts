import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserTarget } from '../../../common/enums/offer.enum';
import { FaqCategory } from '../../../common/enums/support.enum';

export class QueryFaqsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: FaqCategory,
    description:
      'Filter by FAQ category. Not restricted to the enum — rows created before a category ' +
      'was retired must stay filterable so an admin can find and re-file them.',
  })
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
