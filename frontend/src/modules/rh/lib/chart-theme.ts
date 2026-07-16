/**
 * Paleta de gráficos — Manual da Marca Só Aço (#041E42, #1E22AA, #FFAD00).
 * Cores distintas para tema claro e escuro (legibilidade em barras, linhas e tooltips).
 */
import { useMemo, type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export type RhChartTheme = {
  grid: string;
  axisTick: string;
  axisCategory: string;
  linePrimary: string;
  lineSecondary: string;
  lineDot: string;
  lineDotActive: string;
  barPrimary: string;
  barSecondary: string;
  barSelected: string;
  barAccent: string;
  barLarge: string;
  success: string;
  successActive: string;
  danger: string;
  dangerActive: string;
  neutral: string;
  neutralActive: string;
  referenceLine: string;
  sectorGradient: readonly string[];
  legendBlue: string;
  legendGold: string;
  legendSoft: string;
  dotStrokeActive: string;
  tooltipBorder: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipMuted: string;
};

const LIGHT: RhChartTheme = {
  grid: "rgb(4 30 66 / 0.12)",
  axisTick: "#64748b",
  axisCategory: "#041E42",
  linePrimary: "#1E22AA",
  lineSecondary: "#D99000",
  lineDot: "#1E22AA",
  lineDotActive: "#5A8FD4",
  barPrimary: "#1E22AA",
  barSecondary: "#2438b8",
  barSelected: "#FFAD00",
  barAccent: "#5A8FD4",
  barLarge: "#3B72BF",
  success: "#059669",
  successActive: "#34d399",
  danger: "#dc2626",
  dangerActive: "#f87171",
  neutral: "#94a3b8",
  neutralActive: "#cbd5e1",
  referenceLine: "rgb(4 30 66 / 0.16)",
  sectorGradient: ["#0B1F3A", "#12305A", "#1A4380", "#2459A6", "#3B72BF", "#5A8FD4", "#7BA9E3", "#9BC1ED"],
  legendBlue: "#1E22AA",
  legendGold: "#D99000",
  legendSoft: "#cdd3ff",
  dotStrokeActive: "#ffffff",
  tooltipBorder: "rgb(4 30 66 / 0.14)",
  tooltipBg: "#ffffff",
  tooltipText: "#041E42",
  tooltipMuted: "#64748b",
};

const DARK: RhChartTheme = {
  grid: "rgb(255 255 255 / 0.14)",
  axisTick: "rgb(255 255 255 / 0.62)",
  axisCategory: "rgb(255 255 255 / 0.9)",
  linePrimary: "#9BC1ED",
  lineSecondary: "#FFAD00",
  lineDot: "#7BA9E3",
  lineDotActive: "#FFAD00",
  barPrimary: "#7B88FF",
  barSecondary: "#6676ff",
  barSelected: "#FFAD00",
  barAccent: "#9BC1ED",
  barLarge: "#9BC1ED",
  success: "#34d399",
  successActive: "#6ee7b7",
  danger: "#f87171",
  dangerActive: "#fca5a5",
  neutral: "#94a3b8",
  neutralActive: "#cbd5e1",
  referenceLine: "rgb(255 255 255 / 0.18)",
  sectorGradient: ["#1A4380", "#2459A6", "#3B72BF", "#5A8FD4", "#7BA9E3", "#9BC1ED", "#6676ff", "#7B88FF"],
  legendBlue: "#9BC1ED",
  legendGold: "#FFAD00",
  legendSoft: "#6676ff",
  dotStrokeActive: "#1b222e",
  tooltipBorder: "rgb(255 255 255 / 0.16)",
  tooltipBg: "#1b222e",
  tooltipText: "#f4f7fb",
  tooltipMuted: "rgb(255 255 255 / 0.65)",
};

export function getRhChartTheme(isDark: boolean): RhChartTheme {
  return isDark ? DARK : LIGHT;
}

export function useRhChartTheme(): RhChartTheme {
  const { theme } = useTheme();
  return useMemo(() => getRhChartTheme(theme === "dark"), [theme]);
}

export function rhChartAxisTick(theme: RhChartTheme, size = 10): { fontSize: number; fill: string } {
  return { fontSize: size, fill: theme.axisTick };
}

export function rhChartCategoryTick(theme: RhChartTheme, size = 11): { fontSize: number; fill: string } {
  return { fontSize: size, fill: theme.axisCategory };
}

export function rhChartTooltipStyle(theme: RhChartTheme): CSSProperties {
  return {
    border: `1px solid ${theme.tooltipBorder}`,
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: theme.tooltipBg,
    color: theme.tooltipText,
    boxShadow: theme.tooltipBg === "#ffffff"
      ? "0 4px 14px rgb(4 30 66 / 0.12)"
      : "0 8px 24px rgb(0 0 0 / 0.45)",
  };
}
