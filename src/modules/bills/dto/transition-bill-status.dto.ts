import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
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
    description: 'Message for the verification_required transition',
    example: 'The bill is hard to read. Please upload a clearer copy.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description:
      'When the new supply goes live. Required when moving to awaiting_activation.',
    example: '2026-03-12',
  })
  @IsDateString()
  @IsOptional()
  activationDate?: string;

  @ApiPropertyOptional({
    description:
      'When the new supply contract expires. Required when moving to awaiting_activation, and must be after the activation date.',
    example: '2028-03-12',
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
