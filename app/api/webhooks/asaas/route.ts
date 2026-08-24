import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { transaction } from "../../../../lib/db";

export const runtime = "nodejs";

function authenticated(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || "";
  const supplied = request.headers.get("asaas-access-token") || "";
  if (expected.length < 32 || !supplied) return false;
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.slice(0, 120) : "";
}

export async function POST(request: Request) {
  if (!authenticated(request)) return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventId = text(payload?.id);
  const eventType = text(payload?.event);
  if (!eventId || !eventType) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  const payment = record(payload?.payment);
  const subscription = record(payload?.subscription);
  const subscriptionId = text(subscription?.id) || text(payment?.subscription);
  const resourceId = text(payment?.id) || text(subscription?.id) || null;
  const safePayload = {
    id: eventId,
    event: eventType,
    dateCreated: text(payload?.dateCreated),
    resource: resourceId,
    subscription: subscriptionId || null,
    status: text(payment?.status) || text(subscription?.status) || null
  };

  try {
    const duplicate = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO asaas_webhook_events (event_id, event_type, resource_id, payload)
         VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING`,
        [eventId, eventType, resourceId, safePayload]
      );
      if (inserted.rowCount === 0) return true;
      if (!subscriptionId) return false;
      if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
        await client.query(
          "UPDATE asaas_subscriptions SET status = 'PAID', paid_access_until = NULL, updated_at = NOW() WHERE asaas_subscription_id = $1",
          [subscriptionId]
        );
      } else if (eventType === "PAYMENT_OVERDUE") {
        await client.query(
          `UPDATE asaas_subscriptions SET status = 'OVERDUE_GRACE',
            paid_access_until = COALESCE(paid_access_until, NOW() + INTERVAL '3 days'), updated_at = NOW()
           WHERE asaas_subscription_id = $1`,
          [subscriptionId]
        );
      } else if (eventType === "PAYMENT_REFUNDED") {
        await client.query(
          "UPDATE asaas_subscriptions SET status = 'REFUNDED', paid_access_until = NULL, updated_at = NOW() WHERE asaas_subscription_id = $1",
          [subscriptionId]
        );
      } else if (["SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED", "SUBSCRIPTION_CANCELLED"].includes(eventType)) {
        const status = eventType === "SUBSCRIPTION_DELETED" ? "DELETED" : "CANCELLED";
        await client.query(
          "UPDATE asaas_subscriptions SET status = $1, paid_access_until = NULL, updated_at = NOW() WHERE asaas_subscription_id = $2",
          [status, subscriptionId]
        );
      } else if (eventType === "SUBSCRIPTION_UPDATED") {
        await client.query(
          "UPDATE asaas_subscriptions SET remote_response = remote_response || $1::jsonb, updated_at = NOW() WHERE asaas_subscription_id = $2",
          [JSON.stringify({ status: safePayload.status }), subscriptionId]
        );
      }
      return false;
    });
    return NextResponse.json({ ok: true, duplicate });
  } catch {
    return NextResponse.json({ error: "Falha ao processar webhook." }, { status: 500 });
  }
}
