import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/transformers/to-boolean.transformer';
import { NotificationType } from '../../../common/enums/notification.enum';
import { NotificationTemplateCategory } from '../../../common/enums/notification-template.enum';

export class QueryNotificationTemplatesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: NotificationTemplateCategory,
  })
  @IsOptional()
  @IsEnum(NotificationTemplateCategory)
  category?: NotificationTemplateCategory;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
