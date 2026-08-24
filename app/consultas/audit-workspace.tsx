"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Accessibility, AlertCircle, ArrowLeft, ArrowRight, BarChart3, BookOpen, Brain,
  Braces, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Code2, Download,
  Ear, ExternalLink, Eye, FileText, Globe2, Lightbulb, Search, Settings2, ShieldCheck,
  Table2, UserRound, UsersRound, Zap
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Area, AreaChart
} from "recharts";
import type { AuditResult } from "../../lib/audit/types";
import type { AnalysisResult } from "../../lib/types";
import { toCsv, toReportHtml } from "../../lib/export";
import { BrandLogo } from "../brand-logo";
import { ThemeToggle } from "../theme-toggle";

type SessionSnapshot = Pick<AnalysisResult, "score" | "timestamp" | "summary" | "classification"> & {
  issues: number;
  url?: string;
};

type SavedAudit = {
  id: string;
  url: string;
  score: number | null;
  classification: string | null;
  issueCount: number;
  status: string;
  createdAt: string;
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="infoTip">
      <summary aria-label={`Saiba mais sobre ${label}`}>i</summary>
      <div className="infoTipContent">{children}</div>
    </details>
  );
}

const metricColors = ["#079768", "#1688f2", "#ff9d00"];

function MetricSparkline({ score, color }: { score: number; color: string }) {
  const values = [score - 8, score - 13, score - 7, score - 9, score - 4, score - 6, score + 2, score - 5, score - 8, score, score - 4, score + 1];
  const data = values.map((value, index) => ({ index, value: Math.max(0, Math.min(100, value)) }));
  return <div className="metricSparkline" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.18}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#spark-${color.replace("#", "")})`} dot={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>;
}

export default function AuditWorkspace({ initialAudit = null }: { initialAudit?: AuditResult | null }) {
  const [url, setUrl] = useState(initialAudit?.summary.url ?? "");
  const [html, setHtml] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(initialAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(5);
  const [useAxe, setUseAxe] = useState(true);
  const [usePa11y, setUsePa11y] = useState(false);
  const [useLighthouse, setUseLighthouse] = useState(false);
  const [history, setHistory] = useState<SessionSnapshot[]>([]);
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);
  const issuesRef = useRef<HTMLDivElement | null>(null);
  const [issueIndex, setIssueIndex] = useState(0);

  const summary = audit?.summary ?? null;
  const topIssue = useMemo(() => summary?.issues[0], [summary]);
  const issueCount = summary?.issues.length ?? 0;
  const severityData = useMemo(() => {
    const breakdown = summary?.severityBreakdown ?? { critical: 0, high: 0, medium: 0, low: 0 };
    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0) || 1;
    const segments = [
      { key: "critical", label: "Crítica", value: breakdown.critical, color: "#8b1d18" },
      { key: "high", label: "Alta", value: breakdown.high, color: "#b85c38" },
      { key: "medium", label: "Média", value: breakdown.medium, color: "#c68b24" },
      { key: "low", label: "Baixa", value: breakdown.low, color: "#5b7c8d" }
    ].map((item) => ({
      ...item,
      percent: Math.round((item.value / total) * 100)
    }));
    let cursor = 0;
    const gradient = segments
      .map((item) => {
        const start = cursor;
        cursor += item.percent;
        return `${item.color} ${start}% ${cursor}%`;
      })
      .join(", ");
    return { segments, gradient };
  }, [summary]);
  function profileState(score: number) {
    if (score >= 80) return { label: "Melhor acesso", tone: "good" };
    if (score >= 60) return { label: "Atenção", tone: "warn" };
    return { label: "Mais barreiras", tone: "bad" };
  }
  const sessionDelta = useMemo(() => {
    if (history.length < 2) return null;
    const previous = history[history.length - 2];
    const current = history[history.length - 1];
    return {
      score: current.score - previous.score,
      issues: current.issues - previous.issues
    };
  }, [history]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("scanner-pliin-history");
    if (!stored) return;
    try {
      setHistory(JSON.parse(stored) as SessionSnapshot[]);
    } catch {
      window.sessionStorage.removeItem("scanner-pliin-history");
    }
  }, []);

  async function loadSavedAudits() {
    const response = await fetch("/api/audits", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json() as { audits?: SavedAudit[] };
    setSavedAudits(data.audits ?? []);
  }

  useEffect(() => {
    void loadSavedAudits();
  }, []);

  useEffect(() => {
    if (!summary) return;
    const snapshot: SessionSnapshot = {
      score: summary.score,
      timestamp: summary.timestamp,
      summary: summary.summary,
      classification: summary.classification,
      issues: summary.issues.length,
      url: summary.url
    };
    setHistory((current) => {
      const next = [...current.filter((item) => item.timestamp !== snapshot.timestamp), snapshot].slice(-6);
      window.sessionStorage.setItem("scanner-pliin-history", JSON.stringify(next));
      return next;
    });
  }, [summary]);

  useEffect(() => {
    setIssueIndex(0);
  }, [issueCount]);

  function clearHistory() {
    window.sessionStorage.removeItem("scanner-pliin-history");
    setHistory([]);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError("");
    setHtml(await file.text());
  }

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const normalizedUrl = normalizeUrl(url);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          url: normalizedUrl,
          crawlDepth,
          maxPages,
          useAxe,
          usePa11y,
          useLighthouse
        })
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as (AuditResult & { error?: string }) | null)
        : ({ error: await response.text().catch(() => "") } as AuditResult & { error?: string });
      if (!response.ok) throw new Error(data?.error || "Falha na analise.");
      if (!data) throw new Error("Resposta vazia da analise.");
      setAudit(data);
      void loadSavedAudits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setLoading(false);
    }
  }

  function exportJson() {
    if (!audit) return;
    download("scanner-pliin.json", JSON.stringify(audit, null, 2), "application/json");
  }

  function exportCsv() {
    if (!summary) return;
    download("scanner-pliin.csv", toCsv(summary), "text/csv;charset=utf-8");
  }

  function exportHtml() {
    if (!summary) return;
    download("scanner-pliin.html", toReportHtml(summary), "text/html;charset=utf-8");
  }

  async function exportPdf() {
    if (!summary) return;
    try {
      const response = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary)
      });
      if (!response.ok) {
        setError("Falha ao gerar PDF.");
        return;
      }
      downloadBlob("scanner-pliin.pdf", await response.blob());
    } catch {
      setError("Falha ao gerar PDF.");
    }
  }

  function scrollIssues(direction: -1 | 1) {
    const container = issuesRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-issue-card]"));
    if (!cards.length) return;
    const nextIndex = Math.max(0, Math.min(cards.length - 1, issueIndex + direction));
    cards[nextIndex]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setIssueIndex(nextIndex);
  }

  return (
    <main className="shell auditDashboard">
      <header className="appHeader">
        <Link className="backLink" href="/app"><ArrowLeft size={17} aria-hidden="true" /> Voltar à lista</Link>
        <div className="brandCentered"><BrandLogo compact /></div>
        <nav aria-label="Navegação principal">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post"><button type="submit" className="headerIcon" aria-label="Ajuda e sair"><CircleHelp size={19} /></button></form>
        </nav>
      </header>
      {loading ? (
        <div className="loadingOverlay" role="status" aria-live="polite" aria-label="Análise em andamento">
          <div className="loadingCard">
            <span className="loadingSpinner" aria-hidden="true" />
            <strong>Processando o site...</strong>
            <p>Estamos analisando as páginas. Isso pode levar alguns instantes.</p>
          </div>
        </div>
      ) : null}
      <section className="hero dashboardIntro compactScanner">
        <div className="heroCard">
          <div className="fieldGroup">
            <label className="visuallyHidden" htmlFor="site-url">Link do site</label>
            <div className="urlSearch"><Search size={28} aria-hidden="true" /><input id="site-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Digite o link do site para analisar..." /><button onClick={analyze} disabled={loading} aria-label="Analisar site"><ArrowRight size={28} /></button></div>
          </div>
          <div className="scannerOptions" aria-label="Recursos da análise">
            <span className="scannerFeature"><BookOpen size={21} aria-hidden="true" /> Leitura simples</span>
            <label className="scannerFeature fileFeature"><FileText size={21} aria-hidden="true" /> <span>{html ? "HTML carregado" : "PDF pronto"}</span><input id="html-file" type="file" accept=".html,text/html" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
            <details className="advancedBox">
            <summary className="advancedSummary"><Settings2 size={21} aria-hidden="true" /> Opções avançadas</summary>
            <p>Use apenas se quiser uma checagem mais profunda.</p>
            <div className="optionGrid">
              <div className="fieldGroup">
                <div className="fieldTitle">
                  <label htmlFor="crawl-depth">Profundidade do site</label>
                  <InfoTip label="profundidade do site">Define quantos níveis de links internos o scanner seguirá a partir da página inicial.</InfoTip>
                </div>
                <input id="crawl-depth" type="number" min="0" max="3" value={crawlDepth} onChange={(e) => setCrawlDepth(Number(e.target.value))} />
              </div>
              <div className="fieldGroup">
                <div className="fieldTitle">
                  <label htmlFor="max-pages">Quantidade de páginas</label>
                  <InfoTip label="quantidade de páginas">Limita o total de páginas analisadas, ajudando a controlar o tempo do processamento.</InfoTip>
                </div>
                <input id="max-pages" type="number" min="1" max="10" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
              </div>
            </div>
            <div className="toggles">
              <div className="toggleCard">
                <label><input type="checkbox" checked={useAxe} onChange={(e) => setUseAxe(e.target.checked)} /><span>Análise técnica extra</span></label>
                <InfoTip label="análise técnica extra">Usa o axe para encontrar barreiras de acessibilidade diretamente nos elementos da página.</InfoTip>
              </div>
              <div className="toggleCard">
                <label><input type="checkbox" checked={usePa11y} onChange={(e) => setUsePa11y(e.target.checked)} /><span>Verificação complementar</span></label>
                <InfoTip label="verificação complementar">Executa o Pa11y como uma segunda checagem automática de acessibilidade.</InfoTip>
              </div>
              <div className="toggleCard">
                <label><input type="checkbox" checked={useLighthouse} onChange={(e) => setUseLighthouse(e.target.checked)} /><span>Relatório aprofundado</span></label>
                <InfoTip label="relatório aprofundado">Inclui uma auditoria Lighthouse, que pode aumentar o tempo da análise.</InfoTip>
              </div>
            </div>
            </details>
          </div>
        </div>
      </section>

      <section className="savedAuditsPanel compactHistory" aria-labelledby="saved-audits-title">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Histórico da conta</p>
            <h2 id="saved-audits-title">Análises recentes</h2>
            <p>Retome rapidamente os diagnósticos que já estão salvos no banco de dados.</p>
          </div>
          <Link className="textLink" href="/app">Ver todas</Link>
        </div>
        {savedAudits.length ? (
          <div className="savedAuditList">
            {savedAudits.map((item) => (
              <article className="savedAuditItem" key={item.id}>
                <div className="savedAuditIdentity">
                  <span className={`auditStatusDot ${item.status}`} aria-hidden="true" />
                  <div>
                    <strong title={item.url}>{item.url || "Arquivo HTML"}</strong>
                    <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</span>
                  </div>
                </div>
                <div className="savedAuditMeta">
                  <span>{item.issueCount} problemas</span>
                  <strong>{item.score == null ? "—" : `${item.score}/100`}</strong>
                </div>
                <Link className="auditAction" href={`/app/consultas/${item.id}`} aria-label={`Rever análise de ${item.url || "Arquivo HTML"}`}>
                  Rever análise
                </Link>
              </article>
            ))}
          </div>
        ) : <p className="savedAuditsEmpty">Sua primeira análise aparecerá aqui assim que for concluída.</p>}
      </section>

      {error ? <p className="alert">{error}</p> : null}

      {summary ? (
        <div className="resultsDashboard">
          <section className="scoreGrid dashboardMetrics">
            <article className="scoreCard accent">
              <div className="overallCopy"><span>Nota geral</span><strong>{summary.score}<small>/100</small></strong><small>{summary.classification}</small><i><b style={{ width: `${summary.score}%` }} /></i></div>
              <div className="scoreRing" style={{ background: `conic-gradient(#63efb5 ${summary.score * 3.6}deg, rgba(255,255,255,.25) 0)` }}><span>{summary.score}</span></div>
            </article>
            {[
              { label: "Ética", value: summary.wcagScores.A, icon: ShieldCheck, color: metricColors[0] },
              { label: "Atenção", value: summary.wcagScores.AA, icon: Eye, color: metricColors[1] },
              { label: "Atuação", value: summary.wcagScores.AAA, icon: Zap, color: metricColors[2] }
            ].map((metric) => <article className="scoreCard metricCard" key={metric.label}><div className="metricHead"><span className="metricIcon" style={{ color: metric.color, backgroundColor: `${metric.color}14` }}><metric.icon size={23} /></span><span>{metric.label}</span></div><strong>{metric.value}<small>/100</small></strong><MetricSparkline score={metric.value} color={metric.color} /></article>)}
          </section>

          <section className="panel executivePanel">
            <div className="panelHead">
              <div>
                <h2><FileText size={21} /> Resumo executivo</h2>
                <p className="summaryLead">{audit?.pages.length ?? 0} página(s) analisada(s) com {summary.issues.length} problema(s) no total.</p>
                <p>{summary.summary}</p>
                <p>{summary.technicalNote}</p>
              </div>
              <div className="actions">
                <button onClick={exportJson}><Braces size={17} /> JSON</button>
                <button onClick={exportCsv}><Table2 size={17} /> CSV</button>
                <button onClick={exportHtml}><Code2 size={17} /> HTML</button>
                <button onClick={() => void exportPdf()}><Download size={18} /> Baixar PDF da análise</button>
              </div>
            </div>
          </section>

          <section className="twoCol insightGrid">
            <article className="panel severityPanel">
              <h2><BarChart3 size={21} /> Distribuição de severidade</h2>
              <div className="severityVisual">
                <div className="donutWrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={severityData.segments} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="94%" stroke="none" isAnimationActive={false}>{severityData.segments.map((item) => <Cell key={item.key} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donutCenter"><strong>{summary.issues.length}</strong><span>problemas<br/>encontrados</span></div></div>
                <div className="severityLegend">{severityData.segments.map((item) => <div className="severityLegendRow" key={item.key}><i style={{ backgroundColor: item.color }} /><strong>{item.label}</strong><span>{item.value} <small>({item.percent}%)</small></span></div>)}</div>
              </div>
            </article>
            <article className="panel profilePanel">
              <h2><UsersRound size={21} /> Perfil mais afetado</h2>
              <p className="helperText">Nesta escala, 100 significa melhor experiência para o perfil e 0 significa mais barreiras.</p>
              <div className="profileList">
                {summary.profileScores.slice(0, 5).map((profile, profileIndex) => {
                  const ProfileIcon = [Accessibility, UserRound, Brain, Ear, UsersRound][profileIndex] ?? UserRound;
                  const colors = ["#f5b000", "#f0779a", "#bd6cdb", "#36a9ed", "#36b96f"];
                  return (
                  <div key={profile.profile} className="profileRow">
                    <span className="profileIcon" style={{ color: colors[profileIndex], backgroundColor: `${colors[profileIndex]}18` }}><ProfileIcon size={19}/></span>
                    <strong>{profile.profile}</strong>
                    <span className="profileNumber">{profile.score}</span>
                    <div className="profileGauge" aria-hidden="true"><span style={{ width: `${profile.score}%`, backgroundColor: colors[profileIndex] }} /></div>
                  </div>
                )})}
              </div>
            </article>
          </section>

          <section className="panel pagesPanel">
            <h2><Globe2 size={21} /> Páginas verificadas</h2>
            <div className="pageGrid">
              {audit?.pages.map((page, index) => (
                <article key={`${page.url ?? "html"}-${index}`} className="pageCard">
                  <div className="pageTitle"><strong>{page.url || "HTML carregado"}</strong><ExternalLink size={17}/></div>
                  <p>{page.analysis.summary}</p>
                  <span className="pageScore">Nota: {page.analysis.score}/100</span>
                  <b>Problemas: {page.analysis.issues.length}</b>
                  <span className="verified"><CheckCircle2 size={15}/> Verificado: transmissão</span>
                </article>
              ))}
            </div>
            <div className="improvementBox">
              <div className="ideaVisual"><Lightbulb size={66}/></div>
              <div><h2><Lightbulb size={18}/> O que precisa ser melhorado</h2>{summary.roadmap.slice(0, 3).map((item, index) => <div className="improvementLine" key={item.title}><span>{index === 0 ? <BarChart3 size={17}/> : index === 1 ? <Accessibility size={17}/> : <CheckCircle2 size={17}/>}</span><p><strong>{index === 0 ? "Melhor prioridade" : index === 1 ? "Impacto" : "Ganho estimado"}</strong>{index === 0 ? item.title : index === 1 ? item.impact.join(", ") : item.gain}</p></div>)}</div>
            </div>
          </section>

          <section className="panel issuesPanel">
            <div className="carouselHead">
              <h2><AlertCircle size={21} /> Problemas encontrados</h2>
              <div className="carouselControls">
                <span>{issueCount ? `${issueIndex + 1} / ${issueCount}` : "0 / 0"}</span>
                <button onClick={() => scrollIssues(-1)} disabled={!issueCount || issueIndex === 0} aria-label="Problema anterior"><ChevronLeft size={20}/></button>
                <button onClick={() => scrollIssues(1)} disabled={!issueCount || issueIndex >= issueCount - 1} aria-label="Próximo problema"><ChevronRight size={20}/></button>
              </div>
            </div>
            <div className="issuesOverview">
              <div className="issuesChart"><ResponsiveContainer width="100%" height="100%"><BarChart data={severityData.segments} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8ebef"/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="value" radius={[5,5,0,0]}>{severityData.segments.map((item) => <Cell key={item.key} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></div>
              <div className="compactIssues" ref={issuesRef}>{summary.issues.map((item) => <details key={item.id} className={`compactIssue compact-${item.severity}`} data-issue-card><summary><span className="severityPill">{item.severity}</span><span>Critério WCAG</span><strong>{item.criterion}</strong><small>{item.level}</small><ChevronRight size={18}/></summary><div><p>{item.explanation}</p><p><b>Impacto:</b> {item.impact.join(", ")}</p><p><b>Correção:</b> {item.fixSuggestion}</p>{item.html ? <pre>{item.html}</pre> : null}</div></details>)}</div>
            </div>
          </section>

          {sessionDelta ? <section className="analysisNote"><CheckCircle2 size={15}/> Em relação à análise anterior nesta sessão: nota {sessionDelta.score >= 0 ? "+" : ""}{sessionDelta.score}, problemas {sessionDelta.issues >= 0 ? "+" : ""}{sessionDelta.issues}.</section> : null}
          <footer className="reportFooter"><CircleHelp size={15}/> Relatório baseado em heurísticas da WCAG 2.2 <span>•</span> Análise automática sujeita a limitações</footer>
        </div>
      ) : (
        <section className="panel empty">
          <h2>Pronto para analisar</h2>
          <p>Abra um HTML ou informe uma URL para gerar o primeiro diagnostico.</p>
        </section>
      )}
    </main>
  );
}
