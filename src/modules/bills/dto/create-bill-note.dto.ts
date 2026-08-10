import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBillNoteDto {
  @ApiProperty({ description: 'Note content', example: 'Customer called to ask about activation timeline.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
