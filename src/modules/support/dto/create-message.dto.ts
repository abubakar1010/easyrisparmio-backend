import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Attachment URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
