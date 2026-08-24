import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __scannerPliinPool: Pool | undefined;
}

function createPool() {
  const connectionString = getConnectionString();
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

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const password = process.env.APP_DATABASE_PASSWORD;
  if (!password) {
    throw new Error(
      "Banco de dados não configurado: defina DATABASE_URL ou APP_DATABASE_PASSWORD."
    );
  }

  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DB || "scanner_pliin";
  return `postgresql://scanner_app:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function getPool() {
  if (!globalThis.__scannerPliinPool) {
    globalThis.__scannerPliinPool = createPool();
  }
  return globalThis.__scannerPliinPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
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
