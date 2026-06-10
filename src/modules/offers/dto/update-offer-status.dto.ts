import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OfferStatus } from '../../../common/enums/offer-status.enum';

export class UpdateOfferStatusDto {
  @ApiProperty({
    enum: OfferStatus,
    description: 'New offer status',
    example: OfferStatus.ACTIVE,
  })
  @IsEnum(OfferStatus)
  @IsNotEmpty()
  offerStatus: OfferStatus;
}
