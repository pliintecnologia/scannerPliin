import { analyzeHtml } from "../analyzer";
import type { AnalysisResult } from "../types";
import type { AuditInput, AuditResult, PageAudit } from "./types";
import { getSameOriginLinks } from "./crawl";
import { renderPage } from "./render";

async function runAxe(page: import("playwright").Page) {
  try {
    const axe = await import("axe-core");
    await page.addScriptTag({ content: axe.source });
    return await page.evaluate(async () => {
      const win = window as Window & { axe?: { run: () => Promise<unknown> } };
      return await win.axe?.run();
    });
  } catch {
    return undefined;
  }
}

async function runPa11y(url: string) {
  try {
    const pa11y = (await import("pa11y")).default;
    return await pa11y(url, {
      chromeLaunchConfig: { args: ["--no-sandbox"] },
      standard: "WCAG2AA",
      includeWarnings: true
    });
  } catch {
    return undefined;
  }
}

async function runLighthouse(url: string) {
  try {
    const lighthouse = (await import("lighthouse")).default;
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--remote-debugging-port=9222"]
    });
    try {
      const result = await lighthouse(url, {
        port: 9222,
        onlyCategories: ["accessibility"]
      });
      return result.lhr;
    } finally {
      await browser.close();
    }
  } catch {
    return undefined;
  }
}

function mergeResults(pages: PageAudit[]): AnalysisResult {
  const base = pages[0]?.analysis ?? analyzeHtml("<html lang='pt-BR'><body></body></html>");
  const issues = pages.flatMap((page) => page.analysis.issues);
  const score = Math.max(0, Math.round(pages.reduce((sum, page) => sum + page.analysis.score, 0) / Math.max(1, pages.length)));
  const summary = `${pages.length} pagina(s) auditada(s) com ${issues.length} problema(s) no total.`;
  const technicalNote = pages.map((page) => page.analysis.technicalNote).join(" ");
  const wcagScores = {
    A: Math.max(0, Math.round(pages.reduce((sum, page) => sum + page.analysis.wcagScores.A, 0) / pages.length)),
    AA: Math.max(0, Math.round(pages.reduce((sum, page) => sum + page.analysis.wcagScores.AA, 0) / pages.length)),
    AAA: Math.max(0, Math.round(pages.reduce((sum, page) => sum + page.analysis.wcagScores.AAA, 0) / pages.length))
  };

  return {
    ...base,
    score,
    summary,
    technicalNote,
    wcagScores,
    issues,
    roadmap: base.roadmap,
    executiveHighlights: [
      `Paginas auditadas: ${pages.length}`,
      `Nota media: ${score}/100`,
      `Problemas acumulados: ${issues.length}`
    ]
  };
}

export async function runAudit(input: AuditInput): Promise<AuditResult> {
  const pages: PageAudit[] = [];

  if (input.html) {
    let analysis: AnalysisResult = analyzeHtml(input.html, input.url);
    if (input.useAxe || (input.usePa11y && input.url) || (input.useLighthouse && input.url)) {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        await page.setContent(input.html, { waitUntil: "networkidle" });
        const renderedHtml = await page.content();
        analysis = analyzeHtml(renderedHtml, input.url);
        const pageAudit: PageAudit = { url: input.url, renderedHtml, analysis };
        if (input.useAxe) {
          pageAudit.axe = await runAxe(page);
        }
        if (input.usePa11y && input.url) {
          pageAudit.pa11y = await runPa11y(input.url);
        }
        if (input.useLighthouse && input.url) {
          pageAudit.lighthouse = await runLighthouse(input.url);
        }
        pages.push(pageAudit);
      } finally {
        await browser.close();
      }
    } else {
      pages.push({ url: input.url, renderedHtml: input.html, analysis });
    }
    return { pages, summary: analysis };
  }

  if (!input.url) {
    const analysis = analyzeHtml("<html lang=\"pt-BR\"><body></body></html>");
    return { pages: [{ renderedHtml: "", analysis }], summary: analysis };
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const rendered = await renderPage(page, input.url);
    const mainAnalysis = analyzeHtml(rendered.html, input.url);
    const pageAudit: PageAudit = { url: input.url, renderedHtml: rendered.html, analysis: mainAnalysis };

    if (input.useAxe) {
      pageAudit.axe = await runAxe(page);
    }
    if (input.usePa11y) {
      pageAudit.pa11y = await runPa11y(input.url);
    }
    if (input.useLighthouse) {
      pageAudit.lighthouse = await runLighthouse(input.url);
    }

    pages.push(pageAudit);

    const crawlDepth = Math.max(0, Math.min(3, input.crawlDepth ?? 0));
    const maxPages = Math.max(1, Math.min(10, input.maxPages ?? 5));
    if (crawlDepth > 0) {
      const crawlUrls = getSameOriginLinks(input.url, rendered.html, maxPages - 1);
      for (const targetUrl of crawlUrls) {
        const targetRendered = await renderPage(page, targetUrl);
        pages.push({
          url: targetUrl,
          renderedHtml: targetRendered.html,
          analysis: analyzeHtml(targetRendered.html, targetUrl)
        });
      }
    }
  } finally {
    await browser.close();
  }

  return { pages, summary: mergeResults(pages) };
}
