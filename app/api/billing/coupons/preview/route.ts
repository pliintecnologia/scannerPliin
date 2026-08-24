import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { canManageBilling, inspectCoupon, normalizeCouponCode } from "../../../../../lib/billing";
import { bodyTooLarge, rejectCrossOrigin } from "../../../../../lib/request-security";

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  if (bodyTooLarge(request, 2048)) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!canManageBilling(user)) return NextResponse.json({ error: "Sem permissão para gerenciar a cobrança." }, { status: 403 });
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = normalizeCouponCode(body?.code);
  if (!code) return NextResponse.json({ valid: false, reason: "empty", message: "Informe o cupom." }, { status: 400 });
  return NextResponse.json(await inspectCoupon(code, user.tenantId));
}
