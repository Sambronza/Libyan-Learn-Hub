const pg = require("pg");
const client = new pg.Client({ connectionString: "postgresql://neondb_owner:npg_Ftd09uiBHhqk@ep-soft-cake-alu8ahw0-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require" });
client.connect().then(async () => {
  const r = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='wallet_transactions' ORDER BY ordinal_position");
  console.log("wallet_transactions columns:");
  r.rows.forEach(row => console.log(" ", row.column_name, "-", row.data_type));
  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
