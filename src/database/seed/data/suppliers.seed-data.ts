import { DataSource } from 'typeorm';
import { Supplier } from '../../../modules/suppliers/entities/supplier.entity';
import { SeedContext } from '../seed-context';
import { SupplierStatus, Commodity } from '../../../common/enums/supplier.enum';

export async function seedSuppliers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Supplier);

  const suppliersData = [
    {
      name: 'Enel',
      legalName: 'Enel Energia S.p.A.',
      taxId: 'IT06655971007',
      supplierCode: 'ENEL',
      description:
        'Il principale fornitore di energia elettrica e gas in Italia, con milioni di clienti su tutto il territorio nazionale.',
      rating: 4.2,
      isActive: true,
      status: SupplierStatus.ACTIVE,
      commodity: Commodity.DUAL,
      contactName: 'Marco Bianchi',
      contactEmail: 'partner@enel.it',
      contactPhone: '+39 800 900 860',
      website: 'https://www.enel.it',
      logoUrl: 'https://example.com/logos/enel.png',
      streetAddress: 'Viale Regina Margherita 137',
      city: 'Roma',
      zipCode: '00198',
      country: 'Italy',
      iban: 'IT60X0542811101000000123456',
      commissionElectricity: 45,
      commissionGas: 38,
      contractStartDate: '2025-01-01',
      notes: 'Primary energy partner. Volume bonus reviewed quarterly.',
    },
    {
      name: 'Eni',
      legalName: 'Eni Plenitude S.p.A.',
      taxId: 'IT15844561009',
      supplierCode: 'ENI',
      description:
        'Divisione retail di Eni per la fornitura di luce, gas e servizi energetici per la casa e le imprese.',
      rating: 3.8,
      isActive: true,
      status: SupplierStatus.ACTIVE,
      commodity: Commodity.GAS,
      contactName: 'Giulia Conte',
      contactEmail: 'agenzie@plenitude.com',
      contactPhone: '+39 800 900 700',
      website: 'https://eniplenitude.com',
      logoUrl: 'https://example.com/logos/eni.png',
      streetAddress: 'Piazzale Enrico Mattei 1',
      city: 'Roma',
      zipCode: '00144',
      country: 'Italy',
      iban: 'IT60X0542811101000000654321',
      commissionElectricity: 40,
      commissionGas: 42,
      contractStartDate: '2025-02-15',
      notes: 'Strong gas portfolio. Promotional rates in winter season.',
    },
    {
      name: 'A2A',
      legalName: 'A2A Energia S.p.A.',
      taxId: 'IT12883420155',
      supplierCode: 'A2A',
      description:
        'Multiutility leader nel nord Italia per energia elettrica, gas, teleriscaldamento e servizi ambientali.',
      rating: 4.0,
      isActive: true,
      status: SupplierStatus.WARNING,
      commodity: Commodity.ELECTRICITY,
      contactName: 'Luca Ferrari',
      contactEmail: 'business@a2a.eu',
      contactPhone: '+39 800 199 955',
      website: 'https://www.a2aenergia.eu',
      logoUrl: 'https://example.com/logos/a2a.png',
      streetAddress: 'Via Lamarmora 230',
      city: 'Brescia',
      zipCode: '25124',
      country: 'Italy',
      iban: 'IT60X0542811101000000111222',
      commissionElectricity: 35,
      commissionGas: 30,
      contractStartDate: '2025-03-10',
      notes: 'Contract under renewal — commission terms being renegotiated.',
    },
    {
      name: 'Edison',
      legalName: 'Edison Energia S.p.A.',
      taxId: 'IT08526440154',
      supplierCode: 'EDISON',
      description:
        'Storica azienda energetica italiana, tra le prime in Europa, con offerte per privati e aziende.',
      rating: 3.9,
      isActive: true,
      status: SupplierStatus.ACTIVE,
      commodity: Commodity.DUAL,
      contactName: 'Sofia Romano',
      contactEmail: 'info@edison.it',
      contactPhone: '+39 800 031 141',
      website: 'https://www.edison.it',
      logoUrl: 'https://example.com/logos/edison.png',
      streetAddress: 'Foro Buonaparte 31',
      city: 'Milano',
      zipCode: '20121',
      country: 'Italy',
      iban: 'IT60X0542811101000000555666',
      commissionElectricity: 42,
      commissionGas: 36,
      contractStartDate: '2025-01-15',
      notes: 'Storica azienda. Good residential portfolio.',
    },
    {
      name: 'Hera Comm',
      legalName: 'Hera Comm S.r.l.',
      taxId: 'IT02221101203',
      supplierCode: 'HERA',
      description:
        'Multiutility con sede a Bologna, opera nel settore energetico e ambientale nel centro-nord Italia.',
      rating: 3.7,
      isActive: false,
      status: SupplierStatus.INACTIVE,
      commodity: Commodity.DUAL,
      contactName: 'Andrea Rossi',
      contactEmail: 'clienti@hera.it',
      contactPhone: '+39 800 999 500',
      website: 'https://www.heracomm.it',
      logoUrl: 'https://example.com/logos/hera.png',
      streetAddress: 'Viale Carlo Berti Pichat 2/4',
      city: 'Bologna',
      zipCode: '40127',
      country: 'Italy',
      iban: 'IT60X0542811101000000777888',
      commissionElectricity: 30,
      commissionGas: 28,
      contractStartDate: '2024-06-01',
      notes: 'Currently inactive — contract expired.',
    },
  ];

  for (const data of suppliersData) {
    let supplier = await repo.findOne({
      where: { supplierCode: data.supplierCode },
      withDeleted: true,
    });
    if (!supplier) {
      supplier = await repo.save(repo.create(data));
      console.log(`  Created supplier: ${data.name}`);
    } else {
      console.log(`  Supplier already exists: ${data.name}`);
    }
    ctx.suppliers.push(supplier);
  }
}
