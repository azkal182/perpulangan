
import { config } from 'dotenv';
config();

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const migrationName = '20260216152044_add_optional_journeys_and_cancellation';
  try {
    console.log(`Deleting migration records for: ${migrationName}`);
    const result = await prisma.$executeRaw`DELETE FROM "_prisma_migrations" WHERE "migration_name" = ${migrationName}`;
    console.log(`Deleted ${result} records.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
