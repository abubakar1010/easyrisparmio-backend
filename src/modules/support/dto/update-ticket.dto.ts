import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../../../common/enums/support.enum';

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus, description: 'New ticket status', example: TicketStatus.IN_PROGRESS })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ description: 'Admin agent UUID to assign', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
