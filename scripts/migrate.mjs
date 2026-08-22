import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL nao configurada.");
const appPassword = process.env.APP_DATABASE_PASSWORD;
if (!appPassword || appPassword.length < 20) throw new Error("APP_DATABASE_PASSWORD deve ter pelo menos 20 caracteres.");
const sql = await readFile(new URL("../db/init.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});
await client.connect();
try {
  const passwordLiteral = (await client.query("SELECT quote_literal($1) AS value", [appPassword])).rows[0].value;
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scanner_app') THEN
      CREATE ROLE scanner_app LOGIN PASSWORD ${passwordLiteral} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    ELSE
      ALTER ROLE scanner_app PASSWORD ${passwordLiteral} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
  END $$`);
  await client.query(sql);
  const databaseName = (await client.query("SELECT current_database() AS name")).rows[0].name;
  const databaseIdentifier = `"${String(databaseName).replaceAll('"', '""')}"`;
  await client.query(`REVOKE CONNECT ON DATABASE ${databaseIdentifier} FROM PUBLIC`);
  await client.query(`GRANT CONNECT ON DATABASE ${databaseIdentifier} TO scanner_app`);
  console.log("Banco de dados pronto.");
} finally {
  await client.end();
}
