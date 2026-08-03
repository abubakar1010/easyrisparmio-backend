import { IsUUID, IsNotEmpty, IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';

export class CreateCaseDto {
  @ApiProperty({ description: 'ID of the energy bill for this switch case', example: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  billId: string;

  @ApiProperty({ description: 'ID of the selected offer', example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  selectedOfferId: string;

  @ApiPropertyOptional({ description: 'Residential street address (when different from delivery)', example: 'Via Roma 10' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialStreet?: string;

  @ApiPropertyOptional({ description: 'Residential city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialCity?: string;

  @ApiPropertyOptional({ description: 'Residential ZIP code', example: '20100' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  residentialZip?: string;

  @ApiPropertyOptional({ description: 'Residential province', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialProvince?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Payment method for this switch', example: PaymentMethod.RID_BANCARIO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: InvoiceDelivery, description: 'Invoice delivery preference', example: InvoiceDelivery.DIGITAL })
  @IsOptional()
  @IsEnum(InvoiceDelivery)
  invoiceDelivery?: InvoiceDelivery;

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
