import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { UserRole } from '../../../common/enums/role.enum';

/**
 * What a business sign-up has to carry, and what it may.
 *
 * A company is identified by its Partita IVA, but a SEPA direct debit mandate
 * is signed by a person and matched against *their* Codice Fiscale — which the
 * switch request enforces by refusing a VAT number in the holder field, by
 * name. A business account registered without a Codice Fiscale therefore
 * reached that form at a mandatory field the sign-up had never mentioned, with
 * nothing to put in it, so both codes are required here.
 */
const PERSONAL = {
  email: 'mario.rossi@email.com',
  password: 'StrongP@ss1',
  firstName: 'Mario',
  lastName: 'Rossi',
  role: UserRole.PERSONAL,
};

const BUSINESS = {
  ...PERSONAL,
  email: 'info@rossi-srl.it',
  role: UserRole.BUSINESS,
  companyName: 'Rossi S.r.l.',
  partitaIva: '12345678903',
  codiceFiscale: 'RSSMRA85T10A562S',
};

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const failedOn = async (payload: Record<string, unknown>) =>
  (await errorsFor(payload)).map((e) => e.property);

describe('RegisterDto — the three identifiers a business sign-up carries', () => {
  it('accepts a complete business registration', async () => {
    expect(await errorsFor(BUSINESS)).toHaveLength(0);
  });

  it.each(['companyName', 'partitaIva', 'codiceFiscale'])(
    'refuses a business sign-up missing %s',
    async (field) => {
      const payload = { ...BUSINESS };
      delete (payload as Record<string, unknown>)[field];
      expect(await failedOn(payload)).toContain(field);
    },
  );

  /**
   * Not merely the shape. A code that fails only at the supplier is a code that
   * failed too late: by then the customer has been told the switch was filed.
   */
  it('refuses a Partita IVA whose check digit does not add up', async () => {
    expect(await failedOn({ ...BUSINESS, partitaIva: '12345678901' })).toContain(
      'partitaIva',
    );
  });

  it('refuses a Codice Fiscale whose check character does not match', async () => {
    expect(
      await failedOn({ ...BUSINESS, codiceFiscale: 'RSSMRA85T10A562A' }),
    ).toContain('codiceFiscale');
  });

  /**
   * A VAT number is not a personal tax code, however valid it is. Accepting one
   * here would put a company's number where the mandate expects a signatory's,
   * and the app refuses exactly that a few screens later.
   */
  it('refuses a Partita IVA offered as the Codice Fiscale', async () => {
    expect(
      await failedOn({ ...BUSINESS, codiceFiscale: '12345678903' }),
    ).toContain('codiceFiscale');
  });

  it('normalises both codes the way they are stored', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...BUSINESS,
      partitaIva: 'IT 1234-5678-903',
      codiceFiscale: ' rssmra85t10a562s ',
    });

    expect(dto.partitaIva).toBe('12345678903');
    expect(dto.codiceFiscale).toBe('RSSMRA85T10A562S');
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('RegisterDto — a personal sign-up', () => {
  it('needs neither company nor tax code', async () => {
    expect(await errorsFor(PERSONAL)).toHaveLength(0);
  });

  /**
   * Optional is not the same as unchecked: a personal account may leave it out,
   * but one that sends a broken code should hear about it now rather than at
   * the direct debit step.
   */
  it('still checks a Codice Fiscale it is given', async () => {
    expect(
      await failedOn({ ...PERSONAL, codiceFiscale: 'RSSMRA85T10A562A' }),
    ).toContain('codiceFiscale');
  });
});

describe('RegisterDto — where a company is invoiced', () => {
  it('accepts a PEC and an SDI code', async () => {
    expect(
      await errorsFor({
        ...BUSINESS,
        pecEmail: 'rossi@pec.it',
        sdiCode: 'M5UXCR1',
      }),
    ).toHaveLength(0);
  });

  /** The official code for a company with no SDI channel, invoiced by PEC. */
  it('accepts the no-channel SDI placeholder', async () => {
    expect(
      await errorsFor({ ...BUSINESS, sdiCode: '0000000' }),
    ).toHaveLength(0);
  });

  it('refuses an SDI code that is not seven characters', async () => {
    expect(await failedOn({ ...BUSINESS, sdiCode: 'ABC123' })).toContain(
      'sdiCode',
    );
  });

  it('refuses a PEC that is not an address', async () => {
    expect(await failedOn({ ...BUSINESS, pecEmail: 'not-an-address' })).toContain(
      'pecEmail',
    );
  });

  it('leaves both out of a sign-up that does not mention them', async () => {
    expect(await errorsFor(BUSINESS)).toHaveLength(0);
  });
});
