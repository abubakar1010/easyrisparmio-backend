export interface OcrExtractionResult {
  supplierName?: string;
  podNumber?: string;
  pdrNumber?: string;
  totalAmount?: number;
  consumptionKwh?: number;
  consumptionSmc?: number;
  costPerUnit?: number;
  fixedCharges?: number;
  taxes?: number;
  billingPeriodStart?: string; // ISO date (YYYY-MM-DD)
  billingPeriodEnd?: string;
  contractNumber?: string;
  meterNumber?: string;
  customerAddress?: string;
  rawText?: string;
  confidence: number; // 0-1
}
