// Plain CJS migration — no tsx/transpile needed, runs with: node migrate-wallet-txns.cjs
const pg = require("pg");

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Ftd09uiBHhqk@ep-soft-cake-alu8ahw0-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const client = new pg.Client({ connectionString: CONNECTION_STRING });

async function main() {
  await client.connect();
  console.log("[migration] Connected to database.");

  try {
    await client.query(`
      -- Ensure the enum type exists
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
          CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
        END IF;
      END
      $$;

      -- Create table if it doesn't exist yet
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

      -- Performance index
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
        ON wallet_transactions (user_id, created_at DESC);
    `);

    console.log("[migration] wallet_transactions table ensured successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migration] FAILED:", err.message);
  process.exit(1);
});
