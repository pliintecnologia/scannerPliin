import type { AnalysisResult } from "../types";
import { launchBrowser } from "./browser";
import { toReportHtml } from "../export";

export async function buildPdfBuffer(result: AnalysisResult) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
    await page.setContent(toReportHtml(result), { waitUntil: "networkidle" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "12mm", bottom: "18mm", left: "12mm" }
    });
  } finally {
    await browser.close();
  }
}

export async function buildFallbackPdfBuffer(result: AnalysisResult) {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(20).text("Scanner Pliin", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Nota geral: ${result.score}/100`);
  doc.text(`Classificacao: ${result.classification}`);
  doc.text(`Data da analise: ${new Date(result.timestamp).toLocaleString("pt-BR")}`);
  doc.moveDown();
  doc.fontSize(11).text("Resumo executivo", { underline: true });
  doc.fontSize(10).text(result.summary);
  doc.text(result.technicalNote);
  doc.moveDown();
  doc.fontSize(11).text("O que precisa ser melhorado", { underline: true });
  result.roadmap.forEach((item) => {
    doc.moveDown(0.5);
    doc.fontSize(10).text(`${item.priority}: ${item.title}`);
    doc.fontSize(9).text(`Impacta: ${item.impact.join(", ")}`);
    doc.text(`Ganho estimado: ${item.gain}`);
  });
  doc.moveDown();
  doc.fontSize(11).text("Problemas encontrados", { underline: true });
  result.issues.slice(0, 20).forEach((issue) => {
    doc.moveDown(0.5);
    doc.fontSize(10).text(`${issue.criterion} - ${issue.location}`);
    doc.fontSize(9).text(`Nível: ${issue.level} | Severidade: ${issue.severity}`);
    doc.text(issue.explanation);
    doc.text(`Impacto: ${issue.impact.join(", ")}`);
    doc.text(`Público afetado: ${issue.audience.join(", ")}`);
    doc.text(`Correção sugerida: ${issue.fixSuggestion}`);
    doc.text(`HTML problemático: ${issue.html}`);
  });

  doc.end();

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
