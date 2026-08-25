import { NextResponse } from "next/server";
import { listSubscriptionPayments } from "../../../../lib/asaas";
import { getCurrentUser } from "../../../../lib/auth";
import { query } from "../../../../lib/db";
import { PREMIUM_PLAN } from "../../../../lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const result = await query<{ asaas_subscription_id: string; billing_type: string; next_due_date: string }>(
    `SELECT asaas_subscription_id, billing_type, next_due_date::text FROM asaas_subscriptions
     WHERE tenant_id = $1 AND asaas_subscription_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    [user.tenantId]
  );
  const subscriptionId = result.rows[0]?.asaas_subscription_id;
  if (!subscriptionId) return NextResponse.json({ charges: [], pending: null });
  try {
    const remote = await listSubscriptionPayments(subscriptionId);
    const charges = (remote.data ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      value: item.value,
      dueDate: item.dueDate,
      billingType: item.billingType,
      paymentDate: item.paymentDate ?? null,
      invoiceUrl: item.invoiceUrl ?? null,
      bankSlipUrl: item.bankSlipUrl ?? null
    }));
    return NextResponse.json({
      charges,
      pending: charges.length ? null : {
        billingType: result.rows[0].billing_type,
        dueDate: result.rows[0].next_due_date,
        value: PREMIUM_PLAN.priceCents / 100
      }
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar as cobranças." }, { status: 502 });
  }
}
