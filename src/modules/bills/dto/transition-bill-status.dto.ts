import {
  IsEnum,
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillStatus } from '../../../common/enums/bill.enum';

export class TransitionBillStatusDto {
  @ApiProperty({
    description: 'Target bill status to transition to',
    enum: BillStatus,
    example: BillStatus.VERIFIED,
  })
  @IsEnum(BillStatus)
  targetStatus: BillStatus;

  @ApiPropertyOptional({
    description: 'Message for verification_required or contract_verification_required transitions',
    example: 'The POD number is missing from the bill. Please provide it.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'List of bill field names that need to be completed (for verification_required)',
    example: ['podNumber', 'totalAmount'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  missingFields?: string[];

  @ApiPropertyOptional({
    description: 'Whether the user needs to re-upload the bill document (for verification_required)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requireReupload?: boolean;
}

export class SubmitContractVerificationDto {
  @ApiPropertyOptional({
    description: 'Message from user about the contract resubmission',
    example: 'I have corrected the signature and re-uploaded the contract.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'URL of the re-uploaded signed contract document',
  })
  @IsString()
  @IsOptional()
  signedDocumentUrl?: string;
}
