import {
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOffersItemDto {
  @ApiProperty({ description: 'Offer ID to send', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  offerId: string;

  @ApiPropertyOptional({ description: 'Custom estimated savings (EUR). If omitted, auto-calculated.', example: 18.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedSavings?: number;
}

export class SendOffersDto {
  @ApiProperty({ type: [SendOffersItemDto], description: 'Array of offers to send to the user' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SendOffersItemDto)
  offers: SendOffersItemDto[];
}
