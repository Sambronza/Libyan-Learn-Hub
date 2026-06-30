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
    console.log('[migrate-wallet-transactions] Connected to database.');

    const sql = `
      -- Ensure the enum type exists (safe no-op if already present)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
          CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
        END IF;
      END
      $$;

      -- Create the wallet_transactions table if it does not exist yet
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id             serial PRIMARY KEY,
        user_id        integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount         numeric(10, 2) NOT NULL,
        type           transaction_type NOT NULL,
        reference_type varchar(100),
        reference_id   integer,
        description    text,
        created_at     timestamp NOT NULL DEFAULT now()
      );

      -- Index for fast per-user lookups sorted by date (most common query)
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
        ON wallet_transactions (user_id, created_at DESC);
    `;

    console.log('[migrate-wallet-transactions] Running migration SQL…');
    await client.query(sql);
    console.log('[migrate-wallet-transactions] Migration completed successfully.');
  } catch (err) {
    console.error('[migrate-wallet-transactions] Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
