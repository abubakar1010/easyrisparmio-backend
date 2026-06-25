import { DataSource } from 'typeorm';
import { Supplier } from '../../../modules/suppliers/entities/supplier.entity';
import { SeedContext } from '../seed-context';

export async function seedSuppliers(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Supplier);

  const suppliersData = [
    {
      name: 'Enel Energia',
      supplierCode: 'ENEL',
      description:
        'Il principale fornitore di energia elettrica e gas in Italia, con milioni di clienti su tutto il territorio nazionale.',
      rating: 4.2,
      isActive: true,
      contactEmail: 'info@enel.it',
      contactPhone: '+39 800 900 800',
      website: 'https://www.enel.it',
      logoUrl: 'https://example.com/logos/enel.png',
    },
    {
      name: 'Eni Plenitude',
      supplierCode: 'ENI',
      description:
        'Divisione retail di Eni per la fornitura di luce, gas e servizi energetici per la casa e le imprese.',
      rating: 3.8,
      isActive: true,
      contactEmail: 'clienti@eni.it',
      contactPhone: '+39 800 900 700',
      website: 'https://www.eni.com',
      logoUrl: 'https://example.com/logos/eni.png',
    },
    {
      name: 'A2A Energia',
      supplierCode: 'A2A',
      description:
        'Multiutility leader nel nord Italia per energia elettrica, gas, teleriscaldamento e servizi ambientali.',
      rating: 4.0,
      isActive: true,
      contactEmail: 'servizio.clienti@a2a.eu',
      contactPhone: '+39 800 199 955',
      website: 'https://www.a2a.it',
      logoUrl: 'https://example.com/logos/a2a.png',
    },
    {
      name: 'Edison Energia',
      supplierCode: 'EDISON',
      description:
        'Storica azienda energetica italiana, tra le prime in Europa, con offerte per privati e aziende.',
      rating: 3.9,
      isActive: true,
      contactEmail: 'info@edison.it',
      contactPhone: '+39 800 031 141',
      website: 'https://www.edison.it',
      logoUrl: 'https://example.com/logos/edison.png',
    },
    {
      name: 'Hera Comm',
      supplierCode: 'HERA',
      description:
        'Multiutility con sede a Bologna, opera nel settore energetico e ambientale nel centro-nord Italia.',
      rating: 3.7,
      isActive: false,
      contactEmail: 'clienti@hera.it',
      contactPhone: '+39 800 999 500',
      website: 'https://www.heracomm.it',
      logoUrl: 'https://example.com/logos/hera.png',
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
