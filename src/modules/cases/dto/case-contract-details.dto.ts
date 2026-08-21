import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';
import { IsItalianTaxId } from '../../../common/validators/is-italian-tax-id.validator';
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

  /**
   * Whether the account the direct debit is taken from belongs to the contract
   * holder. Recorded rather than inferred from the holder fields being blank:
   * a third-party mandate needs the holder's own signature, so the CRM has to
   * be able to tell "this is the customer's account" from "these details happen
   * to match". Null on cases filed before it was asked.
   */
  @ApiPropertyOptional({
    description: 'Whether the IBAN holder is the contract holder',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  ibanSameAsContract?: boolean | null;

  @ApiPropertyOptional({ description: 'IBAN holder first name', example: 'Mario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderFirstName?: string | null;

  @ApiPropertyOptional({ description: 'IBAN holder last name', example: 'Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ibanHolderLastName?: string | null;

  /**
   * The holder's Italian tax ID — a Codice Fiscale for a person, a Partita IVA
   * for a company. Checked against its own check digit, not just its shape: a
   * mandate filed with a mistyped code is rejected by the supplier, and by then
   * the customer has already been told the switch was submitted.
   */
  @ApiPropertyOptional({
    description: 'IBAN holder tax ID — Codice Fiscale or Partita IVA',
    example: 'RSSMRA85T10A562S',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @IsItalianTaxId()
  ibanHolderTaxCode?: string | null;
}

/** The contract fields, as they are stored on the case. */
export const CASE_CONTRACT_DETAIL_FIELDS = [
  'paymentMethod',
  'invoiceDelivery',
  'invoiceEmail',
  'iban',
  'ibanSameAsContract',
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
  ibanSameAsContract: 'IBAN holder is the contract holder',
  ibanHolderFirstName: 'IBAN holder first name',
  ibanHolderLastName: 'IBAN holder last name',
  ibanHolderTaxCode: 'IBAN holder tax code',
};
