import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth";
import { tenantQuery } from "../../../lib/db";
import type { AnalysisResult } from "../../../lib/types";
import type { AuditResult } from "../../../lib/audit/types";
import AuditWorkspace from "../audit-workspace";

type AuditDetail = {
  id: string;
  url: string;
  score: number | null;
  classification: string | null;
  issue_count: number;
  status: string;
  result: AnalysisResult | AuditResult | null;
  error_message: string | null;
  created_at: Date;
};

export const dynamic = "force-dynamic";

export default async function DiagnosticoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const audits = await tenantQuery<AuditDetail>(
    user.tenantId,
    `SELECT id, url, score, classification, issue_count, status, result, error_message, created_at
     FROM audits WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [user.tenantId, id]
  );
  const audit = audits.rows[0];
  if (!audit) notFound();

  if (!audit.result) {
    return <main className="dashboardShell diagnosticDetail"><section className="panel alert"><h2>Análise não concluída</h2><p>{audit.error_message || "Não há dados disponíveis para este diagnóstico."}</p></section></main>;
  }

  const stored = audit.result;
  const isFullAudit = typeof stored.summary === "object" && Array.isArray((stored as AuditResult).pages);
  const restored: AuditResult = isFullAudit
    ? stored as AuditResult
    : {
        summary: stored as AnalysisResult,
        pages: [{ url: audit.url, renderedHtml: "", analysis: stored as AnalysisResult }]
      };

  return <AuditWorkspace initialAudit={restored} />;
}
