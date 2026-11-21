import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run database migrations');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  migrations: [
    join(dirname(fileURLToPath(import.meta.url)), 'migrations', '*.js'),
  ],
  synchronize: false,
});
