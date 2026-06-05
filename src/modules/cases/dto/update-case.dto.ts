import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';

export class UpdateCaseDto {
  @ApiPropertyOptional({ enum: CaseStatus, description: 'Case status' })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ description: 'Assigned agent ID' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ enum: CasePriority, description: 'Case priority' })
  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @ApiPropertyOptional({ description: 'Notes visible to the customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes visible to admin/agents only' })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
