import { BadRequestException } from '@nestjs/common';

import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { SwitchCase } from './entities/switch-case.entity';
import { PaymentMethod, InvoiceDelivery } from '../../common/enums/payment.enum';
import { CaseStatus, CasePriority } from '../../common/enums/case.enum';

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
    {
      adminApplicationSubmitted: async () => undefined,
      caseMilestone: async () => undefined,
    } as never,
    // Only `updateCase` reaches for a user, to check an assigned agent is an
    // admin; nothing under test here assigns one.
    { findOne: async () => null } as never,
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

/**
 * A case as Postgres hands it back: `decimal` columns arrive as strings and
 * `date` columns as `YYYY-MM-DD`, both of which the update writes back as a
 * number and a `Date`. That mismatch is the whole reason the handling diff
 * normalises before it compares.
 */
function makeUpdateService(
  existing: Partial<SwitchCase> = {},
  agent: { id: string } | null = null,
  supplier: { id: string } | null = null,
) {
  const events: { title: string; metadata?: Record<string, any> }[] = [];

  const switchCase = {
    id: 'case-1',
    status: CaseStatus.IN_PROGRESS,
    caseType: 'switch',
    priority: 'medium',
    selectedOfferId: OFFER_ID,
    assignedAgentId: null,
    residentialSameAsSupply: false,
    shippingSameAsSupply: false,
    estimatedAnnualValue: '1140.00' as unknown as number,
    slaDaysTotal: 30,
    slaDeadline: null,
    contractSentAt: null,
    activationDate: null,
    expiryDate: null,
    ...existing,
  } as SwitchCase;

  const service = new CasesService(
    {
      findOne: async () => switchCase,
      save: async (row: SwitchCase) => row,
    } as never,
    {} as never,
    {
      create: (d: { title: string; metadata?: Record<string, any> }) => d,
      save: async (d: { title: string; metadata?: Record<string, any> }) => {
        events.push(d);
        return d;
      },
    } as never,
    {} as never,
    { findOne: async () => null } as never,
    { findOne: async () => supplier } as never,
    {} as never,
    { caseMilestone: async () => undefined } as never,
    { findOne: async () => agent } as never,
  );

  return { service, switchCase, events };
}

describe('CasesService.updateCase — handling fields', () => {
  it('refuses an assigned agent who is not an admin, before anything is written', async () => {
    const { service, switchCase } = makeUpdateService();
    await expect(
      service.updateCase('case-1', {
        assignedAgentId: '33333333-3333-4333-8333-333333333333',
        priority: CasePriority.HIGH,
      } as never),
    ).rejects.toThrow(BadRequestException);
    // The priority must not have moved: a rejected edit leaves the case as it
    // was rather than half-applied.
    expect(switchCase.priority).toBe('medium');
  });

  it('assigns an admin and logs the handover with both sides of it', async () => {
    const AGENT = '33333333-3333-4333-8333-333333333333';
    const { service, switchCase, events } = makeUpdateService({}, { id: AGENT });
    await service.updateCase('case-1', { assignedAgentId: AGENT } as never);

    expect(switchCase.assignedAgentId).toBe(AGENT);
    expect(events).toContainEqual(
      expect.objectContaining({
        title: 'Agent assigned to case',
        metadata: { changes: { assignedAgentId: { old: null, new: AGENT } } },
      }),
    );
  });

  it('logs unassignment too — the case going back to the queue is a handover', async () => {
    const AGENT = '33333333-3333-4333-8333-333333333333';
    const { service, events } = makeUpdateService({ assignedAgentId: AGENT });
    await service.updateCase('case-1', { assignedAgentId: null } as never);

    expect(events).toContainEqual(
      expect.objectContaining({ title: 'Agent unassigned from case' }),
    );
  });

  it('writes the commercial figure, the SLA and the contract dates', async () => {
    const { service, switchCase } = makeUpdateService();
    await service.updateCase('case-1', {
      estimatedAnnualValue: 2200,
      slaDaysTotal: 14,
      slaDeadline: '2026-07-15T23:59:59.000Z',
      contractSentAt: '2026-06-01T09:00:00.000Z',
      activationDate: '2026-03-12',
      expiryDate: '2028-03-12',
    } as never);

    expect(switchCase.estimatedAnnualValue).toBe(2200);
    expect(switchCase.slaDaysTotal).toBe(14);
    expect(switchCase.slaDeadline).toEqual(new Date('2026-07-15T23:59:59.000Z'));
    expect(switchCase.contractSentAt).toEqual(new Date('2026-06-01T09:00:00.000Z'));
    expect(switchCase.activationDate).toEqual(new Date('2026-03-12'));
  });

  it('clears a date and a figure that were entered against the wrong case', async () => {
    const { service, switchCase } = makeUpdateService({
      contractSentAt: new Date('2026-06-01T09:00:00.000Z'),
    });
    await service.updateCase('case-1', {
      contractSentAt: null,
      estimatedAnnualValue: null,
    } as never);

    expect(switchCase.contractSentAt).toBeNull();
    expect(switchCase.estimatedAnnualValue).toBeNull();
  });

  it('does not log a correction for a value that only changed shape', async () => {
    // "1140.00" off a `decimal` column and 1140 off the form are the same
    // amount; logging that as an admin correction would put something on the
    // timeline that nobody did.
    const { service, events } = makeUpdateService();
    await service.updateCase('case-1', { estimatedAnnualValue: 1140 } as never);

    expect(
      events.filter((e) => e.title === 'Case handling details updated'),
    ).toHaveLength(0);
  });

  it('logs the fields that really moved, with their before and after', async () => {
    const { service, events } = makeUpdateService();
    await service.updateCase('case-1', {
      priority: CasePriority.URGENT,
      slaDaysTotal: 14,
    } as never);

    const logged = events.find((e) => e.title === 'Case handling details updated');
    expect(logged?.metadata?.changes).toEqual({
      priority: { old: 'medium', new: 'urgent' },
      slaDaysTotal: { old: 30, new: 14 },
    });
  });

  it('refuses an outgoing supplier that is not a supplier record', async () => {
    const { service, switchCase } = makeUpdateService();
    await expect(
      service.updateCase('case-1', {
        fromSupplierId: '44444444-4444-4444-8444-444444444444',
      } as never),
    ).rejects.toThrow(/Supplier not found/);
    expect(switchCase.fromSupplierId).toBeUndefined();
  });

  it('records the outgoing supplier, and lets an admin take it back off', async () => {
    const SUPPLIER = '44444444-4444-4444-8444-444444444444';
    const { service, switchCase } = makeUpdateService({}, null, { id: SUPPLIER });
    await service.updateCase('case-1', { fromSupplierId: SUPPLIER } as never);
    expect(switchCase.fromSupplierId).toBe(SUPPLIER);

    // Null is the honest value for a bill whose supplier matched no record.
    await service.updateCase('case-1', { fromSupplierId: null } as never);
    expect(switchCase.fromSupplierId).toBeNull();
  });

  it('refuses an expiry that does not follow the activation date', async () => {
    const { service } = makeUpdateService();
    await expect(
      service.updateCase('case-1', {
        activationDate: '2026-03-12',
        expiryDate: '2026-03-12',
      } as never),
    ).rejects.toThrow(/Expiry date must be after the activation date/);
  });
});
