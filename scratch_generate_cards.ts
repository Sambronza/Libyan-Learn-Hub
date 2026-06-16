import { db } from "./lib/db/src/index.ts";
import { redeemCardsTable } from "./lib/db/src/schema/redeem-cards.ts";

async function main() {
  process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Ftd09uiBHhqk@ep-soft-cake-alu8ahw0-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";
  
  const codes = [
    { code: "LIBYA-TEST-500", value: "500" },
    { code: "LIBYA-TEST-1000", value: "1000" },
    { code: "LIBYA-TEST-2000", value: "2000" },
    { code: "LIBYA-TEST-5000", value: "5000" },
    { code: "LIBYA-TEST-10000", value: "10000" },
    { code: "LIBYA-EXTRA-50", value: "50" },
    { code: "LIBYA-EXTRA-100", value: "100" }
  ];

  try {
    const inserted = await db.insert(redeemCardsTable).values(codes).returning();
    console.log("Successfully inserted redeem cards:");
    console.table(inserted.map(c => ({ code: c.code, value: c.value, status: c.status })));
  } catch (err) {
    console.error("Error inserting cards:", err);
  }
  process.exit(0);
}

main();
