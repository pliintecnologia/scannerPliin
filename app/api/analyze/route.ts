import { NextResponse } from "next/server";
import { runAudit } from "../../../lib/audit/runner";
import { getCurrentUser } from "../../../lib/auth";
import { tenantQuery } from "../../../lib/db";
import { assertPublicUrl } from "../../../lib/public-url";
import { bodyTooLarge, rejectCrossOrigin } from "../../../lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_HTML_LENGTH = 2_000_000;

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isPrivateTarget(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function auditLabel(url: string) {
  if (!url) return "Arquivo HTML";
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().slice(0, 2048);
}

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  if (bodyTooLarge(request, MAX_HTML_LENGTH + 65_536)) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    html?: string;
    url?: string;
    crawlDepth?: number;
    maxPages?: number;
    useAxe?: boolean;
    usePa11y?: boolean;
    useLighthouse?: boolean;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const url = normalizeUrl(body.url || "");
  if (url) {
    try {
      const parsed = new URL(url);
      if (isPrivateTarget(parsed.hostname)) return NextResponse.json({ error: "URL inválida." }, { status: 400 });
      await assertPublicUrl(url);
    } catch {
      return NextResponse.json({ error: "URL inválida ou destino não permitido." }, { status: 400 });
    }
  }

  if (body.html && body.html.length > MAX_HTML_LENGTH) {
    return NextResponse.json({ error: "Documento excede o limite aceito." }, { status: 413 });
  }

  try {
    const result = await runAudit({
      html: body.html?.trim() || undefined,
      url: url || undefined,
      crawlDepth: body.crawlDepth,
      maxPages: body.maxPages,
      useAxe: body.useAxe,
      usePa11y: body.usePa11y,
      useLighthouse: body.useLighthouse
    });
    const persistedResult = {
      summary: result.summary,
      pages: result.pages.map((page) => ({
        url: page.url,
        renderedHtml: "",
        analysis: page.analysis,
        axe: Boolean(page.axe),
        pa11y: Boolean(page.pa11y),
        lighthouse: Boolean(page.lighthouse)
      }))
    };
    await tenantQuery(user.tenantId,
      `INSERT INTO audits (tenant_id, user_id, url, score, classification, issue_count, status, result)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7)`,
      [user.tenantId, user.id, auditLabel(url), result.summary.score, result.summary.classification, result.summary.issues.length, persistedResult]
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada na auditoria.";
    await tenantQuery(user.tenantId,
      `INSERT INTO audits (tenant_id, user_id, url, status, error_message) VALUES ($1, $2, $3, 'failed', $4)`,
      [user.tenantId, user.id, auditLabel(url), message.slice(0, 1000)]
    ).catch((dbError) => console.error("audit_failure_log_failed", dbError));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
