import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

interface AuditOptions {
  adminId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      adminId: opts.adminId,
      action: opts.action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      details: opts.details ?? null,
      ip: opts.ip ?? null,
    });
  } catch {
    // Audit log failures must never break the main request
  }
}
