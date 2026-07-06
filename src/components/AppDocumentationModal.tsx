"use client";

import {
  BarChart3,
  BookOpen,
  Database,
  GitBranch,
  Layers,
  Map,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppPreferences } from "@/context/AppPreferences";
import type { LucideIcon } from "lucide-react";

interface AppDocumentationModalProps {
  onClose: () => void;
}

interface DocSection {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  itemsKey?: string;
}

const SECTIONS: DocSection[] = [
  { id: "purpose", icon: BookOpen, titleKey: "appDocs.purposeTitle", bodyKey: "appDocs.purposeBody" },
  { id: "process", icon: GitBranch, titleKey: "appDocs.processTitle", bodyKey: "appDocs.processBody", itemsKey: "appDocs.processItems" },
  { id: "modules", icon: Layers, titleKey: "appDocs.modulesTitle", bodyKey: "appDocs.modulesBody", itemsKey: "appDocs.modulesItems" },
  { id: "etl", icon: Upload, titleKey: "appDocs.etlTitle", bodyKey: "appDocs.etlBody", itemsKey: "appDocs.etlItems" },
  { id: "architecture", icon: Database, titleKey: "appDocs.architectureTitle", bodyKey: "appDocs.architectureBody", itemsKey: "appDocs.architectureItems" },
  { id: "stack", icon: Layers, titleKey: "appDocs.stackTitle", bodyKey: "appDocs.stackBody", itemsKey: "appDocs.stackItems" },
  { id: "uwi", icon: ShieldCheck, titleKey: "appDocs.uwiTitle", bodyKey: "appDocs.uwiBody" },
  { id: "dashboard", icon: Map, titleKey: "appDocs.dashboardTitle", bodyKey: "appDocs.dashboardBody", itemsKey: "appDocs.dashboardItems" },
  { id: "analytics", icon: BarChart3, titleKey: "appDocs.analyticsTitle", bodyKey: "appDocs.analyticsBody", itemsKey: "appDocs.analyticsItems" },
];

function parseListItems(raw: string): string[] {
  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AppDocumentationModal({ onClose }: AppDocumentationModalProps) {
  const { t } = useAppPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  const modal = (
    <div className="well-modal-root fixed inset-0 z-[2000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="well-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label={t("common.close")}
        onClick={onClose}
      />

      <div
        className="well-modal-dialog relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-anh-border bg-anh-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-docs-title"
      >
        <div className="well-modal-accent h-1.5 shrink-0" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-anh-border px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-anh-secondary">{t("shell.gopSystem")}</p>
            <h2 id="app-docs-title" className="mt-1 text-lg font-extrabold text-anh-primary sm:text-xl">
              {t("appDocs.title")}
            </h2>
            <p className="mt-1 text-sm text-anh-muted">{t("appDocs.subtitle")}</p>
          </div>
          <button
            type="button"
            className="btn-secondary flex h-9 w-9 shrink-0 items-center justify-center p-0"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {SECTIONS.map(({ id, icon: Icon, titleKey, bodyKey, itemsKey }) => {
            const items = itemsKey ? parseListItems(t(itemsKey)) : [];
            return (
              <section key={id} className="rounded-xl border border-anh-border bg-anh-bg/40 p-4 sm:p-5">
                <div className="mb-2 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-anh-secondary/15 text-anh-secondary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="pt-1 text-base font-bold text-anh-primary">{t(titleKey)}</h3>
                </div>
                <p className="text-sm leading-relaxed text-anh-text">{t(bodyKey)}</p>
                {items.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-anh-muted">
                    {items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-anh-secondary" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <section className="rounded-xl border border-dashed border-anh-border bg-anh-bg/30 p-4 text-xs leading-relaxed text-anh-muted sm:p-5">
            <p>{t("appDocs.footerNote")}</p>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
