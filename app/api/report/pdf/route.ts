import { NextResponse } from "next/server";
import type { AnalysisResult } from "../../../../lib/types";
import { buildFallbackPdfBuffer, buildPdfBuffer } from "../../../../lib/audit/report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AnalysisResult | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  try {
    const pdf = await buildPdfBuffer(body);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="scanner-pliin.pdf"'
      }
    });
  } catch {
    const pdf = await buildFallbackPdfBuffer(body);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="scanner-pliin.pdf"'
      }
    });
  }
}
