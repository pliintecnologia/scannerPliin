import type { AnalysisResult, Issue, ProfileScore, Severity, WcagLevel } from "./types";

const severityWeight: Record<Severity, number> = {
  critical: 14,
  high: 9,
  medium: 5,
  low: 2
};

const levelOrder: WcagLevel[] = ["A", "AA", "AAA"];

const profileCatalog = [
  "Pessoa cega / baixa visão",
  "Screen reader",
  "Pessoa surda / auditiva",
  "Pessoa motora",
  "Pessoa neurodivergente",
  "Pessoa com baixa visão",
  "Pessoa com fala / comunicação",
  "Tecnologias assistivas"
];

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseAttributes(fragment: string) {
  const attrs: Record<string, string> = {};
  fragment.replace(/([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_m, key, _raw, v1, v2, v3) => {
    attrs[String(key).toLowerCase()] = String(v1 ?? v2 ?? v3 ?? "");
    return "";
  });
  return attrs;
}

function collectMatches(html: string, tag: string) {
  const matches: Array<{ full: string; attrs: Record<string, string>; inner: string }> = [];
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>|<${tag}\\b([^>]*)\\/?>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const attrs = parseAttributes(match[1] ?? match[3] ?? "");
    matches.push({ full: match[0], attrs, inner: match[2] ?? "" });
  }
  return matches;
}

function hasAccessibleName(attrs: Record<string, string>, inner: string) {
  return Boolean(attrs["aria-label"] || attrs["aria-labelledby"] || attrs["title"] || stripTags(inner));
}

function issue(overrides: Partial<Issue> & Pick<Issue, "criterion" | "level" | "severity" | "location" | "html" | "explanation" | "impact" | "audience" | "fixSuggestion" | "correctedCode" | "profiles" | "weight">) {
  return {
    id: `${overrides.criterion}-${overrides.location}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides
  } as Issue;
}

function levelScore(issues: Issue[], maxLevel: WcagLevel) {
  const limit = levelOrder.indexOf(maxLevel);
  const penalty = issues.filter((item) => levelOrder.indexOf(item.level) <= limit).reduce((sum, item) => sum + item.weight, 0);
  return Math.max(0, Math.round(100 - penalty));
}

function profileScores(issues: Issue[]) {
  return profileCatalog.map((profile) => {
    const related = issues.filter((item) => item.profiles.includes(profile));
    return {
      profile,
      score: Math.max(0, Math.round(100 - related.reduce((sum, item) => sum + item.weight, 0) * 1.2)),
      notes: related.slice(0, 3).map((item) => item.explanation)
    } satisfies ProfileScore;
  });
}

function severityBreakdown(issues: Issue[]) {
  return {
    critical: issues.filter((item) => item.severity === "critical").length,
    high: issues.filter((item) => item.severity === "high").length,
    medium: issues.filter((item) => item.severity === "medium").length,
    low: issues.filter((item) => item.severity === "low").length
  };
}

function classification(score: number) {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Boa";
  if (score >= 50) return "Regular";
  return "Crítica";
}

export function analyzeHtml(html: string, url?: string): AnalysisResult {
  const issues: Issue[] = [];

  if (!/<html[\s>]/i.test(html) || !/lang\s*=/i.test(html)) {
    issues.push(issue({
      criterion: "1.1.1 / 3.1.1",
      level: "A",
      severity: "high",
      location: "<html>",
      html: "<html>",
      explanation: "Documento sem idioma principal declarado.",
      impact: ["Screen readers", "Tradução automática", "Leitura correta do conteúdo"],
      audience: ["Pessoa cega / baixa visão", "Screen reader", "Tecnologias assistivas"],
      fixSuggestion: 'Declare o idioma: `<html lang="pt-BR">`.',
      correctedCode: '<html lang="pt-BR">',
      profiles: ["Pessoa cega / baixa visão", "Screen reader", "Tecnologias assistivas"],
      weight: severityWeight.high
    }));
  }

  if (!/<main[\s>]/i.test(html)) {
    issues.push(issue({
      criterion: "1.3.1",
      level: "A",
      severity: "medium",
      location: "Documento",
      html: "<body>...</body>",
      explanation: "Não foi identificado landmark principal.",
      impact: ["Navegação por landmarks", "Leitores de tela", "Estrutura semântica"],
      audience: ["Pessoa cega / baixa visão", "Screen reader"],
      fixSuggestion: "Use `<main>` para marcar o conteúdo principal.",
      correctedCode: "<main>Conteúdo principal</main>",
      profiles: ["Pessoa cega / baixa visão", "Screen reader", "Tecnologias assistivas"],
      weight: severityWeight.medium
    }));
  }

  collectMatches(html, "img").forEach((img, index) => {
    if (!("alt" in img.attrs)) {
      issues.push(issue({
        criterion: "1.1.1",
        level: "A",
        severity: "high",
        location: `img#${index + 1}`,
        html: img.full,
        explanation: "Imagem sem texto alternativo.",
        impact: ["Leitores de tela", "Compreensão do conteúdo visual"],
        audience: ["Pessoa cega / baixa visão", "Screen reader"],
        fixSuggestion: "Adicione um `alt` descritivo ou marque como decorativa com `alt=\"\"`.",
        correctedCode: '<img src="imagem.jpg" alt="Descrição objetiva da imagem" />',
        profiles: ["Pessoa cega / baixa visão", "Screen reader"],
        weight: severityWeight.high
      }));
    }
  });

  collectMatches(html, "button").forEach((button, index) => {
    if (!hasAccessibleName(button.attrs, button.inner)) {
      issues.push(issue({
        criterion: "4.1.2",
        level: "A",
        severity: "high",
        location: `button#${index + 1}`,
        html: button.full,
        explanation: "Botão sem nome acessível.",
        impact: ["Leitores de tela", "Navegação por teclado", "Compreensão da ação"],
        audience: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa motora"],
        fixSuggestion: "Use texto visível ou `aria-label` descritivo.",
        correctedCode: '<button aria-label="Salvar alterações">Salvar</button>',
        profiles: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa motora", "Tecnologias assistivas"],
        weight: severityWeight.high
      }));
    }
  });

  collectMatches(html, "input").forEach((input, index) => {
    const type = (input.attrs.type || "text").toLowerCase();
    if (!["hidden", "submit", "button", "reset", "image"].includes(type) && !input.attrs.id && !input.attrs["aria-label"] && !input.attrs["aria-labelledby"] && !input.attrs.placeholder) {
      issues.push(issue({
        criterion: "1.3.1 / 3.3.2",
        level: "A",
        severity: "high",
        location: `input#${index + 1}`,
        html: input.full,
        explanation: "Campo sem rótulo acessível identificado.",
        impact: ["Leitores de tela", "Preenchimento correto", "Redução de erro"],
        audience: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
        fixSuggestion: "Associe um `<label for>` ou use `aria-label`.",
        correctedCode: '<label for="email">E-mail</label><input id="email" name="email" type="email" />',
        profiles: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente", "Tecnologias assistivas"],
        weight: severityWeight.high
      }));
    }
  });

  const headingMatches = Array.from(html.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi));
  let lastLevel = 0;
  headingMatches.forEach((match, index) => {
    const currentLevel = Number(match[1].slice(1));
    if (index > 0 && currentLevel > lastLevel + 1) {
      issues.push(issue({
        criterion: "1.3.1",
        level: "A",
        severity: "medium",
        location: `heading#${index + 1}`,
        html: match[0],
        explanation: "Ordem de títulos salta níveis.",
        impact: ["Estrutura", "Navegação por headings", "Compreensão"],
        audience: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
        fixSuggestion: "Mantenha a hierarquia de títulos sem pular níveis.",
        correctedCode: "<h2>Título da seção</h2>",
        profiles: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
        weight: severityWeight.medium
      }));
    }
    lastLevel = currentLevel;
  });

  collectMatches(html, "a").forEach((anchor, index) => {
    const text = stripTags(anchor.inner).toLowerCase();
    if (text === "clique aqui" || text === "saiba mais" || text === "aqui") {
      issues.push(issue({
        criterion: "2.4.4",
        level: "A",
        severity: "medium",
        location: `a#${index + 1}`,
        html: anchor.full,
        explanation: "Link com texto genérico.",
        impact: ["Leitores de tela", "Escaneabilidade", "Contexto fora de contexto"],
        audience: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
        fixSuggestion: "Troque por texto que descreva o destino ou ação.",
        correctedCode: '<a href="/relatorio">Baixar relatório de acessibilidade</a>',
        profiles: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
        weight: severityWeight.medium
      }));
    }
  });

  collectMatches(html, "table").forEach((table, index) => {
    if (!/<caption[\s>]/i.test(table.full)) {
      issues.push(issue({
        criterion: "1.3.1",
        level: "A",
        severity: "low",
        location: `table#${index + 1}`,
        html: table.full,
        explanation: "Tabela sem legenda descritiva.",
        impact: ["Leitores de tela", "Contexto da tabela"],
        audience: ["Pessoa cega / baixa visão", "Screen reader"],
        fixSuggestion: "Adicione `<caption>` com resumo da tabela.",
        correctedCode: "<table><caption>Resumo de vendas</caption>...</table>",
        profiles: ["Pessoa cega / baixa visão", "Screen reader"],
        weight: severityWeight.low
      }));
    }
  });

  collectMatches(html, "video").forEach((video, index) => {
    if (!/<track\b[^>]*kind=['"]captions['"]/i.test(video.full) && !/<track\b[^>]*kind=['"]subtitles['"]/i.test(video.full)) {
      issues.push(issue({
        criterion: "1.2.2",
        level: "A",
        severity: "medium",
        location: `video#${index + 1}`,
        html: video.full,
        explanation: "Vídeo sem legendas identificadas.",
        impact: ["Acesso ao conteúdo audiovisual", "Conteúdo falado"],
        audience: ["Pessoa surda / auditiva"],
        fixSuggestion: "Inclua legendas sincronizadas.",
        correctedCode: '<video controls><track kind="captions" src="legendas.vtt" srclang="pt-BR" label="Português" /></video>',
        profiles: ["Pessoa surda / auditiva"],
        weight: severityWeight.medium
      }));
    }
  });

  collectMatches(html, "audio").forEach((audio, index) => {
    if (!/transcri/i.test(audio.full)) {
      issues.push(issue({
        criterion: "1.2.1",
        level: "A",
        severity: "medium",
        location: `audio#${index + 1}`,
        html: audio.full,
        explanation: "Conteúdo de áudio sem transcrição associada.",
        impact: ["Acesso ao conteúdo falado", "Revisão do conteúdo"],
        audience: ["Pessoa surda / auditiva"],
        fixSuggestion: "Forneça transcrição textual e, se aplicável, legendas.",
        correctedCode: "<audio controls src=\"audio.mp3\"></audio><p>Transcrição do áudio.</p>",
        profiles: ["Pessoa surda / auditiva"],
        weight: severityWeight.medium
      }));
    }
  });

  const duplicateIds = Array.from(html.matchAll(/\sid=['"]([^'"]+)['"]/gi)).reduce<Record<string, number>>((acc, match) => {
    acc[match[1]] = (acc[match[1]] || 0) + 1;
    return acc;
  }, {});

  Object.entries(duplicateIds).forEach(([id, count]) => {
    if (count > 1) {
      issues.push(issue({
        criterion: "4.1.1",
        level: "A",
        severity: "high",
        location: `id=${id}`,
        html: `id="${id}"`,
        explanation: "IDs duplicados foram encontrados.",
        impact: ["Tecnologias assistivas", "Referências ARIA", "Script e foco"],
        audience: ["Screen reader", "Pessoa motora", "Tecnologias assistivas"],
        fixSuggestion: "Garanta IDs únicos em todo o documento.",
        correctedCode: `<div id="${id}-1"></div>`,
        profiles: ["Screen reader", "Pessoa motora", "Tecnologias assistivas"],
        weight: severityWeight.high
      }));
    }
  });

  if (!/button|a|input|select|textarea/i.test(html) && /onclick=/i.test(html)) {
    issues.push(issue({
      criterion: "2.1.1",
      level: "A",
      severity: "high",
      location: "Documento",
      html: "onClick/onclick",
      explanation: "Interação dependente de clique sem alternativa semântica.",
      impact: ["Teclado", "Switch devices", "Navegação operável"],
      audience: ["Pessoa motora", "Tecnologias assistivas"],
      fixSuggestion: "Use elementos nativos interativos.",
      correctedCode: "<button type=\"button\">Abrir menu</button>",
      profiles: ["Pessoa motora", "Tecnologias assistivas"],
      weight: severityWeight.high
    }));
  }

  if (/style=['"][^'"]*color\s*:\s*#([0-9a-f]{3,6})[^'"]*background(?:-color)?\s*:\s*#([0-9a-f]{3,6})/i.test(html)) {
    issues.push(issue({
      criterion: "1.4.3",
      level: "AA",
      severity: "high",
      location: "style",
      html: "color/background inline",
      explanation: "Possível combinação de contraste insuficiente detectada em estilo inline.",
      impact: ["Leitura", "Baixa visão", "Idosos"],
      audience: ["Pessoa com baixa visão"],
      fixSuggestion: "Verifique contraste mínimo e ajuste a paleta.",
      correctedCode: '<span style="color:#111;background:#fff">Texto</span>',
      profiles: ["Pessoa com baixa visão", "Pessoa neurodivergente"],
      weight: severityWeight.high
    }));
  }

  if (!/<label[\s>]/i.test(html) && /<input\b/i.test(html)) {
    issues.push(issue({
      criterion: "3.3.2",
      level: "A",
      severity: "high",
      location: "Formulário",
      html: "<input>",
      explanation: "Campos sem rótulo visível ou programático.",
      impact: ["Compreensão", "Erros de formulário", "Autonomia"],
      audience: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
      fixSuggestion: "Associe labels e mensagens de erro claras.",
      correctedCode: '<label for="name">Nome</label><input id="name" />',
      profiles: ["Pessoa cega / baixa visão", "Screen reader", "Pessoa neurodivergente"],
      weight: severityWeight.high
    }));
  }

  const technicalPenalty = issues.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.max(0, Math.round(100 - technicalPenalty));
  const breakdown = severityBreakdown(issues);
  const wcagScores = {
    A: levelScore(issues, "A"),
    AA: levelScore(issues, "AA"),
    AAA: levelScore(issues, "AAA")
  };
  const profiles = profileScores(issues);
  const topIssues = [...issues].sort((a, b) => b.weight - a.weight).slice(0, 5);

  return {
    title: "Scanner Pliin",
    url,
    timestamp: new Date().toISOString(),
    score,
    classification: classification(score),
    wcagScores,
    technicalNote:
      score >= 90
        ? "A base estrutural está sólida, com poucos pontos de refinamento."
        : score >= 75
          ? "Há boa aderência geral, mas problemas relevantes ainda impactam usuários assistivos."
          : score >= 50
            ? "A página tem barreiras perceptíveis que exigem correções priorizadas."
            : "A página apresenta barreiras críticas e risco alto de exclusão de usuários assistivos.",
    summary: `${issues.length} problema(s) detectado(s) em uma leitura heurística de WCAG 2.2.`,
    severityBreakdown: breakdown,
    profileScores: profiles,
    issues,
    roadmap: topIssues.map((item) => ({
      title: item.fixSuggestion,
      impact: item.impact,
      gain: `+${Math.max(3, item.weight * 2)} pontos`,
      priority: item.severity === "critical" || item.severity === "high" ? "Alta prioridade" : item.severity === "medium" ? "Média prioridade" : "Baixa prioridade"
    })),
    executiveHighlights: [
      `Nota Scanner Pliin: ${score}/100`,
      `Classificação: ${classification(score)}`,
      `Criticidade alta: ${breakdown.critical} item(s)`,
      `Perfil mais afetado: ${profiles.sort((a, b) => a.score - b.score)[0]?.profile ?? "N/A"}`
    ]
  };
}
