import type { BillingType } from "./plans";

export class AsaasApiError extends Error {
  constructor(public readonly status: number, message = "Falha na comunicação com o Asaas.", public readonly code = "provider_error") {
    super(message);
    this.name = "AsaasApiError";
  }
}

function safeApiError(status: number, payload: unknown) {
  const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first = typeof errors[0] === "object" && errors[0] !== null ? errors[0] as Record<string, unknown> : {};
  const code = typeof first.code === "string" ? first.code.slice(0, 80) : "provider_error";
  const messages: Record<string, string> = {
    invalid_environment: "A chave configurada não pertence ao ambiente selecionado no Asaas. Use uma chave Sandbox ou altere conscientemente para produção.",
    invalid_access_token: "A chave de API do Asaas é inválida ou foi revogada.",
    unauthorized: "O Asaas recusou a autenticação da integração. Verifique a chave de API."
  };
  const fallback = status === 400
    ? "O Asaas recusou os dados da cobrança. Confira os dados informados e tente novamente."
    : "Não foi possível comunicar com o Asaas neste momento.";
  return new AsaasApiError(status, messages[code] || fallback, code);
}

function baseUrl() {
  const override = process.env.ASAAS_BASE_URL?.replace(/\/+$/, "");
  if (override) return override;
  return process.env.ASAAS_ENVIRONMENT === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

type AsaasOperation = "create_customer" | "create_subscription" | "list_subscription_payments" | "cancel_subscription";

function logAsaas(level: "info" | "warn" | "error", event: Record<string, string | number | boolean>) {
  console[level]("[asaas]", event);
}

async function request<T>(path: string, options: { operation: AsaasOperation; method?: string; body?: unknown; idempotencyKey?: string }) {
  const apiKey = process.env.ASAAS_API_KEY;
  const environment = process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
  if (!apiKey) {
    logAsaas("error", { event: "configuration_error", operation: options.operation, environment, reason: "missing_api_key" });
    throw new Error("ASAAS_API_KEY não configurada.");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl()}${path}`, {
        method: options.method ?? "GET",
        headers: { "Content-Type": "application/json", access_token: apiKey, ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(65_000),
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null) as T | null;
      if (response.ok) {
        logAsaas("info", { event: "request_completed", operation: options.operation, environment, method: options.method ?? "GET", status: response.status, attempt: attempt + 1, durationMs: Date.now() - startedAt });
        return payload as T;
      }
      const retryable = response.status === 429 || response.status >= 500;
      const apiError = safeApiError(response.status, payload);
      lastError = apiError;
      logAsaas("warn", { event: "request_rejected", operation: options.operation, environment, method: options.method ?? "GET", status: response.status, code: apiError.code, retryable, attempt: attempt + 1, durationMs: Date.now() - startedAt });
      if (!retryable || attempt === 2) throw lastError;
    } catch (error) {
      lastError = error;
      if (error instanceof AsaasApiError && error.status < 500 && error.status !== 429) throw error;
      if (!(error instanceof AsaasApiError)) {
        logAsaas("error", { event: "request_failed", operation: options.operation, environment, method: options.method ?? "GET", reason: error instanceof Error ? error.name : "unknown_error", attempt: attempt + 1, durationMs: Date.now() - startedAt });
      }
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Falha na comunicação com o Asaas.");
}

export type CustomerInput = { name: string; cpfCnpj: string; email: string; phone?: string };
export type CardInput = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
export type HolderInput = Omit<CustomerInput, "phone"> & { phone: string; postalCode: string; addressNumber: string };

export function createAsaasCustomer(input: CustomerInput, idempotencyKey: string) {
  return request<{ id: string }>("/customers", { operation: "create_customer", method: "POST", body: input, idempotencyKey });
}

export function createAsaasSubscription(input: { customer: string; billingType: BillingType; value: number; nextDueDate: string; cycle: "MONTHLY"; description: string; externalReference: string; creditCard?: CardInput; creditCardHolderInfo?: HolderInput; remoteIp?: string }, idempotencyKey: string) {
  return request<{ id: string; status?: string } & Record<string, unknown>>("/subscriptions", { operation: "create_subscription", method: "POST", body: input, idempotencyKey });
}

export function listSubscriptionPayments(subscriptionId: string) {
  return request<{ data?: Array<Record<string, unknown>> }>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`, { operation: "list_subscription_payments" });
}

export function cancelSubscription(subscriptionId: string) {
  return request<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { operation: "cancel_subscription", method: "DELETE" });
}

export function sanitizeRemote(value: Record<string, unknown>) {
  const allowed = ["id", "status", "billingType", "cycle", "value", "nextDueDate", "dateCreated", "subscription"];
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const key of allowed) {
    const item = value[key];
    if (typeof item === "string") sanitized[key] = item.slice(0, 160);
    else if (typeof item === "number" || typeof item === "boolean" || item === null) sanitized[key] = item;
  }
  return sanitized;
}
