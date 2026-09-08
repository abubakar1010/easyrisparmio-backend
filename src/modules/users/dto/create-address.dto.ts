import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '../../../common/enums/address.enum';

export class CreateAddressDto {
  @ApiProperty({ example: 'Via Roma 15' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  streetAddress: string;

  @ApiProperty({ example: 'Milano' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: '20121' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode: string;

  @ApiPropertyOptional({ example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: 'IT', default: 'IT' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  /**
   * Omitted, the type follows the account: `legal` — the registered office —
   * for a business, `residential` for a personal account. A company does not
   * have a residence, and storing its registered office under `residential`
   * left the platform unable to tell the two apart at all.
   */
  @ApiPropertyOptional({
    enum: AddressType,
    description:
      'Defaults to `legal` for a business account and `residential` for a personal one',
  })
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
