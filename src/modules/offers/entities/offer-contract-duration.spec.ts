import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOfferDto } from '../dto/create-offer.dto';
import { UpdateOfferDto } from '../dto/update-offer.dto';
import { contractDurationMonthsToDays } from './offer.entity';

async function durationErrors(
  cls: typeof CreateOfferDto | typeof UpdateOfferDto,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body, { enableImplicitConversion: true });
  const errors = await validate(dto);
  return errors
    .filter((e) => e.property === 'contractDurationMonths')
    .flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('offer contract duration', () => {
  it('derives the legacy days the clients already read', () => {
    expect(contractDurationMonthsToDays(12)).toBe(365);
    expect(contractDurationMonthsToDays(24)).toBe(730);
    expect(contractDurationMonthsToDays(36)).toBe(1095);
    // Indefinite — the mobile app renders 0 as "Durata indeterminata".
    expect(contractDurationMonthsToDays(null)).toBe(0);
  });

  it('keeps the months readable back from days as days / 30', () => {
    for (let months = 1; months <= 60; months++) {
      expect(Math.floor(contractDurationMonthsToDays(months) / 30)).toBe(months);
    }
  });

  describe('create', () => {
    it('accepts a term in months and null for indefinite', async () => {
      expect(await durationErrors(CreateOfferDto, { contractDurationMonths: 24 })).toEqual([]);
      expect(await durationErrors(CreateOfferDto, { contractDurationMonths: null })).toEqual([]);
    });

    it('requires the field to be answered', async () => {
      expect(await durationErrors(CreateOfferDto, {})).not.toEqual([]);
    });

    it('rejects terms outside 1–60 months', async () => {
      expect(await durationErrors(CreateOfferDto, { contractDurationMonths: 0 })).toContain('min');
      expect(await durationErrors(CreateOfferDto, { contractDurationMonths: 61 })).toContain('max');
      expect(await durationErrors(CreateOfferDto, { contractDurationMonths: 1.5 })).toContain('isInt');
    });
  });

  it('lets an update leave the duration untouched', async () => {
    expect(await durationErrors(UpdateOfferDto, {})).toEqual([]);
  });
});
