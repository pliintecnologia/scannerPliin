import { NextResponse } from "next/server";
import { runAudit } from "../../../lib/audit/runner";

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

export async function POST(request: Request) {
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
      if (!["http:", "https:"].includes(parsed.protocol) || isPrivateTarget(parsed.hostname)) {
        return NextResponse.json({ error: "URL invalida." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "URL invalida." }, { status: 400 });
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
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada na auditoria.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
