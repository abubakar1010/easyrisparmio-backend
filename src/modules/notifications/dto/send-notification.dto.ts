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

export class SendNotificationDto {
  @ApiPropertyOptional({ description: 'Single user ID' })
  @ValidateIf((o) => !o.userIds)
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Array of user IDs', type: [String] })
  @ValidateIf((o) => !o.userId)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

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
}
