import { IsUUID, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaseContractDetailsDto } from './case-contract-details.dto';

/**
 * The three addresses and the payment/invoicing details come from
 * {@link CaseContractDetailsDto}, which the admin's update DTO extends too —
 * the app and the CRM write them under one set of rules.
 */
export class CreateCaseDto extends CaseContractDetailsDto {
  @ApiProperty({ description: 'ID of the energy bill for this switch case', example: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  billId: string;

  @ApiProperty({ description: 'ID of the selected offer', example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  selectedOfferId: string;

  @ApiPropertyOptional({
    description:
      'Delivery point the customer confirmed on the request form (POD for electricity, PDR for gas). ' +
      'When it differs from the value OCR read, the bill is corrected with it.',
    example: 'IT001E12345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  podNumber?: string;
}
