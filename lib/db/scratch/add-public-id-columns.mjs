import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  console.log('Connected.');

  const sqls = [
    ['video_public_id', 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "video_public_id" text;'],
    ['document_public_id', 'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "document_public_id" text;'],
  ];

  for (const [name, sql] of sqls) {
    try {
      await client.query(sql);
      console.log('v Added column:', name);
    } catch (e) {
      console.error('x Column', name, ':', e.message);
    }
  }

  await client.end();
  console.log('Done.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
