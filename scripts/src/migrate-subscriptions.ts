/**
 * One-off migration: convert one-time course purchases to time-based subscriptions.
 *
 * 1. Published paid courses: backfill subscription prices from the legacy `price`
 *    (1 month = price, 3 months = price*2.7, 6 months = price*5, 12 months = price*9).
 *    Teachers can adjust these afterwards.
 * 2. Existing enrollments on PAID courses with no expiry: convert to a 1-month
 *    subscription starting now (per product decision). Free-course enrollments untouched.
 * 3. Seed platform settings for device security + face matching.
 *
 * Run: pnpm --filter @workspace/scripts run migrate:subscriptions
 */
import { db, coursesTable, enrollmentsTable, platformSettingsTable } from "@workspace/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

async function main() {
  // --- 1. Backfill course plan prices ---
  const paidCourses = await db
    .select({ id: coursesTable.id, price: coursesTable.price, priceMonth1: coursesTable.priceMonth1 })
    .from(coursesTable)
    .where(gt(coursesTable.price, "0"));

  let coursesUpdated = 0;
  for (const course of paidCourses) {
    if (course.priceMonth1 !== null) continue; // already migrated
    const base = parseFloat(course.price);
    await db
      .update(coursesTable)
      .set({
        priceMonth1: base.toFixed(2),
        priceMonth3: (base * 2.7).toFixed(2),
        priceMonth6: (base * 5).toFixed(2),
        priceMonth12: (base * 9).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(coursesTable.id, course.id));
    coursesUpdated++;
  }
  console.log(`Courses: backfilled plan prices for ${coursesUpdated}/${paidCourses.length} paid courses.`);

  // --- 2. Convert existing paid enrollments to 1-month subscriptions ---
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);

  const result = await db
    .update(enrollmentsTable)
    .set({
      subscriptionMonths: 1,
      startedAt: now,
      expiresAt: expiry,
    })
    .where(
      and(
        isNull(enrollmentsTable.expiresAt),
        isNull(enrollmentsTable.subscriptionMonths),
        // only enrollments on paid courses
        sql`${enrollmentsTable.courseId} IN (SELECT id FROM courses WHERE price::numeric > 0)`,
      ),
    )
    .returning({ id: enrollmentsTable.id });
  console.log(`Enrollments: converted ${result.length} paid enrollments to 1-month subscriptions (expire ${expiry.toISOString()}).`);

  // --- 3. Seed platform settings ---
  const settings: Array<{ key: string; value: string; description: string }> = [
    { key: "student_reverify_interval_days", value: "3", description: "Days between face re-verifications after a device switch" },
    { key: "student_reverify_window_days", value: "14", description: "Length of the re-verification window after a device switch" },
    { key: "face_match_threshold", value: "0.55", description: "Max euclidean distance for a face descriptor match" },
    { key: "student_device_enforcement", value: "off", description: "Enable single-device binding for student accounts (on/off)" },
  ];
  for (const s of settings) {
    await db
      .insert(platformSettingsTable)
      .values(s)
      .onConflictDoNothing({ target: platformSettingsTable.key });
  }
  console.log("Platform settings seeded (existing values preserved).");
}

main()
  .then(() => {
    console.log("Migration complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
