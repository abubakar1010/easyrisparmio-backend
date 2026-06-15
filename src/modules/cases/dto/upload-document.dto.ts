import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../../common/enums/user.enum';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType, description: 'Type of document', example: DocumentType.ID_CARD })
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
}
