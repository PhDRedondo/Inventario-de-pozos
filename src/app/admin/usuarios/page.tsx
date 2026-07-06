"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import type { UserRecord, UserRole } from "@/lib/types";

export default function AdminUsuariosPage() {
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Omit<UserRecord, "password_hash">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<UserRole>("operadora");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [operadora, setOperadora] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [operadoras, setOperadoras] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/panel");
    }
  }, [user, router]);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (!res.ok) throw new Error("No autorizado");
    setUsers(await res.json());
  }

  useEffect(() => {
    Promise.all([
      loadUsers(),
      fetch("/api/catalogs")
        .then((r) => r.json())
        .then((c) => setOperadoras(c.operadoras ?? [])),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, username, email, operadora, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("admin.createError"));
      return;
    }
    setUsername("");
    setEmail("");
    setOperadora("");
    setPassword("");
    setDisplayName("");
    await loadUsers();
  }

  async function toggleActive(id: number, active: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    await loadUsers();
  }

  if (loading) return <p className="p-6 text-anh-muted">{t("common.loading")}</p>;

  return (
    <div>
      <PageHeader title={t("admin.usersTitle")} description={t("admin.usersDescription")} />

      <form onSubmit={handleCreate} className="card mb-8 space-y-4 p-6">
        <h3 className="font-bold text-anh-primary">{t("admin.createUser")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">{t("admin.role")}</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="operadora">Operadora</option>
              <option value="anh">ANH</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">{t("admin.username")}</label>
            <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          {role === "admin" && (
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("admin.email")}</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          {role === "operadora" && (
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("common.operator")}</label>
              <select className="input-field" value={operadora} onChange={(e) => setOperadora(e.target.value)} required>
                <option value="">—</option>
                {operadoras.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-semibold">{t("admin.displayName")}</label>
            <input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">{t("admin.password")}</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-anh-danger">{error}</p>}
        <button type="submit" className="btn-primary">
          {t("admin.createUser")}
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-anh-bg text-left text-anh-muted">
            <tr>
              <th className="px-4 py-3">{t("admin.username")}</th>
              <th className="px-4 py-3">{t("admin.email")}</th>
              <th className="px-4 py-3">{t("admin.role")}</th>
              <th className="px-4 py-3">{t("common.operator")}</th>
              <th className="px-4 py-3">{t("admin.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-anh-border">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">{u.operadora ?? "—"}</td>
                <td className="px-4 py-3">{u.active ? t("admin.active") : t("admin.inactive")}</td>
                <td className="px-4 py-3">
                  {u.email !== "johan.redondo@anh.gov.co" && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-anh-secondary hover:underline"
                      onClick={() => toggleActive(u.id, !u.active)}
                    >
                      {u.active ? t("admin.deactivate") : t("admin.activate")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
