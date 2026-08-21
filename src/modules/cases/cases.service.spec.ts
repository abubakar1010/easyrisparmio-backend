import { BadRequestException } from '@nestjs/common';

import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { SwitchCase } from './entities/switch-case.entity';
import { PaymentMethod, InvoiceDelivery } from '../../common/enums/payment.enum';

/**
 * Covers what a case may be opened with, at the one point the app can reach.
 *
 * A direct debit is filed against an account and a tax ID, and the customer is
 * told the switch was submitted the moment the case is created — so a mandate
 * missing either is refused here rather than weeks later by the supplier, when
 * there is nothing left to un-tell. The rule is deliberately not on the DTO:
 * `UpdateCaseDto` shares that base class, and an admin setting the payment
 * method on a case that already stores an IBAN must not be caught by it.
 */

const USER_ID = '00000000-0000-4000-8000-000000000001';
const BILL_ID = '11111111-1111-4111-8111-111111111111';
const OFFER_ID = '22222222-2222-4222-8222-222222222222';

/** Enough of a query builder for the two `getOne()` lookups create makes. */
const emptyQueryBuilder = () => ({
  where: () => emptyQueryBuilder(),
  orWhere: () => emptyQueryBuilder(),
  orderBy: () => emptyQueryBuilder(),
  getOne: async () => null,
});

function makeService() {
  const saved: SwitchCase[] = [];

  const caseRepository = {
    // Null on the first call — the "one bill, one switch" check — and the saved
    // case afterwards, which is what `getCaseById` reads back.
    findOne: async () => saved[0] ?? null,
    create: (data: Partial<SwitchCase>) => ({ ...data }) as SwitchCase,
    save: async (row: SwitchCase) => {
      row.id = 'case-1';
      saved.push(row);
      return row;
    },
    createQueryBuilder: emptyQueryBuilder,
  };

  const billRepository = {
    findOne: async () => ({ id: BILL_ID, userId: USER_ID, supplierId: 'sup-1' }),
    save: async (row: unknown) => row,
  };

  const offerRepository = {
    findOne: async () => ({ id: OFFER_ID, name: 'Fixed 12', supplierId: 'sup-2', supplier: {} }),
  };

  const service = new CasesService(
    caseRepository as never,
    {} as never,
    { create: (d: unknown) => d, save: async (d: unknown) => d } as never,
    billRepository as never,
    offerRepository as never,
    { createQueryBuilder: emptyQueryBuilder } as never,
    { findOne: async () => ({ billId: BILL_ID, offerId: OFFER_ID }) } as never,
    { sendNotification: async () => undefined } as never,
    { notifyAdmins: async () => undefined, describeUser: async () => 'Mario Rossi' } as never,
  );

  return { service, saved };
}

function dto(overrides: Partial<CreateCaseDto> = {}): CreateCaseDto {
  return {
    billId: BILL_ID,
    selectedOfferId: OFFER_ID,
    invoiceDelivery: InvoiceDelivery.DIGITAL,
    ...overrides,
  } as CreateCaseDto;
}

describe('CasesService.createCase — direct debit details', () => {
  it('refuses a direct debit with no IBAN and no tax ID, naming both', async () => {
    const { service } = makeService();
    await expect(
      service.createCase(USER_ID, dto({ paymentMethod: PaymentMethod.RID_BANCARIO })),
    ).rejects.toThrow(/IBAN and holder Codice Fiscale or Partita IVA/);
  });

  it('refuses a direct debit with an IBAN but no tax ID', async () => {
    const { service } = makeService();
    await expect(
      service.createCase(
        USER_ID,
        dto({
          paymentMethod: PaymentMethod.RID_BANCARIO,
          iban: 'IT60X0542811101000000123456',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a direct debit whose tax ID is only whitespace', async () => {
    const { service } = makeService();
    await expect(
      service.createCase(
        USER_ID,
        dto({
          paymentMethod: PaymentMethod.RID_BANCARIO,
          iban: 'IT60X0542811101000000123456',
          ibanHolderTaxCode: '   ',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('leaves a postal order alone — it has no account to file against', async () => {
    const { service, saved } = makeService();
    await service.createCase(USER_ID, dto({ paymentMethod: PaymentMethod.POSTAL_ORDER }));
    expect(saved).toHaveLength(1);
    expect(saved[0].paymentMethod).toBe(PaymentMethod.POSTAL_ORDER);
  });

  it('stores the whole holder block, normalised, when the details are there', async () => {
    const { service, saved } = makeService();
    await service.createCase(
      USER_ID,
      dto({
        paymentMethod: PaymentMethod.RID_BANCARIO,
        iban: 'IT60 X054 2811 1010 0000 0123 456',
        ibanSameAsContract: true,
        ibanHolderFirstName: 'Mario',
        ibanHolderLastName: 'Rossi',
        // Printed the way a customer copies it off a document.
        ibanHolderTaxCode: 'rssmra85 t10a562s',
      }),
    );

    expect(saved[0]).toMatchObject({
      iban: 'IT60X0542811101000000123456',
      ibanSameAsContract: true,
      ibanHolderFirstName: 'Mario',
      ibanHolderLastName: 'Rossi',
      // One spelling per account, so the supplier has nothing to reconcile.
      ibanHolderTaxCode: 'RSSMRA85T10A562S',
    });
  });

  it('records that the account is a third party, which is not the same as unasked', async () => {
    const { service, saved } = makeService();
    await service.createCase(
      USER_ID,
      dto({
        paymentMethod: PaymentMethod.RID_BANCARIO,
        iban: 'IT60X0542811101000000123456',
        ibanSameAsContract: false,
        ibanHolderTaxCode: 'RSSMRA85T10A562S',
      }),
    );
    expect(saved[0].ibanSameAsContract).toBe(false);
  });
});
