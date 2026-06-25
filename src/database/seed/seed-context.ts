import { User } from '../../modules/users/entities/user.entity';
import { Supplier } from '../../modules/suppliers/entities/supplier.entity';
import { Offer } from '../../modules/offers/entities/offer.entity';
import { Meter } from '../../modules/meters/entities/meter.entity';
import { EnergyBill } from '../../modules/bills/entities/energy-bill.entity';
import { SwitchCase } from '../../modules/cases/entities/switch-case.entity';
import { SupportTicket } from '../../modules/support/entities/support-ticket.entity';
import { CommissionRule } from '../../modules/commissions/entities/commission-rule.entity';
import { UserAddress } from '../../modules/users/entities/user-address.entity';
import { CsvReconciliation } from '../../modules/reconciliation/entities/csv-reconciliation.entity';
import { Contract } from '../../modules/contracts/entities/contract.entity';

export interface SeedContext {
  users: {
    admin: User;
    personal: User[];
    business: User[];
  };
  suppliers: Supplier[];
  offers: Offer[];
  meters: Meter[];
  bills: EnergyBill[];
  cases: SwitchCase[];
  tickets: SupportTicket[];
  commissionRules: CommissionRule[];
  addresses: UserAddress[];
  reconciliations: CsvReconciliation[];
  contracts: Contract[];
}

export function createEmptyContext(): SeedContext {
  return {
    users: { admin: null as any, personal: [], business: [] },
    suppliers: [],
    offers: [],
    meters: [],
    bills: [],
    cases: [],
    tickets: [],
    commissionRules: [],
    addresses: [],
    reconciliations: [],
    contracts: [],
  };
}
