import {
  composeAddressLine,
  hasAddressParts,
  normalizePostalCode,
  normalizeProvince,
  parseAddressLine,
  reconcileAddress,
} from './address.utils';

describe('address.utils', () => {
  describe('parseAddressLine', () => {
    it('splits the shape Italian bills print', () => {
      expect(parseAddressLine('VIA ROMA 42, 20121 MILANO (MI)')).toEqual({
        street: 'Via Roma',
        streetNumber: '42',
        city: 'Milano',
        postalCode: '20121',
        province: 'MI',
      });
    });

    it('handles the dash separator and a suffixed civic number', () => {
      expect(parseAddressLine('Corso Vittorio Emanuele 10/A - 00186 Roma (RM)')).toEqual({
        street: 'Corso Vittorio Emanuele',
        streetNumber: '10/A',
        city: 'Roma',
        postalCode: '00186',
        province: 'RM',
      });
    });

    it('takes a trailing sigla with no brackets', () => {
      expect(parseAddressLine('Via Verdi 3, 09100 Cagliari CA').province).toBe('CA');
    });

    it('leaves a trailing two-letter word that is no sigla on the city', () => {
      // The check against the official sigle is what stops the last word of a
      // city name being carried off as a province.
      const parsed = parseAddressLine('Via Milano 5, 24020 Zu');
      expect(parsed.province).toBeNull();
      expect(parsed.city).toBe('Zu');
    });

    it('does not read a civic number as the city when there is no CAP', () => {
      expect(parseAddressLine('Via Roma, 10')).toEqual({
        street: 'Via Roma',
        streetNumber: '10',
        city: null,
        postalCode: null,
        province: null,
      });
    });

    it('keeps mixed-case input exactly as printed', () => {
      expect(parseAddressLine('Via del Corso 1, 00187 Roma (RM)').street).toBe(
        'Via del Corso',
      );
    });

    it('returns empty parts for nothing usable', () => {
      for (const input of [null, undefined, '', '   ']) {
        expect(parseAddressLine(input)).toEqual({
          street: null,
          streetNumber: null,
          city: null,
          postalCode: null,
          province: null,
        });
      }
    });
  });

  describe('composeAddressLine', () => {
    it('renders the five fields as one line', () => {
      expect(
        composeAddressLine({
          street: 'Via Roma',
          streetNumber: '42',
          city: 'Milano',
          postalCode: '20121',
          province: 'MI',
        }),
      ).toBe('Via Roma 42, 20121 Milano (MI)');
    });

    it('skips the parts that are missing', () => {
      expect(composeAddressLine({ street: 'Via Roma', city: 'Milano' })).toBe(
        'Via Roma, Milano',
      );
    });

    it('is null when there is nothing to render', () => {
      expect(composeAddressLine({})).toBeNull();
      expect(composeAddressLine({ street: '  ' })).toBeNull();
    });

    it('round-trips a parsed line', () => {
      const line = 'VIA ROMA 42, 20121 MILANO (MI)';
      const parsed = parseAddressLine(line);
      expect(composeAddressLine(parsed)).toBe('Via Roma 42, 20121 Milano (MI)');
    });
  });

  describe('reconcileAddress', () => {
    const LINE = 'VIA ROMA 42, 20121 MILANO (MI)';

    it('splits a line when no part was given', () => {
      const { parts, recovered } = reconcileAddress(LINE, {});
      expect(parts).toEqual({
        street: 'Via Roma',
        streetNumber: '42',
        city: 'Milano',
        postalCode: '20121',
        province: 'MI',
      });
      expect(recovered).toHaveLength(5);
    });

    it('fills only the parts that are missing and keeps the rest', () => {
      const { parts, recovered } = reconcileAddress(LINE, {
        street: 'Viale Certosa',
        city: 'Milano',
      });
      expect(parts.street).toBe('Viale Certosa');
      expect(parts.streetNumber).toBe('42');
      expect(recovered).toEqual(['streetNumber', 'postalCode', 'province']);
    });

    it('does not let one stray part overwrite a good line', () => {
      // The regression this guards: composing from `{province: 'MI'}` alone
      // used to replace the whole printed address with "(MI)".
      const { line } = reconcileAddress(LINE, { province: 'MI' });
      expect(line).toBe('Via Roma 42, 20121 Milano (MI)');
    });

    it('never drops address text it cannot structure', () => {
      // A line with no CAP, civic number or sigla lands whole in the street
      // rather than being discarded, so the address survives to the admin form.
      const { line, parts } = reconcileAddress('c/o portineria', {});
      expect(parts.street).toBe('c/o portineria');
      expect(line).toBe('c/o portineria');
    });

    it('renders the line from the parts when both were given', () => {
      const { line } = reconcileAddress('whatever was printed', {
        street: 'Via Verdi',
        streetNumber: '3',
        city: 'Cagliari',
        postalCode: '09100',
        province: 'CA',
      });
      expect(line).toBe('Via Verdi 3, 09100 Cagliari (CA)');
    });

    it('drops a CAP that is not five digits', () => {
      const { parts } = reconcileAddress(null, { postalCode: '2012' });
      expect(parts.postalCode).toBeNull();
    });

    it('is all nulls when there is neither a line nor a part', () => {
      const { line, parts, recovered } = reconcileAddress(null, {});
      expect(line).toBeNull();
      expect(recovered).toEqual([]);
      expect(Object.values(parts).every((v) => v === null)).toBe(true);
    });
  });

  describe('hasAddressParts', () => {
    it('is true as soon as one field carries something', () => {
      expect(hasAddressParts({ province: 'MI' })).toBe(true);
      expect(hasAddressParts({})).toBe(false);
      expect(hasAddressParts({ street: '', city: '   ' })).toBe(false);
    });
  });

  describe('normalizePostalCode', () => {
    it('keeps a five-digit CAP and drops anything else', () => {
      expect(normalizePostalCode(' 20121 ')).toBe('20121');
      expect(normalizePostalCode('2012')).toBeNull();
      expect(normalizePostalCode('201211')).toBeNull();
      expect(normalizePostalCode('2012A')).toBeNull();
      expect(normalizePostalCode(null)).toBeNull();
    });
  });

  describe('normalizeProvince', () => {
    it('trims and collapses blanks to null', () => {
      expect(normalizeProvince('  MI ')).toBe('MI');
      expect(normalizeProvince('   ')).toBeNull();
      expect(normalizeProvince(undefined)).toBeNull();
    });
  });
});
