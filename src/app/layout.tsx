import type { Metadata, Viewport } from "next";
import { AppPreferencesProvider } from "@/context/AppPreferences";
import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Inventario de Pozos | ANH — GOP",
  description:
    "Sistema GOP de la ANH para recepción manual, validación y consulta del inventario de pozos reportado por operadoras vía correo electrónico.",
};

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("anh-theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
    var locale = localStorage.getItem("anh-locale");
    if (locale === "en") document.documentElement.lang = "en";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <AppPreferencesProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
