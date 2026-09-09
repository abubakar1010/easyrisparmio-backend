import { UserRole } from './role.enum';

export enum AddressType {
  RESIDENTIAL = 'residential',
  SUPPLY = 'supply',
  LEGAL = 'legal',
  BILLING = 'billing',
}

/**
 * The two types that stand for the account holder's *own* address, as opposed
 * to where the energy is delivered (`supply`) or where paper invoices are
 * posted (`billing`).
 *
 * Exactly one of the two belongs on an account, and which one is not a
 * preference: a person has a residence and no registered office, a company has
 * a registered office — a sede legale — and no residence.
 */
export const ACCOUNT_ADDRESS_TYPES = [
  AddressType.RESIDENTIAL,
  AddressType.LEGAL,
] as const;

export type AccountAddressType = (typeof ACCOUNT_ADDRESS_TYPES)[number];

/** True for `residential` and `legal` — the account's own address. */
export function isAccountAddressType(
  type: AddressType,
): type is AccountAddressType {
  return (ACCOUNT_ADDRESS_TYPES as readonly AddressType[]).includes(type);
}

/**
 * The type an account's own address is stored under: `legal` — the registered
 * office — for a business, `residential` for a personal account.
 *
 * The type is the only thing that distinguishes the two, so once it is wrong
 * nothing downstream can tell a company's legal seat from someone's home.
 */
export function accountAddressTypeFor(role: UserRole): AccountAddressType {
  return role === UserRole.BUSINESS
    ? AddressType.LEGAL
    : AddressType.RESIDENTIAL;
}

/**
 * The account address type a role must never hold — the other half of
 * {@link accountAddressTypeFor}.
 *
 * A business account holds no residence at all, and a personal account no
 * registered office, so this is what gets refused on write and what gets
 * rewritten when an account changes role.
 */
export function forbiddenAccountAddressTypeFor(
  role: UserRole,
): AccountAddressType {
  return role === UserRole.BUSINESS
    ? AddressType.RESIDENTIAL
    : AddressType.LEGAL;
}

/**
 * Whether `type` may be stored against an account of `role`.
 *
 * `supply` and `billing` describe places rather than who the holder is, so
 * either role may hold them; only the account's own address is constrained.
 */
export function isAddressTypeAllowedFor(
  role: UserRole,
  type: AddressType,
): boolean {
  return type !== forbiddenAccountAddressTypeFor(role);
}

/** Why a mismatched type was refused, phrased for whoever sent it. */
export function addressTypeRoleMismatchMessage(role: UserRole): string {
  return role === UserRole.BUSINESS
    ? 'A business account has a registered office (sede legale), not a residence: its own address must be stored as `legal`'
    : 'A personal account has a residence, not a registered office: its own address must be stored as `residential`';
}
