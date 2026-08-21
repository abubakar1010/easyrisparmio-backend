import { PRECISION, roundMoney, roundPercent, roundTo } from './precision.util';

/**
 * The dashboard used to render whatever `parseFloat` handed back: an AVG over
 * days arrived as 4.333333333333333, a SUM of two-decimal money columns as
 * 128.40000000000001. These tests pin the scale each kind of value leaves the
 * API at, and the string input it has to survive — Postgres sends `decimal`
 * columns and aggregates as text, never as numbers.
 */
describe('precision.util', () => {
  describe('roundTo', () => {
    it('terminates a repeating average', () => {
      expect(roundTo(13 / 3, 2)).toBe(4.33);
    });

    it('accepts the string form a decimal column arrives in', () => {
      expect(roundTo('128.4059', 2)).toBe(128.41);
    });

    it('treats a SUM over no rows as zero rather than NaN', () => {
      expect(roundTo(null, 2)).toBe(0);
      expect(roundTo(undefined, 2)).toBe(0);
      expect(roundTo('', 2)).toBe(0);
    });

    it('gives back a number, not a fixed-width string', () => {
      expect(roundTo('10', 2)).toBe(10);
      expect(typeof roundTo('10', 2)).toBe('number');
    });

    it('refuses to invent a value for junk', () => {
      expect(roundTo('not a number', 2)).toBe(0);
      expect(roundTo(Number.POSITIVE_INFINITY, 2)).toBe(0);
    });

    it('leaves a value already inside the scale untouched', () => {
      expect(roundTo(0.129, 3)).toBe(0.129);
    });
  });

  describe('roundMoney', () => {
    it('clears the artefact a float SUM leaves behind', () => {
      expect(roundMoney(128.40000000000001)).toBe(128.4);
    });

    it('rounds to the schema scale of every money column', () => {
      expect(PRECISION.money).toBe(2);
      expect(roundMoney('19.999')).toBe(20);
      expect(roundMoney('0.126')).toBe(0.13);
    });
  });

  describe('roundPercent', () => {
    it('holds a conversion rate to two decimals', () => {
      expect(roundPercent((17 / 43) * 100)).toBe(39.53);
    });

    it('keeps the sign of a negative period-over-period delta', () => {
      expect(roundPercent(-3.14159)).toBe(-3.14);
    });
  });
});
