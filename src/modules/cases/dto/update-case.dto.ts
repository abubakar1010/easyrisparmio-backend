import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  IsInt,
  Min,
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
 * workflow state, assignment, notes, the commercial figures, the SLA and the
 * contract dates.
 *
 * `caseNumber` is deliberately absent: it is generated per day from a sequence
 * and carries a unique index, so an admin retyping one could only collide with
 * a case that already holds it.
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

  /**
   * The admin handling the case. `null` unassigns it — a case whose handler has
   * left is better shown as unassigned than as belonging to nobody reachable.
   * The id is checked against the admin roster before it is written.
   */
  @ApiPropertyOptional({ description: 'Admin agent UUID to assign, or null to unassign', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string | null;

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

  /**
   * The supplier the customer is leaving. Read off the bill when the case is
   * opened, and correctable here because OCR names a brand where the contract
   * names a company — and the switch is filed against the company.
   */
  @ApiPropertyOptional({ description: 'Supplier the customer is switching away from, or null when it is not known', example: 's1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  fromSupplierId?: string | null;

  @ApiPropertyOptional({ description: 'Notes visible to the customer', example: 'Your documents have been received and are under review.' })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Internal notes visible to admin/agents only', example: 'Verified POD via supplier portal on 2026-06-10' })
  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  // ── Commercial ──

  /**
   * What the switch is worth over a year. Quoted to the customer from the
   * offer, but booked on the case, because the figure the commission is
   * eventually reconciled against is the one agreed at the time — not whatever
   * the offer says months later.
   */
  @ApiPropertyOptional({ description: 'Estimated annual value of the switch, in euro', example: 1140.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedAnnualValue?: number | null;

  // ── SLA ──
  // Nothing derives these; they are the target an admin sets on the case and
  // the board then reports against, so both are editable and both may be blank.

  @ApiPropertyOptional({ description: 'Days the case is allowed to take end to end', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  slaDaysTotal?: number | null;

  @ApiPropertyOptional({ description: 'When the case falls out of SLA', example: '2026-07-15T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  slaDeadline?: string | null;

  // ── Contract dates ──
  // Set as the case moves through activation and editable afterwards — the
  // supplier does move these around, and the CRM has to be able to follow.

  /**
   * When the contract was handed over for signing. Stamped automatically the
   * first time the bill reaches "contract sent"; correctable here, because the
   * hand-over often happened before anyone got round to moving the case.
   */
  @ApiPropertyOptional({ description: 'When the contract was sent for signing', example: '2026-06-01T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractSentAt?: string | null;

  @ApiPropertyOptional({ description: 'When the new supply goes live', example: '2026-03-12' })
  @IsOptional()
  @IsDateString()
  activationDate?: string | null;

  @ApiPropertyOptional({ description: 'When the new supply contract expires', example: '2028-03-12' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;
}

/**
 * The CRM-only fields, as they are stored on the case — the ones no address or
 * contract writer owns and that therefore need their own audit line.
 *
 * `status` is not among them: a transition already writes its own timeline
 * entry, and listing it here would double every status change.
 */
export const CASE_HANDLING_FIELDS = [
  'caseType',
  'priority',
  'estimatedAnnualValue',
  'slaDaysTotal',
  'slaDeadline',
  'contractSentAt',
  'activationDate',
  'expiryDate',
] as const;

export type CaseHandlingField = (typeof CASE_HANDLING_FIELDS)[number];

/** How each field is named to a human — on the case timeline, for instance. */
export const CASE_HANDLING_LABELS: Record<CaseHandlingField, string> = {
  caseType: 'Case type',
  priority: 'Priority',
  estimatedAnnualValue: 'Estimated annual value',
  slaDaysTotal: 'SLA days',
  slaDeadline: 'SLA deadline',
  contractSentAt: 'Contract sent on',
  activationDate: 'Activation date',
  expiryDate: 'Expiry date',
};
