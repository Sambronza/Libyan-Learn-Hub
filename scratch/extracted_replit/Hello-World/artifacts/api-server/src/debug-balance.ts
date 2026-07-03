import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, 52)).limit(1);
  console.log(`Teacher 52 Balance: ${teacher?.balance}`);
  process.exit(0);
}

run().catch(console.error);
