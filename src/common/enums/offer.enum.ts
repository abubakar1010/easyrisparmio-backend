export enum EnergyType {
  ELECTRICITY = 'electricity',
  GAS = 'gas',
  DUAL = 'dual',
}

export enum MarketType {
  FIXED = 'fixed',
  VARIABLE = 'variable',
  INDEXED = 'indexed',
}

export enum UserTarget {
  PERSONAL = 'personal',
  BUSINESS = 'business',
  BOTH = 'both',
}

/**
 * Payment methods a supplier accepts for an offer. Distinct from the
 * `PaymentMethod` enum in payment.enum.ts, which records what a customer
 * actually chose on a case — an offer may accept BOTH, a case never does.
 */
export enum OfferPaymentMethod {
  DIRECT_DEBIT = 'direct_debit',
  POSTAL_ORDER = 'postal_order',
  BOTH = 'both',
}
