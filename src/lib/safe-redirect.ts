/** Rutas internas permitidas tras login (anti open-redirect). */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/panel";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/panel";
  if (trimmed.includes("://") || trimmed.includes("\\")) return "/panel";
  if (trimmed.startsWith("/login") || trimmed.startsWith("/api/")) return "/panel";
  return trimmed.slice(0, 200);
}
