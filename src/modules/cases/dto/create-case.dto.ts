import { IsUUID, IsNotEmpty, IsOptional, IsString, IsEnum, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';
import { CaseAddressesDto } from './case-addresses.dto';

/**
 * The three addresses come from {@link CaseAddressesDto}, which the admin's
 * update DTO extends too — the app and the CRM write them under one set of
 * rules.
 */
export class CreateCaseDto extends CaseAddressesDto {
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

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Payment method for this switch', example: PaymentMethod.RID_BANCARIO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: InvoiceDelivery, description: 'Invoice delivery preference', example: InvoiceDelivery.DIGITAL })
  @IsOptional()
  @IsEnum(InvoiceDelivery)
  invoiceDelivery?: InvoiceDelivery;

  @ApiPropertyOptional({
    description:
      'Address digital invoices are sent to. Defaults to the account email when omitted.',
    example: 'mario.rossi@email.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  invoiceEmail?: string;

  @ApiPropertyOptional({ description: 'IBAN for direct debit payment', example: 'IT60X0542811101000000123456' })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @ApiPropertyOptional({ description: 'IBAN holder first name (if different from contract holder)', example: 'Mario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderFirstName?: string;

  @ApiPropertyOptional({ description: 'IBAN holder last name (if different from contract holder)', example: 'Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderLastName?: string;

  @ApiPropertyOptional({ description: 'IBAN holder tax code (codice fiscale)', example: 'RSSMRA80A01H501Z' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ibanHolderTaxCode?: string;
}
