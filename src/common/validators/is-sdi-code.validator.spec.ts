import {
  SDI_CODE_NO_CHANNEL,
  isValidSdiCode,
  normalizeSdiCode,
} from './is-sdi-code.validator';
import {
  AddressType,
  defaultAddressTypeFor,
} from '../enums/address.enum';
import { UserRole } from '../enums/role.enum';

/**
 * The Codice Destinatario and the address type an account's own address gets:
 * the two smallest pieces of "a company is not a person" that everything else
 * builds on.
 */
describe('isValidSdiCode', () => {
  it.each(['ABC1234', 'M5UXCR1', 'USAL8PV', '0000001'])(
    'accepts %s',
    (code) => {
      expect(isValidSdiCode(code)).toBe(true);
    },
  );

  /**
   * The official code for a recipient with no SDI channel, who is invoiced by
   * PEC instead. A real stored value — rejecting it would leave those companies
   * unable to say what is true of them.
   */
  it('accepts the no-channel placeholder', () => {
    expect(isValidSdiCode(SDI_CODE_NO_CHANNEL)).toBe(true);
  });

  it.each([
    ['too short', 'ABC123'],
    ['too long', 'ABC12345'],
    ['a punctuation character', 'ABC-234'],
    ['empty', ''],
  ])('refuses %s', (_label, code) => {
    expect(isValidSdiCode(code)).toBe(false);
  });

  it('reads a code as it is typed, not only as it is stored', () => {
    // Lower case and stray spacing are how one arrives out of an email; it is
    // the normalised value that is compared, here and in both clients.
    expect(isValidSdiCode(' m5uxcr1 ')).toBe(true);
    expect(normalizeSdiCode(' m5uxcr1 ')).toBe('M5UXCR1');
  });
});

describe('defaultAddressTypeFor', () => {
  /**
   * A company has a registered office and no residence. Storing one under
   * `RESIDENTIAL` is not a cosmetic mislabel: the type is the only thing that
   * tells a sede legale from someone's home, so once it is wrong nothing
   * downstream can recover the difference.
   */
  it('gives a business account a registered office', () => {
    expect(defaultAddressTypeFor(UserRole.BUSINESS)).toBe(AddressType.LEGAL);
  });

  it.each([UserRole.PERSONAL, UserRole.ADMIN])(
    'gives %s a residence',
    (role) => {
      expect(defaultAddressTypeFor(role)).toBe(AddressType.RESIDENTIAL);
    },
  );
});
