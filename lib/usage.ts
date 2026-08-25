import { tenantQuery } from "./db";
import { PREMIUM_PLAN } from "./plans";

export type MonthlyAuditUsage = {
  used: number;
  limit: number;
  remaining: number;
};

export async function getMonthlyAuditUsage(tenantId: string): Promise<MonthlyAuditUsage> {
  const result = await tenantQuery<{ count: string }>(tenantId,
    `SELECT COUNT(*)::text AS count FROM audits
     WHERE tenant_id = $1
       AND created_at >= date_trunc('month', NOW())
       AND created_at < date_trunc('month', NOW()) + INTERVAL '1 month'`,
    [tenantId]
  );
  const used = Number(result.rows[0]?.count || 0);
  const limit = PREMIUM_PLAN.monthlyAuditLimit;
  return { used, limit, remaining: Math.max(0, limit - used) };
}
