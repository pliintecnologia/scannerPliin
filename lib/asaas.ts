import type { BillingType } from "./plans";

export class AsaasApiError extends Error {
  constructor(public readonly status: number, message = "Falha na comunicação com o Asaas.") {
    super(message);
    this.name = "AsaasApiError";
  }
}

function baseUrl() {
  const override = process.env.ASAAS_BASE_URL?.replace(/\/+$/, "");
  if (override) return override;
  return process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function request<T>(path: string, options: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.");
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl()}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(12_000)
      });
      const payload = await response.json().catch(() => null) as T | null;
      if (response.ok) return payload as T;
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new AsaasApiError(response.status);
      if (!retryable || attempt === 2) throw lastError;
    } catch (error) {
      lastError = error;
      if (error instanceof AsaasApiError && error.status < 500 && error.status !== 429) throw error;
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
  return request<{ id: string }>("/customers", { method: "POST", body: input, idempotencyKey });
}

export function createAsaasSubscription(input: {
  customer: string; billingType: BillingType; value: number; nextDueDate: string;
  cycle: "MONTHLY"; description: string; externalReference: string;
  creditCard?: CardInput; creditCardHolderInfo?: HolderInput; remoteIp?: string;
}, idempotencyKey: string) {
  return request<{ id: string; status?: string } & Record<string, unknown>>("/subscriptions", {
    method: "POST", body: input, idempotencyKey
  });
}

export function listSubscriptionPayments(subscriptionId: string) {
  return request<{ data?: Array<Record<string, unknown>> }>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
}

export function cancelSubscription(subscriptionId: string) {
  return request<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
}

export function sanitizeRemote(value: Record<string, unknown>) {
  const allowed = ["id", "status", "billingType", "cycle", "value", "nextDueDate", "dateCreated", "subscription"];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}
