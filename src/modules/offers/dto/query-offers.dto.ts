import { IsEnum, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  EnergyType,
  MarketType,
  OfferPaymentMethod,
  UserTarget,
} from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';
import { ToBoolean } from '../../../common/transformers/to-boolean.transformer';

export class QueryOffersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EnergyType, description: 'Filter by energy type' })
  @IsOptional()
  @IsEnum(EnergyType)
  energyType?: EnergyType;

  @ApiPropertyOptional({ enum: MarketType, description: 'Filter by market type' })
  @IsOptional()
  @IsEnum(MarketType)
  marketType?: MarketType;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Filter by target audience' })
  @IsOptional()
  @IsEnum(UserTarget)
  target?: UserTarget;

  @ApiPropertyOptional({
    enum: OfferPaymentMethod,
    description:
      'Filter by accepted payment method. direct_debit and postal_order also ' +
      'match offers accepting both; both matches only offers accepting both.',
  })
  @IsOptional()
  @IsEnum(OfferPaymentMethod)
  paymentMethod?: OfferPaymentMethod;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: OfferStatus, description: 'Filter by offer status' })
  @IsOptional()
  @IsEnum(OfferStatus)
  offerStatus?: OfferStatus;
}
