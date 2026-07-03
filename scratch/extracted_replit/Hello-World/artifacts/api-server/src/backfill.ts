import { db } from "@workspace/db";
import { tutoringRequestsTable, teacherEarningsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Fetching completed tutoring requests...");
  const completedRequests = await db.select()
    .from(tutoringRequestsTable)
    .where(eq(tutoringRequestsTable.status, "completed"));

  console.log(`Found ${completedRequests.length} completed requests.`);

  const existingEarnings = await db.select().from(teacherEarningsTable);
  const existingTutoringIds = new Set(existingEarnings.map(e => e.tutoringRequestId).filter(id => id !== null));

  let insertedCount = 0;

  for (const req of completedRequests) {
    if (req.teacherId && !existingTutoringIds.has(req.id)) {
      const platformFeePercent = 10;
      const platformFee = parseFloat(req.totalAmount) * (platformFeePercent / 100);
      const teacherPayout = parseFloat(req.totalAmount) - platformFee;

      console.log(`Backfilling earning for tutoring request #${req.id} (Teacher ${req.teacherId})`);
      
      await db.insert(teacherEarningsTable).values({
        teacherId: req.teacherId,
        paymentId: 0,
        tutoringRequestId: req.id,
        grossAmount: parseFloat(req.totalAmount).toFixed(2),
        platformFeePercent: platformFeePercent.toFixed(2),
        platformFee: platformFee.toFixed(2),
        netAmount: teacherPayout.toFixed(2),
        currency: "LYD",
        status: "paid",
        createdAt: req.updatedAt || new Date(),
        paidAt: req.updatedAt || new Date()
      });
      insertedCount++;
    }
  }

  console.log(`Successfully backfilled ${insertedCount} earning records.`);
  process.exit(0);
}

run().catch(console.error);
