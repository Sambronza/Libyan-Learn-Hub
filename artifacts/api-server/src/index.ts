import "dotenv/config.js";
import app from "./app";
import { startScheduler } from "./lib/scheduler.js";
import { warmUpPool, db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"] || "5001";

const port = Number(rawPort);

// Start background workers
startScheduler();

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  // Eagerly open a DB connection so the first login doesn't pay the
  // Neon cold-start penalty. Fire-and-forget — non-fatal if it fails.
  warmUpPool();

  // Auto-migrate: add is_compulsory column to quizzes if not already present.
  // Safe to run on every startup — ADD COLUMN IF NOT EXISTS is idempotent.
  db.execute(sql`
    ALTER TABLE quizzes
      ADD COLUMN IF NOT EXISTS is_compulsory boolean NOT NULL DEFAULT false
  `).then(() => {
    console.log("[startup] quizzes.is_compulsory column ensured.");
  }).catch((err: any) => {
    console.error("[startup] Failed to ensure quizzes.is_compulsory:", err?.message);
  });
});
