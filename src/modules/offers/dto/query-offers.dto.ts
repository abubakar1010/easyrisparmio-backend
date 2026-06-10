import { IsEnum, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EnergyType, MarketType, UserTarget } from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';

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

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
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
