import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketCategory } from '../../../common/enums/support.enum';

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket subject' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ enum: TicketCategory, description: 'Ticket category' })
  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ description: 'Initial message for the ticket' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
