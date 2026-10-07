import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'vyzi',
  ssl: process.env.DB_SSL === 'true',
  // The project has no migrations: the schema is kept by `synchronize`, which
  // runs automatically in development. Production must opt in explicitly.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
}));
