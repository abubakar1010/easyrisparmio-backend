export enum PaymentMethod {
  RID_BANCARIO = 'rid_bancario',
  CREDIT_CARD = 'credit_card',
  POSTAL_ORDER = 'postal_order',
  BANK_TRANSFER = 'bank_transfer',
}

export enum InvoiceDelivery {
  DIGITAL = 'digital',
  PAPER = 'paper',
}

// LanguagePref moved to language.enum.ts
export { LanguagePref } from './language.enum';
