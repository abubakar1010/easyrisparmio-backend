import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';
import { CaseType } from '../../../common/enums/case-type.enum';
import { CaseContractDetailsDto } from './case-contract-details.dto';

/**
 * Everything on a case an admin can correct.
 *
 * Extends {@link CaseContractDetailsDto} so the supply, residence and shipping
 * addresses and the payment and invoicing details the customer submitted are
 * editable field by field, under exactly the validation the app was held to
 * when it created them — and adds the fields only the CRM ever writes:
 * workflow state, assignment, notes and the activation dates.
 */
export class UpdateCaseDto extends CaseContractDetailsDto {
  @ApiPropertyOptional({ enum: CaseStatus, description: 'Case status', example: CaseStatus.IN_PROGRESS })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ enum: CaseType, description: 'What kind of case this is', example: CaseType.SWITCH })
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @ApiPropertyOptional({ description: 'Admin agent UUID to assign', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ enum: CasePriority, description: 'Case priority', example: CasePriority.HIGH })
  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  /**
   * Correcting the offer moves the destination supplier with it — the two are
   * one decision, and a case pointing at an offer from a supplier it is not
   * switching to would be filed against the wrong company.
   */
  @ApiPropertyOptional({ description: 'Offer the customer is switching to', example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  selectedOfferId?: string;

  @ApiPropertyOptional({ description: 'Notes visible to the customer', example: 'Your documents have been received and are under review.' })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Internal notes visible to admin/agents only', example: 'Verified POD via supplier portal on 2026-06-10' })
  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  // Both dates are set when the case moves to "In Attivazione" and stay
  // editable afterwards — the supplier does move activation dates around.

  @ApiPropertyOptional({ description: 'When the new supply goes live', example: '2026-03-12' })
  @IsOptional()
  @IsDateString()
  activationDate?: string;

  @ApiPropertyOptional({ description: 'When the new supply contract expires', example: '2028-03-12' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
