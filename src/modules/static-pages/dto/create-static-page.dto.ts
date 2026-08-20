import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LegalAudience } from '../../../common/enums/legal.enum';
import { VERSION_PATTERN } from '../../../common/utils/version.util';

export class CreateStaticPageDto {
  @ApiProperty({ description: 'Page slug identifier', example: 'privacy-policy', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  slug: string;

  @ApiProperty({ description: 'Page title', example: 'Informativa sulla Privacy', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Page content (HTML)', example: '<h2>Privacy Policy</h2><p>Your privacy is important to us...</p>' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Locale code', example: 'it', default: 'it', maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiPropertyOptional({ description: 'Whether the page is active', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Document version as a dotted number. Raising it on a page that requires ' +
      'acceptance makes every user who accepted an older version be asked again.',
    example: '1.0',
    default: '1.0',
  })
  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, {
    message: 'version must be a dotted number such as 2.1',
  })
  version?: string;

  @ApiPropertyOptional({
    description:
      'Marks the page as an agreement users must actively accept, rather than ' +
      'informational content.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresAcceptance?: boolean;

  @ApiPropertyOptional({
    description: 'Which accounts the document binds',
    enum: LegalAudience,
    example: LegalAudience.ALL,
    default: LegalAudience.ALL,
  })
  @IsOptional()
  @IsEnum(LegalAudience)
  audience?: LegalAudience;

  @ApiPropertyOptional({
    description:
      'Plain-language summary of what changed in this version, shown at the top ' +
      'of the re-acceptance prompt.',
    example: 'Aggiornata la sezione sui tempi di recesso.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changeSummary?: string;
}
