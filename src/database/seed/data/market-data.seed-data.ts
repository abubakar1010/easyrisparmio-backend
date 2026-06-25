import { DataSource } from 'typeorm';
import { MarketIndex } from '../../../modules/market-data/entities/market-index.entity';

export async function seedMarketIndices(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(MarketIndex);

  const indicesData = [
    // PUN (Prezzo Unico Nazionale) - electricity spot price
    {
      indexName: 'PUN',
      value: 125.45,
      unit: 'EUR/MWh',
      date: '2026-01-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PUN',
      value: 118.3,
      unit: 'EUR/MWh',
      date: '2026-02-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PUN',
      value: 110.75,
      unit: 'EUR/MWh',
      date: '2026-03-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PUN',
      value: 98.2,
      unit: 'EUR/MWh',
      date: '2026-04-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PUN',
      value: 105.6,
      unit: 'EUR/MWh',
      date: '2026-05-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    // PSV (Punto di Scambio Virtuale) - gas spot price
    {
      indexName: 'PSV',
      value: 42.8,
      unit: 'EUR/MWh',
      date: '2026-01-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PSV',
      value: 39.15,
      unit: 'EUR/MWh',
      date: '2026-02-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PSV',
      value: 35.9,
      unit: 'EUR/MWh',
      date: '2026-03-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PSV',
      value: 31.45,
      unit: 'EUR/MWh',
      date: '2026-04-15',
      source: 'GME - Gestore Mercati Energetici',
    },
    {
      indexName: 'PSV',
      value: 33.7,
      unit: 'EUR/MWh',
      date: '2026-05-15',
      source: 'GME - Gestore Mercati Energetici',
    },
  ];

  for (const data of indicesData) {
    const existing = await repo.findOne({
      where: { indexName: data.indexName, date: new Date(data.date) },
    });
    if (!existing) {
      await repo.save(repo.create({ ...data, date: new Date(data.date) }));
      console.log(`  Created market index: ${data.indexName} ${data.date}`);
    } else {
      console.log(
        `  Market index already exists: ${data.indexName} ${data.date}`,
      );
    }
  }
}
