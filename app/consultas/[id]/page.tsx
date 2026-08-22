import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import { tenantQuery } from "../../../lib/db";
import type { AnalysisResult } from "../../../lib/types";

type AuditDetail = {
  id: string;
  url: string;
  score: number | null;
  classification: string | null;
  issue_count: number;
  status: string;
  result: AnalysisResult | null;
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

  const result = audit.result;
  const formattedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(audit.created_at);

  return <main className="dashboardShell diagnosticDetail">
    <header className="appHeader">
      <Link className="brand" href="/consultas">Scanner Pliin</Link>
      <nav aria-label="Navegação principal"><Link href="/consultas">Seus diagnósticos</Link><form action="/api/auth/logout" method="post"><button type="submit" className="ghostButton">Sair</button></form></nav>
    </header>

    <section className="dashboardHero detailHero">
      <div><p className="eyebrow">Dados da análise</p><h1>{audit.url}</h1><p>Diagnóstico realizado em {formattedDate}.</p></div>
      <Link className="primaryLink" href="/consultas">Voltar</Link>
    </section>

    {!result ? <section className="panel alert"><h2>Análise não concluída</h2><p>{audit.error_message || "Não há dados disponíveis para este diagnóstico."}</p></section> : <>
      <section className="detailMetrics" aria-label="Resumo do diagnóstico">
        <article className="detailMetric"><span>Nota geral</span><strong>{result.score}/100</strong><small>{result.classification}</small></article>
        <article className="detailMetric"><span>Problemas</span><strong>{result.issues.length}</strong><small>itens encontrados</small></article>
        <article className="detailMetric"><span>WCAG A</span><strong>{result.wcagScores.A}</strong><small>aderência base</small></article>
        <article className="detailMetric"><span>WCAG AA / AAA</span><strong>{result.wcagScores.AA} / {result.wcagScores.AAA}</strong><small>níveis avançados</small></article>
      </section>

      <section className="panel detailSummary"><h2>Resumo da análise</h2><p>{result.summary}</p><p>{result.technicalNote}</p></section>

      {result.executiveHighlights.length ? <section className="panel"><h2>Destaques</h2><ul className="detailHighlights">{result.executiveHighlights.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}

      <section className="panel"><h2>Plano de melhorias</h2><div className="roadmap">{result.roadmap.map((item) => <article className="roadmapItem" key={`${item.priority}-${item.title}`}><strong>{item.priority}</strong><h3>{item.title}</h3><p><b>Impacta:</b> {item.impact.join(", ")}</p><p><b>Ganho estimado:</b> {item.gain}</p></article>)}</div></section>

      <section className="panel"><h2>Problemas encontrados</h2>{result.issues.length ? <div className="detailIssues">{result.issues.map((item) => <article className={`issueCard wcagCard wcag-${item.severity}`} key={item.id}><div className="wcagCardTop"><div><p className="wcagCardLabel">Critério WCAG</p><h3>{item.criterion}</h3></div><div className="wcagBadges"><span className="wcagBadge">{item.level}</span><span className="wcagBadge subtle">{item.severity}</span></div></div><p className="issueLocation">{item.location}</p><p className="wcagExcerpt">{item.explanation}</p><div className="wcagMeta"><div><span>Impacto</span><strong>{item.impact.join(", ")}</strong></div><div><span>Público afetado</span><strong>{item.audience.join(", ")}</strong></div></div><div className="wcagFooter"><span>Correção sugerida</span><p>{item.fixSuggestion}</p></div></article>)}</div> : <p>Nenhum problema foi encontrado nesta análise.</p>}</section>
    </>}
  </main>;
}
