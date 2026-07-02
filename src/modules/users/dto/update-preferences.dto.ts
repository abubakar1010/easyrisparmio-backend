import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, InvoiceDelivery, LanguagePref } from '../../../common/enums/payment.enum';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.RID_BANCARIO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: InvoiceDelivery, example: InvoiceDelivery.DIGITAL })
  @IsOptional()
  @IsEnum(InvoiceDelivery)
  invoiceDelivery?: InvoiceDelivery;

  @ApiPropertyOptional({ enum: LanguagePref, example: LanguagePref.ITALIANO })
  @IsOptional()
  @IsEnum(LanguagePref)
  language?: LanguagePref;

  @ApiPropertyOptional({ example: 'email' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPreference?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ example: 'IT60X0542811101000000123456' })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;
}
