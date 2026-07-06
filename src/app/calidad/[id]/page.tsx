"use client";

import { useParams } from "next/navigation";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";
import { useAuth } from "@/context/AuthContext";

export default function NotebookDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const notebookId = Number(params.id);

  if (!Number.isFinite(notebookId)) {
    return null;
  }

  return (
    <NotebookWorkspace
      notebookId={notebookId}
      operadora={user?.role === "admin" ? undefined : user?.operadora ?? undefined}
      isAdmin={user?.role === "admin"}
    />
  );
}
