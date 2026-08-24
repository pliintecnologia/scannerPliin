import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { canManageBilling, getEffectiveAccess } from "../../../../lib/billing";
import { query } from "../../../../lib/db";
import { PREMIUM_PLAN } from "../../../../lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const access = await getEffectiveAccess(user.tenantId);
  const subscription = await query<{
    id: string; billing_type: string; status: string; next_due_date: string; created_at: Date;
  }>(
    `SELECT id, billing_type, status, next_due_date::text, created_at
     FROM asaas_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.tenantId]
  );
  return NextResponse.json({
    access,
    plan: PREMIUM_PLAN,
    canManage: canManageBilling(user),
    subscription: subscription.rows[0] ?? null
  });
}
