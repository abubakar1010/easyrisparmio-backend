import { IsUUID, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean, IsEmail, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';

/** Italian CAP — exactly five digits. */
const POSTAL_CODE_PATTERN = /^\d{5}$/;

export class CreateCaseDto {
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

  // ── Addresses ──
  // Supply, residential and shipping addresses all carry the same five fields:
  // street, civic number, city, postal code (CAP) and province.

  @ApiPropertyOptional({ description: 'Supply address street', example: 'Via Roma' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplyStreet?: string;

  @ApiPropertyOptional({ description: 'Supply address street number', example: '10' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplyStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Supply address city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplyCity?: string;

  @ApiPropertyOptional({ description: 'Supply address postal code (CAP)', example: '20100' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'supplyPostalCode must be a 5-digit CAP' })
  supplyPostalCode?: string;

  @ApiPropertyOptional({ description: 'Supply address province (free text)', example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplyProvince?: string;

  @ApiPropertyOptional({ description: 'Whether the residence address is the same as the supply address', example: true })
  @IsOptional()
  @IsBoolean()
  residentialSameAsSupply?: boolean;

  @ApiPropertyOptional({ description: 'Residence address street', example: 'Via Verdi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialStreet?: string;

  @ApiPropertyOptional({ description: 'Residence address street number', example: '25' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  residentialStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Residence address city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialCity?: string;

  @ApiPropertyOptional({ description: 'Residence address postal code (CAP)', example: '20100' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'residentialPostalCode must be a 5-digit CAP' })
  residentialPostalCode?: string;

  @ApiPropertyOptional({ description: 'Residence address province (free text)', example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialProvince?: string;

  @ApiPropertyOptional({ description: 'Whether paper invoices go to the supply address', example: true })
  @IsOptional()
  @IsBoolean()
  shippingSameAsSupply?: boolean;

  @ApiPropertyOptional({ description: 'Shipping address street (paper invoices)', example: 'Via Dante' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shippingStreet?: string;

  @ApiPropertyOptional({ description: 'Shipping address street number', example: '3/A' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shippingStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Shipping address city', example: 'Torino' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @ApiPropertyOptional({ description: 'Shipping address postal code (CAP)', example: '10121' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'shippingPostalCode must be a 5-digit CAP' })
  shippingPostalCode?: string;

  @ApiPropertyOptional({ description: 'Shipping address province (free text)', example: 'TO' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingProvince?: string;

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
