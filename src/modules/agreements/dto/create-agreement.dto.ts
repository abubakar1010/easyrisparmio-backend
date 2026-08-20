import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsDateString,
  IsInt,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserTarget } from '../../../common/enums/offer.enum';

export class CreateAgreementDto {
  @ApiProperty({ description: 'Agreement title', example: '20% Off on Enel Smart Home Kit', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Agreement description', example: 'Exclusive discount on smart home energy monitoring devices for EasyRisparmio users' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Partner company name', example: 'Enel X', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  partnerName: string;

  @ApiPropertyOptional({ description: 'Partner logo URL', example: 'https://cdn.easyresparmio.it/partners/enel-x.png', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  partnerLogoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Details of the discount or benefit', example: '20% off on all smart home kits. Use code EASY20 at checkout.' })
  @IsOptional()
  @IsString()
  discountDescription?: string | null;

  @ApiPropertyOptional({
    description:
      'Short headline shown as the large discount figure in the mobile app. Keep it terse (e.g. "20%", "5 cent/litro").',
    example: '20%',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  discountHeadline?: string | null;

  @ApiPropertyOptional({
    description:
      'Promo code the user copies from the mobile app. Leave empty for agreements that need no code.',
    example: 'EASY20',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  discountCode?: string | null;

  @ApiPropertyOptional({
    description:
      'Ordered "how to use" steps shown on the agreement detail screen. Leave empty to fall back to the generic steps built into the app.',
    example: ['Mostra il codice alla cassa', 'Lo sconto viene applicato sul totale'],
    type: [String],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  howToUse?: string[] | null;

  @ApiPropertyOptional({ description: 'URL to full terms and conditions', example: 'https://www.enelx.com/terms/easy-risparmio', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  termsUrl?: string | null;

  @ApiPropertyOptional({ description: 'Physical address of the partner', example: 'Via Cesare Sersale 1, 80139 Napoli NA', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ description: 'Whether the agreement is active (visible to users)', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Target audience', example: UserTarget.BOTH, default: UserTarget.BOTH })
  @IsOptional()
  @IsEnum(UserTarget)
  targetAudience?: UserTarget;

  @ApiProperty({ description: 'Agreement validity start date (ISO 8601)', example: '2026-01-01' })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ description: 'Agreement validity end date (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @ApiPropertyOptional({ description: 'Display order (lower = shown first)', example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
