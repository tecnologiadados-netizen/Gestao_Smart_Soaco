/**
 * Período, empresa e salário vigente do Dashboard Executivo.
 * A folha de hoje usa a CTPS atual. Uma data passada usa o último salário da
 * trajetória com data até aquele dia — um reajuste posterior não entra.
 */
import { parseCtpsToNumber } from "@rh/pages/Organico/organico-derive";

export const DASHBOARD_EMPRESA_TODAS = "__todas__";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

export type DashboardPeriodo = { inicio: Date; fim: Date };

export type MesPeriodo = { year: number; month: number; label: (typeof MESES)[number] };

export type SalarioTrajetoriaRow = {
  colaboradorMatricula: string;
  dataEvento: string;
  descricao: string;
};

export type SalarioEvento = { dataIso: string; valor: number };

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function fimDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Últimos 12 meses civis, do dia 1 do mês inicial até hoje. */
export function periodoPadraoExecutivo(hoje: Date = new Date()): DashboardPeriodo {
  const fim = inicioDoDia(hoje);
  const inicio = new Date(fim.getFullYear(), fim.getMonth() - 11, 1);
  return { inicio, fim };
}

/** Ano inteiro, cortado em hoje quando o ano ainda não terminou. */
export function periodoDoAno(year: number, hoje: Date = new Date()): DashboardPeriodo | null {
  const limite = inicioDoDia(hoje);
  const inicio = new Date(year, 0, 1);
  if (inicio > limite) return null;
  const fimAno = new Date(year, 11, 31);
  return { inicio, fim: fimAno > limite ? limite : fimAno };
}

/** Mês inteiro, cortado em hoje quando o mês ainda não terminou. */
export function periodoDoMes(year: number, month: number, hoje: Date = new Date()): DashboardPeriodo | null {
  const limite = inicioDoDia(hoje);
  const inicio = new Date(year, month, 1);
  if (inicio > limite) return null;
  const fimMes = new Date(year, month + 1, 0);
  return { inicio, fim: fimMes > limite ? limite : inicioDoDia(fimMes) };
}

/** dd/mmm/yyyy — ex.: 05/out/2026 */
export function formatDiaMmmAno(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatPeriodoLabel(periodo: DashboardPeriodo): string {
  return `${formatDiaMmmAno(periodo.inicio)} até ${formatDiaMmmAno(periodo.fim)}`;
}

export function parseIsoLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return null;
  }
  return d;
}

/** Meses civis que o intervalo toca, do mais antigo ao mais novo. */
export function mesesNoPeriodo(inicio: Date, fim: Date): MesPeriodo[] {
  const start = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const end = new Date(fim.getFullYear(), fim.getMonth(), 1);
  if (end < start) return [];
  const out: MesPeriodo[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth(), label: MESES[cursor.getMonth()] });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Recorte do mês civil que cai dentro do período escolhido. */
export function janelaDoMes(year: number, month: number, inicio: Date, fim: Date): { start: Date; end: Date } {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const start = monthStart > inicioDoDia(inicio) ? monthStart : inicioDoDia(inicio);
  const endLimit = fimDoDia(fim);
  const end = monthEnd < endLimit ? monthEnd : endLimit;
  return { start, end };
}

export function chaveMatricula(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits) return digits.replace(/^0+/, "") || "0";
  return raw.toUpperCase();
}

export function normalizarDataIso(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(raw);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return "";
}

/** Tira "R$ 1.593,78 por mês" e devolve o número. */
export function parseSalarioDescricao(descricao: string): number {
  const raw = String(descricao ?? "");
  const match = raw.match(/R\$\s*[\d.,]+/i) ?? raw.match(/\d{1,3}(?:\.\d{3})+,\d{2}/) ?? raw.match(/\d+(?:,\d{1,2})?/);
  if (!match) return 0;
  return parseCtpsToNumber(match[0]);
}

export function indexarSalariosTrajetoria(rows: SalarioTrajetoriaRow[] | null | undefined): Map<string, SalarioEvento[]> {
  const map = new Map<string, SalarioEvento[]>();
  for (const row of rows ?? []) {
    const valor = parseSalarioDescricao(row.descricao);
    if (!(valor > 0)) continue;
    const dataIso = normalizarDataIso(row.dataEvento);
    if (!dataIso) continue;
    const keys = new Set([String(row.colaboradorMatricula ?? "").trim(), chaveMatricula(row.colaboradorMatricula)]);
    for (const key of keys) {
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push({ dataIso, valor });
      map.set(key, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.dataIso.localeCompare(b.dataIso));
  }
  return map;
}

function ultimoSalarioAte(eventos: SalarioEvento[] | undefined, iso: string): number | null {
  if (!eventos || eventos.length === 0) return null;
  let chosen: number | null = null;
  for (const ev of eventos) {
    if (ev.dataIso <= iso && ev.valor > 0) chosen = ev.valor;
  }
  return chosen;
}

/**
 * Hoje (ou depois): CTPS atual.
 * Data passada: último evento da trajetória até esse dia.
 * Sem nenhum evento: CTPS atual.
 * Eventos só depois da data: não usa o reajuste futuro.
 */
export function salarioVigente(
  eventos: SalarioEvento[] | undefined,
  asOf: Date,
  ctpsAtual: number,
  hoje: Date,
): number {
  const asOfIso = toIsoLocal(asOf);
  const hojeIso = toIsoLocal(hoje);
  const atual = Number.isFinite(ctpsAtual) && ctpsAtual > 0 ? ctpsAtual : 0;
  if (asOfIso >= hojeIso) {
    if (atual > 0) return atual;
    return ultimoSalarioAte(eventos, hojeIso) ?? 0;
  }
  const historico = ultimoSalarioAte(eventos, asOfIso);
  if (historico != null && historico > 0) return historico;
  if (!eventos || eventos.length === 0) return atual;
  return 0;
}

export function salarioVigenteDaMatricula(
  index: Map<string, SalarioEvento[]>,
  matricula: unknown,
  asOf: Date,
  ctpsAtual: number,
  hoje: Date,
): number {
  const bruto = String(matricula ?? "").trim();
  const eventos = index.get(bruto) ?? index.get(chaveMatricula(matricula));
  return salarioVigente(eventos, asOf, ctpsAtual, hoje);
}

export function colaboradorAtivoNaData(
  input: { admissao: Date | null; demissao: Date | null; statusDesligado: boolean },
  asOf: Date,
  opcoes?: { contarAdmissaoFutura?: boolean },
): boolean {
  const end = fimDoDia(asOf);
  if (!opcoes?.contarAdmissaoFutura && input.admissao && input.admissao > end) return false;
  if (input.demissao) return input.demissao > end;
  if (input.statusDesligado) return false;
  return true;
}

export function dataDentroDoPeriodo(data: Date | null, inicio: Date, fim: Date): boolean {
  if (!data) return false;
  return data >= inicioDoDia(inicio) && data <= fimDoDia(fim);
}
