import { NextResponse } from "next/server";
import { AsaasApiError, cancelSubscription } from "../../../../../lib/asaas";
import { getCurrentUser } from "../../../../../lib/auth";
import { canManageBilling } from "../../../../../lib/billing";
import { query } from "../../../../../lib/db";
import { rejectCrossOrigin } from "../../../../../lib/request-security";

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!canManageBilling(user)) return NextResponse.json({ error: "Sem permissão para cancelar." }, { status: 403 });
  const result = await query<{ id: string; asaas_subscription_id: string }>(
    `SELECT id, asaas_subscription_id FROM asaas_subscriptions
     WHERE tenant_id = $1 AND asaas_subscription_id IS NOT NULL
       AND status NOT IN ('CANCELLED', 'DELETED', 'REFUNDED')
     ORDER BY created_at DESC LIMIT 1`,
    [user.tenantId]
  );
  const subscription = result.rows[0];
  if (!subscription) return NextResponse.json({ error: "Assinatura ativa não encontrada." }, { status: 404 });
  try {
    await cancelSubscription(subscription.asaas_subscription_id);
  } catch (error) {
    if (!(error instanceof AsaasApiError && error.status === 404)) {
      return NextResponse.json({ error: "Não foi possível cancelar a assinatura." }, { status: 502 });
    }
  }
  await query(
    "UPDATE asaas_subscriptions SET status = 'CANCELLED', paid_access_until = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [subscription.id, user.tenantId]
  );
  return NextResponse.json({ ok: true });
}
