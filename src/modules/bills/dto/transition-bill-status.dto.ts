import { IsEnum, IsString, IsArray, IsOptional } from 'class-validator';
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
    example: 'The bill is hard to read. Please upload a clearer copy.',
  })
  @IsString()
  @IsOptional()
  message?: string;
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

  @ApiPropertyOptional({
    description: 'IDs of uploaded files to associate with this verification',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];
}
