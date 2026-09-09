import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryNotificationsDto } from './query-notifications.dto';
import { ToBoolean } from '../../../common/transformers/to-boolean.transformer';

/**
 * The notification history shown on a customer's profile.
 *
 * Inherits `type` and pagination from the customer-facing query; `isRead` comes
 * with it and is just as meaningful to an operator looking at whether a message
 * landed.
 */
export class QueryCustomerNotificationsDto extends QueryNotificationsDto {
  @ApiPropertyOptional({
    description:
      'Only messages an operator composed by hand, excluding the ones the ' +
      'platform raised automatically',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  onlyManual?: boolean;
}
