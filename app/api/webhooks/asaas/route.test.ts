import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock } = vi.hoisted(() => ({ transactionMock: vi.fn() }));
vi.mock("../../../../lib/db", () => ({ transaction: transactionMock }));

import { POST } from "./route";

function webhook(event: string, token = "w".repeat(32)) {
  return new Request("http://localhost/api/webhooks/asaas", {
    method: "POST",
    headers: { "Content-Type": "application/json", "asaas-access-token": token },
    body: JSON.stringify({ id: `evt_${event}`, event, payment: { id: "pay_1", subscription: "sub_1", status: "CONFIRMED" } })
  });
}

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = "w".repeat(32);
  transactionMock.mockReset();
});

afterEach(() => delete process.env.ASAAS_WEBHOOK_TOKEN);

describe("webhook Asaas", () => {
  it("rejeita token inválido sem consultar o banco", async () => {
    const response = await POST(webhook("PAYMENT_CONFIRMED", "invalid"));
    expect(response.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it.each([
    ["PAYMENT_CONFIRMED", "status = 'PAID'"],
    ["PAYMENT_RECEIVED", "status = 'PAID'"],
    ["PAYMENT_OVERDUE", "status = 'OVERDUE_GRACE'"],
    ["PAYMENT_REFUNDED", "status = 'REFUNDED'"],
    ["SUBSCRIPTION_CANCELLED", "status = $1"]
  ])("processa %s uma única vez", async (event, expectedSql) => {
    const queries: string[] = [];
    transactionMock.mockImplementation(async (work: (client: { query: (sql: string) => Promise<{ rowCount: number }> }) => Promise<unknown>) => work({
      query: async (sql: string) => { queries.push(sql); return { rowCount: 1 }; }
    }));
    const response = await POST(webhook(event));
    expect(response.status).toBe(200);
    expect(queries).toHaveLength(2);
    expect(queries[1]).toContain(expectedSql);
  });

  it("não reaplica evento duplicado", async () => {
    const queries: string[] = [];
    transactionMock.mockImplementation(async (work: (client: { query: (sql: string) => Promise<{ rowCount: number }> }) => Promise<unknown>) => work({
      query: async (sql: string) => { queries.push(sql); return { rowCount: 0 }; }
    }));
    const response = await POST(webhook("PAYMENT_CONFIRMED"));
    expect(await response.json()).toMatchObject({ ok: true, duplicate: true });
    expect(queries).toHaveLength(1);
  });
});
