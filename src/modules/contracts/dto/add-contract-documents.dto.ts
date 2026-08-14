import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContractDocumentItemDto {
  @ApiProperty({ description: 'URL of the uploaded file (from /api/v1/upload)' })
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: 'Stored filename (from upload response)' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'Original filename' })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiPropertyOptional({ description: 'MIME type of the file' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  fileSizeBytes?: number;
}

export class AddContractDocumentsDto {
  @ApiProperty({
    description: 'Array of documents to attach to the contract',
    type: [ContractDocumentItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContractDocumentItemDto)
  documents: ContractDocumentItemDto[];
}
