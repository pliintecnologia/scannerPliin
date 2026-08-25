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
  vi.restoreAllMocks();
  delete process.env.ASAAS_API_KEY;
  delete process.env.ASAAS_ENVIRONMENT;
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
  it("registra diagnóstico sem chave, corpo ou identificadores", async () => {
    process.env.ASAAS_API_KEY = "secret-api-key";
    process.env.ASAAS_ENVIRONMENT = "production";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "sub_sensitive" }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await createAsaasSubscription({ customer: "cus_sensitive", billingType: "PIX", value: 50, nextDueDate: "2026-08-25", cycle: "MONTHLY", description: "Sensitive description", externalReference: "external-sensitive" }, "idempotency-sensitive");

    const serialized = JSON.stringify(log.mock.calls);
    expect(serialized).toContain("create_subscription");
    expect(serialized).toContain("production");
    expect(serialized).not.toMatch(/secret-api-key|sub_sensitive|cus_sensitive|Sensitive description|external-sensitive|idempotency-sensitive/);
  });

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
    const clean = sanitizeRemote({ id: "sub", status: "ACTIVE", creditCard: { number: "4111" }, subscription: { creditCard: { number: "5555" }, ccv: "999" }, ccv: "123", apiKey: "secret" });
    expect(clean).toEqual({ id: "sub", status: "ACTIVE" });
    expect(JSON.stringify(clean)).not.toMatch(/4111|5555|999|123|secret/);
  });

  it("classifica com segurança chave incompatível com o ambiente", async () => {
    process.env.ASAAS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ code: "invalid_environment", description: "detalhe externo" }] }), { status: 401, headers: { "Content-Type": "application/json" } })));
    await expect(createAsaasSubscription({ customer: "cus_1", billingType: "PIX", value: 50, nextDueDate: "2026-08-25", cycle: "MONTHLY", description: "Plano", externalReference: "request-123" }, "request-123"))
      .rejects.toMatchObject({ code: "invalid_environment", status: 401 });
  });
});
