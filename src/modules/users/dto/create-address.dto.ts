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

  @ApiPropertyOptional({ example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  province?: string;

  @ApiPropertyOptional({ example: 'IT', default: 'IT' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ enum: AddressType, default: AddressType.RESIDENTIAL })
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
