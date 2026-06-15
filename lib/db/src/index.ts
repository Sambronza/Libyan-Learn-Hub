import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep TCP connections alive so the OS doesn't silently drop idle sockets.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Allow up to 10 s for Neon to wake its compute node on a cold start.
  connectionTimeoutMillis: 10_000,
  // Release idle connections after 30 s to avoid stale sockets,
  // but short enough that the pool keeps at least one warm connection
  // when traffic is ongoing.
  idleTimeoutMillis: 30_000,
  // Pool size: 1 minimum ensures at least one connection is always ready.
  min: 1,
  max: 10,
});

export const db = drizzle(pool, { schema });

/**
 * Eagerly establishes a connection to the database by running a lightweight
 * `SELECT 1` query. Call this once at server startup so the pool has a warm
 * connection before the first real request arrives, eliminating the Neon
 * compute cold-start delay on the first login.
 */
export async function warmUpPool(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] Connection pool warmed up successfully.");
  } catch (err) {
    // Non-fatal — the server can still start; the first real request will
    // trigger the connection instead.
    console.error("[DB] Warm-up query failed (non-fatal):", err);
  }
}

export * from "./schema/index.js";
