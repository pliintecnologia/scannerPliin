import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { tenantQuery } from "../../lib/db";
import { BrandLogo } from "../brand-logo";

type AuditRow = { id: string; url: string; score: number | null; classification: string | null; issue_count: number; status: string; created_at: Date };
export const dynamic = "force-dynamic";

export default async function ConsultasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const audits = await tenantQuery<AuditRow>(user.tenantId, `SELECT id, url, score, classification, issue_count, status, created_at FROM audits WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.tenantId]);
  return <main className="dashboardShell">
    <header className="appHeader"><BrandLogo /><nav aria-label="Navegação principal"><span>Olá, {user.name.split(" ")[0]}</span><form action="/api/auth/logout" method="post"><button type="submit" className="ghostButton">Sair</button></form></nav></header>
    <section className="dashboardHero"><div><p className="eyebrow">Área de consultas</p><h1>Seus diagnósticos</h1><p>Acompanhe as análises realizadas pela sua conta.</p></div><Link className="primaryLink" href="/consultas/nova">Nova consulta</Link></section>
    <section className="listPanel">
      {audits.rows.length ? <div className="auditList">{audits.rows.map((audit) => <article className="auditRow" key={audit.id}>
        <div><strong>{audit.url}</strong><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(audit.created_at)}</span></div>
        <span>{audit.issue_count} problemas</span><span className={`statusBadge ${audit.status}`}>{audit.status === "completed" ? audit.classification || "Concluída" : "Falhou"}</span><strong className="auditScore">{audit.score == null ? "—" : `${audit.score}/100`}</strong>
        <Link className="auditAction" href={`/consultas/${audit.id}`}>Ver análise</Link>
      </article>)}</div> : <div className="emptyState"><h2>Nenhuma consulta ainda</h2><p>Faça sua primeira análise para começar o histórico.</p><Link className="primaryLink" href="/consultas/nova">Realizar primeira consulta</Link></div>}
    </section>
  </main>;
}
