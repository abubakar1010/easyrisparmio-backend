import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { createEmptyContext } from './seed-context';
import { seedSuppliers } from './data/suppliers.seed-data';

async function run(): Promise<void> {
  process.env.SKIP_AUTO_SEED = 'true';

  console.log('\n========================================');
  console.log('  EasyRisparmio — Seed Suppliers Only');
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const ctx = createEmptyContext();

  try {
    await seedSuppliers(ds, ctx);
    console.log(`\n  Done — ${ctx.suppliers.length} suppliers in database.\n`);
  } catch (error) {
    console.error('\n  Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }

  process.exit(0);
}

run();
