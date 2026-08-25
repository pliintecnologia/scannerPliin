import { createHmac } from "node:crypto";
import type { AuthUser } from "./auth";
import { query, transaction } from "./db";

export type AccessSource = "paid" | "coupon" | "legacy" | "none";
export type EffectiveAccess = {
  allowed: boolean;
  source: AccessSource;
  expiresAt: string | null;
  status: string;
};

function documentSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.");
  return value;
}

export function hashBillingDocument(value: string) {
  return createHmac("sha256", documentSecret()).update(value).digest("hex");
}

export function canManageBilling(user: AuthUser) {
  return user.role === "owner" || user.role === "admin";
}

export async function getEffectiveAccess(tenantId: string): Promise<EffectiveAccess> {
  const result = await query<{
    legacy_access: boolean;
    paid: boolean;
    paid_until: Date | null;
    coupon_until: Date | null;
  }>(
    `SELECT t.legacy_access,
      EXISTS (
        SELECT 1 FROM asaas_subscriptions s
        WHERE s.tenant_id = t.id AND (
          s.status = 'PAID' OR (s.status = 'OVERDUE_GRACE' AND s.paid_access_until > NOW())
        )
      ) AS paid,
      (SELECT MAX(s.paid_access_until) FROM asaas_subscriptions s
        WHERE s.tenant_id = t.id AND s.status = 'OVERDUE_GRACE' AND s.paid_access_until > NOW()) AS paid_until,
      (SELECT MAX(c.ends_at) FROM benefit_coupon_redemptions r
        JOIN benefit_coupons c ON c.id = r.coupon_id
        WHERE r.tenant_id = t.id AND c.active = TRUE
          AND (c.starts_at IS NULL OR c.starts_at <= NOW()) AND c.ends_at > NOW()) AS coupon_until
     FROM tenants t WHERE t.id = $1 AND t.active = TRUE`,
    [tenantId]
  );
  const row = result.rows[0];
  if (!row) return { allowed: false, source: "none", expiresAt: null, status: "inactive_tenant" };
  if (row.paid) return {
    allowed: true,
    source: "paid",
    expiresAt: row.paid_until?.toISOString() ?? null,
    status: row.paid_until ? "overdue_grace" : "active"
  };
  if (row.coupon_until) return { allowed: true, source: "coupon", expiresAt: row.coupon_until.toISOString(), status: "active" };
  if (row.legacy_access) return { allowed: true, source: "legacy", expiresAt: null, status: "active" };
  return { allowed: false, source: "none", expiresAt: null, status: "required" };
}

export function normalizeCouponCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 64) : "";
}

export async function inspectCoupon(code: string, tenantId: string) {
  const result = await query<{
    id: string; code: string; name: string | null; starts_at: Date | null; ends_at: Date;
    active: boolean; redeemed: boolean;
  }>(
    `SELECT c.id, c.code, c.name, c.starts_at, c.ends_at, c.active,
      EXISTS (SELECT 1 FROM benefit_coupon_redemptions r WHERE r.coupon_id = c.id AND r.tenant_id = $2) AS redeemed
     FROM benefit_coupons c WHERE c.code = $1`,
    [code, tenantId]
  );
  const coupon = result.rows[0];
  if (!coupon) return { valid: false as const, reason: "not_found", message: "Cupom não encontrado. Confira se o código foi digitado por completo, incluindo letras, números e hífens." };
  if (!coupon.active) return { valid: false as const, reason: "inactive", message: "Este cupom está inativo. Solicite um novo código a quem forneceu o cupom." };
  const now = Date.now();
  if (coupon.starts_at && coupon.starts_at.getTime() > now) return { valid: false as const, reason: "not_started", message: `Este cupom ainda não está disponível. Tente novamente a partir de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(coupon.starts_at)}.` };
  if (coupon.ends_at.getTime() <= now) return { valid: false as const, reason: "expired", message: "Este cupom expirou. Solicite um novo código a quem forneceu o cupom." };
  return {
    valid: true as const,
    couponId: coupon.id,
    code: coupon.code,
    name: coupon.name,
    endsAt: coupon.ends_at.toISOString(),
    alreadyRedeemed: coupon.redeemed
  };
}

export async function redeemCoupon(code: string, tenantId: string, userId: string) {
  return transaction(async (client) => {
    const locked = await client.query<{ id: string; code: string; name: string | null; ends_at: Date }>(
      `SELECT id, code, name, ends_at FROM benefit_coupons
       WHERE code = $1 AND active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND ends_at > NOW()
       FOR UPDATE`,
      [code]
    );
    const coupon = locked.rows[0];
    if (!coupon) return null;
    await client.query(
      `INSERT INTO benefit_coupon_redemptions (tenant_id, coupon_id, redeemed_by_user_id)
       VALUES ($1, $2, $3) ON CONFLICT (tenant_id, coupon_id) DO NOTHING`,
      [tenantId, coupon.id, userId]
    );
    return { code: coupon.code, name: coupon.name, endsAt: coupon.ends_at.toISOString() };
  });
}
