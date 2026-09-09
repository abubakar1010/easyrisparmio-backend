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
   *
   * Sent, it has to agree with the role. `residential` on a business account
   * and `legal` on a personal one are refused rather than stored: the type is
   * the only thing that distinguishes the two, so a wrong one written here is
   * a wrong one nothing downstream can detect.
   */
  @ApiPropertyOptional({
    enum: AddressType,
    description:
      "The account's own address type: `legal` (the registered office) on a " +
      'business account, `residential` on a personal one. Defaults to whichever ' +
      'the role calls for; the other is refused.',
  })
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
