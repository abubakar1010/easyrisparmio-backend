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

    it('refuses a well-shaped code whose check character is wrong', () => {
      // Everything but the last character is a real Codice Fiscale, which is
      // exactly what a typo produces — the shape alone would wave it through.
      expect(check('MRTMTT25D09F205A')).toBe(false);
    });

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

  it('names both accepted forms, since the field takes either', () => {
    expect(constraint.defaultMessage()).toMatch(/Codice Fiscale/);
    expect(constraint.defaultMessage()).toMatch(/Partita IVA/);
  });
});
