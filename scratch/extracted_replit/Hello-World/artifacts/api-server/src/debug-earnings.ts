import { db } from "@workspace/db";
import { teacherEarningsTable } from "@workspace/db";

async function run() {
  const earnings = await db.select().from(teacherEarningsTable);
  console.log("Earnings in DB:");
  console.table(earnings);
  process.exit(0);
}

run().catch(console.error);
