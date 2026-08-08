import { PartialType, OmitType } from '@nestjs/swagger';
import { UploadBillDto } from './upload-bill.dto';

export class UpdateBillDto extends PartialType(
  OmitType(UploadBillDto, ['fileUrl'] as const),
) {}
