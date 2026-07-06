import { fixEncoding } from "@/lib/geo";
import { hasActiveFilters } from "@/lib/filters";
import type { DashboardFilters, DashboardStats, UploadBatch, WellRecord } from "@/lib/types";
import { jsPDF } from "jspdf";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 10;
const MAX_WELLS = 200;

const LH = {
  caption: 4.2,
  small: 4.8,
  body: 5.4,
  subhead: 6,
  hero: 9,
} as const;

const C = {
  black: [26, 26, 26] as const,
  muted: [90, 90, 90] as const,
  border: [229, 229, 229] as const,
  surface: [248, 248, 248] as const,
  orange: [255, 140, 0] as const,
  yellow: [255, 230, 0] as const,
  red: [232, 56, 26] as const,
  green: [39, 174, 96] as const,
  amber: [230, 126, 34] as const,
};

export interface DashboardReportPdfLabels {
  anhTitle: string;
  gopSystem: string;
  title: string;
  subtitle: string;
  footer: string;
  generatedAt: string;
  scopeTitle: string;
  scopeAll: string;
  scopeFiltered: string;
  activeFiltersTitle: string;
  noActiveFilters: string;
  summaryTitle: string;
  validationTitle: string;
  estadoTitle: string;
  departamentoTitle: string;
  operadoraTitle: string;
  wellsTitle: string;
  wellsTruncated: string;
  uploadsTitle: string;
  count: string;
  percentage: string;
  none: string;
  statTotal: string;
  statUploads: string;
  statValid: string;
  statWarnings: string;
  statErrors: string;
  colWell: string;
  colUwi: string;
  colOperator: string;
  colDepartment: string;
  colState: string;
  colValidation: string;
  colFile: string;
  colTotal: string;
  colValid: string;
  colErrors: string;
  colWarnings: string;
  colDate: string;
  statusValid: string;
  statusWarning: string;
  statusInvalid: string;
  statusPending: string;
  filterSearch: string;
  filterState: string;
  filterDepartment: string;
  filterOperator: string;
  filterValidation: string;
}

export interface DashboardReportPdfContent {
  stats: DashboardStats;
  filters: DashboardFilters;
  wells: WellRecord[];
  generatedAt: string;
  filename: string;
  labels: DashboardReportPdfLabels;
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

function validationLabel(status: string | null | undefined, labels: DashboardReportPdfLabels): string {
  if (status === "valid") return labels.statusValid;
  if (status === "warning") return labels.statusWarning;
  if (status === "invalid") return labels.statusInvalid;
  return labels.statusPending;
}

function sortedEntries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

function buildFilterLines(filters: DashboardFilters, labels: DashboardReportPdfLabels): string[] {
  const lines: string[] = [];
  if (filters.q) lines.push(`${labels.filterSearch}: ${filters.q}`);
  if (filters.estado) lines.push(`${labels.filterState}: ${filters.estado}`);
  for (const dept of filters.departamentos ?? []) {
    lines.push(`${labels.filterDepartment}: ${fixEncoding(dept)}`);
  }
  if (filters.operadora) lines.push(`${labels.filterOperator}: ${filters.operadora}`);
  if (filters.validation_status) {
    lines.push(`${labels.filterValidation}: ${validationLabel(filters.validation_status, labels)}`);
  }
  return lines;
}

class DashboardReportPdfBuilder {
  private pdf: jsPDF;
  private y = MARGIN;
  private page = 1;
  private logoData: string | null;
  private labels: DashboardReportPdfLabels;

  constructor(logoData: string | null, labels: DashboardReportPdfLabels) {
    this.pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.logoData = logoData;
    this.labels = labels;
  }

  private split(text: string, maxWidth: number): string[] {
    return this.pdf.splitTextToSize(text, maxWidth);
  }

  private writeLines(lines: string[], x: number, lineHeight: number, startY?: number): number {
    const baseY = startY ?? this.y;
    lines.forEach((line, index) => {
      this.pdf.text(line, x, baseY + index * lineHeight);
    });
    const endY = baseY + lines.length * lineHeight;
    if (startY === undefined) this.y = endY;
    return endY;
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

  drawCover(content: DashboardReportPdfContent) {
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

  drawScope(content: DashboardReportPdfContent) {
    const { stats, filters, labels } = content;
    const filtered = hasActiveFilters(filters);

    this.drawSectionHeading(labels.scopeTitle);

    const scopeText = filtered
      ? labels.scopeFiltered
          .replace("{{filtered}}", String(stats.total_wells))
          .replace("{{total}}", String(stats.catalog_total_wells))
      : labels.scopeAll.replace("{{count}}", String(stats.total_wells));

    this.setColor(C.black);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(9.5);
    this.writeLines(this.split(scopeText, CONTENT_W), MARGIN, LH.body, this.y);
    this.y += 4;

    this.drawSectionHeading(labels.activeFiltersTitle);
    const filterLines = buildFilterLines(filters, labels);

    this.setColor(filterLines.length ? C.black : C.muted);
    this.pdf.setFont("helvetica", filterLines.length ? "normal" : "italic");
    this.pdf.setFontSize(9);
    const text = filterLines.length ? filterLines : [labels.noActiveFilters];
    this.writeLines(text, MARGIN, LH.small, this.y);
    this.y += 4;
  }

  drawSummaryKpis(stats: DashboardStats, labels: DashboardReportPdfLabels) {
    this.drawSectionHeading(labels.summaryTitle);

    const items: Array<[string, number, readonly [number, number, number]]> = [
      [labels.statTotal, stats.total_wells, C.black],
      [labels.statUploads, stats.total_uploads, C.muted],
      [labels.statValid, stats.valid_wells, C.green],
      [labels.statWarnings, stats.wells_with_warnings, C.amber],
      [labels.statErrors, stats.wells_with_errors, C.red],
    ];

    const colW = CONTENT_W / 2 - 4;
    const rowH = 14;

    items.forEach(([label, value, color], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + col * (colW + 8);
      const y = this.y + row * rowH;

      this.ensureSpace(rowH * 2);

      this.setColor(C.border, "fill");
      this.pdf.roundedRect(x, y, colW, rowH - 2, 1.5, 1.5, "F");
      this.setColor(C.border, "draw");
      this.pdf.roundedRect(x, y, colW, rowH - 2, 1.5, 1.5, "S");

      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(7.5);
      this.pdf.text(label.toUpperCase(), x + 4, y + 5);

      this.setColor(color);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(14);
      this.pdf.text(String(value), x + 4, y + 11);
    });

    this.y += Math.ceil(items.length / 2) * rowH + 4;
  }

  private drawDistributionSection(
    title: string,
    entries: Array<[string, number]>,
    total: number,
    barColor: readonly [number, number, number],
    formatLabel: (value: string) => string = (v) => v,
  ) {
    if (!entries.length) return;

    this.drawSectionHeading(title);

    const labelW = 52;
    const countW = 14;
    const pctW = 12;
    const barMaxW = CONTENT_W - labelW - countW - pctW - 6;
    const rowH = 7;

    entries.forEach(([rawLabel, count]) => {
      this.ensureSpace(rowH + 1);
      const label = formatLabel(rawLabel);
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const barW = total > 0 ? (count / total) * barMaxW : 0;
      const rowY = this.y;

      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8);
      const labelLines = this.split(label, labelW - 2);
      this.pdf.text(labelLines[0] ?? label, MARGIN, rowY + 4.5);

      this.setColor(C.surface, "fill");
      this.pdf.rect(MARGIN + labelW, rowY + 2, barMaxW, 3.5, "F");
      if (barW > 0) {
        this.setColor(barColor, "fill");
        this.pdf.rect(MARGIN + labelW, rowY + 2, barW, 3.5, "F");
      }

      this.setColor(C.black);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(8);
      this.pdf.text(String(count), MARGIN + labelW + barMaxW + 2, rowY + 4.5);
      this.pdf.setFont("helvetica", "normal");
      this.setColor(C.muted);
      this.pdf.text(`${pct}%`, MARGIN + labelW + barMaxW + countW + 2, rowY + 4.5);

      this.y += rowH;
    });

    this.y += 3;
  }

  drawDistributions(content: DashboardReportPdfContent) {
    const { stats, labels } = content;
    const total = stats.total_wells || 1;

    this.drawDistributionSection(
      labels.validationTitle,
      [
        [labels.statusValid, stats.valid_wells],
        [labels.statusWarning, stats.wells_with_warnings],
        [labels.statusInvalid, stats.wells_with_errors],
      ],
      total,
      C.green,
    );

    this.drawDistributionSection(labels.estadoTitle, sortedEntries(stats.by_estado), total, C.orange);
    this.drawDistributionSection(
      labels.departamentoTitle,
      sortedEntries(stats.by_departamento),
      total,
      C.red,
      fixEncoding,
    );
    this.drawDistributionSection(labels.operadoraTitle, sortedEntries(stats.by_operadora), total, C.amber);
  }

  drawWellsTable(content: DashboardReportPdfContent) {
    const { wells, labels } = content;
    if (!wells.length) return;

    this.drawSectionHeading(labels.wellsTitle);

    const shown = wells.slice(0, MAX_WELLS);
    const truncated = wells.length > MAX_WELLS;

    if (truncated) {
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "italic");
      this.pdf.setFontSize(8);
      const note = labels.wellsTruncated
        .replace("{{shown}}", String(MAX_WELLS))
        .replace("{{total}}", String(wells.length));
      this.writeLines(this.split(note, CONTENT_W), MARGIN, LH.small, this.y);
      this.y += 2;
    }

    const cols = [
      { key: "well", w: 32 },
      { key: "uwi", w: 38 },
      { key: "op", w: 28 },
      { key: "dept", w: 26 },
      { key: "state", w: 22 },
      { key: "val", w: 22 },
    ] as const;

    const headerLabels = [
      labels.colWell,
      labels.colUwi,
      labels.colOperator,
      labels.colDepartment,
      labels.colState,
      labels.colValidation,
    ];

    const drawHeader = () => {
      this.ensureSpace(10);
      const headerY = this.y;
      this.setColor(C.surface, "fill");
      this.pdf.rect(MARGIN, headerY, CONTENT_W, 7, "F");
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(6.5);
      let x = MARGIN + 2;
      headerLabels.forEach((label, i) => {
        this.pdf.text(label.toUpperCase(), x, headerY + 4.5);
        x += cols[i].w;
      });
      this.y = headerY + 8;
    };

    drawHeader();

    shown.forEach((well) => {
      const values = [
        well.nombre_pozo_sgc ?? labels.none,
        well.uwi_fiscalizado ?? labels.none,
        well.operadora ?? labels.none,
        fixEncoding(well.departamento ?? labels.none),
        well.estado_pozo ?? labels.none,
        validationLabel(well.validation_status, labels),
      ];

      const lineCounts = values.map((value, i) => this.split(value, cols[i].w - 2).length);
      const rowLines = Math.max(...lineCounts, 1);
      const rowH = rowLines * LH.small + 2;

      if (this.y + rowH > PAGE_H - MARGIN - FOOTER_H) {
        this.addFooter();
        this.pdf.addPage();
        this.page += 1;
        this.drawRunningHeader();
        this.y = MARGIN + 18;
        drawHeader();
      }

      const rowY = this.y;
      this.setColor(C.border, "draw");
      this.pdf.setLineWidth(0.05);
      this.pdf.line(MARGIN, rowY, PAGE_W - MARGIN, rowY);

      this.setColor(C.black);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7);
      let x = MARGIN + 2;
      values.forEach((value, i) => {
        const lines = this.split(value, cols[i].w - 2).slice(0, rowLines);
        this.writeLines(lines, x, LH.small, rowY + 3);
        x += cols[i].w;
      });

      this.y = rowY + rowH;
    });

    this.y += 4;
  }

  drawRecentUploads(uploads: UploadBatch[], labels: DashboardReportPdfLabels) {
    if (!uploads.length) return;

    this.drawSectionHeading(labels.uploadsTitle);

    for (const upload of uploads) {
      this.ensureSpace(18);
      const blockY = this.y;

      this.setColor(C.border, "fill");
      this.pdf.roundedRect(MARGIN, blockY, CONTENT_W, 16, 1.5, 1.5, "F");
      this.setColor(C.border, "draw");
      this.pdf.roundedRect(MARGIN, blockY, CONTENT_W, 16, 1.5, 1.5, "S");

      this.setColor(C.black);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(8);
      const fileLines = this.split(upload.filename, CONTENT_W - 8);
      this.pdf.text(fileLines[0], MARGIN + 4, blockY + 5);

      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7);
      const meta = [
        `${labels.colOperator}: ${upload.operadora ?? labels.none}`,
        `${labels.colTotal}: ${upload.total_records}`,
        `${labels.colValid}: ${upload.valid_records}`,
        `${labels.colErrors}: ${upload.invalid_records}`,
        `${labels.colWarnings}: ${upload.warning_records}`,
      ].join("  ·  ");
      this.pdf.text(meta, MARGIN + 4, blockY + 10);

      const date = new Date(upload.created_at).toLocaleString();
      this.pdf.text(date, MARGIN + 4, blockY + 14);

      this.y = blockY + 20;
    }
  }

  save(filename: string) {
    this.addFooter();
    this.pdf.save(filename);
  }
}

export async function downloadDashboardReportPdf(content: DashboardReportPdfContent): Promise<void> {
  const logoData = await loadImageDataUrl("/anh-logo.png");
  const builder = new DashboardReportPdfBuilder(logoData, content.labels);

  builder.drawCover(content);
  builder.drawScope(content);
  builder.drawSummaryKpis(content.stats, content.labels);
  builder.drawDistributions(content);
  builder.drawWellsTable(content);
  builder.drawRecentUploads(content.stats.recent_uploads, content.labels);
  builder.save(content.filename);
}
