import { IsItalianTaxIdConstraint } from './is-italian-tax-id.validator';

/**
 * The rule this constraint implements is mirrored in the Flutter app
 * (`lib/core/utils/tax_id_validator.dart`) and in the dashboard
 * (`src/utils/italianTaxId.ts`), because all three have to reach the same
 * verdict: a code the app accepts and the API refuses strands a customer on the
 * request form with no way forward. These cases are the shared contract — when
 * one of the three changes, this table is what the other two are held to.
 */
describe('IsItalianTaxIdConstraint', () => {
  const constraint = new IsItalianTaxIdConstraint();
  const check = (value: unknown) => constraint.validate(value);

  describe('Codice Fiscale', () => {
    it.each(['RSSMRA85T10A562S', 'MRTMTT25D09F205Z'])('accepts %s', (value) => {
      expect(check(value)).toBe(true);
    });

    it('accepts one written in lower case and padded with spaces', () => {
      expect(check('  mrtmtt25d09f205z  ')).toBe(true);
    });

    it('accepts one written in the groups it is printed in', () => {
      // Whitespace is stripped, not trimmed: the clients normalise the same
      // way, so a value they accept must not come back a 400 from here.
      expect(check('MRTMTT 25D09 F205Z')).toBe(true);
    });

    it("accepts a woman's code, whose day of birth carries the forty", () => {
      expect(check('RSSMRA85T50A562W')).toBe(true);
    });

    // The Agenzia delle Entrate replaces numerals with letters — 0→L, 1→M, 2→N,
    // 3→P, 4→Q, 5→R, 6→S, 7→T, 8→U, 9→V — from the right whenever two people
    // would otherwise be issued the same code. These are on real identity
    // cards, and each substitution changes the check character too.
    it.each(['MRTMTT25D09F20RU', 'MRTMTT25D09F2LRF', 'MRTMTT25D09FNLRU'])(
      'accepts the omocodia code %s',
      (value) => {
        expect(check(value)).toBe(true);
      },
    );

    it('refuses an omocodia code whose check character is wrong', () => {
      expect(check('MRTMTT25D09F20RA')).toBe(false);
    });

    it('refuses a well-shaped code whose check character is wrong', () => {
      // Everything but the last character is a real Codice Fiscale, which is
      // exactly what a typo produces — the shape alone would wave it through.
      expect(check('MRTMTT25D09F205A')).toBe(false);
    });

    it('refuses a month letter that was never issued', () => {
      // Only ABCDEHLMPRST are month letters.
      expect(check('MRTMTT25N09F205M')).toBe(false);
    });

    it.each(['MRTMTT25D00F205F', 'MRTMTT25D35F205U', 'MRTMTT25D99F205I'])(
      'refuses %s, whose day of birth cannot exist',
      (value) => {
        expect(check(value)).toBe(false);
      },
    );

    it('refuses sixteen characters of the wrong shape', () => {
      expect(check('1234567890123456')).toBe(false);
    });
  });

  describe('Partita IVA', () => {
    it('accepts eleven digits with a valid check digit', () => {
      expect(check('00743110157')).toBe(true);
    });

    it('accepts the same number written with its IT country prefix', () => {
      expect(check('IT00743110157')).toBe(true);
    });

    it('accepts the same number written with its printed punctuation', () => {
      expect(check('IT-00743.110.157')).toBe(true);
    });

    it('refuses eleven digits whose check digit is wrong', () => {
      expect(check('12345678901')).toBe(false);
    });

    it('refuses ten and twelve digits', () => {
      expect(check('0074311015')).toBe(false);
      expect(check('007431101577')).toBe(false);
    });
  });

  it('refuses anything that is not a string', () => {
    expect(check(undefined)).toBe(false);
    expect(check(null)).toBe(false);
    expect(check(12345678901)).toBe(false);
  });

  it('refuses an empty string', () => {
    expect(check('')).toBe(false);
  });

  it('refuses the placeholder values a test account tends to carry', () => {
    // Reported as valid by a customer; it is not — the first fifteen
    // characters imply a final X, not a Z.
    expect(check('MRRMRA42E48B888Z')).toBe(false);
    expect(check('IT45324567894')).toBe(false);
  });

  it('names both accepted forms, since the field takes either', () => {
    expect(constraint.defaultMessage()).toMatch(/Codice Fiscale/);
    expect(constraint.defaultMessage()).toMatch(/Partita IVA/);
  });
});
