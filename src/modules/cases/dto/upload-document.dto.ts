import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../../common/enums/user.enum';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType, description: 'Type of document', example: DocumentType.IDENTITY_DOCUMENT })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'URL of the uploaded file', example: 'https://storage.easyresparmio.it/docs/id-card-front.pdf', maxLength: 500 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  fileUrl: string;

  @ApiProperty({ description: 'Original file name', example: 'carta-identita-fronte.pdf', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional({
    description:
      'The rejected document this file replaces. Puts the rejected document back in review and tells the admins.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsOptional()
  @IsUUID()
  replacesDocumentId?: string;
}
