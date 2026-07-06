"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RoleWorkflowSteps, roleWorkflowIntro } from "@/components/RoleWorkflowSteps";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import type { NotebookSummary } from "@/lib/types";

interface NotebookInventoryProps {
  operadora: string;
  isAdmin?: boolean;
  operadoras?: string[];
  onOperadoraChange?: (value: string) => void;
}

function statusLabel(t: ReturnType<typeof useT>, status: NotebookSummary["status"]) {
  if (status === "active") return t("notebook.statusActiveShort");
  if (status === "submitted") return t("notebook.statusSubmittedShort");
  return t("notebook.statusArchivedShort");
}

function statusClass(status: NotebookSummary["status"]) {
  if (status === "active") return "badge-warning";
  if (status === "submitted") return "badge-valid";
  return "badge-invalid";
}

export function NotebookInventory({
  operadora,
  isAdmin = false,
  operadoras = [],
  onOperadoraChange,
}: NotebookInventoryProps) {
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadNotebooks = useCallback(async () => {
    if (!operadora) {
      setNotebooks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = isAdmin ? `?operadora=${encodeURIComponent(operadora)}` : "";
      const res = await fetch(`/api/notebooks${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("notebook.loadError"));
      setNotebooks(data.notebooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }, [operadora, isAdmin, t]);

  useEffect(() => {
    loadNotebooks();
  }, [loadNotebooks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!operadora) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operadora, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("notebook.createError"));
      setShowCreate(false);
      setTitle("");
      router.push(`/calidad/${data.notebook.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("notebook.inventoryTitle")}
        description={user ? t(roleWorkflowIntro(user.role, "quality")) : t("notebook.inventoryDescription")}
        action={
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setShowCreate(true)}
            disabled={!operadora || creating}
          >
            <Plus className="h-4 w-4" />
            {t("notebook.createNotebook")}
          </button>
        }
      />

      {user && <RoleWorkflowSteps role={user.role} variant="compact" />}

      {isAdmin && onOperadoraChange && (
        <div className="card mb-4 p-4">
          <label className="mb-1 block text-sm font-semibold">{t("upload.operatorLabel")}</label>
          <select className="input-field" value={operadora} onChange={(e) => onOperadoraChange(e.target.value)}>
            <option value="">{t("upload.operatorPlaceholder")}</option>
            {operadoras.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
      )}

      {!operadora && isAdmin && (
        <div className="card p-8 text-center text-anh-muted">{t("notebook.selectOperatorFirst")}</div>
      )}

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="card mb-4 p-4">
          <h3 className="mb-3 font-bold text-anh-primary">{t("notebook.createNotebook")}</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-anh-muted">{t("notebook.titleLabel")}</label>
              <input
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("notebook.titlePlaceholder")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? t("common.loading") : t("notebook.createAndOpen")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                {t("common.close")}
              </button>
            </div>
          </form>
        </div>
      )}

      {operadora && (
        <div className="card overflow-hidden" data-tour="notebook-inventory">
          <div className="border-b border-anh-border px-4 py-3 font-bold text-anh-primary">
            {t("notebook.inventoryListTitle")}
          </div>
          {loading ? (
            <div className="p-8 text-center text-anh-muted">{t("common.loading")}</div>
          ) : notebooks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <BookOpen className="h-10 w-10 text-anh-muted" />
              <p className="text-sm text-anh-muted">{t("notebook.emptyInventory")}</p>
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
                {t("notebook.createFirst")}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-anh-bg text-left text-xs text-anh-muted">
                  <tr>
                    <th className="px-4 py-3">{t("notebook.colTitle")}</th>
                    <th className="px-4 py-3">{t("notebook.colStatus")}</th>
                    <th className="px-4 py-3">{t("notebook.colVersions")}</th>
                    <th className="px-4 py-3">{t("notebook.colLastUpload")}</th>
                    <th className="px-4 py-3">{t("notebook.colApplied")}</th>
                    <th className="px-4 py-3">{t("notebook.colUpdated")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {notebooks.map((notebook) => (
                    <tr key={notebook.id} className="border-t border-anh-border align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-anh-primary">{notebook.title || `#${notebook.id}`}</p>
                        <p className="text-xs text-anh-muted">{notebook.operadora}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusClass(notebook.status)}>{statusLabel(t, notebook.status)}</span>
                      </td>
                      <td className="px-4 py-3">{notebook.version_count}</td>
                      <td className="px-4 py-3">
                        {notebook.last_upload_at ? (
                          <>
                            <p>{new Date(notebook.last_upload_at).toLocaleString()}</p>
                            {notebook.last_filename && (
                              <p className="text-xs text-anh-muted">{notebook.last_filename}</p>
                            )}
                          </>
                        ) : (
                          t("common.none")
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {notebook.submitted_at
                          ? new Date(notebook.submitted_at).toLocaleString()
                          : t("common.none")}
                      </td>
                      <td className="px-4 py-3">{new Date(notebook.updated_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Link href={`/calidad/${notebook.id}`} className="btn-secondary text-xs">
                          {t("notebook.openNotebook")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
