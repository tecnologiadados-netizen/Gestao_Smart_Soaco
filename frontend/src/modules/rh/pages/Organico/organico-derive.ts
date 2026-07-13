/**
 * Índices dos cabeçalhos da planilha para derivar campos do banco (rh.organico).
 * Ordem = ORGANICO_HEADERS.
 */
export const ORGANICO_IDX = {
  MATRICULA: 0,   // "MATRICULA" (ID)
  NOME: 1,
  CPF: 2,
  RG: 3,
  /** Texto do turno / jornada (ex.: "07:20 às 17:08") — ORGANICO_HEADERS[7]. */
  TURNO: 7,
  SEXO: 9,
  ADMISSAO: 10,  // "ADMISSÃO"
  TEMPO_EMPRESA: 11, // "TEMPO DE EMPRESA"
  CARGO: 12,
  AREA: 13,      // "AREÁ"
  SETOR: 14,
  GESTOR_IMEDIATO: 15,
  GESTOR_MEDIATO: 16, // "GESTOR MEDIATO"
  PIS: 18,
  NASCIMENTO: 19,
  /** "Idade" — texto calculado (anos, meses e dias) a partir de Nascimento. */
  IDADE: 20,
  GRAU_INSTRUCAO: 21,
  FILHOS: 28,
  NUMERO_DEPENDENTES: 29,
  TELEFONE: 30,
  TELEFONE_EMERGENCIAL: 31,
  CTPS: 53,      // salário base (CTPS)
  /** Fórmula da planilha: somente salário (coluna BS). */
  SOMENTE_SALARIO: 71,
  /** SALÁRIO + ADENDO (entre Adendo e Adicionais). */
  SALARIO_MAIS_POR_FORA: 73,
  /** Fórmula: SALÁRIO + ADENDO + ADICIONAIS (coluna BV) — remuneração total usada em Cargos & Salários. */
  SALARIO_POR_FORA_ADICIONAIS: 74,
  SITUACAO_TRABALHISTA: 83, // "SITUAÇÃO TRABALHISTA"
  STATUS: 84,    // "STATUS FUNCIONÁRIO"
} as const;

export type OrganicoStatus = "Ativo" | "Férias" | "Afastado" | "Desligado";

type Status = OrganicoStatus;

function normalizeStatus(s: string): Status {
  const t = String(s ?? "").trim().toUpperCase();
  if (t.includes("FÉRIAS") || t.includes("FERIAS")) return "Férias";
  if (t.includes("AFASTADO")) return "Afastado";
  if (t.includes("DESLIG") || t === "DESLIGADO") return "Desligado";
  return "Ativo";
}

/** Status da linha do orgânico (planilha/API) — usado no card e no modal. */
export function getStatusFromRow(row: (string | number)[] | null | undefined): OrganicoStatus {
  const cells = Array.isArray(row) ? row : [];
  return normalizeStatus(String(cells[ORGANICO_IDX.STATUS] ?? ""));
}

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

/** Converte string de data (DD/MM/YYYY, YYYY-MM-DD, etc.) em Date. */
export function parseDateBR(s: string): Date | null {
  if (!s || !s.trim()) return null;
  let t = s.trim();
  // "DD/MM/YYYY HH:mm:ss" / "YYYY-MM-DD HH:mm:ss" -> mantém só a parte da data
  const datePrefix = t.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
  if (datePrefix?.[1]) t = datePrefix[1];
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY ou DD-MM-YYYY
  const match = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, a, b, year] = match.map(Number);
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Valor monetário da coluna CTPS (planilha/API).
 * A Edge get-organico usa String(v): números viram "613746.23". Texto BR: "1.593,78", "7.024".
 * Nunca apagar todos os "." antes de interpretar — quebra "613746.23".
 */
export function parseCtpsToNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return 0;

  if (/[a-zA-Z]/.test(s) && !/^[\d.,+-]+$/.test(s.replace(/−/g, "-"))) {
    return 0;
  }

  if (s.includes(",")) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  const parts = s.split(".");
  if (parts.length === 1) {
    const n = parseFloat(parts[0].replace(/[^\d-]/g, "") || "0");
    return Number.isFinite(n) ? n : 0;
  }

  if (parts.length === 2) {
    const [intPart, frac] = parts;
    if (!/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) {
      const n = parseFloat(s.replace(/\./g, "").replace(/,/g, "."));
      return Number.isFinite(n) ? n : 0;
    }
    if (frac.length <= 2) {
      return parseFloat(`${intPart}.${frac}`) || 0;
    }
    // Valores vindos de ponto flutuante JS podem aparecer como "32412.119999999996".
    // Se há muitas casas decimais, interpretar como decimal normal (e não milhar).
    if (frac.length > 3) {
      const n = parseFloat(`${intPart}.${frac}`);
      return Number.isFinite(n) ? n : 0;
    }
    // Exatamente 3 dígitos após o ponto: ambíguo entre milhar BR ("1.234" → 1234) e decimal ("4926.516").
    // Parte inteira grande (≥ 1000) → quase sempre decimal / Excel; senão → atalho BR sem vírgula.
    if (frac.length === 3) {
      const intNum = Number(intPart);
      if (intNum >= 1000) {
        const n = parseFloat(`${intPart}.${frac}`);
        return Number.isFinite(n) ? n : 0;
      }
      return parseFloat(intPart + frac) || 0;
    }
    return parseFloat(intPart + frac) || 0;
  }

  return parseFloat(s.replace(/\./g, "")) || 0;
}

function monthsBetweenAdmissaoAndFim(admissaoStr: string, demissaoStr?: string): number {
  if (!admissaoStr?.trim()) return -1;
  const dInicio = parseDateBR(admissaoStr.trim());
  if (!dInicio) return -1;
  const dFim = demissaoStr?.trim() ? parseDateBR(demissaoStr.trim()) : null;
  const dataFim = dFim ?? new Date();
  let months = (dataFim.getFullYear() - dInicio.getFullYear()) * 12 + (dataFim.getMonth() - dInicio.getMonth());
  if (dataFim.getDate() < dInicio.getDate()) months -= 1;
  if (months < 0) return -1;
  return months;
}

/** Extrai "DD/MM/AAAA" de textos tipo "Desligado em DD/MM/AAAA" (Secullum / situação). */
export function parseDemissaoFromSituacaoTrabalhista(situacao: string): string | undefined {
  const m = String(situacao ?? "").match(/Desligad[oa]\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  return m?.[1];
}

/**
 * Data final para cálculo de tempo de empresa: demissão (API), texto da situação ou hoje.
 */
export function resolveDataFimTempoEmpresa(cells: (string | number)[], demissaoApi?: string): Date {
  const api = demissaoApi?.trim();
  if (api) {
    const d = parseDateBR(api);
    if (d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    }
  }
  const situacao = str(cells[ORGANICO_IDX.SITUACAO_TRABALHISTA]);
  const fromText = parseDemissaoFromSituacaoTrabalhista(situacao);
  if (fromText) {
    const d = parseDateBR(fromText);
    if (d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    }
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

/** Diferença em anos, meses e dias (texto legível). */
export function formatDuracaoAnosMesesDias(inicio: Date, fim: Date): string {
  if (!inicio || Number.isNaN(inicio.getTime())) return "—";
  const start = new Date(inicio);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  if (end < start) return "—";

  let y = end.getFullYear() - start.getFullYear();
  let m = end.getMonth() - start.getMonth();
  let d = end.getDate() - start.getDate();
  if (d < 0) {
    m -= 1;
    const prevMonthLast = new Date(end.getFullYear(), end.getMonth(), 0);
    d += prevMonthLast.getDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }

  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "ano" : "anos"}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? "mês" : "meses"}`);
  parts.push(`${d} ${d === 1 ? "dia" : "dias"}`);
  return parts.join(", ");
}

export function textoTempoEmpresaDesdeAdmissao(
  cells: (string | number)[],
  demissaoApi?: string,
): string {
  const adm = str(cells[ORGANICO_IDX.ADMISSAO]);
  const d0 = parseDateBR(adm);
  if (!d0) return "—";
  const fim = resolveDataFimTempoEmpresa(cells, demissaoApi);
  return formatDuracaoAnosMesesDias(d0, fim);
}

export function textoIdadeDesdeNascimento(cells: (string | number)[]): string {
  const nasc = str(cells[ORGANICO_IDX.NASCIMENTO]);
  const d0 = parseDateBR(nasc);
  if (!d0) return "—";
  const fim = new Date();
  fim.setHours(0, 0, 0, 0);
  return formatDuracaoAnosMesesDias(d0, fim);
}

const SIM_NAO_POSITIVO = /^(sim|s|yes|1|true)$/i;

/** Normaliza para "Sim" ou "Não" (campos de benefício/remuneração). */
export function normalizeSimNao(raw: unknown): "Sim" | "Não" {
  const s = String(raw ?? "").trim();
  if (!s) return "Não";
  if (SIM_NAO_POSITIVO.test(s)) return "Sim";
  const t = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t === "nao" || t === "n") return "Não";
  if (t === "sim") return "Sim";
  return "Não";
}

/** Meses de tempo de empresa a partir da linha da planilha (e demissão opcional da API). -1 se não calculável. */
export function getTempoEmpresaMeses(values: unknown[], demissaoApi?: string): number {
  const adm = str(values[ORGANICO_IDX.ADMISSAO]);
  const demissao =
    demissaoApi?.trim() ||
    parseDemissaoFromSituacaoTrabalhista(str(values[ORGANICO_IDX.SITUACAO_TRABALHISTA])) ||
    undefined;
  return monthsBetweenAdmissaoAndFim(adm, demissao);
}

/** Calcula tempo de empresa em "X anos e Y meses" a partir da data de admissão.
 * Se demissaoStr for informada, calcula o período ativo (admissão até demissão). */
export function formatTempoEmpresaAnosMeses(admissaoStr: string, demissaoStr?: string): string {
  const months = monthsBetweenAdmissaoAndFim(admissaoStr, demissaoStr);
  if (months < 0) return "—";
  const years = Math.floor(months / 12);
  const monthsRem = months % 12;
  if (years === 0) return `${monthsRem} ${monthsRem === 1 ? "mês" : "meses"}`;
  if (monthsRem === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${monthsRem} ${monthsRem === 1 ? "mês" : "meses"}`;
}

/** Converte uma linha do orgânico (API) em Colaborador para a aba Colaboradores.
 * demissaoApi: data de demissão da API Secullum (não existe na planilha), usada para calcular tempo ativo. */
export function organicoRowToColaborador(
  row: { id: string; values: unknown[]; demissaoApi?: string }
): import("@rh/types/api").Colaborador | null {
  const values = Array.isArray(row.values) ? row.values : [];
  const v = (i: number) => (values[i] != null ? String(values[i]).trim() : "");
  const nome = v(ORGANICO_IDX.NOME);
  if (!nome) return null;
  const matricula = v(ORGANICO_IDX.MATRICULA) || row.id || "—";
  /** Salário exibido nos fluxos de Colaboradores: somente CTPS (coluna BA). */
  const salario = parseCtpsToNumber(values[ORGANICO_IDX.CTPS]);
  let admissao = v(ORGANICO_IDX.ADMISSAO);
  if (admissao) {
    const d = parseDateBR(admissao);
    admissao = d ? d.toISOString().slice(0, 10) : admissao;
  } else {
    admissao = "";
  }
  const tempoEmpresa = admissao
    ? textoTempoEmpresaDesdeAdmissao(values, row.demissaoApi)
    : (v(ORGANICO_IDX.TEMPO_EMPRESA) || "—");
  return {
    id: matricula,
    name: nome,
    cargo: v(ORGANICO_IDX.CARGO) || "—",
    setor: v(ORGANICO_IDX.SETOR) || "—",
    area: v(ORGANICO_IDX.AREA) || undefined,
    gestorImediato: v(ORGANICO_IDX.GESTOR_IMEDIATO) || undefined,
    gestorMediato: v(ORGANICO_IDX.GESTOR_MEDIATO) || undefined,
    salario,
    admissao,
    status: normalizeStatus(v(ORGANICO_IDX.STATUS)),
    tempoEmpresa,
  };
}

/** Converte uma linha da planilha (array de valores) em campos para replace-organico. */
export function rowToReplaceRow(values: (string | number)[]): {
  matricula: string;
  nome: string;
  cargo: string;
  setor: string;
  area: string | null;
  lider: string | null;
  dataAdmissao: string | null;
  status: Status;
  values: string[];
} {
  const v = (i: number) => str(values[i]);
  const matricula = v(ORGANICO_IDX.MATRICULA) || "—";
  const nome = v(ORGANICO_IDX.NOME) || "—";
  const cargo = v(ORGANICO_IDX.CARGO) || "—";
  const setor = v(ORGANICO_IDX.SETOR) || "—";
  const area = v(ORGANICO_IDX.AREA) || null;
  const lider = v(ORGANICO_IDX.GESTOR_IMEDIATO) || null;
  let dataAdmissao: string | null = v(ORGANICO_IDX.ADMISSAO) || null;
  if (dataAdmissao) {
    const d = parseDateBR(dataAdmissao);
    dataAdmissao = d ? d.toISOString().slice(0, 10) : null;
  }
  const status = normalizeStatus(v(ORGANICO_IDX.STATUS));
  const valuesStr = values.map((x) => (x != null ? String(x) : ""));
  return { matricula, nome, cargo, setor, area, lider, dataAdmissao, status, values: valuesStr };
}
