/**
 * The single source of truth for whether a supplier is usable. Only an ACTIVE
 * supplier is listed publicly and can carry offers. PENDING_DELETION is set by
 * the deletion flow alone; admins choose between ACTIVE and INACTIVE.
 */
export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_DELETION = 'pending_deletion',
}

/** The statuses an admin may set directly (create, edit, toggle). */
export const ADMIN_SETTABLE_SUPPLIER_STATUSES = [
  SupplierStatus.ACTIVE,
  SupplierStatus.INACTIVE,
] as const;

export enum Commodity {
  ELECTRICITY = 'electricity',
  GAS = 'gas',
  DUAL = 'dual',
}
