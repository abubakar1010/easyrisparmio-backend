import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvReconciliation } from './entities/csv-reconciliation.entity';
import { CsvReconciliationRow } from './entities/csv-reconciliation-row.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CsvReconciliation, CsvReconciliationRow])],
  exports: [TypeOrmModule],
})
export class ReconciliationModule {}
