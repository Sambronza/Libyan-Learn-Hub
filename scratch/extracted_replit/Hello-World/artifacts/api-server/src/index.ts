import "dotenv/config.js";
import app from "./app";
import { startScheduler } from "./lib/scheduler.js";
import { warmUpPool } from "@workspace/db";

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
});
