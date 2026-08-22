import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __scannerPliinPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 65_000,
    query_timeout: 70_000,
    application_name: "scanner-pliin",
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });
}

export const db = globalThis.__scannerPliinPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__scannerPliinPool = db;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function tenantQuery<T extends QueryResultRow>(tenantId: string, text: string, values: unknown[] = []) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Contexto de tenant inválido.");
  }
  return transaction(async (client) => {
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    return client.query<T>(text, values);
  });
}
