import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '../../../common/enums/support.enum';

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket subject', example: 'Unable to upload my electricity bill', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ description: 'Support topic ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsNotEmpty()
  topicId: string;

  @ApiPropertyOptional({ enum: TicketPriority, description: 'Ticket priority (defaults to medium)', example: TicketPriority.MEDIUM, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ description: 'Initial message for the ticket', example: 'I keep getting an error when trying to upload my Enel electricity bill as PDF.' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
