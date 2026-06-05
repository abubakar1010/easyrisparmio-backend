import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, TicketPriority } from '../../../common/enums/support.enum';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTicketsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}
