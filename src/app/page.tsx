import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/**
 * Entrada del sitio: no hay página de lanzamiento/ventas como aterrizaje. Quien
 * llega entra directo a la obertura + inicio de sesión (`/acceso`); si ya tiene
 * sesión, va a su panel. La presentación institucional queda en `/presentacion`.
 */
export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? "/panel" : "/acceso");
}
