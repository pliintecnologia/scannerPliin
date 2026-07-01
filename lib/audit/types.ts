import type { AnalysisResult } from "../types";

export type AuditInput = {
  html?: string;
  url?: string;
  crawlDepth?: number;
  maxPages?: number;
  useAxe?: boolean;
  usePa11y?: boolean;
  useLighthouse?: boolean;
};

export type PageAudit = {
  url?: string;
  renderedHtml: string;
  analysis: AnalysisResult;
  axe?: unknown;
  pa11y?: unknown;
  lighthouse?: unknown;
};

export type AuditResult = {
  pages: PageAudit[];
  summary: AnalysisResult;
};
