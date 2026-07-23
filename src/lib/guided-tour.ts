import { driver, type DriveStep, type Driver, type Popover } from "driver.js";
import type { UserRole } from "./types";

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;
export type TourNavigateFn = (path: string) => Promise<void>;

const NAV_WAIT_MS = 450;
const ELEMENT_WAIT_MS = 4000;

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

export function resolveTourTarget(selector: string): Element | undefined {
  const matches = document.querySelectorAll(selector);
  for (const element of matches) {
    if (isVisible(element)) return element;
  }
  return matches[0] ?? undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForElement(selector: string, timeout = ELEMENT_WAIT_MS): Promise<Element | undefined> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const element = resolveTourTarget(selector);
    if (element) return element;
    await wait(80);
  }
  return undefined;
}

async function ensurePath(navigate: TourNavigateFn, path: string): Promise<void> {
  if (window.location.pathname === path) {
    await wait(NAV_WAIT_MS);
    return;
  }
  await navigate(path);
  await wait(NAV_WAIT_MS);
}

function tourElement(selector: string): () => Element {
  return () => resolveTourTarget(selector) ?? document.body;
}

function scrollTargetIntoView(element: Element | undefined) {
  if (!element || element === document.body) return;
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function attachSpotlight(element: Element | undefined) {
  if (!element || element === document.body) return;
  element.classList.add("anh-tour-spotlight");
}

function detachSpotlight(element: Element | undefined) {
  if (!element || element === document.body) return;
  element.classList.remove("anh-tour-spotlight");
}

function buildHighlightHooks() {
  return {
    onHighlightStarted: (element: Element | undefined) => {
      document.body.classList.add("anh-guided-tour-active");
      scrollTargetIntoView(element);
      attachSpotlight(element);
    },
    onDeselected: (element: Element | undefined) => {
      detachSpotlight(element);
    },
    onDestroyed: () => {
      document.body.classList.remove("anh-guided-tour-active");
      document.querySelectorAll(".anh-tour-spotlight").forEach((node) => {
        node.classList.remove("anh-tour-spotlight");
      });
    },
  };
}

function buildGuidedTourSteps(t: TranslateFn, navigate: TourNavigateFn, role: UserRole): DriveStep[] {
  const rk = (key: string) => `tour.${role}.${key}`;

  const pop = (
    titleKey: string,
    descKey: string,
    side?: "top" | "right" | "bottom" | "left",
    align: "start" | "center" | "end" = "start",
    hooks: Partial<Popover> = {},
  ): Popover => ({
    title: t(titleKey),
    description: t(descKey),
    ...(side ? { side, align } : { align }),
    ...hooks,
  });

  const onPath = (path: string): Partial<DriveStep> => ({
    onHighlightStarted: async () => {
      await ensurePath(navigate, path);
    },
  });

  const goNext = (path: string, selector: string) => ({
    onNextClick: (_element: Element | undefined, _step: DriveStep, { driver: tourDriver }: { driver: Driver }) => {
      void ensurePath(navigate, path)
        .then(() => waitForElement(selector))
        .then(() => tourDriver.moveNext());
    },
  });

  const goPrev = (path: string, selector: string) => ({
    onPrevClick: (_element: Element | undefined, _step: DriveStep, { driver: tourDriver }: { driver: Driver }) => {
      void ensurePath(navigate, path)
        .then(() => waitForElement(selector))
        .then(() => tourDriver.movePrevious());
    },
  });

  const sharedIntro: DriveStep[] = [
    { popover: pop(rk("welcomeTitle"), rk("welcomeDesc"), undefined, "center") },
    {
      element: tourElement("[data-tour='app-header']"),
      popover: pop("tour.headerTitle", "tour.headerDesc", "bottom", "start"),
    },
    {
      element: tourElement("[data-tour='preferences']"),
      popover: pop("tour.preferencesTitle", "tour.preferencesDesc", "bottom", "end"),
    },
    {
      element: tourElement("[data-tour='app-nav']"),
      popover: pop(rk("navTitle"), rk("navDesc"), "right", "start"),
      ...onPath("/panel"),
    },
  ];

  const dashboardSteps: DriveStep[] = [
    {
      element: tourElement("[data-tour='dashboard-filters']"),
      popover: pop(rk("filtersTitle"), rk("filtersDesc"), "bottom", "start"),
      ...onPath("/panel"),
    },
    {
      element: tourElement("[data-tour='dashboard-map']"),
      popover: pop(rk("mapTitle"), rk("mapDesc"), "top", "center"),
      ...onPath("/panel"),
    },
    {
      element: tourElement("[data-tour='dashboard-stats']"),
      popover: pop(rk("statsTitle"), rk("statsDesc"), "bottom", "start"),
      ...onPath("/panel"),
    },
    {
      element: tourElement("[data-tour='dashboard-charts']"),
      popover: pop(rk("chartsTitle"), rk("chartsDesc"), "top", "start"),
      ...onPath("/panel"),
    },
    {
      element: tourElement("[data-tour='wells-table']"),
      popover: pop(rk("wellsTitle"), rk("wellsDesc"), "top", "start"),
      ...onPath("/panel"),
    },
  ];

  if (role === "operadora") {
    return [
      ...sharedIntro,
      ...dashboardSteps,
      {
        element: tourElement("[data-tour='nav-calidad']"),
        popover: pop(rk("notebookTitle"), rk("notebookNavDesc"), "right", "start", {
          ...goNext("/calidad", "[data-tour='notebook-inventory']"),
        }),
      },
      {
        element: tourElement("[data-tour='notebook-inventory']"),
        popover: pop(rk("notebookInventoryTitle"), rk("notebookInventoryDesc"), "top", "start", {
          ...goPrev("/panel", "[data-tour='nav-calidad']"),
        }),
        ...onPath("/calidad"),
      },
      {
        popover: pop(rk("endTitle"), rk("endDesc"), undefined, "center"),
        ...onPath("/panel"),
      },
    ];
  }

  if (role === "anh") {
    return [
      ...sharedIntro,
      ...dashboardSteps,
      {
        element: tourElement("[data-tour='nav-analitica']"),
        popover: pop(rk("analyticsTitle"), rk("analyticsNavDesc"), "right", "start", {
          ...goNext("/analitica", "[data-tour='analytics-page']"),
        }),
      },
      {
        element: tourElement("[data-tour='analytics-page']"),
        popover: pop(rk("analyticsPanelTitle"), rk("analyticsPanelDesc"), "top", "start", {
          ...goPrev("/panel", "[data-tour='nav-analitica']"),
        }),
        ...onPath("/analitica"),
      },
      {
        popover: pop(rk("endTitle"), rk("endDesc"), undefined, "center"),
        ...onPath("/panel"),
      },
    ];
  }

  return [
    ...sharedIntro,
    ...dashboardSteps,
    {
      element: tourElement("[data-tour='nav-analitica']"),
      popover: pop(rk("analyticsTitle"), rk("analyticsNavDesc"), "right", "start", {
        ...goNext("/analitica", "[data-tour='analytics-page']"),
      }),
    },
    {
      element: tourElement("[data-tour='analytics-page']"),
      popover: pop(rk("analyticsPanelTitle"), rk("analyticsPanelDesc"), "top", "start", {
        ...goPrev("/panel", "[data-tour='nav-analitica']"),
      }),
      ...onPath("/analitica"),
    },
    {
      element: tourElement("[data-tour='nav-admin']"),
      popover: pop(rk("usersTitle"), rk("usersNavDesc"), "right", "start", {
        ...goNext("/admin/usuarios", "[data-tour='admin-users']"),
        ...goPrev("/analitica", "[data-tour='analytics-page']"),
      }),
    },
    {
      element: tourElement("[data-tour='admin-users']"),
      popover: pop(rk("usersPanelTitle"), rk("usersPanelDesc"), "top", "start", {
        ...goPrev("/analitica", "[data-tour='nav-admin']"),
      }),
      ...onPath("/admin/usuarios"),
    },
    {
      popover: pop(rk("endTitle"), rk("endDesc"), undefined, "center"),
      ...onPath("/panel"),
    },
  ];
}

export function startGuidedTour(t: TranslateFn, navigate: TourNavigateFn, role: UserRole = "anh"): Driver {
  const hooks = buildHighlightHooks();

  const tour = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    allowKeyboardControl: true,
    smoothScroll: true,
    disableActiveInteraction: false,
    overlayColor: "#000000",
    overlayOpacity: 0.82,
    stagePadding: 14,
    stageRadius: 14,
    popoverOffset: 16,
    nextBtnText: t("tour.next"),
    prevBtnText: t("tour.prev"),
    doneBtnText: t("tour.done"),
    progressText: t("tour.progress"),
    popoverClass: "anh-guided-tour",
    steps: buildGuidedTourSteps(t, navigate, role),
    onHighlightStarted: (element, step, ctx) => {
      hooks.onHighlightStarted(element);
      void step.onHighlightStarted?.(element, step, ctx);
    },
    onDeselected: (element, step, ctx) => {
      hooks.onDeselected(element);
      void step.onDeselected?.(element, step, ctx);
    },
    onDestroyed: () => {
      hooks.onDestroyed();
    },
  });

  tour.drive();
  return tour;
}
