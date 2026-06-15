import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';

export class UpdateCaseDto {
  @ApiPropertyOptional({ enum: CaseStatus, description: 'Case status', example: CaseStatus.IN_PROGRESS })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ description: 'Admin agent UUID to assign', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ enum: CasePriority, description: 'Case priority', example: CasePriority.HIGH })
  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @ApiPropertyOptional({ description: 'Notes visible to the customer', example: 'Your documents have been received and are under review.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes visible to admin/agents only', example: 'Verified POD via supplier portal on 2026-06-10' })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
