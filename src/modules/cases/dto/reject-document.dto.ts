import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentRejectionReason } from '../../../common/enums/user.enum';

export class RejectDocumentDto {
  @ApiProperty({
    enum: DocumentRejectionReason,
    description: 'Why the document is not acceptable',
    example: DocumentRejectionReason.EXPIRED,
  })
  @IsEnum(DocumentRejectionReason)
  reason: DocumentRejectionReason;

  @ApiPropertyOptional({
    description:
      'Shown to the customer beside the reason. Required when the reason is `other`, since the code alone says nothing.',
    example: 'The back of the card is missing.',
    maxLength: 1000,
  })
  @ValidateIf((o: RejectDocumentDto) => o.reason === DocumentRejectionReason.OTHER || o.note != null)
  @IsString()
  @IsNotEmpty({ message: 'A note is required when the reason is other' })
  @MaxLength(1000)
  note?: string;
}
