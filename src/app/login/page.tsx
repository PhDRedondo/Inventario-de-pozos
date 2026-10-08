import { redirect } from "next/navigation";

/**
 * Compatibilidad: la ruta de acceso canónica es `/acceso` (como los demás
 * aplicativos de la ANH). `/login` redirige conservando los parámetros, y
 * normaliza `next` a `volver`.
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value !== "string") continue;
    params.set(key === "next" ? "volver" : key, value);
  }
  const qs = params.toString();
  redirect(`/acceso${qs ? `?${qs}` : ""}`);
}
