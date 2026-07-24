import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VisionOcrService } from './vision-ocr.service';
import { BillType } from '../../../common/enums/bill.enum';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('VisionOcrService', () => {
  let service: VisionOcrService;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionOcrService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'ai.openaiApiKey': 'test-key',
                'ai.ocrModel': 'gpt-4o',
                'ai.ocrMaxTokens': 4096,
                'ai.ocrScale': 3.0,
                'ai.ocrMaxPages': 5,
                'ai.ocrTimeout': 60000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VisionOcrService>(VisionOcrService);
    mockCreate = (service as any).openai.chat.completions.create;
  });

  describe('extractFromImages', () => {
    const sampleResponse = {
      supplierName: 'Enel Energia',
      podNumber: 'IT001E12345678',
      pdrNumber: null,
      totalAmount: 120.50,
      consumptionKwh: 350,
      consumptionSmc: null,
      costPerUnit: 0.085,
      fixedCharges: 9.90,
      taxes: 22.10,
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      supplyAddress: 'Via Roma 42, 20121 Milano MI',
      codiceFiscale: 'RSSMRA85M01H501Z',
      partitaIva: null,
      contractNumber: 'C-2026-001234',
      meterNumber: '12345678',
      customerName: 'Mario Rossi',
      confidence: {
        supplierName: 'high',
        podNumber: 'high',
        pdrNumber: null,
        totalAmount: 'high',
        consumptionKwh: 'high',
        consumptionSmc: null,
        costPerUnit: 'medium',
        fixedCharges: 'high',
        taxes: 'high',
        billingPeriodStart: 'high',
        billingPeriodEnd: 'high',
        supplyAddress: 'medium',
        codiceFiscale: 'high',
        partitaIva: null,
        contractNumber: 'medium',
        meterNumber: 'medium',
        customerName: 'high',
      },
    };

    it('should extract fields from bill image', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(sampleResponse) } }],
      });

      const imageBuffer = Buffer.from('fake-image-data');
      const result = await service.extractFromImages([imageBuffer], BillType.ELECTRICITY);

      expect(result.supplierName).toBe('Enel Energia');
      expect(result.podNumber).toBe('IT001E12345678');
      expect(result.totalAmount).toBe(120.50);
      expect(result.consumptionKwh).toBe(350);
      expect(result.costPerUnit).toBe(0.085);
      expect(result.fixedCharges).toBe(9.90);
      expect(result.taxes).toBe(22.10);
      expect(result.billingPeriodStart).toBe('2026-01-01');
      expect(result.billingPeriodEnd).toBe('2026-01-31');
      expect(result.codiceFiscale).toBe('RSSMRA85M01H501Z');
      expect(result.customerName).toBe('Mario Rossi');
    });

    it('should map confidence levels correctly', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(sampleResponse) } }],
      });

      const result = await service.extractFromImages(
        [Buffer.from('fake')],
        BillType.ELECTRICITY,
      );

      expect(result.confidence.supplierName).toBe('high');
      expect(result.confidence.podNumber).toBe('high');
      expect(result.confidence.pdrNumber).toBeNull();
      expect(result.confidence.costPerUnit).toBe('medium');
      expect(result.overallConfidence).toBe('high');
    });

    it('should handle null fields gracefully and trigger second pass', async () => {
      const sparseResponse = {
        supplierName: null,
        podNumber: null,
        totalAmount: 50.0,
        confidence: { totalAmount: 'low' },
      };

      // Second pass also returns sparse data
      const secondPassResponse = {
        podNumber: null,
        confidence: {},
      };

      mockCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(sparseResponse) } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(secondPassResponse) } }],
        });

      const result = await service.extractFromImages(
        [Buffer.from('fake')],
        BillType.ELECTRICITY,
      );

      expect(result.supplierName).toBeNull();
      expect(result.podNumber).toBeNull();
      expect(result.totalAmount).toBe(50.0);
      expect(result.overallConfidence).toBe('low');
      // Second pass was triggered because mandatory fields were missing
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle empty Vision API response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        service.extractFromImages([Buffer.from('fake')], BillType.GAS),
      ).rejects.toThrow('Empty response from Vision API');
    });

    it('should retry on rate limit (429)', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(sampleResponse) } }],
        });

      const result = await service.extractFromImages(
        [Buffer.from('fake')],
        BillType.ELECTRICITY,
      );

      expect(result.supplierName).toBe('Enel Energia');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw on non-retryable error', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockCreate.mockRejectedValueOnce(authError);

      await expect(
        service.extractFromImages([Buffer.from('fake')], BillType.ELECTRICITY),
      ).rejects.toThrow('Invalid API key');
    });
  });
});
