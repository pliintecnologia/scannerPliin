import type { AnalysisResult } from "./types";

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toCsv(result: AnalysisResult) {
  const rows = [
    ["criterion", "level", "severity", "location", "explanation", "impact", "audience", "fixSuggestion", "correctedCode"],
    ...result.issues.map((item) => [
      item.criterion,
      item.level,
      item.severity,
      item.location,
      item.explanation,
      item.impact.join(" | "),
      item.audience.join(" | "),
      item.fixSuggestion,
      item.correctedCode
    ])
  ];
  return rows.map((row) => row.map((cell) => escapeCsv(String(cell))).join(",")).join("\n");
}

export function toReportHtml(result: AnalysisResult) {
  const issueCards = result.issues
    .map(
      (item) => `
        <article class="issue-card issue-${escapeHtml(item.severity)}">
          <div class="issue-card__head">
            <div>
              <p class="eyebrow">Critério WCAG</p>
              <h3>${escapeHtml(item.criterion)}</h3>
            </div>
            <div class="pill-row">
              <span class="pill">${escapeHtml(item.level)}</span>
              <span class="pill muted">${escapeHtml(item.severity)}</span>
            </div>
          </div>
          <p class="muted"><strong>Local:</strong> ${escapeHtml(item.location)}</p>
          <p>${escapeHtml(item.explanation)}</p>
          <div class="grid-2">
            <div>
              <p class="label">Impacto</p>
              <p>${escapeHtml(item.impact.join(", "))}</p>
            </div>
            <div>
              <p class="label">Público afetado</p>
              <p>${escapeHtml(item.audience.join(", "))}</p>
            </div>
          </div>
          <div>
            <p class="label">Correção sugerida</p>
            <p>${escapeHtml(item.fixSuggestion)}</p>
            <p class="label">HTML problemático</p>
            <pre>${escapeHtml(item.html)}</pre>
          </div>
        </article>`
    )
    .join("");

  const roadmap = result.roadmap
    .map(
      (item) => `
        <section class="roadmap-item">
          <h3>${escapeHtml(item.priority)}</h3>
          <p>${escapeHtml(item.title)}</p>
          <p><strong>Impacta:</strong> ${escapeHtml(item.impact.join(", "))}</p>
          <p><strong>Ganho estimado:</strong> ${escapeHtml(item.gain)}</p>
        </section>`
    )
    .join("");

  const issueRows = result.issues
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.criterion)}</td>
          <td>${escapeHtml(item.level)}</td>
          <td>${escapeHtml(item.severity)}</td>
          <td>${escapeHtml(item.location)}</td>
          <td>${escapeHtml(item.explanation)}</td>
          <td>${escapeHtml(item.fixSuggestion)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Scanner Pliin - Relatorio</title>
      <style>
        :root{--bg:#f5f1e8;--card:#fffaf1;--text:#171717;--muted:#5f5a51;--line:#ddd;--accent:#0b6b57;--accent-2:#b85c38}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px;background:var(--bg);color:var(--text)}
        header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:24px}
        h1,h2,h3,p{margin:0 0 12px}
        .muted{color:var(--muted)}
        .eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:var(--accent-2);font-weight:700}
        .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
        .card,.roadmap-item,.issue-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(17,17,17,.06)}
        .metric{display:flex;flex-direction:column;gap:4px}
        .metric strong{font-size:28px}
        .section{margin-top:18px}
        .roadmap-list,.issue-list{display:grid;gap:12px}
        .issue-card{page-break-inside:avoid;break-inside:avoid}
        .issue-card__head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
        .pill-row{display:flex;gap:8px;flex-wrap:wrap}
        .pill{padding:6px 10px;border-radius:999px;background:#111;color:#fff;font-size:12px;font-weight:700}
        .pill.muted{background:#f1eadf;color:var(--text)}
        .grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
        .label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px}
        pre{white-space:pre-wrap;word-break:break-word;background:#f6f1e7;padding:12px;border-radius:14px;border:1px solid var(--line);font-size:11px}
        table{width:100%;border-collapse:collapse}
        th,td{border-bottom:1px solid #eee;padding:10px;text-align:left;vertical-align:top;font-size:12px}
        details summary{cursor:pointer;font-weight:700}
        @media print{body{background:#fff}.card,.roadmap-item,.issue-card{box-shadow:none}}
      </style>
    </head>
    <body>
      <header>
        <div>
          <h1>Scanner Pliin</h1>
          <p class="muted">Preparado para integração futura ao Pliin.com.br</p>
          <p class="muted">${new Date(result.timestamp).toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <h2>Nota Scanner Pliin: ${result.score}/100</h2>
          <p>${result.classification}</p>
        </div>
      </header>
      <section class="grid">
        <div class="card metric"><span class="label">Nota geral</span><strong>${result.score}</strong><span>${result.classification}</span></div>
        <div class="card metric"><span class="label">WCAG A</span><strong>${result.wcagScores.A}</strong><span>Aderência base</span></div>
        <div class="card metric"><span class="label">WCAG AA / AAA</span><strong>${result.wcagScores.AA} / ${result.wcagScores.AAA}</strong><span>Refinamento e excelência</span></div>
      </section>
      <section class="card section">
        <h2>Diagnóstico</h2>
        <p>${escapeHtml(result.summary)}</p>
        <p>${escapeHtml(result.technicalNote)}</p>
      </section>
      <section class="card section">
        <h2>O que precisa ser melhorado</h2>
        <div class="roadmap-list">${roadmap}</div>
      </section>
      <section class="card section">
        <h2>Problemas em detalhes</h2>
        <div class="issue-list">${issueCards}</div>
      </section>
      <section class="card section">
        <h2>Tabela resumida</h2>
        <table>
          <thead><tr><th>Critério</th><th>Nível</th><th>Severidade</th><th>Local</th><th>Explicação</th><th>Correção sugerida</th></tr></thead>
          <tbody>${issueRows}</tbody>
        </table>
      </section>
    </body>
  </html>`;
}
