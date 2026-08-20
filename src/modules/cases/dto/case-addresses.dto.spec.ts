import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCaseDto } from './create-case.dto';
import { UpdateCaseDto } from './update-case.dto';

/**
 * The address fields live on a base class both DTOs extend. The API runs with
 * `whitelist: true, forbidNonWhitelisted: true`, so if inherited decorators
 * were not picked up the app's own case submission would be rejected outright —
 * which is what these check.
 */
const BASE = {
  billId: '11111111-1111-4111-8111-111111111111',
  selectedOfferId: '22222222-2222-4222-8222-222222222222',
};

const SUPPLY = {
  supplyStreet: 'Via Roma',
  supplyStreetNumber: '42',
  supplyCity: 'Milano',
  supplyPostalCode: '20121',
  supplyProvince: 'MI',
};

async function errorsFor<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, payload, {
    excludeExtraneousValues: false,
  });
  return validate(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('case address DTOs', () => {
  describe('CreateCaseDto', () => {
    it('accepts the three address blocks the app submits', async () => {
      const errors = await errorsFor(CreateCaseDto, {
        ...BASE,
        ...SUPPLY,
        residentialSameAsSupply: false,
        residentialStreet: 'Via Verdi',
        residentialStreetNumber: '3',
        residentialCity: 'Torino',
        residentialPostalCode: '10121',
        residentialProvince: 'TO',
        shippingSameAsSupply: true,
        shippingStreet: 'Via Roma',
        shippingStreetNumber: '42',
        shippingCity: 'Milano',
        shippingPostalCode: '20121',
        shippingProvince: 'MI',
      });
      expect(errors).toHaveLength(0);
    });

    it('refuses a CAP that is not five digits, on every block', async () => {
      for (const field of [
        'supplyPostalCode',
        'residentialPostalCode',
        'shippingPostalCode',
      ]) {
        const errors = await errorsFor(CreateCaseDto, {
          ...BASE,
          ...SUPPLY,
          [field]: '2012',
        });
        expect(errors.map((e) => e.property)).toContain(field);
      }
    });

    it('still refuses a property no DTO declares', async () => {
      const errors = await errorsFor(CreateCaseDto, {
        ...BASE,
        ...SUPPLY,
        supplyCounty: 'Lombardia',
      });
      expect(errors.map((e) => e.property)).toContain('supplyCounty');
    });
  });

  describe('UpdateCaseDto', () => {
    it('accepts a single address field on its own', async () => {
      const errors = await errorsFor(UpdateCaseDto, { residentialCity: 'Bologna' });
      expect(errors).toHaveLength(0);
    });

    it('accepts an address edit alongside the fields it already had', async () => {
      const errors = await errorsFor(UpdateCaseDto, {
        status: 'in_progress',
        residentialSameAsSupply: false,
        residentialStreet: 'Via Dante',
        residentialPostalCode: '40121',
      });
      expect(errors).toHaveLength(0);
    });

    it('refuses a bad CAP', async () => {
      const errors = await errorsFor(UpdateCaseDto, { shippingPostalCode: 'ABCDE' });
      expect(errors.map((e) => e.property)).toContain('shippingPostalCode');
    });
  });
});
