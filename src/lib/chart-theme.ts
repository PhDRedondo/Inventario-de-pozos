import type { CSSProperties } from "react";
import type { Theme } from "@/i18n";

export interface ChartTheme {
  pieColors: string[];
  validationPieColors: Record<"valid" | "warning" | "invalid", string>;
  pieStroke: string;
  pieLabelFill: string;
  axisTick: string;
  gridStroke: string;
  barLabelFill: string;
  tooltipContentStyle: CSSProperties;
  tooltipLabelStyle: CSSProperties;
}

export function getChartTheme(theme: Theme): ChartTheme {
  if (theme === "dark") {
    return {
      pieColors: ["#ffe600", "#ff8c00", "#e8381a", "#4ade80", "#38bdf8", "#c084fc", "#fb7185", "#fbbf24"],
      validationPieColors: {
        valid: "#4ade80",
        warning: "#fbbf24",
        invalid: "#fb7185",
      },
      pieStroke: "#f5f5f5",
      pieLabelFill: "#f5f5f5",
      axisTick: "#a3a3a3",
      gridStroke: "#2a2a2a",
      barLabelFill: "#f5f5f5",
      tooltipContentStyle: {
        backgroundColor: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        color: "#f5f5f5",
      },
      tooltipLabelStyle: { color: "#f5f5f5" },
    };
  }

  return {
    pieColors: ["#1a1a1a", "#ff8c00", "#e8381a", "#ffe600", "#ff6b00", "#333333", "#ffa500", "#c0392b"],
    validationPieColors: {
      valid: "#16a34a",
      warning: "#f59e0b",
      invalid: "#e8381a",
    },
    pieStroke: "#1a1a1a",
    pieLabelFill: "#1a1a1a",
    axisTick: "#5a5a5a",
    gridStroke: "#e5e5e5",
    barLabelFill: "#1a1a1a",
    tooltipContentStyle: {
      backgroundColor: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      color: "#1a1a1a",
    },
    tooltipLabelStyle: { color: "#1a1a1a" },
  };
}
