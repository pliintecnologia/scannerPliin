import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, createSession, hashPassword, verifyPassword } from "../../../../lib/auth";
import { query } from "../../../../lib/db";
import { normalizeEmail } from "../../../../lib/validation";
import { bodyTooLarge, rejectCrossOrigin } from "../../../../lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  if (bodyTooLarge(request, 16_384)) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateKey = createHash("sha256").update(`login:${ip}:${email}`).digest("hex");
  if (!(await checkRateLimit(rateKey, 10, 15))) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const result = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1 AND active = TRUE",
    [email]
  );
  const user = result.rows[0];
  const valid = user ? await verifyPassword(password, user.password_hash) : Boolean(await hashPassword(password || "invalid")) && false;
  if (!valid) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
