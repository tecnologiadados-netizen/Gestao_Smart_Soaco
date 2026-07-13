/**
 * Domínio da guia **Pontualidade** (planilha de ponto / atrasos) — independente do dashboard de absenteísmo por ausências.
 */

/** De onde veio o CTPS usado no custo (API Secullum vs cadastro Orgânico). */
export type CtpsSource = "secullum" | "organico";

export type AbsenteismoPorHorasRow = {
  dataIso: string;
  nome: string;
  turno: string;
  /** Minutos desde meia-noite (entrada prevista extraída do texto do turno). */
  entradaPrevistaMin: number;
  /** Minutos desde meia-noite (saída prevista, se houver no texto do turno). */
  saidaPrevistaMin: number | null;
  /** Horário real de chegada (coluna ENT. 1 / equivalente). */
  entradaRealMin: number;
  /** Atraso em minutos (0 se pontual ou adiantado). */
  atrasoMin: number;
  /** Minutos de extras informados na planilha (coluna EXTRAS), quando aplicável. */
  horaExtraMin: number;
  /** Saída real (coluna SAÍ. 2 / equivalente), quando existir na planilha. */
  saidaRealMin: number | null;
  /** NORMAIS (duração em minutos), quando existir. */
  normaisMin: number | null;
  /** Texto bruto da coluna FALTAS (planilha). */
  faltasText: string;
  weekdayIndex: number;
  bucketDia: string;
  bucketMes: string;
  /** Setor do Orgânico quando há match por nome; senão vazio. */
  setorOrganico: string;
  /** Equipe/área do Orgânico quando há match por nome; senão vazio. */
  equipeOrganico: string;
  matriculaOrganico: string;
  /** Matrícula informada na planilha de ponto (coluna opcional MATRÍCULA / REGISTRO). */
  matriculaPlanilha: string;
  /**
   * CTPS usado nos cálculos: prioriza **API Secullum** (mesmo valor do card na aba Orgânico);
   * senão cadastro Orgânico (planilha/API).
   */
  ctpsOrganico: number;
  ctpsSource: CtpsSource;
};

export type AbsenteismoPorHorasPeopleLookup = {
  byNomeNorm: Map<
    string,
    {
      setor: string;
      equipe: string;
      matricula: string;
      nome: string;
    }
  >;
};

/**
 * Cruzamento nos gráficos: filtros combinados com **AND** (ex.: colaboradora + dia da semana).
 */
export type ChartCrossState = {
  colaboradorNome: string | null;
  weekdayIndex: number | null;
  timelineKey: string | null;
};

export const EMPTY_CHART_CROSS: ChartCrossState = {
  colaboradorNome: null,
  weekdayIndex: null,
  timelineKey: null,
};

export function isChartCrossEmpty(c: ChartCrossState | null | undefined): boolean {
  if (c == null) return true;
  return c.colaboradorNome == null && c.weekdayIndex == null && c.timelineKey == null;
}

/** Alterna uma fatia do cruzamento (clique de novo remove só essa fatia). */
export type ChartCrossToggle =
  | { kind: "colaborador"; nome: string }
  | { kind: "weekday"; weekdayIndex: number }
  | { kind: "timeline"; key: string };
