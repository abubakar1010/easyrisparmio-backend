import {
  ACCOUNT_ADDRESS_TYPES,
  AddressType,
  accountAddressTypeFor,
  addressTypeRoleMismatchMessage,
  forbiddenAccountAddressTypeFor,
  isAccountAddressType,
  isAddressTypeAllowedFor,
} from './address.enum';
import { UserRole } from './role.enum';

describe('account address types', () => {
  describe('accountAddressTypeFor', () => {
    it('gives a business account its registered office', () => {
      expect(accountAddressTypeFor(UserRole.BUSINESS)).toBe(AddressType.LEGAL);
    });

    it('gives a personal account a residence', () => {
      expect(accountAddressTypeFor(UserRole.PERSONAL)).toBe(
        AddressType.RESIDENTIAL,
      );
    });

    // Admins are people, and the seeded admin account carries a home address
    // like any other person's.
    it('treats an admin as a person', () => {
      expect(accountAddressTypeFor(UserRole.ADMIN)).toBe(
        AddressType.RESIDENTIAL,
      );
    });
  });

  describe('forbiddenAccountAddressTypeFor', () => {
    // The point of the pair: whichever type a role holds, it is the only one,
    // and the other must never appear on the account.
    it.each([UserRole.BUSINESS, UserRole.PERSONAL, UserRole.ADMIN])(
      'is the other account type for %s',
      (role) => {
        const allowed = accountAddressTypeFor(role);
        const forbidden = forbiddenAccountAddressTypeFor(role);

        expect(forbidden).not.toBe(allowed);
        expect(ACCOUNT_ADDRESS_TYPES).toContain(forbidden);
      },
    );
  });

  describe('isAddressTypeAllowedFor', () => {
    it('refuses a residence on a business account', () => {
      expect(
        isAddressTypeAllowedFor(UserRole.BUSINESS, AddressType.RESIDENTIAL),
      ).toBe(false);
    });

    it('refuses a registered office on a personal account', () => {
      expect(
        isAddressTypeAllowedFor(UserRole.PERSONAL, AddressType.LEGAL),
      ).toBe(false);
    });

    it('allows each role the type its own address is stored under', () => {
      expect(
        isAddressTypeAllowedFor(UserRole.BUSINESS, AddressType.LEGAL),
      ).toBe(true);
      expect(
        isAddressTypeAllowedFor(UserRole.PERSONAL, AddressType.RESIDENTIAL),
      ).toBe(true);
    });

    // Where the energy arrives and where the invoice is posted are places, not
    // claims about who the holder is, so neither role is constrained in them.
    it.each([AddressType.SUPPLY, AddressType.BILLING])(
      'leaves %s open to both roles',
      (type) => {
        expect(isAddressTypeAllowedFor(UserRole.BUSINESS, type)).toBe(true);
        expect(isAddressTypeAllowedFor(UserRole.PERSONAL, type)).toBe(true);
      },
    );
  });

  describe('isAccountAddressType', () => {
    it('is true only for the two account types', () => {
      expect(isAccountAddressType(AddressType.RESIDENTIAL)).toBe(true);
      expect(isAccountAddressType(AddressType.LEGAL)).toBe(true);
      expect(isAccountAddressType(AddressType.SUPPLY)).toBe(false);
      expect(isAccountAddressType(AddressType.BILLING)).toBe(false);
    });
  });

  describe('addressTypeRoleMismatchMessage', () => {
    // The message is what the admin who sent the wrong type reads, so it has to
    // name the type they should have sent rather than only saying "invalid".
    it('names the registered office for a business account', () => {
      expect(addressTypeRoleMismatchMessage(UserRole.BUSINESS)).toContain(
        '`legal`',
      );
    });

    it('names the residence for a personal account', () => {
      expect(addressTypeRoleMismatchMessage(UserRole.PERSONAL)).toContain(
        '`residential`',
      );
    });
  });
});
