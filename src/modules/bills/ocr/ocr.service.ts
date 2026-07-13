import { Injectable, Logger } from '@nestjs/common';
import { BillType } from '../../../common/enums/bill.enum';
import { OcrExtractionResult } from './ocr.interface';

// Cloud OCR (Anthropic Claude Vision) has been replaced by on-device
// Google ML Kit in the mobile app. The mobile app now extracts bill data
// locally and sends it via the upload DTO. This service is kept as a
// stub so the DI container doesn't break (BillsModule still lists it
// as a provider). To restore cloud OCR, reinstall @anthropic-ai/sdk
// and restore the original implementation from git history.

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractBillData(
    _fileUrl: string,
    _billType: BillType,
  ): Promise<OcrExtractionResult> {
    this.logger.debug(
      'Cloud OCR disabled — bill data is extracted on-device via ML Kit',
    );
    return { confidence: 0 };
  }
}
