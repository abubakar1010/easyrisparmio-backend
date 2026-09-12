import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { UserRole } from '../../../common/enums/role.enum';

/**
 * One account, one tax identifier.
 *
 * A company is identified by its Partita IVA and a private customer by their
 * Codice Fiscale, and neither account kind carries the other's — a business
 * sign-up offering a Codice Fiscale is refused as surely as a personal one
 * offering a VAT number. What stays true either way is that a code that *is*
 * sent is checked against its check character, not merely its shape.
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
   * The two codes identify two different parties, so a business sign-up may
   * carry both: the Partita IVA is the company's, the Codice Fiscale belongs to
   * the owner who signs. Which of them the direct debit mandate is filed
   * against is settled on the case — always the VAT number for a company — so
   * nothing downstream has to guess from the account alone.
   */
  it('accepts a business sign-up that also offers the owner Codice Fiscale', async () => {
    expect(
      await failedOn({ ...BUSINESS, codiceFiscale: 'RSSMRA85T10A562S' }),
    ).not.toContain('codiceFiscale');
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

  it('normalises the VAT number the way it is stored', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...BUSINESS,
      partitaIva: 'IT 1234-5678-903',
    });

    expect(dto.partitaIva).toBe('12345678903');
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

  it('normalises that code the way it is stored', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...PERSONAL,
      codiceFiscale: ' rssmra85t10a562s ',
    });

    expect(dto.codiceFiscale).toBe('RSSMRA85T10A562S');
    expect(await validate(dto)).toHaveLength(0);
  });

  /**
   * The mirror of the rule above: a private customer has no VAT number, and one
   * offered here would put a company's identifier on a consumer account.
   */
  it('refuses a Partita IVA', async () => {
    expect(
      await failedOn({ ...PERSONAL, partitaIva: '12345678903' }),
    ).toContain('partitaIva');
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
