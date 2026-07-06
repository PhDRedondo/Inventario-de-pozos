import fs from "fs";
import path from "path";

const OUTBOX_DIR = path.join(process.cwd(), "data", "outbox");
const ANH_CORRESPONDENCE = "correspondenciaanh@anh.gov.co";

export interface SubmissionEmailInput {
  uploadId: number;
  operadora: string;
  filename: string;
  submittedBy: string;
  totalRecords: number;
  validRecords: number;
  excelBuffer: Buffer;
}

export async function sendSubmissionEmail(input: SubmissionEmailInput): Promise<{ sent: boolean; outboxPath?: string }> {
  const subject = `[Inventario Pozos] Envío operadora ${input.operadora} — ${input.filename}`;
  const body = [
    "Estimados señores ANH,",
    "",
    "Se remite inventario de pozos validado sin errores para carga en ControlDoc.",
    "",
    `Operadora: ${input.operadora}`,
    `Archivo: ${input.filename}`,
    `Registros: ${input.totalRecords} (válidos: ${input.validRecords})`,
    `Enviado por: ${input.submittedBy}`,
    `Lote ID: ${input.uploadId}`,
    "",
    "Este mensaje fue generado automáticamente por el Sistema GOP — Inventario de Pozos.",
  ].join("\n");

  if (!fs.existsSync(OUTBOX_DIR)) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(OUTBOX_DIR, `submission-${input.uploadId}-${stamp}`);
  fs.writeFileSync(`${base}.txt`, `To: ${ANH_CORRESPONDENCE}\nSubject: ${subject}\n\n${body}`);
  fs.writeFileSync(`${base}.xlsx`, input.excelBuffer);

  return { sent: false, outboxPath: base };
}

export { ANH_CORRESPONDENCE };
