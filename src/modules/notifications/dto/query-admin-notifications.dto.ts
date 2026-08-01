import { IsOptional, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification.enum';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAdminNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['all', 'sent', 'received'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'sent', 'received'])
  direction?: 'all' | 'sent' | 'received' = 'all';

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
