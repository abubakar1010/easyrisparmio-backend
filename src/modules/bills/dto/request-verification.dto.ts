import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestVerificationDto {
  @ApiProperty({
    description: 'Message from admin explaining what is needed',
    example: 'The bill is hard to read. Please re-upload a clearer copy and provide the missing POD number.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'List of bill field names that need to be completed by the user',
    example: ['podNumber', 'totalAmount', 'consumptionKwh'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  missingFields: string[];

  @ApiPropertyOptional({
    description: 'Whether the user needs to re-upload the bill document',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requireReupload?: boolean;
}

export class SubmitVerificationDto {
  @ApiPropertyOptional({
    description: 'Message from user',
    example: 'I have uploaded a clearer version and filled in the missing POD number.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'User-submitted field values for missing fields',
    example: { podNumber: 'IT001E12345678', totalAmount: 120.50 },
  })
  @IsOptional()
  fieldValues?: Record<string, any>;

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
