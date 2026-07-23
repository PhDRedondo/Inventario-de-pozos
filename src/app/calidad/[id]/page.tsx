"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";

export default function NotebookDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const t = useT();
  const notebookId = Number(params.id);

  useEffect(() => {
    if (user?.role === "anh") {
      router.replace("/analitica");
    } else if (user?.role === "admin") {
      router.replace("/panel");
    }
  }, [user, router]);

  if (!Number.isFinite(notebookId)) {
    return null;
  }

  if (user?.role === "anh" || user?.role === "admin") {
    return <div className="card p-8 text-center text-anh-muted">{t("common.loading")}</div>;
  }

  return (
    <NotebookWorkspace
      notebookId={notebookId}
      operadora={user?.operadora ?? undefined}
      isAdmin={false}
    />
  );
}
