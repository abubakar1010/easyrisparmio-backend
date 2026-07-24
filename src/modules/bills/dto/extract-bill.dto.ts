import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BillType } from '../../../common/enums/bill.enum';

export class ExtractBillDto {
  @ApiProperty({ enum: BillType, description: 'Type of energy bill', example: BillType.ELECTRICITY })
  @IsEnum(BillType)
  billType: BillType;
}

export class FieldConfidence {
  supplierName?: 'high' | 'medium' | 'low' | null;
  podNumber?: 'high' | 'medium' | 'low' | null;
  pdrNumber?: 'high' | 'medium' | 'low' | null;
  totalAmount?: 'high' | 'medium' | 'low' | null;
  consumptionKwh?: 'high' | 'medium' | 'low' | null;
  consumptionSmc?: 'high' | 'medium' | 'low' | null;
  costPerUnit?: 'high' | 'medium' | 'low' | null;
  fixedCharges?: 'high' | 'medium' | 'low' | null;
  taxes?: 'high' | 'medium' | 'low' | null;
  billingPeriodStart?: 'high' | 'medium' | 'low' | null;
  billingPeriodEnd?: 'high' | 'medium' | 'low' | null;
  supplyAddress?: 'high' | 'medium' | 'low' | null;
  codiceFiscale?: 'high' | 'medium' | 'low' | null;
  partitaIva?: 'high' | 'medium' | 'low' | null;
  contractNumber?: 'high' | 'medium' | 'low' | null;
  meterNumber?: 'high' | 'medium' | 'low' | null;
  customerName?: 'high' | 'medium' | 'low' | null;
}

export class BillExtractionResult {
  @ApiPropertyOptional() supplierName?: string | null;
  @ApiPropertyOptional() podNumber?: string | null;
  @ApiPropertyOptional() pdrNumber?: string | null;
  @ApiPropertyOptional() totalAmount?: number | null;
  @ApiPropertyOptional() consumptionKwh?: number | null;
  @ApiPropertyOptional() consumptionSmc?: number | null;
  @ApiPropertyOptional() costPerUnit?: number | null;
  @ApiPropertyOptional() fixedCharges?: number | null;
  @ApiPropertyOptional() taxes?: number | null;
  @ApiPropertyOptional() billingPeriodStart?: string | null;
  @ApiPropertyOptional() billingPeriodEnd?: string | null;
  @ApiPropertyOptional() supplyAddress?: string | null;
  @ApiPropertyOptional() codiceFiscale?: string | null;
  @ApiPropertyOptional() partitaIva?: string | null;
  @ApiPropertyOptional() contractNumber?: string | null;
  @ApiPropertyOptional() meterNumber?: string | null;
  @ApiPropertyOptional() customerName?: string | null;

  @ApiProperty({ description: 'Per-field confidence levels' })
  confidence: FieldConfidence;

  @ApiProperty({ description: 'Overall extraction confidence', enum: ['high', 'medium', 'low'] })
  overallConfidence: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ description: 'Raw Vision API response for audit' })
  rawResponse?: Record<string, any>;
}
