import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VERSION_PATTERN } from '../../../common/utils/version.util';

export class LegalAcceptanceItemDto {
  @ApiProperty({ description: 'Document slug', example: 'terms-conditions' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  slug: string;

  /**
   * The client echoes back the version it displayed. The server rejects
   * anything that is not the current one, so a stale screen left open across a
   * publish cannot record consent to a document the user never saw.
   */
  @ApiProperty({ description: 'Version the user was shown', example: '2.1' })
  @IsString()
  @IsNotEmpty()
  @Matches(VERSION_PATTERN, {
    message: 'version must be a dotted number such as 2.1',
  })
  version: string;

  @ApiPropertyOptional({
    description: 'Locale of the document the user read',
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

export class AcceptLegalDocumentsDto {
  @ApiProperty({
    description: 'Documents the user is accepting, with the versions shown',
    type: [LegalAcceptanceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => LegalAcceptanceItemDto)
  acceptances: LegalAcceptanceItemDto[];
}
