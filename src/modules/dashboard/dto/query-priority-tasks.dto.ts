import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PriorityTaskCategory } from '../priority-tasks.constant';

export class QueryPriorityTasksDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: PriorityTaskCategory,
    description:
      'Restrict the list to one task category. Omit it to get every open task, ' +
      'ordered by urgency — that is what "View all tasks" asks for.',
    example: PriorityTaskCategory.PENDING_VALIDATION,
  })
  @IsOptional()
  @IsEnum(PriorityTaskCategory)
  category?: PriorityTaskCategory;
}
