import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';

export class QueryCasesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CaseStatus, description: 'Filter by case status', example: 'in_progress' })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ enum: CasePriority, description: 'Filter by priority', example: 'high' })
  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'Filter by user (customer) ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
