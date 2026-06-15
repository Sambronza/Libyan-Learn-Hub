/**
 * Migration: Add video_public_id and document_public_id columns to the lessons table.
 * These store the stable Cloudinary public_id so video/document access never depends on lesson title.
 *
 * Run with: node --env-file=.env artifacts/api-server/scripts/add-public-id-columns.mjs
 */

import pg from 'pg';
const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log('Connected to database.');

  const migrations = [
    {
      sql: `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "video_public_id" text;`,
      desc: 'Add video_public_id column to lessons',
    },
    {
      sql: `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "document_public_id" text;`,
      desc: 'Add document_public_id column to lessons',
    },
  ];

  for (const m of migrations) {
    try {
      await client.query(m.sql);
      console.log(`✓ ${m.desc}`);
    } catch (err) {
      console.error(`✗ ${m.desc}: ${err.message}`);
    }
  }

  await client.end();
  console.log('\nMigration complete.');
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
