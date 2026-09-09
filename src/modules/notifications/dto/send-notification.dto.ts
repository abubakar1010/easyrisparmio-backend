import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsObject,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification.enum';

/**
 * One message, one customer. Sending the same text to a group of customers is
 * deliberately not offered: the endpoint takes a single `userId` and nothing
 * else. Internal event fan-out (alerting every admin about a platform event)
 * still writes many rows in one call, but that path goes through
 * `SendNotificationInput` in the service and is never reachable over HTTP.
 */
export class SendNotificationDto {
  @ApiProperty({ description: 'Recipient user ID' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Notification title (required if messageKey is not set)' })
  @ValidateIf((o) => !o.messageKey)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Notification body (required if messageKey is not set)' })
  @ValidateIf((o) => !o.messageKey)
  @IsString()
  @IsNotEmpty()
  body?: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Message key for i18n resolution (internal use)' })
  @IsOptional()
  @IsString()
  messageKey?: string;

  @ApiPropertyOptional({ description: 'Parameters for message template interpolation' })
  @IsOptional()
  @IsArray()
  bodyParams?: any[];

  /**
   * Provenance only. The composer loads a template into the form and the admin
   * may edit before sending, so `title` and `body` above are always the final
   * text — the server never rebuilds a message from this id. It is recorded so a
   * customer's history can say which template a message started from.
   */
  @ApiPropertyOptional({
    description: 'Template this message was composed from (provenance only)',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  /**
   * Which case resolves `{{provider}}`, `{{offer_name}}` and `{{utility_type}}`.
   * Omitted, the customer's most recent case is used.
   */
  @ApiPropertyOptional({
    description:
      'Case that resolves {{provider}}, {{offer_name}} and {{utility_type}}',
  })
  @IsOptional()
  @IsUUID()
  caseId?: string;
}
