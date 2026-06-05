import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MarketIndex } from './entities/market-index.entity';

@Injectable()
export class MarketDataService {
  constructor(
    @InjectRepository(MarketIndex)
    private readonly marketIndexRepository: Repository<MarketIndex>,
  ) {}

  async getLatestIndices(): Promise<MarketIndex[]> {
    const indexNames = await this.marketIndexRepository
      .createQueryBuilder('mi')
      .select('DISTINCT mi.index_name', 'indexName')
      .getRawMany();

    const latest: MarketIndex[] = [];

    for (const { indexName } of indexNames) {
      const entry = await this.marketIndexRepository.findOne({
        where: { indexName },
        order: { date: 'DESC' },
      });
      if (entry) {
        latest.push(entry);
      }
    }

    return latest;
  }

  async getIndexHistory(
    name: string,
    from?: string,
    to?: string,
  ): Promise<MarketIndex[]> {
    const qb = this.marketIndexRepository
      .createQueryBuilder('mi')
      .where('mi.index_name = :name', { name });

    if (from && to) {
      qb.andWhere('mi.date BETWEEN :from AND :to', { from, to });
    } else if (from) {
      qb.andWhere('mi.date >= :from', { from });
    } else if (to) {
      qb.andWhere('mi.date <= :to', { to });
    }

    qb.orderBy('mi.date', 'ASC');

    return qb.getMany();
  }

  async createIndex(data: {
    indexName: string;
    value: number;
    unit: string;
    date: string;
  }): Promise<MarketIndex> {
    const index = this.marketIndexRepository.create({
      indexName: data.indexName,
      value: data.value,
      unit: data.unit,
      date: new Date(data.date),
    });

    return this.marketIndexRepository.save(index);
  }

  async getIndicesByName(name: string): Promise<MarketIndex[]> {
    return this.marketIndexRepository.find({
      where: { indexName: name },
      order: { date: 'DESC' },
    });
  }
}
