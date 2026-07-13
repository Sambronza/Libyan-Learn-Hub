import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

const isProd = process.env.NODE_ENV === "production";

/**
 * Log a server-side error in full and return a safe JSON response.
 * The raw error message is only exposed outside production so we never leak
 * internal/DB details to clients in prod.
 */
export function serverError(res: Response, err: unknown, label = "Server error"): void {
  logger.error({ err }, label);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: label, ...(isProd ? {} : { message }) });
}

/**
 * Express error-handling middleware — the last line of defense for anything
 * that throws or calls next(err) without being caught inside a route handler.
 * Registered after all routes in app.ts.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({
    error: "Server error",
    ...(isProd ? {} : { message: err instanceof Error ? err.message : String(err) }),
  });
}
