export type Severity = "critical" | "high" | "medium" | "low";
export type WcagLevel = "A" | "AA" | "AAA";
export type Classification = "Excelente" | "Boa" | "Regular" | "Crítica";

export type Issue = {
  id: string;
  criterion: string;
  level: WcagLevel;
  severity: Severity;
  location: string;
  html: string;
  explanation: string;
  impact: string[];
  audience: string[];
  fixSuggestion: string;
  correctedCode: string;
  profiles: string[];
  weight: number;
};

export type ProfileScore = {
  profile: string;
  score: number;
  notes: string[];
};

export type AnalysisResult = {
  title: string;
  url?: string;
  timestamp: string;
  score: number;
  classification: Classification;
  wcagScores: Record<WcagLevel, number>;
  technicalNote: string;
  summary: string;
  severityBreakdown: Record<Severity, number>;
  profileScores: ProfileScore[];
  issues: Issue[];
  roadmap: Array<{
    title: string;
    impact: string[];
    gain: string;
    priority: "Alta prioridade" | "Média prioridade" | "Baixa prioridade";
  }>;
  executiveHighlights: string[];
};
