import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillType } from '../../../common/enums/bill.enum';

export class UploadBillDto {
  @ApiProperty({ enum: BillType, description: 'Type of energy bill', example: BillType.ELECTRICITY })
  @IsEnum(BillType)
  billType: BillType;

  @ApiPropertyOptional({ description: 'POD number for electricity bills', example: 'IT001E12345678', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  podNumber?: string;

  @ApiPropertyOptional({ description: 'PDR number for gas bills', example: 'GS002C87654321', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pdrNumber?: string;

  @ApiPropertyOptional({ description: 'Total bill amount in EUR', example: 120.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Electricity consumption in kWh', example: 350 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  consumptionKwh?: number;

  @ApiPropertyOptional({ description: 'Gas consumption in Smc (standard cubic meters)', example: 120 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  consumptionSmc?: number;

  @ApiPropertyOptional({ description: 'Cost per unit (EUR/kWh or EUR/Smc)', example: 0.25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  costPerUnit?: number;

  @ApiPropertyOptional({ description: 'Fixed monthly charges in EUR', example: 15.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedCharges?: number;

  @ApiPropertyOptional({ description: 'Taxes in EUR', example: 8.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxes?: number;

  @ApiPropertyOptional({ description: 'Supplier name from OCR extraction (used for auto-matching)', example: 'Enel Energia', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Current supplier ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Billing period start date (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  billingPeriodStart?: string;

  @ApiPropertyOptional({ description: 'Billing period end date (ISO 8601)', example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  billingPeriodEnd?: string;

  @ApiPropertyOptional({ description: 'Supply/delivery address (indirizzo di fornitura)', example: 'Via Roma 42, 20121 Milano MI', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  supplyAddress?: string;

  @ApiPropertyOptional({ description: 'Codice Fiscale (Italian tax code, 16 chars)', example: 'RSSMRA85M01H501Z', maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  codiceFiscale?: string;

  @ApiPropertyOptional({ description: 'Partita IVA (VAT number, 11 digits, business bills only)', example: '12345678901', maxLength: 11 })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  partitaIva?: string;

  @ApiPropertyOptional({ description: 'Contract number', example: 'C-2026-001234', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contractNumber?: string;

  @ApiPropertyOptional({ description: 'Meter serial number (matricola contatore)', example: '12345678', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  meterNumber?: string;

  @ApiPropertyOptional({ description: 'Customer/account holder name (intestatario)', example: 'Mario Rossi', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;
}
