import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, createSession, hashDocument, hashPassword } from "../../../../lib/auth";
import { transaction } from "../../../../lib/db";
import { cleanText, normalizeEmail, onlyDigits, validCnpj, validCpf, validEmail } from "../../../../lib/validation";
import { bodyTooLarge, rejectCrossOrigin } from "../../../../lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  if (bodyTooLarge(request, 32_768)) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateKey = createHash("sha256").update(`register:${ip}`).digest("hex");
  if (!(await checkRateLimit(rateKey, 8, 30))) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const email = normalizeEmail(body.email);
  const name = cleanText(body.name, 120);
  const city = cleanText(body.city, 120);
  const company = cleanText(body.company, 160);
  const cpf = onlyDigits(body.cpf);
  const cnpj = onlyDigits(body.cnpj);
  const password = typeof body.password === "string" ? body.password : "";

  if (!validEmail(email) || name.length < 2 || city.length < 2) {
    return NextResponse.json({ error: "Preencha nome, cidade e um e-mail válido." }, { status: 400 });
  }
  if (!validCpf(cpf)) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  if (cnpj && !validCnpj(cnpj)) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: "A senha deve ter de 10 a 128 caracteres, com letras e números." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const userId = await transaction(async (client) => {
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users
          (email, password_hash, name, city, company, cpf_hash, cpf_last4, cnpj_hash, cnpj_last4)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [email, passwordHash, name, city, company || null, hashDocument(cpf), cpf.slice(-4), cnpj ? hashDocument(cnpj) : null, cnpj ? cnpj.slice(-4) : null]
      );
      const tenantResult = await client.query<{ id: string }>(
        "INSERT INTO tenants (name, document_hash) VALUES ($1, $2) RETURNING id",
        [company || `${name} - Conta`, cnpj ? hashDocument(cnpj) : null]
      );
      await client.query(
        "INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')",
        [tenantResult.rows[0].id, userResult.rows[0].id]
      );
      return userResult.rows[0].id;
    });
    await createSession(userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ error: "Não foi possível cadastrar com os dados informados." }, { status: 409 });
    console.error("registration_failed", { code: code || "unknown" });
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
