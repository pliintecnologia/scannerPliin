"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditResult } from "../lib/audit/types";
import type { AnalysisResult } from "../lib/types";
import { toCsv, toReportHtml } from "../lib/export";

type SessionSnapshot = Pick<AnalysisResult, "score" | "timestamp" | "summary" | "classification"> & {
  issues: number;
  url?: string;
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(5);
  const [useAxe, setUseAxe] = useState(true);
  const [usePa11y, setUsePa11y] = useState(false);
  const [useLighthouse, setUseLighthouse] = useState(false);
  const [history, setHistory] = useState<SessionSnapshot[]>([]);
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
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Scanner Pliin</p>
          <h1>Verifique se seu site é fácil de usar</h1>
          <p className="lead">
            Envie um arquivo HTML ou cole o link do site para receber um diagnóstico simples, com problemas,
            impacto e o que corrigir primeiro.
          </p>
          <div className="heroStats" aria-label="Resumo da ferramenta">
            <span className="statChip">Leitura simples</span>
            <span className="statChip">Sem login</span>
            <span className="statChip">PDF pronto</span>
          </div>
        </div>
        <div className="heroCard">
          <label>
            Link do site
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemplo.com" />
          </label>
          <label>
            Arquivo HTML
            <input type="file" accept=".html,text/html" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          <details className="advancedBox">
            <summary>Opções avançadas</summary>
            <p>Use apenas se quiser uma checagem mais profunda.</p>
            <div className="optionGrid">
              <label>
                Profundidade do site
                <input type="number" min="0" max="3" value={crawlDepth} onChange={(e) => setCrawlDepth(Number(e.target.value))} />
              </label>
              <label>
                Quantas páginas
                <input type="number" min="1" max="10" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
              </label>
            </div>
            <div className="toggles">
              <label><input type="checkbox" checked={useAxe} onChange={(e) => setUseAxe(e.target.checked)} /> análise técnica extra</label>
              <label><input type="checkbox" checked={usePa11y} onChange={(e) => setUsePa11y(e.target.checked)} /> verificação complementar</label>
              <label><input type="checkbox" checked={useLighthouse} onChange={(e) => setUseLighthouse(e.target.checked)} /> relatório aprofundado</label>
            </div>
          </details>
          <button onClick={analyze} disabled={loading}>
            {loading ? "Analisando..." : "Verificar agora"}
          </button>
        </div>
      </section>

      {error ? <p className="alert">{error}</p> : null}

      {summary ? (
        <>
          <section className="scoreGrid">
            <article className="scoreCard accent">
              <span>Nota geral</span>
              <strong>{summary.score}/100</strong>
              <small>{summary.classification}</small>
            </article>
            <article className="scoreCard">
              <span>Base</span>
              <strong>{summary.wcagScores.A}</strong>
            </article>
            <article className="scoreCard">
              <span>Atenção</span>
              <strong>{summary.wcagScores.AA}</strong>
            </article>
            <article className="scoreCard">
              <span>Avançado</span>
              <strong>{summary.wcagScores.AAA}</strong>
            </article>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Resumo executivo</h2>
                <p>{summary.summary}</p>
                <p>{summary.technicalNote}</p>
              </div>
              <div className="actions">
                <button onClick={exportJson}>JSON</button>
                <button onClick={exportCsv}>CSV</button>
                <button onClick={exportHtml}>HTML</button>
                <button onClick={() => void exportPdf()}>Baixar PDF da análise</button>
              </div>
            </div>
          </section>

          {sessionDelta ? (
            <section className="panel">
              <h2>Comparacao desta sessao</h2>
              <p>Variação de nota: {sessionDelta.score >= 0 ? "+" : ""}{sessionDelta.score}</p>
              <p>Variação de problemas: {sessionDelta.issues >= 0 ? "+" : ""}{sessionDelta.issues}</p>
            </section>
          ) : null}

          <section className="twoCol">
            <article className="panel">
              <h2>Distribuicao severidade</h2>
              <div className="severityBars">
                {severityData.segments.map((item) => (
                  <div key={item.key} className="severityBarRow">
                    <div className="severityBarHead">
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.value} item(s)</p>
                      </div>
                      <span>{item.percent}%</span>
                    </div>
                    <div className="severityBarTrack" aria-hidden="true">
                      <div className="severityBarFill" style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <h2>Perfil mais afetado</h2>
              <p className="helperText">Nesta escala, 100 significa melhor experiência para o perfil e 0 significa mais barreiras.</p>
              <div className="profileList">
                {summary.profileScores.slice(0, 5).map((profile) => (
                  <div key={profile.profile} className="profileRow">
                    <div>
                      <strong>{profile.profile}</strong>
                      <div className="profileGauge" aria-hidden="true">
                        <span className={`profileGaugeFill ${profileState(profile.score).tone}`} style={{ width: `${profile.score}%` }} />
                      </div>
                      <p>{profile.notes[0] || "Sem alerta adicional."}</p>
                    </div>
                    <div className="profileScoreWrap">
                      <strong>{profile.score}</strong>
                      <span className={`profileState ${profileState(profile.score).tone}`}>{profileState(profile.score).label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel">
            <h2>Páginas verificadas</h2>
            <div className="pageGrid">
              {audit?.pages.map((page, index) => (
                <article key={`${page.url ?? "html"}-${index}`} className="pageCard">
                  <strong>{page.url || "HTML carregado"}</strong>
                  <p>{page.analysis.summary}</p>
                  <p>Nota: {page.analysis.score}/100</p>
                  <p>Problemas: {page.analysis.issues.length}</p>
                  {page.axe ? <p>Verificação extra realizada</p> : null}
                  {page.pa11y ? <p>Checagem complementar realizada</p> : null}
                  {page.lighthouse ? <p>Relatório aprofundado realizado</p> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>O que precisa ser melhorado</h2>
            <div className="roadmap">
              {summary.roadmap.map((item) => (
                <article key={item.title} className="roadmapItem">
                  <strong>{item.priority}</strong>
                  <h3>{item.title}</h3>
                  <p>
                    <b>Impacta:</b> {item.impact.join(", ")}
                  </p>
                  <p>
                    <b>Ganho estimado:</b> {item.gain}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="carouselHead">
              <h2>Problemas encontrados</h2>
              <div className="carouselControls">
                <span>{issueCount ? `${issueIndex + 1} / ${issueCount}` : "0 / 0"}</span>
                <button onClick={() => scrollIssues(-1)} disabled={!issueCount || issueIndex === 0}>Anterior</button>
                <button onClick={() => scrollIssues(1)} disabled={!issueCount || issueIndex >= issueCount - 1}>Próximo</button>
              </div>
            </div>
            <div className="issues wcagDeck" ref={issuesRef}>
              {summary.issues.map((item) => (
                <article key={item.id} className={`issueCard wcagCard wcag-${item.severity}`} data-issue-card>
                  <div className="wcagCardTop">
                    <div>
                      <p className="wcagCardLabel">Critério WCAG</p>
                      <h3>{item.criterion}</h3>
                    </div>
                    <div className="wcagBadges">
                      <span className="wcagBadge">{item.level}</span>
                      <span className="wcagBadge subtle">{item.severity}</span>
                    </div>
                  </div>
                  <p className="issueLocation">{item.location}</p>
                  <p className="wcagExcerpt">{item.explanation}</p>
                  <div className="wcagMeta">
                    <div>
                      <span>Impacto</span>
                      <strong>{item.impact.join(", ")}</strong>
                    </div>
                    <div>
                      <span>Público afetado</span>
                      <strong>{item.audience.join(", ")}</strong>
                    </div>
                  </div>
                  <div className="wcagFooter">
                    <div>
                      <span>Correção sugerida</span>
                      <p>{item.fixSuggestion}</p>
                      <span className="htmlLabel">HTML problemático</span>
                      <pre>{item.html}</pre>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Historico da sessao</h2>
                <p className="helperText">Fica salvo apenas no navegador, durante esta sessão.</p>
              </div>
              <button onClick={clearHistory} disabled={!history.length}>Limpar histórico</button>
            </div>
            <div className="historyList">
              {history.slice().reverse().map((entry) => (
                <article key={entry.timestamp} className="historyRow">
                  <strong>{entry.classification}</strong>
                  <span>{entry.score}/100</span>
                  <p>{entry.summary}</p>
                </article>
              ))}
            </div>
          </section>

          {topIssue ? (
            <section className="panel">
              <h2>Principal alerta</h2>
              <p>{topIssue.explanation}</p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="panel empty">
          <h2>Pronto para analisar</h2>
          <p>Abra um HTML ou informe uma URL para gerar o primeiro diagnostico.</p>
        </section>
      )}
    </main>
  );
}
