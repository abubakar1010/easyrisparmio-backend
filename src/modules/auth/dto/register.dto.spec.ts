import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { UserRole } from '../../../common/enums/role.enum';

/**
 * What a business sign-up has to carry, and what it may.
 *
 * A company is identified by its Partita IVA, and that is all sign-up asks a
 * business for. The Codice Fiscale — the person's own, which a SEPA mandate is
 * signed and matched against — is optional here for a business exactly as it is
 * for a private account: both are asked on the profile screen and on the switch
 * request form, which is the point at which the mandate needs it. What stays
 * true for either kind is that a code that *is* sent is checked.
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

  it.each(['companyName', 'partitaIva'])(
    'refuses a business sign-up missing %s',
    async (field) => {
      const payload = { ...BUSINESS };
      delete (payload as Record<string, unknown>)[field];
      expect(await failedOn(payload)).toContain(field);
    },
  );

  /**
   * Sign-up asks for what the account cannot be created without. The mandate
   * needs a person's code, but the request form is where it is filled in — for
   * a company exactly as for a private customer — so a business that has not
   * given one yet still registers.
   */
  it('accepts a business sign-up that omits the Codice Fiscale', async () => {
    const payload = { ...BUSINESS };
    delete (payload as Record<string, unknown>).codiceFiscale;
    expect(await errorsFor(payload)).toHaveLength(0);
  });

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
  it('accepts a PEC', async () => {
    expect(
      await errorsFor({ ...BUSINESS, pecEmail: 'rossi@pec.it' }),
    ).toHaveLength(0);
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
