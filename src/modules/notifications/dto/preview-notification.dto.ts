import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Renders a message against a real customer without sending it.
 *
 * This exists so the dashboard never has to reimplement substitution. It used to
 * carry its own copy of the regex and the fallback rules, which is a second
 * renderer to keep in step with this one — and the two only had to disagree once
 * for a customer to be shown a preview that did not match what they received.
 *
 * Either pass `templateId` to preview a saved template, or `title`/`body` to
 * preview text the admin is editing right now. The composer does the latter,
 * since a template is only a starting point.
 */
export class PreviewNotificationDto {
  @ApiProperty({
    description: 'The customer the message will be rendered for',
    example: 'a3f1c2d4-5e6b-7a89-b0cd-1e2f3a4b5c6d',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description:
      'Preview a saved template. When set, `title` and `body` are ignored.',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Title to render (required when `templateId` is not set)',
    example: 'Nuova offerta per te, {{firstName}}',
    maxLength: 255,
  })
  @ValidateIf((o) => !o.templateId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Body to render (required when `templateId` is not set)',
    example: 'Ciao {{name}}, passa a {{provider}} e risparmia.',
  })
  @ValidateIf((o) => !o.templateId)
  @IsString()
  @IsNotEmpty()
  body?: string;

  @ApiPropertyOptional({
    description:
      'Which case resolves {{provider}}, {{offer_name}} and {{utility_type}}. ' +
      'Defaults to the customer’s most recent case.',
  })
  @IsOptional()
  @IsUUID()
  caseId?: string;
}
