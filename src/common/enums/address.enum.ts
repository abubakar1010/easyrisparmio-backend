import { UserRole } from './role.enum';

export enum AddressType {
  RESIDENTIAL = 'residential',
  SUPPLY = 'supply',
  LEGAL = 'legal',
  BILLING = 'billing',
}

/**
 * The address type an account's own address is stored under when the caller
 * does not say.
 *
 * A company has a registered office — a sede legale — and no residence. Storing
 * one under `RESIDENTIAL` is not a cosmetic mislabel: it is the only thing that
 * distinguishes the two, so once it is wrong nothing downstream can tell a
 * company's legal seat from someone's home.
 */
export function defaultAddressTypeFor(role: UserRole): AddressType {
  return role === UserRole.BUSINESS
    ? AddressType.LEGAL
    : AddressType.RESIDENTIAL;
}
