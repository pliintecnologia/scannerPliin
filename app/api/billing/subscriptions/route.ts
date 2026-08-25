import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { AsaasApiError, createAsaasCustomer, createAsaasSubscription, sanitizeRemote, type CardInput, type HolderInput } from "../../../../lib/asaas";
import { getCurrentUser } from "../../../../lib/auth";
import { canManageBilling, getEffectiveAccess, hashBillingDocument } from "../../../../lib/billing";
import { query, transaction } from "../../../../lib/db";
import { PREMIUM_PLAN, type BillingType } from "../../../../lib/plans";
import { bodyTooLarge, rejectCrossOrigin } from "../../../../lib/request-security";
import { cleanText, normalizeEmail, onlyDigits, validCnpj, validCpf, validEmail } from "../../../../lib/validation";

type SubscriptionBody = {
  billingType?: unknown;
  customer?: { name?: unknown; cpfCnpj?: unknown; email?: unknown; phone?: unknown };
  creditCard?: Record<string, unknown>;
  creditCardHolderInfo?: Record<string, unknown>;
};

export const runtime = "nodejs";
export const maxDuration = 75;

function dueToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function digitsField(value: unknown, max: number) {
  return onlyDigits(value).slice(0, max);
}

function validCardNumber(value: string) {
  if (!/^\d{13,19}$/.test(value)) return false;
  let sum = 0;
  let double = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function clientIp(request: Request) {
  const candidates = [request.headers.get("cf-connecting-ip"), request.headers.get("x-real-ip"), request.headers.get("x-forwarded-for")?.split(",")[0]];
  return candidates.map((value) => value?.trim()).find((value) => value && isIP(value)) || "";
}

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  if (bodyTooLarge(request, 32_768)) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!canManageBilling(user)) return NextResponse.json({ error: "Sem permissão para contratar." }, { status: 403 });
  const access = await getEffectiveAccess(user.tenantId);
  if (access.source === "coupon") return NextResponse.json({ access, charged: false, message: "Cupom vigente; nenhuma cobrança foi criada." });

  let body = await request.json().catch(() => null) as SubscriptionBody | null;
  const billingType = body?.billingType;
  if (billingType !== "CREDIT_CARD" && billingType !== "PIX" && billingType !== "BOLETO") {
    return NextResponse.json({ error: "Meio de pagamento inválido." }, { status: 400 });
  }
  const name = cleanText(body?.customer?.name, 160);
  const email = normalizeEmail(body?.customer?.email);
  const cpfCnpj = digitsField(body?.customer?.cpfCnpj, 14);
  const phone = digitsField(body?.customer?.phone, 15);
  if (name.length < 2 || !validEmail(email) || (!validCpf(cpfCnpj) && !validCnpj(cpfCnpj)) || phone.length < 8) {
    return NextResponse.json({ error: "Dados do titular inválidos." }, { status: 400 });
  }

  let card: CardInput | undefined;
  let holder: HolderInput | undefined;
  if (billingType === "CREDIT_CARD") {
    const rawCard = body?.creditCard ?? {};
    const rawHolder = body?.creditCardHolderInfo ?? {};
    card = {
      holderName: cleanText(rawCard.holderName, 160),
      number: digitsField(rawCard.number, 19),
      expiryMonth: digitsField(rawCard.expiryMonth, 2),
      expiryYear: digitsField(rawCard.expiryYear, 4),
      ccv: digitsField(rawCard.ccv, 4)
    };
    holder = {
      name: cleanText(rawHolder.name, 160),
      email: normalizeEmail(rawHolder.email),
      cpfCnpj: digitsField(rawHolder.cpfCnpj, 14),
      postalCode: digitsField(rawHolder.postalCode, 8),
      addressNumber: cleanText(rawHolder.addressNumber, 20),
      phone: digitsField(rawHolder.phone, 15)
    };
    const month = Number(card.expiryMonth);
    if (!validCardNumber(card.number)) card.number = "";
    if (card.holderName.length < 2 || card.number.length < 13 || card.number.length > 19 || month < 1 || month > 12 || !/^\d{4}$/.test(card.expiryYear) || card.ccv.length < 3 || holder.name.length < 2 || !validEmail(holder.email) || (!validCpf(holder.cpfCnpj) && !validCnpj(holder.cpfCnpj)) || holder.postalCode.length !== 8 || !holder.addressNumber || holder.phone.length < 8) {
      return NextResponse.json({ error: "Dados do cartão ou endereço inválidos." }, { status: 400 });
    }
  }

  if (body) {
    body.creditCard = undefined;
    body.creditCardHolderInfo = undefined;
  }
  const suppliedKey = request.headers.get("idempotency-key")?.trim();
  const idempotencyKey = suppliedKey && /^[A-Za-z0-9:_-]{8,128}$/.test(suppliedKey) ? suppliedKey : randomUUID();
  const existing = await query<{ id: string; status: string }>(
    "SELECT id, status FROM asaas_subscriptions WHERE idempotency_key = $1 AND tenant_id = $2",
    [idempotencyKey, user.tenantId]
  );
  if (existing.rows[0]) return NextResponse.json({ subscription: existing.rows[0], reused: true });
  const current = await query<{ id: string; status: string }>(
    `SELECT id, status FROM asaas_subscriptions WHERE tenant_id = $1
     AND status IN ('CREATING', 'PENDING', 'PAID', 'OVERDUE_GRACE') ORDER BY created_at DESC LIMIT 1`,
    [user.tenantId]
  );
  if (current.rows[0]) return NextResponse.json({ error: "Já existe uma assinatura ativa ou pendente para esta conta." }, { status: 409 });

  const nextDueDate = dueToday();
  const description = `${process.env.BILLING_COMPANY_NAME || "Scanner Pliin"} - Plano Premium`;
  const reserved = await query<{ id: string }>(
    `INSERT INTO asaas_subscriptions
      (tenant_id, idempotency_key, billing_type, next_due_date, description, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [user.tenantId, idempotencyKey, billingType, nextDueDate, description, user.id]
  );
  if (!reserved.rows[0]) return NextResponse.json({ error: "Solicitação idempotente em processamento." }, { status: 409 });

  try {
    const documentHash = hashBillingDocument(cpfCnpj);
    let localCustomer = await query<{ id: string; asaas_customer_id: string }>(
      "SELECT id, asaas_customer_id FROM asaas_customers WHERE tenant_id = $1 AND document_hash = $2",
      [user.tenantId, documentHash]
    );
    if (!localCustomer.rows[0]) {
      const remoteCustomer = await createAsaasCustomer({ name, cpfCnpj, email, phone }, `${idempotencyKey}:customer`.slice(0, 128));
      localCustomer = await query<{ id: string; asaas_customer_id: string }>(
        `INSERT INTO asaas_customers
          (tenant_id, asaas_customer_id, document_hash, document_last4, name, email, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, document_hash) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
           phone = EXCLUDED.phone, updated_at = NOW()
         RETURNING id, asaas_customer_id`,
        [user.tenantId, remoteCustomer.id, documentHash, cpfCnpj.slice(-4), name, email, phone]
      );
    }
    const customer = localCustomer.rows[0];
    const remoteIp = clientIp(request);
    if (billingType === "CREDIT_CARD" && !remoteIp) throw new Error("missing_client_ip");
    const remote = await createAsaasSubscription({
      customer: customer.asaas_customer_id,
      billingType: billingType as BillingType,
      value: PREMIUM_PLAN.priceCents / 100,
      nextDueDate,
      cycle: "MONTHLY",
      description,
      externalReference: idempotencyKey,
      creditCard: card,
      creditCardHolderInfo: holder,
      remoteIp: billingType === "CREDIT_CARD" ? remoteIp : undefined
    }, idempotencyKey);
    const saved = await transaction(async (client) => {
      const result = await client.query<{ id: string; status: string }>(
        `UPDATE asaas_subscriptions SET customer_id = $1, asaas_customer_id = $2,
          asaas_subscription_id = $3, status = 'PENDING', remote_response = $4, updated_at = NOW()
         WHERE id = $5 RETURNING id, status`,
        [customer.id, customer.asaas_customer_id, remote.id, sanitizeRemote(remote), reserved.rows[0].id]
      );
      return result.rows[0];
    });
    return NextResponse.json({ subscription: saved, accessPending: true }, { status: 201 });
  } catch (error) {
    const providerCode = error instanceof AsaasApiError ? error.code : "provider_request_failed";
    const safeMessage = error instanceof AsaasApiError ? error.message : "Não foi possível iniciar a assinatura no Asaas.";
    await query(
      "UPDATE asaas_subscriptions SET status = 'FAILED', error_message = $1, updated_at = NOW() WHERE id = $2",
      [`provider_${providerCode}`.slice(0, 500), reserved.rows[0].id]
    );
    return NextResponse.json({ error: safeMessage }, { status: 502 });
  } finally {
    card = undefined;
    holder = undefined;
    body = null;
  }
}
