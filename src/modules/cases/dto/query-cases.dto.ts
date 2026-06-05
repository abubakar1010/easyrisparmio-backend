import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';

export class QueryCasesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CaseStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ enum: CasePriority, description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'Filter by user (customer) ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
