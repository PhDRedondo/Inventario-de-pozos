import { driver, type DriveStep, type Driver, type Popover } from "driver.js";

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

function buildGuidedTourSteps(t: TranslateFn, navigate: TourNavigateFn): DriveStep[] {
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

  const onDashboard = (): Partial<DriveStep> => ({
    onHighlightStarted: async () => {
      await ensurePath(navigate, "/panel");
    },
  });

  return [
    { popover: pop("tour.welcomeTitle", "tour.welcomeDesc", undefined, "center") },
    {
      element: tourElement("[data-tour='app-header']"),
      popover: pop("tour.headerTitle", "tour.headerDesc", "bottom", "start"),
    },
    {
      element: tourElement("[data-tour='preferences']"),
      popover: pop("tour.preferencesTitle", "tour.preferencesDesc", "bottom", "end"),
    },
    {
      element: tourElement("[data-tour='nav-dashboard']"),
      popover: pop("tour.navTitle", "tour.navDesc", "right", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='dashboard-filters']"),
      popover: pop("tour.filtersTitle", "tour.filtersDesc", "bottom", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='dashboard-map']"),
      popover: pop("tour.mapTitle", "tour.mapDesc", "top", "center"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='dashboard-stats']"),
      popover: pop("tour.statsTitle", "tour.statsDesc", "bottom", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='dashboard-charts']"),
      popover: pop("tour.chartsTitle", "tour.chartsDesc", "top", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='wells-table']"),
      popover: pop("tour.wellsTitle", "tour.wellsDesc", "top", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='workflow']"),
      popover: pop("tour.workflowTitle", "tour.workflowDesc", "right", "start"),
      ...onDashboard(),
    },
    {
      element: tourElement("[data-tour='nav-cargar']"),
      popover: pop("tour.uploadTitle", "tour.uploadNavDesc", "right", "start", {
        onNextClick: (_element, _step, { driver: tourDriver }) => {
          void ensurePath(navigate, "/cargar")
            .then(() => waitForElement("[data-tour='upload-form']"))
            .then(() => tourDriver.moveNext());
        },
      }),
    },
    {
      element: tourElement("[data-tour='upload-form']"),
      popover: pop("tour.uploadFormTitle", "tour.uploadFormDesc", "top", "start", {
        onPrevClick: (_element, _step, { driver: tourDriver }) => {
          void ensurePath(navigate, "/panel")
            .then(() => waitForElement("[data-tour='nav-cargar']"))
            .then(() => tourDriver.movePrevious());
        },
      }),
      onHighlightStarted: async () => {
        await ensurePath(navigate, "/cargar");
      },
    },
    {
      element: tourElement("[data-tour='nav-calidad']"),
      popover: pop("tour.qualityTitle", "tour.qualityNavDesc", "right", "start", {
        onNextClick: (_element, _step, { driver: tourDriver }) => {
          void ensurePath(navigate, "/calidad")
            .then(() => waitForElement("[data-tour='quality-panel']"))
            .then(() => tourDriver.moveNext());
        },
        onPrevClick: (_element, _step, { driver: tourDriver }) => {
          void ensurePath(navigate, "/cargar")
            .then(() => waitForElement("[data-tour='upload-form']"))
            .then(() => tourDriver.movePrevious());
        },
      }),
    },
    {
      element: tourElement("[data-tour='quality-panel']"),
      popover: pop("tour.qualityPanelTitle", "tour.qualityPanelDesc", "top", "start", {
        onPrevClick: (_element, _step, { driver: tourDriver }) => {
          void ensurePath(navigate, "/cargar")
            .then(() => waitForElement("[data-tour='nav-calidad']"))
            .then(() => tourDriver.movePrevious());
        },
      }),
      onHighlightStarted: async () => {
        await ensurePath(navigate, "/calidad");
      },
    },
    {
      popover: pop("tour.endTitle", "tour.endDesc", undefined, "center"),
      onHighlightStarted: async () => {
        await ensurePath(navigate, "/panel");
      },
    },
  ];
}

export function startGuidedTour(t: TranslateFn, navigate: TourNavigateFn): Driver {
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
    steps: buildGuidedTourSteps(t, navigate),
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
