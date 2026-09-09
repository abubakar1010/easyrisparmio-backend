import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCaseDto } from './update-case.dto';

/**
 * The CRM-only half of a case correction: who is handling it, what it is booked
 * at, how long it has, and the contract dates.
 *
 * The API runs with `whitelist: true, forbidNonWhitelisted: true`, so a field
 * the edit form sends without a decorator behind it is not ignored — the whole
 * save is rejected. These are the fields the form gained last, and the ones an
 * admin has no other way to correct, so each is asserted to survive the round
 * trip and each is asserted to refuse a wrong value rather than store it.
 */
async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCaseDto, payload, {
    excludeExtraneousValues: false,
  });
  return validate(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const propertiesIn = async (payload: Record<string, unknown>) =>
  (await errorsFor(payload)).map((e) => e.property);

describe('UpdateCaseDto — handling, commercial and SLA fields', () => {
  it('accepts everything the edit form sends', async () => {
    const errors = await errorsFor({
      caseType: 'switch',
      priority: 'high',
      assignedAgentId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      estimatedAnnualValue: 1140.5,
      slaDaysTotal: 30,
      slaDeadline: '2026-07-15T23:59:59.000Z',
      contractSentAt: '2026-06-01T09:00:00.000Z',
      activationDate: '2026-03-12',
      expiryDate: '2028-03-12',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts null on every field an admin is allowed to blank', async () => {
    // Clearing is how a figure or a date entered against the wrong case is
    // taken back off it — `@IsOptional` has to let null through, not just
    // undefined, or the form could fill these but never empty them.
    const errors = await errorsFor({
      assignedAgentId: null,
      estimatedAnnualValue: null,
      slaDaysTotal: null,
      slaDeadline: null,
      contractSentAt: null,
      activationDate: null,
      expiryDate: null,
    });
    expect(errors).toHaveLength(0);
  });

  it('refuses an agent id that is not a UUID', async () => {
    expect(await propertiesIn({ assignedAgentId: 'giulia' })).toContain(
      'assignedAgentId',
    );
  });

  it('refuses a negative annual value and a fractional SLA', async () => {
    expect(await propertiesIn({ estimatedAnnualValue: -1 })).toContain(
      'estimatedAnnualValue',
    );
    expect(await propertiesIn({ slaDaysTotal: 1.5 })).toContain('slaDaysTotal');
  });

  it('refuses a value carrying more precision than money has', async () => {
    // Money is two decimals everywhere in the app; a third would be rounded
    // silently by the column and reconcile against nothing.
    expect(await propertiesIn({ estimatedAnnualValue: 1140.555 })).toContain(
      'estimatedAnnualValue',
    );
  });

  it('refuses a date that is not a date', async () => {
    expect(await propertiesIn({ contractSentAt: 'yesterday' })).toContain(
      'contractSentAt',
    );
    expect(await propertiesIn({ slaDeadline: '15/07/2026' })).toContain(
      'slaDeadline',
    );
  });

  it('refuses the case number, which is generated and not correctable', async () => {
    expect(await propertiesIn({ caseNumber: 'SW-20260610-00001' })).toContain(
      'caseNumber',
    );
  });
});
