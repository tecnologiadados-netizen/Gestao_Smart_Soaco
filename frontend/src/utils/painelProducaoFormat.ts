export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const MESES_LABEL = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export function formatMesShort(mes: string): string {
  const parts = mes.split('-');
  if (parts.length < 2) return mes;
  const year = parts[0];
  const monthIndex = Number(parts[1]) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) return mes;
  return `${MESES_ABREV[monthIndex]}/${year.slice(-2)}`;
}

export function formatMesLabel(mes: string): string {
  const parts = mes.split('-');
  if (parts.length < 2) return mes;
  const monthIndex = Number(parts[1]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return mes;
  return `${MESES_LABEL[monthIndex]} ${parts[0]}`;
}

export function getChartTheme(isDark: boolean) {
  return {
    grid: isDark ? '#2d3a50' : '#e8ecf0',
    tick: isDark ? '#9aa3b2' : '#5a6270',
    axis: isDark ? '#3d4d66' : '#d0d7de',
    barMonth: isDark ? '#8eb4e8' : '#0a1628',
    barMonthLabel: isDark ? '#8eb4e8' : '#0a1628',
    barDayLabel: isDark ? '#ffc940' : '#8a5a00',
    lineMeta: isDark ? '#ffc940' : '#ffae00',
    lineMetaHit: isDark ? '#22c55e' : '#27ae60',
    tooltip: {
      fontSize: '14px',
      background: isDark ? '#1e2838' : '#ffffff',
      border: isDark ? '1px solid #2d3a50' : '1px solid #e0e4e8',
      color: isDark ? '#e8edf4' : '#1a1a2e',
    },
  };
}
