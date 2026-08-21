import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCaseDto } from './create-case.dto';
import { UpdateCaseDto } from './update-case.dto';

/**
 * The payment and invoicing fields live on a base class both DTOs extend, the
 * same way the addresses do. The API runs with `whitelist: true,
 * forbidNonWhitelisted: true`, so if the inherited decorators were not picked
 * up the app's own case submission would be rejected outright — and an admin
 * would have no way to correct what the customer sent.
 */
const BASE = {
  billId: '11111111-1111-4111-8111-111111111111',
  selectedOfferId: '22222222-2222-4222-8222-222222222222',
};

const CONTRACT = {
  paymentMethod: 'rid_bancario',
  invoiceDelivery: 'digital',
  invoiceEmail: 'mario.rossi@example.com',
  iban: 'IT60X0542811101000000123456',
  ibanSameAsContract: true,
  ibanHolderFirstName: 'Mario',
  ibanHolderLastName: 'Rossi',
  ibanHolderTaxCode: 'RSSMRA85T10A562S',
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

describe('case contract detail DTOs', () => {
  describe('CreateCaseDto', () => {
    it('accepts the payment and invoicing block the app submits', async () => {
      const errors = await errorsFor(CreateCaseDto, { ...BASE, ...CONTRACT });
      expect(errors).toHaveLength(0);
    });

    it('refuses a payment method that is not one of the four', async () => {
      const errors = await errorsFor(CreateCaseDto, {
        ...BASE,
        paymentMethod: 'cash',
      });
      expect(errors.map((e) => e.property)).toContain('paymentMethod');
    });

    it('refuses an invoice email that is not an email', async () => {
      const errors = await errorsFor(CreateCaseDto, {
        ...BASE,
        invoiceEmail: 'not-an-email',
      });
      expect(errors.map((e) => e.property)).toContain('invoiceEmail');
    });
  });

  /**
   * The holder's tax ID is what the SDD mandate is filed against. A mistyped
   * one is only found out when the supplier bounces the mandate — long after
   * the customer has been told the switch was submitted — so it is checked
   * against its own check digit here rather than merely for its shape.
   */
  describe('ibanHolderTaxCode', () => {
    it.each([
      ['a Codice Fiscale', 'RSSMRA85T10A562S'],
      ['a bare Partita IVA', '00743110157'],
      ['a Partita IVA with its IT prefix', 'IT00743110157'],
    ])('accepts %s', async (_label, ibanHolderTaxCode) => {
      const errors = await errorsFor(CreateCaseDto, { ...BASE, ibanHolderTaxCode });
      expect(errors).toHaveLength(0);
    });

    it.each([
      ['a Codice Fiscale with the wrong check character', 'RSSMRA85T10A562A'],
      ['a Partita IVA with the wrong check digit', '12345678901'],
      ['a string that is neither', 'NOT A TAX CODE'],
    ])('refuses %s', async (_label, ibanHolderTaxCode) => {
      const errors = await errorsFor(CreateCaseDto, { ...BASE, ibanHolderTaxCode });
      expect(errors.map((e) => e.property)).toContain('ibanHolderTaxCode');
    });

    it('still accepts null, which is how an admin clears one', async () => {
      const errors = await errorsFor(UpdateCaseDto, { ibanHolderTaxCode: null });
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateCaseDto', () => {
    it('accepts the same block on its own, so an admin can correct it', async () => {
      const errors = await errorsFor(UpdateCaseDto, CONTRACT);
      expect(errors).toHaveLength(0);
    });

    it('accepts a correction spanning workflow, address and payment fields', async () => {
      const errors = await errorsFor(UpdateCaseDto, {
        status: 'in_progress',
        caseType: 'transfer',
        priority: 'high',
        selectedOfferId: '33333333-3333-4333-8333-333333333333',
        residentialCity: 'Bologna',
        paymentMethod: 'postal_order',
        invoiceDelivery: 'paper',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts null on a nullable field, which is how one is cleared', async () => {
      const errors = await errorsFor(UpdateCaseDto, {
        iban: null,
        invoiceEmail: null,
        paymentMethod: null,
      });
      expect(errors).toHaveLength(0);
    });

    it('refuses an IBAN longer than the column holds', async () => {
      const errors = await errorsFor(UpdateCaseDto, { iban: 'I'.repeat(35) });
      expect(errors.map((e) => e.property)).toContain('iban');
    });

    it('refuses a case type that is not one of the four', async () => {
      const errors = await errorsFor(UpdateCaseDto, { caseType: 'renewal' });
      expect(errors.map((e) => e.property)).toContain('caseType');
    });

    it('refuses a selected offer that is not a UUID', async () => {
      const errors = await errorsFor(UpdateCaseDto, { selectedOfferId: 'offer-1' });
      expect(errors.map((e) => e.property)).toContain('selectedOfferId');
    });

    it('takes the holder flag on its own, so an admin can correct just that', async () => {
      const errors = await errorsFor(UpdateCaseDto, { ibanSameAsContract: false });
      expect(errors).toHaveLength(0);
    });

    it('refuses a holder flag that is not a boolean', async () => {
      const errors = await errorsFor(UpdateCaseDto, { ibanSameAsContract: 'yes' });
      expect(errors.map((e) => e.property)).toContain('ibanSameAsContract');
    });
  });
});
