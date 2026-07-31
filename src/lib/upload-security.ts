/** Validación de cargas Excel (tamaño, extensión, MIME). */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const ALLOWED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx).toLowerCase();
}

/** Devuelve mensaje de error o null si el archivo es aceptable. */
export function validateExcelUpload(file: File): string | null {
  if (!file.name || file.name.length > 180) {
    return "Nombre de archivo inválido";
  }
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return "Solo se permiten archivos Excel (.xlsx o .xls)";
  }
  if (file.size <= 0) {
    return "El archivo está vacío";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `El archivo supera el tamaño máximo (${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)`;
  }
  const mime = (file.type || "").toLowerCase().trim();
  if (
    mime &&
    !ALLOWED_MIMES.has(mime) &&
    !mime.includes("excel") &&
    !mime.includes("spreadsheet")
  ) {
    return "Tipo de archivo no permitido";
  }
  return null;
}
