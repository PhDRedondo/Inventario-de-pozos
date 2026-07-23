import { fixEncoding } from "@/lib/geo";
import type { AnalyticsRadarPoint, AnalyticsThemeId, CompareEntityType } from "@/lib/analytics";
import { jsPDF } from "jspdf";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 10;

const LH = {
  small: 4.8,
  body: 5.4,
  subhead: 6,
  hero: 9,
} as const;

const C = {
  black: [26, 26, 26] as const,
  muted: [90, 90, 90] as const,
  border: [229, 229, 229] as const,
  orange: [255, 140, 0] as const,
  yellow: [255, 230, 0] as const,
  red: [232, 56, 26] as const,
  green: [39, 174, 96] as const,
};

export interface AnalyticsReportPdfLabels {
  anhTitle: string;
  gopSystem: string;
  title: string;
  subtitle: string;
  footer: string;
  generatedAt: string;
  scopeTitle: string;
  themeLabel: string;
  themeDescription: string;
  comparisonTitle: string;
  nationalOnly: string;
  compareWith: string;
  entityType: string;
  sampleTitle: string;
  nationalBaseline: string;
  selection: string;
  metricsTitle: string;
  colMetric: string;
  colNational: string;
  colSelection: string;
  colIndex: string;
  colDelta: string;
  heatmapDeptTitle: string;
  heatmapOpTitle: string;
  sampleSize: string;
  none: string;
  filePrefix: string;
}

export interface AnalyticsHeatmapRow {
  name: string;
  sampleSize: number;
  cells: Array<{ key: string; label: string; ratio: number; raw: number }>;
}

export interface AnalyticsReportPdfContent {
  themeId: AnalyticsThemeId;
  themeTitle: string;
  themeDescription: string;
  entityType: CompareEntityType | null;
  entityTypeLabel: string;
  compareLabel: string | null;
  baselineSampleSize: number;
  comparisonSampleSize: number;
  radar: AnalyticsRadarPoint[];
  heatmapDept: AnalyticsHeatmapRow[];
  heatmapOp: AnalyticsHeatmapRow[];
  generatedAt: string;
  filename: string;
  labels: AnalyticsReportPdfLabels;
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.type && !blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  return value.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

class AnalyticsReportPdfBuilder {
  private pdf: jsPDF;
  private y = MARGIN;
  private page = 1;
  private logoData: string | null;
  private labels: AnalyticsReportPdfLabels;

  constructor(logoData: string | null, labels: AnalyticsReportPdfLabels) {
    this.pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.logoData = logoData;
    this.labels = labels;
  }

  private split(text: string, maxWidth: number): string[] {
    return this.pdf.splitTextToSize(text, maxWidth);
  }

  private writeLines(lines: string[], x: number, lineHeight: number): void {
    lines.forEach((line, index) => {
      this.pdf.text(line, x, this.y + index * lineHeight);
    });
    this.y += lines.length * lineHeight;
  }

  private ensureSpace(height: number) {
    if (this.y + height <= PAGE_H - MARGIN - FOOTER_H) return;
    this.addFooter();
    this.pdf.addPage();
    this.page += 1;
    this.drawRunningHeader();
    this.y = MARGIN + 18;
  }

  private setColor(rgb: readonly [number, number, number], type: "text" | "draw" | "fill" = "text") {
    if (type === "text") this.pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
    if (type === "draw") this.pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
    if (type === "fill") this.pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  private drawBrandBar(x: number, y: number, width: number, height: number) {
    const steps = 24;
    const stepW = width / steps;
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      const r = Math.round(C.yellow[0] + (C.red[0] - C.yellow[0]) * t);
      const g = Math.round(C.yellow[1] + (C.red[1] - C.yellow[1]) * t);
      const b = Math.round(C.yellow[2] + (C.red[2] - C.yellow[2]) * t);
      this.pdf.setFillColor(r, g, b);
      this.pdf.rect(x + i * stepW, y, stepW + 0.2, height, "F");
    }
  }

  private drawRunningHeader() {
    if (this.logoData) {
      this.pdf.addImage(this.logoData, "PNG", MARGIN, MARGIN - 2, 38, 14);
    }
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);
    this.pdf.text(this.labels.anhTitle, PAGE_W - MARGIN, MARGIN + 3, { align: "right" });
    this.pdf.text(this.labels.title, PAGE_W - MARGIN, MARGIN + 8, { align: "right" });
    this.setColor(C.border, "draw");
    this.pdf.setLineWidth(0.2);
    this.pdf.line(MARGIN, MARGIN + 16, PAGE_W - MARGIN, MARGIN + 16);
  }

  private addFooter() {
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(7.5);
    const footerY = PAGE_H - 8;
    this.pdf.text(this.labels.footer, MARGIN, footerY);
    this.pdf.text(`${this.page}`, PAGE_W - MARGIN, footerY, { align: "right" });
  }

  private drawSectionHeading(title: string) {
    this.ensureSpace(LH.subhead + 4);
    this.setColor(C.orange, "fill");
    this.pdf.rect(MARGIN, this.y - 3.5, 2.5, 6, "F");
    this.setColor(C.black);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(11);
    this.pdf.text(title, MARGIN + 5, this.y);
    this.y += LH.subhead;
  }

  drawCover(content: AnalyticsReportPdfContent) {
    const { labels } = content;

    if (this.logoData) {
      this.pdf.addImage(this.logoData, "PNG", MARGIN, this.y, 52, 19);
    }

    this.setColor(C.black);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9);
    this.pdf.text(labels.anhTitle, PAGE_W - MARGIN, this.y + 5, { align: "right" });
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);
    this.pdf.text(labels.gopSystem, PAGE_W - MARGIN, this.y + 10, { align: "right" });
    this.pdf.text(labels.subtitle, PAGE_W - MARGIN, this.y + 15, { align: "right" });

    this.y += 24;
    this.drawBrandBar(MARGIN, this.y, CONTENT_W, 2.2);
    this.y += 8;

    this.setColor(C.orange);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8);
    this.pdf.text(labels.title.toUpperCase(), MARGIN, this.y);
    this.y += LH.subhead;

    this.setColor(C.black);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(17);
    this.pdf.text(labels.title, MARGIN, this.y);
    this.y += LH.hero;

    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.5);
    this.pdf.text(content.generatedAt, MARGIN, this.y);
    this.y += LH.body + 4;
  }

  drawScope(content: AnalyticsReportPdfContent) {
    const { labels } = content;
    this.drawSectionHeading(labels.scopeTitle);

    this.setColor(C.black);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(10);
    this.pdf.text(`${labels.themeLabel}: ${content.themeTitle}`, MARGIN, this.y);
    this.y += LH.body;

    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(9);
    this.writeLines(this.split(content.themeDescription, CONTENT_W), MARGIN, LH.small);
    this.y += 3;

    this.drawSectionHeading(labels.comparisonTitle);
    this.setColor(C.black);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(9.5);
    if (content.compareLabel) {
      this.pdf.text(`${labels.entityType}: ${content.entityTypeLabel}`, MARGIN, this.y);
      this.y += LH.body;
      this.pdf.text(`${labels.compareWith}: ${fixEncoding(content.compareLabel)}`, MARGIN, this.y);
      this.y += LH.body + 2;
    } else {
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "italic");
      this.pdf.text(labels.nationalOnly, MARGIN, this.y);
      this.y += LH.body + 2;
    }
  }

  drawSamples(content: AnalyticsReportPdfContent) {
    const { labels } = content;
    this.drawSectionHeading(labels.sampleTitle);

    const cards: Array<[string, number]> = [
      [labels.nationalBaseline, content.baselineSampleSize],
      [labels.selection, content.comparisonSampleSize],
    ];

    const colW = CONTENT_W / 2 - 4;
    cards.forEach(([label, value], index) => {
      const x = MARGIN + index * (colW + 8);
      this.setColor(C.border, "fill");
      this.pdf.roundedRect(x, this.y, colW, 16, 1.5, 1.5, "F");
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8);
      this.pdf.text(label, x + 3, this.y + 5);
      this.setColor(C.black);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(14);
      this.pdf.text(value.toLocaleString("es-CO"), x + 3, this.y + 12);
    });
    this.y += 20;
  }

  drawMetricsTable(content: AnalyticsReportPdfContent) {
    const { labels, radar } = content;
    this.drawSectionHeading(labels.metricsTitle);

    const cols = [
      { key: "metric", label: labels.colMetric, w: 52 },
      { key: "national", label: labels.colNational, w: 30 },
      { key: "selection", label: labels.colSelection, w: 30 },
      { key: "index", label: labels.colIndex, w: 28 },
      { key: "delta", label: labels.colDelta, w: 28 },
    ] as const;

    const rowH = 7;
    this.ensureSpace(rowH + 2);
    this.setColor(C.border, "fill");
    this.pdf.rect(MARGIN, this.y - 4, CONTENT_W, rowH, "F");
    this.setColor(C.black);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8);
    let x = MARGIN + 1.5;
    for (const col of cols) {
      this.pdf.text(col.label, x, this.y);
      x += col.w;
    }
    this.y += rowH;

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);
    for (const point of radar) {
      this.ensureSpace(rowH);
      this.setColor(C.black);
      x = MARGIN + 1.5;
      const values = [
        point.metric,
        formatNumber(point.baselineRaw),
        formatNumber(point.comparisonRaw),
        `${formatNumber(point.comparison)}%`,
        `${point.deltaPct > 0 ? "+" : ""}${formatNumber(point.deltaPct)}%`,
      ];
      values.forEach((value, i) => {
        this.pdf.text(String(value).slice(0, 28), x, this.y);
        x += cols[i].w;
      });
      this.y += rowH - 0.5;
      this.setColor(C.border, "draw");
      this.pdf.setLineWidth(0.15);
      this.pdf.line(MARGIN, this.y - 3.5, PAGE_W - MARGIN, this.y - 3.5);
    }
    this.y += 3;
  }

  drawHeatmapSection(title: string, rows: AnalyticsHeatmapRow[], labels: AnalyticsReportPdfLabels) {
    if (!rows.length) return;
    this.drawSectionHeading(title);
    const top = rows.slice(0, 8);

    for (const row of top) {
      this.ensureSpace(10 + row.cells.length * 4.2);
      this.setColor(C.black);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(9);
      this.pdf.text(fixEncoding(row.name), MARGIN, this.y);
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8);
      this.pdf.text(
        labels.sampleSize.replace("{{count}}", String(row.sampleSize)),
        PAGE_W - MARGIN,
        this.y,
        { align: "right" },
      );
      this.y += LH.small + 1;

      for (const cell of row.cells) {
        this.setColor(C.black);
        this.pdf.setFontSize(8);
        this.pdf.text(
          `${cell.label}: ${formatNumber(cell.raw)} (${formatNumber(cell.ratio)}%)`,
          MARGIN + 2,
          this.y,
        );
        this.y += 4.2;
      }
      this.y += 2;
    }
  }

  finish() {
    this.addFooter();
    return this.pdf;
  }
}

export async function downloadAnalyticsReportPdf(content: AnalyticsReportPdfContent): Promise<void> {
  const logoData = await loadImageDataUrl("/anh-logo.png");
  const builder = new AnalyticsReportPdfBuilder(logoData, content.labels);
  builder.drawCover(content);
  builder.drawScope(content);
  builder.drawSamples(content);
  builder.drawMetricsTable(content);
  builder.drawHeatmapSection(content.labels.heatmapDeptTitle, content.heatmapDept, content.labels);
  builder.drawHeatmapSection(content.labels.heatmapOpTitle, content.heatmapOp, content.labels);
  const pdf = builder.finish();
  pdf.save(content.filename);
}
