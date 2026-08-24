import { afterEach, describe, expect, it, vi } from "vitest";
import { canManageBilling, hashBillingDocument, normalizeCouponCode } from "./billing";
import { createAsaasSubscription, sanitizeRemote } from "./asaas";
import { PREMIUM_PLAN } from "./plans";
import type { AuthUser } from "./auth";

function user(role: AuthUser["role"]): AuthUser {
  return { id: "u", email: "u@example.com", name: "User", city: "City", company: null, cpfLast4: null, cnpjLast4: null, tenantId: "t", tenantName: "Tenant", role };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ASAAS_API_KEY;
  delete process.env.AUTH_SECRET;
});

describe("catálogo autoritativo", () => {
  it("mantém o único plano em 5000 centavos", () => {
    expect(PREMIUM_PLAN).toMatchObject({ id: "premium", priceCents: 5000, price: "50.00", cycle: "MONTHLY" });
  });
});

describe("permissões e cupons", () => {
  it("permite cobrança somente para owner e admin", () => {
    expect(canManageBilling(user("owner"))).toBe(true);
    expect(canManageBilling(user("admin"))).toBe(true);
    expect(canManageBilling(user("member"))).toBe(false);
  });

  it("normaliza cupom sem aceitar mais de 64 caracteres", () => {
    expect(normalizeCouponCode("  cortesia-2026  ")).toBe("CORTESIA-2026");
    expect(normalizeCouponCode("a".repeat(80))).toHaveLength(64);
  });

  it("gera somente HMAC do documento", () => {
    process.env.AUTH_SECRET = "s".repeat(32);
    const result = hashBillingDocument("12345678909");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toContain("12345678909");
  });
});

describe("cliente Asaas", () => {
  it("envia access_token, idempotência e exatamente R$ 50,00", async () => {
    process.env.ASAAS_API_KEY = "sandbox-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "sub_1", status: "ACTIVE" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await createAsaasSubscription({
      customer: "cus_1", billingType: "PIX", value: PREMIUM_PLAN.priceCents / 100,
      nextDueDate: "2026-08-25", cycle: "MONTHLY", description: "Scanner Pliin - Plano Premium",
      externalReference: "request-123"
    }, "request-123");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.access_token).toBe("sandbox-key");
    expect(options.headers["Idempotency-Key"]).toBe("request-123");
    expect(JSON.parse(options.body).value).toBe(50);
  });

  it("não preserva campos sensíveis em respostas remotas", () => {
    const clean = sanitizeRemote({ id: "sub", status: "ACTIVE", creditCard: { number: "4111" }, ccv: "123", apiKey: "secret" });
    expect(clean).toEqual({ id: "sub", status: "ACTIVE" });
    expect(JSON.stringify(clean)).not.toMatch(/4111|123|secret/);
  });
});
