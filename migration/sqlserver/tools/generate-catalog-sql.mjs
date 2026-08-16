/*
 * VIP — Generador de datos de catálogos para SQL Server (Fase 1).
 *
 * Lee data/seed.json y emite migration/sqlserver/03_catalogs_data.sql con:
 *   - vip.cat_departamento   (desde catalogs.departamentos_dane)
 *   - vip.cat_municipio      (desde catalogs.municipios_dane)
 *   - vip.cat_lista_valor    (todos los catálogos de tipo lista)
 *
 * Reproducible y determinista: mismo seed.json -> mismo .sql.
 * Uso:  node migration/sqlserver/tools/generate-catalog-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const seedPath = resolve(repoRoot, "data", "seed.json");
const outPath = resolve(repoRoot, "migration", "sqlserver", "03_catalogs_data.sql");

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const catalogs = seed.catalogs ?? {};

/** Escapa un literal de texto para T-SQL (Unicode). */
const q = (v) => `N'${String(v).replace(/'/g, "''")}'`;

/** Divide un arreglo en lotes de tamaño <= n (límite de 1000 filas por INSERT en SQL Server). */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const BATCH = 900;
const lines = [];
const push = (s = "") => lines.push(s);

push("/* =====================================================================");
push("   VIP — Inventario de Pozos ANH · Migración a Microsoft SQL Server");
push("   Fase 1 · 03_catalogs_data.sql — Datos de catálogos (GENERADO)");
push("");
push("   NO EDITAR A MANO. Regenerar con:");
push("     node migration/sqlserver/tools/generate-catalog-sql.mjs");
push("   Fuente: data/seed.json");
push("   Requiere: 02_catalogs_schema.sql ejecutado previamente.");
push("   Idempotente: vacía y recarga cada catálogo dentro de una transacción.");
push("   ===================================================================== */");
push("");
push("SET NOCOUNT ON;");
push("SET XACT_ABORT ON;");
push("GO");
push("");
push("BEGIN TRANSACTION;");
push("");

/* ---- Departamentos (DANE) ---- */
const departamentos = Object.entries(catalogs.departamentos_dane ?? {}).sort((a, b) =>
  a[0].localeCompare(b[0]),
);
push("/* --- vip.cat_departamento --- */");
push("DELETE FROM vip.cat_departamento;");
for (const batch of chunk(departamentos, BATCH)) {
  push("INSERT INTO vip.cat_departamento (codigo_dane, nombre) VALUES");
  push(batch.map(([code, nombre]) => `  (${q(code)}, ${q(nombre)})`).join(",\n") + ";");
}
push("");

/* ---- Municipios (DANE) ---- */
const municipios = Object.entries(catalogs.municipios_dane ?? {}).sort((a, b) =>
  a[0].localeCompare(b[0]),
);
push("/* --- vip.cat_municipio --- */");
push("DELETE FROM vip.cat_municipio;");
for (const batch of chunk(municipios, BATCH)) {
  push("INSERT INTO vip.cat_municipio (codigo_dane, nombre, codigo_dane_depto) VALUES");
  push(
    batch
      .map(([code, info]) => `  (${q(code)}, ${q(info.nombre)}, ${q(info.dept_code)})`)
      .join(",\n") + ";",
  );
}
push("");

/* ---- Catálogos de lista simple ---- */
const listCatalogs = Object.entries(catalogs)
  .filter(([, v]) => Array.isArray(v))
  .sort((a, b) => a[0].localeCompare(b[0]));

push("/* --- vip.cat_lista_valor --- */");
push("DELETE FROM vip.cat_lista_valor;");
let totalListRows = 0;
for (const [catalogo, values] of listCatalogs) {
  const rows = values.map((valor, i) => ({ catalogo, valor, orden: i }));
  totalListRows += rows.length;
  push(`/* ${catalogo}: ${rows.length} valores */`);
  for (const batch of chunk(rows, BATCH)) {
    push("INSERT INTO vip.cat_lista_valor (catalogo, valor, orden) VALUES");
    push(
      batch.map((r) => `  (${q(r.catalogo)}, ${q(r.valor)}, ${r.orden})`).join(",\n") + ";",
    );
  }
}
push("");
push("COMMIT TRANSACTION;");
push("GO");
push("");
push(
  `PRINT N'VIP · catálogos cargados: ${departamentos.length} departamentos, ${municipios.length} municipios, ${listCatalogs.length} listas (${totalListRows} valores).';`,
);
push("GO");

writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

console.log("Generado:", outPath);
console.log("Departamentos:", departamentos.length);
console.log("Municipios:", municipios.length);
console.log(
  "Catálogos de lista:",
  listCatalogs.length,
  "->",
  listCatalogs.map(([k, v]) => `${k}(${v.length})`).join(", "),
);
console.log("Filas de lista:", totalListRows);
