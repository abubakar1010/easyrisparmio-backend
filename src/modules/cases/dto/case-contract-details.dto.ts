import { IsOptional, IsString, IsEnum, IsEmail, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';
import { CaseAddressesDto } from './case-addresses.dto';

/**
 * Everything the case records about the contract itself — how it is paid for
 * and where the invoices go — on top of the three addresses it inherits from
 * {@link CaseAddressesDto}.
 *
 * Declared once and extended by both `CreateCaseDto` and `UpdateCaseDto`, for
 * the same reason the addresses are: the app filing a switch request and the
 * admin correcting it afterwards are held to one set of rules, so a case the
 * CRM saved can never be shaped differently from one the app created.
 *
 * Every field is optional and `null` clears it — an admin who has to blank a
 * wrongly entered IBAN needs a way to say so.
 */
export class CaseContractDetailsDto extends CaseAddressesDto {
  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Payment method for this switch', example: PaymentMethod.RID_BANCARIO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;

  @ApiPropertyOptional({ enum: InvoiceDelivery, description: 'Invoice delivery preference', example: InvoiceDelivery.DIGITAL })
  @IsOptional()
  @IsEnum(InvoiceDelivery)
  invoiceDelivery?: InvoiceDelivery | null;

  @ApiPropertyOptional({
    description:
      'Address digital invoices are sent to. Defaults to the account email when omitted.',
    example: 'mario.rossi@email.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  invoiceEmail?: string | null;

  @ApiPropertyOptional({ description: 'IBAN for direct debit payment', example: 'IT60X0542811101000000123456' })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string | null;

  @ApiPropertyOptional({ description: 'IBAN holder first name (if different from contract holder)', example: 'Mario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderFirstName?: string | null;

  @ApiPropertyOptional({ description: 'IBAN holder last name (if different from contract holder)', example: 'Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderLastName?: string | null;

  @ApiPropertyOptional({ description: 'IBAN holder tax code (codice fiscale)', example: 'RSSMRA80A01H501Z' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ibanHolderTaxCode?: string | null;
}

/** The contract fields, as they are stored on the case. */
export const CASE_CONTRACT_DETAIL_FIELDS = [
  'paymentMethod',
  'invoiceDelivery',
  'invoiceEmail',
  'iban',
  'ibanHolderFirstName',
  'ibanHolderLastName',
  'ibanHolderTaxCode',
] as const;

export type CaseContractDetailField =
  (typeof CASE_CONTRACT_DETAIL_FIELDS)[number];

/** How each field is named to a human — on the case timeline, for instance. */
export const CASE_CONTRACT_DETAIL_LABELS: Record<CaseContractDetailField, string> = {
  paymentMethod: 'Payment method',
  invoiceDelivery: 'Invoice delivery',
  invoiceEmail: 'Invoice email',
  iban: 'IBAN',
  ibanHolderFirstName: 'IBAN holder first name',
  ibanHolderLastName: 'IBAN holder last name',
  ibanHolderTaxCode: 'IBAN holder tax code',
};
