import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
