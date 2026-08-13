import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestVerificationDto {
  @ApiProperty({
    description: 'Message from admin explaining what the user needs to provide',
    example:
      'The bill is hard to read. Please upload a clearer copy of the document.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SubmitVerificationDto {
  @ApiPropertyOptional({
    description: 'Message from user',
    example: 'I have uploaded a clearer copy of the bill.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'IDs of uploaded files to associate with this verification',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fileIds?: string[];
}
