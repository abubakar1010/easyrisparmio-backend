import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminSettingsDto {
  @ApiPropertyOptional({ description: 'Enable/disable automatic offer sending to users after bill analysis' })
  @IsOptional()
  @IsBoolean()
  autoSendOffers?: boolean;

  @ApiPropertyOptional({ description: 'Maximum number of recommended offers per bill (1-10)', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRecommendedOffers?: number;
}
