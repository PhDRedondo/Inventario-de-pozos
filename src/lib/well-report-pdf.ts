import { THEMES } from "@/lib/catalogs";
import { fixEncoding } from "@/lib/geo";
import { buildEsriSatelliteExportUrl, getWellSatelliteMapApiUrl } from "@/lib/satellite-map";
import type { ValidationIssue, WellRecord } from "@/lib/types";
import { jsPDF } from "jspdf";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 10;

/** Alturas de línea consistentes (mm) por tamaño de fuente */
const LH = {
  caption: 4.2,
  small: 4.8,
  body: 5.4,
  subhead: 6,
  title: 7.8,
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

export interface WellReportPdfContent {
  well: WellRecord;
  issues: ValidationIssue[];
  coordinates: { lat: number; lng: number } | null;
  generatedAt: string;
  filename: string;
  labels: {
    anhTitle: string;
    gopSystem: string;
    title: string;
    subtitle: string;
    footer: string;
    generatedAt: string;
    locationMap: string;
    noCoordinates: string;
    validationSection: string;
    none: string;
    errorLabel: string;
    warningLabel: string;
    uwiFiscal: string;
    operadora: string;
    estado: string;
    departamento: string;
    municipio: string;
    validation: string;
    statusValid: string;
    statusWarning: string;
    statusInvalid: string;
    statusPending: string;
    coordinates: string;
    mapAttribution: string;
  };
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

async function loadSatelliteMapDataUrl(lat: number, lng: number): Promise<string> {
  const sources = [getWellSatelliteMapApiUrl(lat, lng), buildEsriSatelliteExportUrl(lat, lng)];

  for (const url of sources) {
    const data = await loadImageDataUrl(url);
    if (data) return data;
  }

  throw new Error("SATELLITE_MAP_UNAVAILABLE");
}

function fieldValue(well: WellRecord, key: keyof WellRecord, none: string): string {
  const raw = well[key];
  if (raw === null || raw === undefined || String(raw).trim() === "") return none;
  if (key === "departamento" || key === "municipio" || key === "locacion_cluster") {
    return fixEncoding(String(raw));
  }
  return String(raw);
}

function validationLabel(status: string | null | undefined, labels: WellReportPdfContent["labels"]): string {
  if (status === "valid") return labels.statusValid;
  if (status === "warning") return labels.statusWarning;
  if (status === "invalid") return labels.statusInvalid;
  return labels.statusPending;
}

function validationColor(status: string | null | undefined): readonly [number, number, number] {
  if (status === "valid") return C.green;
  if (status === "warning") return C.amber;
  if (status === "invalid") return C.red;
  return C.muted;
}

class WellReportPdfBuilder {
  private pdf: jsPDF;
  private y = MARGIN;
  private page = 1;
  private logoData: string | null;
  private labels: WellReportPdfContent["labels"];

  constructor(logoData: string | null, labels: WellReportPdfContent["labels"]) {
    this.pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.logoData = logoData;
    this.labels = labels;
  }

  private split(text: string, maxWidth: number): string[] {
    return this.pdf.splitTextToSize(text, maxWidth);
  }

  /** Escribe líneas con interlineado uniforme y avanza cursor Y */
  private writeLines(lines: string[], x: number, lineHeight: number, startY?: number): number {
    const baseY = startY ?? this.y;
    lines.forEach((line, index) => {
      this.pdf.text(line, x, baseY + index * lineHeight);
    });
    const endY = baseY + lines.length * lineHeight;
    if (startY === undefined) this.y = endY;
    return endY;
  }

  private writeParagraph(text: string, x: number, maxWidth: number, lineHeight: number, gapAfter = 2): void {
    const lines = this.split(text, maxWidth);
    this.writeLines(lines, x, lineHeight);
    this.y += gapAfter;
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

  drawCoverHeader(content: WellReportPdfContent) {
    const { well, labels } = content;

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
    const wellName = well.nombre_pozo_sgc ?? labels.none;
    this.writeParagraph(wellName, MARGIN, CONTENT_W, LH.hero, 1);

    this.setColor(C.muted);
    this.pdf.setFont("courier", "normal");
    this.pdf.setFontSize(9.5);
    this.pdf.text(`${labels.uwiFiscal}: ${well.uwi_fiscalizado ?? labels.none}`, MARGIN, this.y);
    this.y += LH.body + 2;

    const summaryRows: Array<[string, string]> = [
      [labels.operadora, well.operadora ?? labels.none],
      [labels.estado, well.estado_pozo ?? labels.none],
      [labels.departamento, fixEncoding(well.departamento ?? labels.none)],
      [labels.municipio, fixEncoding(well.municipio ?? labels.none)],
    ];

    const colW = CONTENT_W / 2 - 5;
    const rowHeights = summaryRows.map(([, value]) => {
      const lines = this.split(value, colW - 2);
      return LH.caption + 2 + lines.length * LH.small;
    });
    const rowsPerCol = 2;
    const leftColH = rowHeights[0] + rowHeights[2];
    const rightColH = rowHeights[1] + rowHeights[3];
    const boxH = Math.max(leftColH, rightColH) + 10;

    this.setColor(C.border, "fill");
    this.pdf.roundedRect(MARGIN, this.y, CONTENT_W, boxH, 2, 2, "F");
    this.setColor(C.border, "draw");
    this.pdf.roundedRect(MARGIN, this.y, CONTENT_W, boxH, 2, 2, "S");

    const boxTop = this.y + 5;
    summaryRows.forEach(([label, value], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + 5 + col * (colW + 5);
      let rowY = boxTop;
      for (let r = 0; r < row; r += 1) {
        rowY += rowHeights[col === 0 ? r * 2 : r * 2 + 1] ?? LH.body;
      }

      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(7.5);
      this.pdf.text(`${label}:`, x, rowY);

      this.setColor(C.black);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(9);
      const valueLines = this.split(value, colW - 2);
      this.writeLines(valueLines, x, LH.small, rowY + LH.caption);
    });

    const status = validationLabel(well.validation_status, labels);
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(7.5);
    this.pdf.text(`${labels.validation}:`, MARGIN + 5, this.y + boxH - 5);
    this.setColor(validationColor(well.validation_status));
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(9);
    this.pdf.text(status, MARGIN + 30, this.y + boxH - 5);

    this.y += boxH + 4;
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(7.5);
    this.pdf.text(labels.generatedAt, MARGIN, this.y);
    this.y += LH.body;
  }

  private drawMapMarker(centerX: number, centerY: number, validationStatus: string | null | undefined) {
    const fill = validationColor(validationStatus);
    this.setColor([255, 255, 255], "draw");
    this.pdf.setLineWidth(0.7);
    this.pdf.circle(centerX, centerY, 3.2, "S");
    this.setColor(fill, "fill");
    this.pdf.circle(centerX, centerY, 2.5, "F");
    this.setColor(C.black, "draw");
    this.pdf.setLineWidth(0.4);
    this.pdf.circle(centerX, centerY, 2.5, "S");
  }

  drawMap(content: WellReportPdfContent, mapData: string) {
    const { well, coordinates, labels } = content;

    this.ensureSpace(90);
    this.drawSectionHeading(labels.locationMap);

    const contextLines: string[] = [];
    if (well.departamento) contextLines.push(`${labels.departamento}: ${fixEncoding(well.departamento)}`);
    if (well.municipio) contextLines.push(`${labels.municipio}: ${fixEncoding(well.municipio)}`);
    if (coordinates) {
      contextLines.push(`${labels.coordinates}: ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`);
    }

    if (contextLines.length) {
      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8.5);
      this.writeLines(contextLines, MARGIN, LH.small);
      this.y += 2;
    }

    const mapH = 72;
    const mapX = MARGIN;
    const mapY = this.y;

    this.ensureSpace(mapH + 10);
    this.setColor(C.border, "draw");
    this.pdf.setLineWidth(0.3);
    this.pdf.roundedRect(mapX, mapY, CONTENT_W, mapH, 2, 2, "S");
    this.pdf.addImage(mapData, "PNG", mapX + 1, mapY + 1, CONTENT_W - 2, mapH - 2);

    if (coordinates) {
      this.drawMapMarker(mapX + CONTENT_W / 2, mapY + mapH / 2, well.validation_status);
    }

    this.y = mapY + mapH + 2;
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.5);
    this.pdf.text(labels.mapAttribution, MARGIN, this.y);
    this.y += LH.caption + 2;
  }

  drawMapWithoutCoordinates(labels: WellReportPdfContent["labels"]) {
    this.ensureSpace(24);
    this.drawSectionHeading(labels.locationMap);
    this.setColor(C.surface, "fill");
    this.pdf.roundedRect(MARGIN, this.y, CONTENT_W, 16, 2, 2, "F");
    this.setColor(C.border, "draw");
    this.pdf.roundedRect(MARGIN, this.y, CONTENT_W, 16, 2, 2, "S");
    this.setColor(C.muted);
    this.pdf.setFont("helvetica", "italic");
    this.pdf.setFontSize(9);
    this.pdf.text(labels.noCoordinates, MARGIN + CONTENT_W / 2, this.y + 10, { align: "center" });
    this.y += 20;
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

  drawThemes(well: WellRecord, none: string) {
    const colW = CONTENT_W / 2 - 4;

    for (const theme of THEMES) {
      this.ensureSpace(LH.subhead + LH.body);
      this.drawSectionHeading(theme.title);

      this.setColor(C.muted);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8);
      this.writeParagraph(theme.description, MARGIN, CONTENT_W, LH.small, 3);

      for (let i = 0; i < theme.fields.length; i += 2) {
        const left = theme.fields[i];
        const right = theme.fields[i + 1];
        const leftLines = this.split(fieldValue(well, left.key, none), colW);
        const rightLines = right ? this.split(fieldValue(well, right.key, none), colW) : [];
        const valueLines = Math.max(leftLines.length, rightLines.length, 1);
        const blockH = LH.caption + 2 + valueLines * LH.body + 5;

        this.ensureSpace(blockH);

        this.setColor(C.border, "draw");
        this.pdf.setLineWidth(0.1);
        this.pdf.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);

        const blockTop = this.y + 1;

        this.setColor(C.muted);
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(7);
        this.pdf.text(left.label.toUpperCase(), MARGIN + 1, blockTop + LH.caption);
        if (right) {
          this.pdf.text(right.label.toUpperCase(), MARGIN + colW + 8, blockTop + LH.caption);
        }

        this.setColor(C.black);
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(9);
        const valueStart = blockTop + LH.caption + 3;
        this.writeLines(leftLines, MARGIN + 1, LH.body, valueStart);
        if (right) {
          this.writeLines(rightLines, MARGIN + colW + 8, LH.body, valueStart);
        }

        this.y = valueStart + valueLines * LH.body + 4;
      }

      this.y += 3;
    }
  }

  drawIssues(issues: ValidationIssue[], labels: WellReportPdfContent["labels"]) {
    if (!issues.length) return;

    this.ensureSpace(LH.subhead + LH.body);
    this.drawSectionHeading(labels.validationSection);

    for (const issue of issues) {
      const prefix = issue.severity === "error" ? labels.errorLabel : labels.warningLabel;
      const lines = this.split(`${prefix}: ${issue.message}`, CONTENT_W - 8);
      const boxH = lines.length * LH.body + 8;

      this.ensureSpace(boxH + 2);

      const bg = issue.severity === "error" ? [254, 242, 242] : [255, 251, 235];
      this.pdf.setFillColor(bg[0], bg[1], bg[2]);
      this.pdf.roundedRect(MARGIN, this.y, CONTENT_W, boxH, 1.5, 1.5, "F");

      this.setColor(issue.severity === "error" ? C.red : C.amber);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8.5);
      this.writeLines(lines, MARGIN + 4, LH.body, this.y + 5);

      this.y += boxH + 4;
    }
  }

  save(filename: string) {
    this.addFooter();
    this.pdf.save(filename);
  }
}

export async function downloadWellReportPdf(content: WellReportPdfContent): Promise<void> {
  const [logoData, mapData] = await Promise.all([
    loadImageDataUrl("/anh-logo.png"),
    content.coordinates
      ? loadSatelliteMapDataUrl(content.coordinates.lat, content.coordinates.lng)
      : Promise.resolve(null),
  ]);

  const builder = new WellReportPdfBuilder(logoData, content.labels);
  builder.drawCoverHeader(content);
  if (content.coordinates && mapData) {
    builder.drawMap(content, mapData);
  } else if (!content.coordinates) {
    builder.drawMapWithoutCoordinates(content.labels);
  }
  builder.drawThemes(content.well, content.labels.none);
  builder.drawIssues(content.issues, content.labels);
  builder.save(content.filename);
}
