import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL env var must be set');
}

const client = new pg.Client({ connectionString });

async function main() {
  try {
    await client.connect();
    console.log('[migrate-quiz-compulsory] Connected to database.');

    const sql = `
      -- Add is_compulsory column to quizzes if it doesn't exist yet
      ALTER TABLE quizzes
        ADD COLUMN IF NOT EXISTS is_compulsory boolean NOT NULL DEFAULT false;
    `;

    console.log('[migrate-quiz-compulsory] Running migration SQL…');
    await client.query(sql);
    console.log('[migrate-quiz-compulsory] Migration completed successfully.');
  } catch (err) {
    console.error('[migrate-quiz-compulsory] Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
