import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserTarget } from '../../../common/enums/offer.enum';

export class QueryAgreementsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Filter by target audience' })
  @IsOptional()
  @IsEnum(UserTarget)
  targetAudience?: UserTarget;
}
