import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification.enum';
import { NotificationTemplateCategory } from '../../../common/enums/notification-template.enum';

export class CreateNotificationTemplateDto {
  @ApiProperty({
    description: 'Admin-facing label, shown in the template picker',
    example: 'Promo switch luce',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'One-line note on what this template is for',
    example: 'Invito a passare a una nuova offerta luce.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'What the template is for. Drives the filter and colour tag.',
    enum: NotificationTemplateCategory,
    example: NotificationTemplateCategory.PROMOTIONAL,
    default: NotificationTemplateCategory.CUSTOM,
  })
  @IsOptional()
  @IsEnum(NotificationTemplateCategory)
  category?: NotificationTemplateCategory;

  @ApiProperty({
    description:
      'Notification title. May contain `{{...}}` variables — see ' +
      'GET /notification-templates/variables for the ones this server resolves.',
    example: 'Nuova offerta per te, {{firstName}}',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Notification body. May contain `{{...}}` variables.',
    example:
      'Ciao {{name}}, la tua pratica {{utility_type}} con {{provider}} sta procedendo.',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description:
      'The type a send from this template carries. Drives the icon and the ' +
      'deep link in the apps.',
    enum: NotificationType,
    example: NotificationType.GENERAL,
    default: NotificationType.GENERAL,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Whether the template appears in the composer picker',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
