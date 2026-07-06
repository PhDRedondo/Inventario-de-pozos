export function fixEncoding(text: string): string {
  return text
    .replace(/├ô/g, "Ó")
    .replace(/├ü/g, "Á")
    .replace(/├Ü/g, "Ü")
    .replace(/├╝/g, "ú")
    .replace(/├┤/g, "ó")
    .replace(/├ì/g, "Í")
    .replace(/├ë/g, "É")
    .replace(/├║/g, "Ú")
    .replace(/├▒/g, "Ñ")
    .replace(/√≥/g, "ó")
    .replace(/√≠/g, "í")
    .replace(/√°/g, "á")
    .replace(/√©/g, "é")
    .replace(/√∫/g, "ú")
    .replace(/√±/g, "ñ")
    .replace(/Ã³/g, "ó")
    .replace(/Ã­/g, "í")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã"/g, "Ó")
    .replace(/Ã'/g, "Á");
}

export function sanitizeSpanishText(text: string | null | undefined): string {
  if (!text) return "";
  return fixEncoding(text).normalize("NFC");
}

export function normalizeGeoName(name: string): string {
  return fixEncoding(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function deptNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeGeoName(a) === normalizeGeoName(b);
}
