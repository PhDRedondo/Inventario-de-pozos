import fs from "fs";
import path from "path";

/** En Vercel el filesystem es de solo lectura salvo /tmp; SQLite y outbox van ahí. */
export function getDataDir(): string {
  const dir =
    process.env.VERCEL === "1"
      ? path.join("/tmp", "inventario-pozos-anh-data")
      : path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDbPath(): string {
  return path.join(getDataDir(), "inventario.db");
}

export function getOutboxDir(): string {
  const dir = path.join(getDataDir(), "outbox");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
