/**
 * Drops ALL tables, enums, and extensions from the database.
 *
 * Usage:  npm run db:drop
 *
 * WARNING: This is destructive and irreversible. All data will be lost.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';

async function run(): Promise<void> {
  process.env.SKIP_AUTO_SEED = 'true';

  console.log('\n========================================');
  console.log('  EasyRisparmio — DROP DATABASE');
  console.log('  ⚠  This will destroy ALL data!');
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const queryRunner = ds.createQueryRunner();

  try {
    // Drop all tables via schema
    await queryRunner.query('DROP SCHEMA public CASCADE;');
    await queryRunner.query('CREATE SCHEMA public;');
    await queryRunner.query('GRANT ALL ON SCHEMA public TO public;');

    console.log('  Dropped all tables, types, and sequences.');
    console.log('  Schema "public" recreated.\n');

    console.log('========================================');
    console.log('  Database is now empty.');
    console.log('  Run `npm run seed` to re-seed.');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n  Drop failed:', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await app.close();
  }

  process.exit(0);
}

run();
