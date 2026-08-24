import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tenantQuery } from "../../../lib/db";
import { getEffectiveAccess } from "../../../lib/billing";

type AuditRow = {
  id: string;
  url: string;
  score: number | null;
  classification: string | null;
  issue_count: number;
  status: string;
  created_at: Date;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!(await getEffectiveAccess(user.tenantId)).allowed) return NextResponse.json({ error: "Assinatura necessária." }, { status: 402 });

  const result = await tenantQuery<AuditRow>(
    user.tenantId,
    `SELECT id, url, score, classification, issue_count, status, created_at
     FROM audits
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 6`,
    [user.tenantId]
  );

  return NextResponse.json({
    audits: result.rows.map((audit) => ({
      id: audit.id,
      url: audit.url,
      score: audit.score,
      classification: audit.classification,
      issueCount: audit.issue_count,
      status: audit.status,
      createdAt: audit.created_at
    }))
  });
}
