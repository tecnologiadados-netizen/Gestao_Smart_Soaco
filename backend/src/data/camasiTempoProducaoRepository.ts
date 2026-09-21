/**
 * TEMPO_PRODUCAO (Camasi / RICMAQ) — leitura e agregações do painel.
 */

import { queryCamasi } from '../config/camasiFirebirdDb.js';
import {
  escalaEstaVazia,
  horasDosIntervalos,
  horasEscalaNoDia,
  horasIntervaloNaEscala,
  intervalosNaEscalaDoDia,
  janelasEscalaNoDia,
  subtrairIntervalos,
  unirIntervalos,
  type MsInterval,
  type RecursoEscala,
} from '../utils/recursoEscalaTrabalho.js';
import {
  categoriaParadaCamasi,
  isMotivoFimJornadaCamasi,
  isMotivoInicioJornadaCamasi,
  type CamasiCategoriaParada,
} from '../utils/camasiMotivoJornada.js';

/** Carência padrão (início e fim da jornada). */
export const CAMASI_CARENCIA_MS = 5 * 60 * 1000;
/** @deprecated use CAMASI_CARENCIA_MS */
export const CAMASI_CARENCIA_INICIO_MS = CAMASI_CARENCIA_MS;

/** Ociosidade após/antes da carência sem produção/registro. */
export const CAMASI_PARADA_SEM_JUSTIFICATIVA = 'SEM JUSTIFICATIVA';
/** Parada em andamento no dia corrente ainda sem motivo na Camasi. */
export const CAMASI_AGUARDANDO_JUSTIFICATIVA = 'AGUARDANDO JUSTIFICATIVA';
/** Produção em andamento (FIM_PRODUCAO da Camasi ainda avançando). */
export const CAMASI_EM_PRODUCAO = 'EM PRODUÇÃO';

export const CAMASI_INICIO_JORNADA_LABEL = 'INÍCIO JORNADA';
export const CAMASI_FIM_JORNADA_LABEL = 'FIM JORNADA';

export const CAMASI_OBS_INICIO_ESCALA = 'Cortado automaticamente: início da escala';
export const CAMASI_OBS_FIM_ESCALA = 'Cortado automaticamente: fim da escala';
export const CAMASI_OBS_PARADA_INFERIDA = 'Inferido: fim de produção congelado sem parada registrada';
export const CAMASI_OBS_PRODUCAO_ABERTA = 'Em andamento na Camasi (FIM_PRODUCAO atualizando)';
export const CAMASI_OBS_PARADA_ABERTA = 'Em andamento na Camasi (sem fim de parada)';

/** Se FIM_PRODUCAO está a até estes ms de "agora", considera produção ao vivo. */
export const CAMASI_FIM_PRODUCAO_VIVO_MS = 30_000;

export type TempoProducaoRow = {
  id: number;
  data: string; // YYYY-MM-DD
  inicioProducao: string | null; // HH:MM:SS
  fimProducao: string | null;
  inicioParado: string | null;
  fimParado: string | null;
  motivoParado: string | null;
  nomeMotivo: string | null;
  obsMotivo: string | null;
  operador: string | null;
  nomeOperador: string | null; // peça
  horasProducao: number;
  horasParado: number;
};

export type CamasiDashboardKpis = {
  horasProducao: number;
  horasParado: number;
  horasParadoOperacional: number;
  horasParadoJornada: number;
  horasEscala: number | null;
  /** Escala já decorrida (até agora no dia aberto) — denominador da disponibilidade. */
  horasEscalaDecorrida: number | null;
  disponibilidadePct: number | null;
  qtdeParadas: number;
  qtdeParadasOperacionais: number;
  qtdeParadasJornada: number;
};

export type CamasiMesAgg = {
  mes: string; // YYYY-MM
  label: string;
  horasProducao: number;
  horasParado: number;
};

export type CamasiMotivoAgg = {
  motivo: string;
  horas: number;
  qtde: number;
  pct: number;
};

export type CamasiPecaAgg = {
  peca: string;
  horasProducao: number;
  horasParado: number;
};

export type CamasiDiaParadoAgg = {
  data: string; // YYYY-MM-DD
  horas: number;
  qtde: number;
  pct: number;
};

export type CamasiParadaValida = {
  id: number;
  data: string;
  inicioParado: string | null;
  fimParado: string | null;
  horas: number;
  minutos: number;
  peca: string;
  justificativa: string;
  observacao: string | null;
  categoria: CamasiCategoriaParada;
  /** Parada sintética SEM JUSTIFICATIVA (início/fim de escala) — pode receber motivo no GS. */
  justificativaEditavel?: boolean;
};

export type CamasiProducaoValida = {
  id: number;
  data: string;
  inicioProducao: string | null;
  fimProducao: string | null;
  horas: number;
  minutos: number;
  peca: string;
  /** Ex.: "EM PRODUÇÃO" quando o trecho está em andamento no dia corrente. */
  justificativa?: string | null;
};

/** Memorial do dia: parado por união de intervalos; produção = escala − parado. */
export type CamasiResumoDia = {
  data: string;
  escalaHoras: number;
  paradoHoras: number;
  paradoOperacionalHoras: number;
  paradoJornadaHoras: number;
  producaoHoras: number;
  /** Soma das durações por evento (pode > paradoHoras se houver sobreposição). */
  paradoSomaEventos: number;
  temSobreposicao: boolean;
  qtdeParadas: number;
};

export type CamasiDiaAgg = {
  data: string; // YYYY-MM-DD
  horas: number;
};

const TOP_DIAS_PARADO = 20;

/** NOME_MOTIVO em TEMPO_PRODUCAO é snapshot do momento da parada; o catálogo MOTIVO_PARADA tem o nome vigente. */
/** Colunas comuns TEMPO_PRODUCAO + MOTIVO_PARADA (horário 06:00 legado → 07:00). */
const SQL_TEMPO_PRODUCAO_SELECT = `
SELECT
    tp.ID,
    tp."DATA",
    CASE
        WHEN tp.INICIO_PRODUCAO = CAST('06:00:00' AS TIME)
        THEN CAST('07:00:00' AS TIME)
        ELSE tp.INICIO_PRODUCAO
    END AS INICIO_PRODUCAO,
    CASE
        WHEN tp.FIM_PRODUCAO = CAST('06:00:00' AS TIME)
        THEN CAST('07:00:00' AS TIME)
        ELSE tp.FIM_PRODUCAO
    END AS FIM_PRODUCAO,
    CASE
        WHEN tp.INICIO_PARADO = CAST('06:00:00' AS TIME)
        THEN CAST('07:00:00' AS TIME)
        ELSE tp.INICIO_PARADO
    END AS INICIO_PARADO,
    CASE
        WHEN tp.FIM_PARADO = CAST('06:00:00' AS TIME)
        THEN CAST('07:00:00' AS TIME)
        ELSE tp.FIM_PARADO
    END AS FIM_PARADO,
    tp.MOTIVO_PARADO,
    COALESCE(NULLIF(TRIM(mp.NOME), ''), tp.NOME_MOTIVO) AS NOME_MOTIVO,
    tp.OBS_MOTIVO,
    tp.OPERADOR,
    tp.NOME_OPERADOR
FROM TEMPO_PRODUCAO tp
LEFT JOIN MOTIVO_PARADA mp ON mp.ID = tp.MOTIVO_PARADO
`;

const SQL_TEMPO_PRODUCAO = `
${SQL_TEMPO_PRODUCAO_SELECT}
WHERE tp."DATA" BETWEEN ? AND ?
ORDER BY tp.ID DESC
`;

/** Histórico completo (sync inicial). */
const SQL_TEMPO_PRODUCAO_ALL = `
${SQL_TEMPO_PRODUCAO_SELECT}
ORDER BY tp.ID
`;

/** Janela incremental (sync a cada minuto). */
const SQL_TEMPO_PRODUCAO_DESDE = `
${SQL_TEMPO_PRODUCAO_SELECT}
WHERE tp."DATA" >= ?
ORDER BY tp.ID
`;

const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Normaliza data Firebird/JS para YYYY-MM-DD. */
export function toYmd(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

/** Normaliza TIME Firebird para HH:MM:SS. */
export function toHms(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${pad2(Number(m[1]))}:${m[2]}:${pad2(Number(m[3] ?? 0))}`;
}

const MS_HORA = 1000 * 60 * 60;
/** Gap mínimo (em horas) para tratar fim < início como virada de dia. */
const OVERNIGHT_MIN_HORAS = 12;

function parseIntervaloMs(
  dataYmd: string,
  inicioHms: string | null,
  fimHms: string | null
): { startMs: number; endMs: number } | null {
  if (!dataYmd || !inicioHms || !fimHms) return null;
  const iniParts = inicioHms.split(':').map(Number);
  const fimParts = fimHms.split(':').map(Number);
  if (iniParts.length < 2 || fimParts.length < 2) return null;
  if (iniParts.some((n) => Number.isNaN(n)) || fimParts.some((n) => Number.isNaN(n))) return null;

  const [y, mo, d] = dataYmd.split('-').map(Number);
  const start = new Date(y, mo - 1, d, iniParts[0], iniParts[1], iniParts[2] ?? 0, 0);
  const end = new Date(y, mo - 1, d, fimParts[0], fimParts[1], fimParts[2] ?? 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Duração em horas (produção): se fim < início, assume virada de dia (+24h).
 */
export function horasEntre(dataYmd: string, inicioHms: string | null, fimHms: string | null): number {
  const iv = parseIntervaloMs(dataYmd, inicioHms, fimHms);
  if (!iv) return 0;
  let { startMs, endMs } = iv;
  if (endMs < startMs) {
    endMs += 24 * MS_HORA;
  }
  const ms = endMs - startMs;
  if (ms <= 0) return 0;
  return ms / MS_HORA;
}

/**
 * Duração em horas (parada):
 * - fim >= início → duração normal
 * - fim < início com gap pequeno (< 12h) → 0
 *   (ex.: INÍCIO JORNADA 07:00 → 06:55 quando a máquina começou antes da abertura)
 * - fim < início com gap grande (≥ 12h) → virada de dia (+24h)
 */
export function horasEntreParado(
  dataYmd: string,
  inicioHms: string | null,
  fimHms: string | null
): number {
  const iv = parseIntervaloMs(dataYmd, inicioHms, fimHms);
  if (!iv) return 0;
  const { startMs, endMs } = iv;
  if (endMs >= startMs) {
    const ms = endMs - startMs;
    return ms <= 0 ? 0 : ms / MS_HORA;
  }
  // Intervalo invertido: distância "para trás" no mesmo dia civil.
  const gapHoras = (startMs - endMs) / MS_HORA;
  if (gapHoras < OVERNIGHT_MIN_HORAS) {
    return 0;
  }
  const ms = endMs + 24 * MS_HORA - startMs;
  return ms <= 0 ? 0 : ms / MS_HORA;
}

function intervaloEfetivoMs(
  dataYmd: string,
  inicioHms: string | null,
  fimHms: string | null,
  tipo: 'producao' | 'parado'
): { startMs: number; endMs: number } | null {
  const iv = parseIntervaloMs(dataYmd, inicioHms, fimHms);
  if (!iv) return null;
  let { startMs, endMs } = iv;
  if (endMs >= startMs) {
    return endMs > startMs ? { startMs, endMs } : null;
  }
  if (tipo === 'producao') {
    endMs += 24 * MS_HORA;
    return endMs > startMs ? { startMs, endMs } : null;
  }
  const gapHoras = (startMs - endMs) / MS_HORA;
  if (gapHoras < OVERNIGHT_MIN_HORAS) return null;
  endMs += 24 * MS_HORA;
  return endMs > startMs ? { startMs, endMs } : null;
}

export function horasNaEscala(
  dataYmd: string,
  inicioHms: string | null,
  fimHms: string | null,
  tipo: 'producao' | 'parado',
  escala: RecursoEscala | null | undefined
): number {
  if (!escala || escalaEstaVazia(escala)) {
    return tipo === 'producao'
      ? horasEntre(dataYmd, inicioHms, fimHms)
      : horasEntreParado(dataYmd, inicioHms, fimHms);
  }
  const iv = intervaloEfetivoMs(dataYmd, inicioHms, fimHms, tipo);
  if (!iv) return 0;
  return horasIntervaloNaEscala(dataYmd, iv.startMs, iv.endMs, escala);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Horas decimais com precisão de 1s — evita 10,25h (07:00–17:15) virar 10,3 = 10:18. */
function roundHoras(n: number): number {
  return Math.round(n * 3600) / 3600;
}

function msParaHmsLocal(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Minutos de relógio entre instantes — alinha com HH:MM na tela (06:00→06:24 = 24, não 25). */
function minutosEntreMs(startMs: number, endMs: number): number {
  return Math.max(0, Math.floor(endMs / 60_000) - Math.floor(startMs / 60_000));
}

function minutosDeHoras(horas: number): number {
  if (!Number.isFinite(horas) || horas <= 0) return 0;
  return Math.max(0, Math.floor(horas * 60 + 1e-9));
}

function hmsParaMsNoDia(ymd: string, hms: string | null | undefined): number | null {
  if (!hms) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hms).trim());
  if (!m) return null;
  const [y, mo, d] = ymd.split('-').map(Number);
  if (![y, mo, d].every((n) => Number.isFinite(n))) return null;
  return new Date(y!, mo! - 1, d!, Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0).getTime();
}

function temHorarioInformado(hms: string | null | undefined): boolean {
  return hms != null && String(hms).trim() !== '';
}

/**
 * Linha Camasi fechada (entra no histórico normalmente).
 * No dia corrente, linhas sem parada fechada são tratadas em `interpretarLinhaAbertaCamasi`.
 * Em dias passados, mantém linhas só de produção (padrão histórico / testes).
 */
export function linhaCamasiUtilizavel(
  row: Pick<TempoProducaoRow, 'data' | 'inicioParado' | 'fimParado'>,
  hojeYmd: string
): boolean {
  const paradaFechada =
    temHorarioInformado(row.inicioParado) && temHorarioInformado(row.fimParado);
  if (paradaFechada) return true;
  if (row.data === hojeYmd) return false;
  return true;
}

function fimCoberturaLinhaMs(row: TempoProducaoRow): number | null {
  const candidatos: number[] = [];
  const tPar = hmsParaMsNoDia(row.data, row.fimParado);
  if (tPar != null) candidatos.push(tPar);
  const tProd = hmsParaMsNoDia(row.data, row.fimProducao);
  if (tProd != null) candidatos.push(tProd);
  if (candidatos.length === 0) return null;
  return Math.max(...candidatos);
}

export type CamasiLinhaAberta =
  | {
      tipo: 'producao';
      row: TempoProducaoRow;
      startMs: number;
      endMs: number;
    }
  | {
      tipo: 'parada';
      row: TempoProducaoRow;
      startMs: number;
      endMs: number;
    };

/**
 * Última linha do dia sem parada fechada:
 * - FIM_PRODUCAO próximo de "agora" → máquina produzindo (fim ainda atualiza na Camasi)
 * - FIM_PRODUCAO congelado → parado aguardando justificativa até agora
 */
export function interpretarLinhaAbertaCamasi(
  rows: TempoProducaoRow[],
  hojeYmd: string,
  agoraMs: number,
  vivoMs: number = CAMASI_FIM_PRODUCAO_VIVO_MS
): CamasiLinhaAberta | null {
  const abertas = rows.filter((r) => {
    if (r.data !== hojeYmd) return false;
    const paradaFechada =
      temHorarioInformado(r.inicioParado) && temHorarioInformado(r.fimParado);
    if (paradaFechada) return false;
    return temHorarioInformado(r.inicioProducao) && temHorarioInformado(r.fimProducao);
  });
  if (abertas.length === 0) return null;

  abertas.sort((a, b) => {
    const fa = hmsParaMsNoDia(a.data, a.fimProducao) ?? 0;
    const fb = hmsParaMsNoDia(b.data, b.fimProducao) ?? 0;
    if (fa !== fb) return fb - fa;
    return b.id - a.id;
  });
  const row = abertas[0]!;
  const startMs = hmsParaMsNoDia(row.data, row.inicioProducao);
  const fimMs = hmsParaMsNoDia(row.data, row.fimProducao);
  if (startMs == null || fimMs == null) return null;
  if (startMs >= agoraMs) return null;

  const ageMs = agoraMs - fimMs;
  // Fim no futuro (relógio) ou ainda "vivo" → produção até agora.
  if (ageMs <= vivoMs) {
    return { tipo: 'producao', row, startMs, endMs: agoraMs };
  }
  // Fim congelado: parado de FIM_PRODUCAO até agora.
  if (fimMs < agoraMs) {
    return { tipo: 'parada', row, startMs: fimMs, endMs: agoraMs };
  }
  return null;
}

/**
 * Limites do dia corrente:
 * - eventos (tabelas): até "agora" se há linha aberta ao vivo; senão até última parada fechada
 * - KPI: escala até "agora"; produção = previsto − parado (fechado + aguardando inferido)
 */
function buildLimitesDiaCorrente(
  hojeYmd: string,
  agoraMs: number,
  workRows: TempoProducaoRow[],
  linhaAberta: CamasiLinhaAberta | null
): {
  limiteMsEventos: (data: string) => number | null;
  limiteMsKpi: (data: string) => number | null;
} {
  const fimCoberturaHoje = (() => {
    let max: number | null = null;
    for (const row of workRows) {
      if (row.data !== hojeYmd) continue;
      if (!temHorarioInformado(row.inicioParado) || !temHorarioInformado(row.fimParado)) continue;
      const t = fimCoberturaLinhaMs(row);
      if (t == null) continue;
      if (max == null || t > max) max = t;
    }
    return max;
  })();

  return {
    limiteMsEventos: (data: string): number | null => {
      if (data !== hojeYmd) return null;
      if (linhaAberta) return agoraMs;
      if (fimCoberturaHoje == null) return 0;
      return Math.min(agoraMs, fimCoberturaHoje);
    },
    limiteMsKpi: (data: string): number | null => {
      if (data !== hojeYmd) return null;
      return agoraMs;
    },
  };
}

function isParadaInicioAuto(p: { justificativa: string; observacao: string | null }): boolean {
  if (isMotivoInicioJornadaCamasi(p.justificativa)) return true;
  const just = p.justificativa.trim().toLowerCase();
  if (just === 'sem justificativa' || just === 'parada sem justificativa') {
    const obs = (p.observacao ?? '').toLowerCase();
    return obs.includes('início da escala') || obs.includes('inicio da escala');
  }
  return false;
}

function isParadaFimAuto(p: { justificativa: string; observacao: string | null }): boolean {
  if (isMotivoFimJornadaCamasi(p.justificativa)) return true;
  const just = p.justificativa.trim().toLowerCase();
  if (just === 'sem justificativa' || just === 'parada sem justificativa') {
    const obs = (p.observacao ?? '').toLowerCase();
    return obs.includes('fim da escala');
  }
  return false;
}

function isParadaJornadaAuto(p: { justificativa: string; observacao: string | null }): boolean {
  return isParadaInicioAuto(p) || isParadaFimAuto(p);
}

function ymdLocalDeMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias YYYY-MM-DD de [ini, fim] inclusive. */
function ymdsNoPeriodo(dataIni: string, dataFim: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIni) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim) || dataIni > dataFim) {
    return [];
  }
  const out: string[] = [];
  const cur = new Date(`${dataIni}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(fim.getTime())) return [];
  while (cur.getTime() <= fim.getTime()) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${mo}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function clipIntervalosAte(intervals: MsInterval[], limiteMs: number): MsInterval[] {
  return intervals
    .map((iv) => ({
      startMs: iv.startMs,
      endMs: Math.min(iv.endMs, limiteMs),
    }))
    .filter((iv) => iv.endMs > iv.startMs && iv.startMs < limiteMs);
}

function clipJanelasAte(janelas: MsInterval[], limiteMs: number | null): MsInterval[] {
  if (limiteMs == null) return janelas.map((j) => ({ ...j }));
  return clipIntervalosAte(janelas, limiteMs);
}

/** União das peças já recortada nas faixas da escala — almoço/fora da jornada não conta como parado. */
function pecasNaEscalaDoDia(
  pieces: MsInterval[],
  data: string,
  escala: RecursoEscala | null | undefined
): MsInterval[] {
  if (!escala || escalaEstaVazia(escala)) return unirIntervalos(pieces);
  const out: MsInterval[] = [];
  for (const p of pieces) {
    out.push(...intervalosNaEscalaDoDia(data, p.startMs, p.endMs, escala));
  }
  return unirIntervalos(out);
}

function pecasParadasDoDia(
  paradas: CamasiParadaValida[],
  data: string,
  escala: RecursoEscala | null | undefined,
  categoria?: CamasiCategoriaParada
): MsInterval[] {
  const out: MsInterval[] = [];
  for (const p of paradas) {
    if (p.data !== data) continue;
    if (categoria && p.categoria !== categoria) continue;
    const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
    const t1 = hmsParaMsNoDia(p.data, p.fimParado);
    if (t0 == null || t1 == null || t1 <= t0) continue;
    out.push(...intervalosNaEscalaDoDia(data, t0, t1, escala));
  }
  return unirIntervalos(out);
}

function pushParadaPeca(
  acc: {
    paradoPieces: MsInterval[];
    operacionalPieces: MsInterval[];
    jornadaPieces: MsInterval[];
    producaoPieces: MsInterval[];
    paradoSomaEventos: number;
    qtdeParadas: number;
  },
  pieces: MsInterval[],
  categoria: CamasiCategoriaParada,
  horasEvento: number
): void {
  acc.paradoSomaEventos += horasEvento;
  acc.qtdeParadas += 1;
  acc.paradoPieces.push(...pieces);
  if (categoria === 'jornada') acc.jornadaPieces.push(...pieces);
  else acc.operacionalPieces.push(...pieces);
}

function strField(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v == null || v === '') continue;
    return String(v).trim() || null;
  }
  return null;
}

function numField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function mapTempoProducaoRow(raw: Record<string, unknown>): TempoProducaoRow | null {
  const data = toYmd(raw.DATA ?? raw.data ?? raw.Data);
  if (!data) return null;
  const inicioProducao = toHms(raw.INICIO_PRODUCAO ?? raw.inicio_producao ?? raw.inicioproducao);
  const fimProducao = toHms(raw.FIM_PRODUCAO ?? raw.fim_producao ?? raw.fimproducao);
  const inicioParado = toHms(raw.INICIO_PARADO ?? raw.inicio_parado ?? raw.inicioparado);
  const fimParado = toHms(raw.FIM_PARADO ?? raw.fim_parado ?? raw.fimparado);

  return {
    id: numField(raw, 'ID', 'id'),
    data,
    inicioProducao,
    fimProducao,
    inicioParado,
    fimParado,
    motivoParado: strField(raw, 'MOTIVO_PARADO', 'motivo_parado', 'motivoparado'),
    nomeMotivo: strField(raw, 'NOME_MOTIVO', 'nome_motivo', 'nomemotivo'),
    obsMotivo: strField(raw, 'OBS_MOTIVO', 'obs_motivo', 'obsmotivo'),
    operador: strField(raw, 'OPERADOR', 'operador'),
    nomeOperador: strField(raw, 'NOME_OPERADOR', 'nome_operador', 'nomeoperador'),
    horasProducao: horasEntre(data, inicioProducao, fimProducao),
    horasParado: horasEntreParado(data, inicioParado, fimParado),
  };
}

/** @deprecated use mapTempoProducaoRow */
const mapRow = mapTempoProducaoRow;

function aplicarEscalaNaRow(row: TempoProducaoRow, escala: RecursoEscala | null | undefined): TempoProducaoRow {
  if (!escala || escalaEstaVazia(escala)) return row;
  return {
    ...row,
    horasProducao: horasNaEscala(row.data, row.inicioProducao, row.fimProducao, 'producao', escala),
    horasParado: horasNaEscala(row.data, row.inicioParado, row.fimParado, 'parado', escala),
  };
}

export function motivoLabel(row: TempoProducaoRow): string {
  return row.nomeMotivo || row.motivoParado || '(sem motivo)';
}

export function pecaLabel(row: TempoProducaoRow): string {
  return row.nomeOperador || row.operador || '(sem peça)';
}

export function mesLabel(mes: string): string {
  const [y, m] = mes.split('-');
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return mes;
  return `${MESES_ABREV[idx]}/${y}`;
}

function mapRawList(
  raw: Record<string, unknown>[],
  escala?: RecursoEscala | null
): TempoProducaoRow[] {
  const out: TempoProducaoRow[] = [];
  for (const r of raw) {
    const mapped = mapRow(r);
    if (mapped) out.push(aplicarEscalaNaRow(mapped, escala));
  }
  return out;
}

/** Lê TEMPO_PRODUCAO no Firebird (período). */
export async function listTempoProducaoFirebird(
  dataIni: string,
  dataFim: string,
  escala?: RecursoEscala | null
): Promise<TempoProducaoRow[]> {
  const raw = await queryCamasi<Record<string, unknown>>(SQL_TEMPO_PRODUCAO, [dataIni, dataFim]);
  return mapRawList(raw, escala);
}

/** Histórico completo no Firebird (sync inicial). */
export async function listTempoProducaoFirebirdAll(): Promise<TempoProducaoRow[]> {
  const raw = await queryCamasi<Record<string, unknown>>(SQL_TEMPO_PRODUCAO_ALL, []);
  return mapRawList(raw, null);
}

/** Janela a partir de dataIni (sync incremental). */
export async function listTempoProducaoFirebirdDesde(dataIni: string): Promise<TempoProducaoRow[]> {
  const raw = await queryCamasi<Record<string, unknown>>(SQL_TEMPO_PRODUCAO_DESDE, [dataIni]);
  return mapRawList(raw, null);
}

export type CamasiDataFonte = 'firebird' | 'cache';

export type ListTempoProducaoResult = {
  rows: TempoProducaoRow[];
  fonte: CamasiDataFonte;
  /** ISO da última sync bem-sucedida (quando fonte=cache). */
  cacheSyncedAt: string | null;
};

/**
 * Preferência: Firebird ao vivo. Se falhar e houver espelho SQLite, usa o cache.
 */
export async function listTempoProducaoComFonte(
  dataIni: string,
  dataFim: string,
  escala?: RecursoEscala | null
): Promise<ListTempoProducaoResult> {
  try {
    const rows = await listTempoProducaoFirebird(dataIni, dataFim, escala);
    return { rows, fonte: 'firebird', cacheSyncedAt: null };
  } catch (err) {
    const { listCamasiTempoProducaoFromCache, getCamasiSyncEstado, countCamasiCacheRows } =
      await import('./camasiTempoProducaoCacheRepository.js');
    const n = await countCamasiCacheRows();
    if (n <= 0) throw err;
    const cached = await listCamasiTempoProducaoFromCache(dataIni, dataFim);
    const estado = await getCamasiSyncEstado();
    const rows = cached.map((r) => aplicarEscalaNaRow(r, escala));
    return { rows, fonte: 'cache', cacheSyncedAt: estado.lastSuccessAt };
  }
}

export async function listTempoProducao(
  dataIni: string,
  dataFim: string,
  escala?: RecursoEscala | null
): Promise<TempoProducaoRow[]> {
  const { rows } = await listTempoProducaoComFonte(dataIni, dataFim, escala);
  return rows;
}

export function buildDashboardResumo(
  rows: TempoProducaoRow[],
  opts?: {
    horasEscala?: number | null;
    escala?: RecursoEscala | null;
    agoraMs?: number;
    /** Período filtrado: dias de escala até hoje (inclusive) entram como produção se não houver Camasi. */
    dataIni?: string;
    dataFim?: string;
  }
): {
  kpis: CamasiDashboardKpis;
  porMes: CamasiMesAgg[];
  motivos: CamasiMotivoAgg[];
  pecas: CamasiPecaAgg[];
  pioresDiasParado: CamasiDiaParadoAgg[];
  paradasValidas: CamasiParadaValida[];
  producaoValidas: CamasiProducaoValida[];
  resumoDias: CamasiResumoDia[];
} {
  const escala = opts?.escala ?? null;
  const agoraMs = opts?.agoraMs ?? Date.now();
  const hojeYmd = ymdLocalDeMs(agoraMs);
  const linhaAberta = interpretarLinhaAbertaCamasi(rows, hojeYmd, agoraMs);
  const workRows = rows.filter((r) => linhaCamasiUtilizavel(r, hojeYmd));
  const liveEmProducao = new Map<string, MsInterval[]>();
  if (linhaAberta?.tipo === 'producao') {
    liveEmProducao.set(hojeYmd, [{ startMs: linhaAberta.startMs, endMs: linhaAberta.endMs }]);
  }
  const limiteMs = buildLimitesDiaCorrente(hojeYmd, agoraMs, workRows, linhaAberta);
  const limiteMsEventos = limiteMs.limiteMsEventos;
  const limiteMsKpi = limiteMs.limiteMsKpi;

  let qtdeParadas = 0;
  let qtdeParadasOperacionais = 0;
  let qtdeParadasJornada = 0;

  const mesMap = new Map<string, { horasProducao: number; horasParado: number }>();
  const motivoMap = new Map<string, { horas: number; qtde: number }>();
  const pecaMap = new Map<string, { horasProducao: number; horasParado: number }>();
  const paradasValidas: CamasiParadaValida[] = [];
  const producaoValidas: CamasiProducaoValida[] = [];

  type DiaAcc = {
    paradoPieces: MsInterval[];
    operacionalPieces: MsInterval[];
    jornadaPieces: MsInterval[];
    producaoPieces: MsInterval[];
    paradoSomaEventos: number;
    qtdeParadas: number;
  };
  const diaAcc = new Map<string, DiaAcc>();
  let idSintetico = 0;
  /** Peças Camasi sobrepostas (para rotular gaps de produção na escala). */
  const pecasProducaoPorDia = new Map<string, { startMs: number; endMs: number; peca: string }[]>();

  const emptyDiaAcc = (): DiaAcc => ({
    paradoPieces: [],
    operacionalPieces: [],
    jornadaPieces: [],
    producaoPieces: [],
    paradoSomaEventos: 0,
    qtdeParadas: 0,
  });

  for (const row of workRows) {
    if (row.horasProducao > 0) {
      const ivProd = intervaloEfetivoMs(row.data, row.inicioProducao, row.fimProducao, 'producao');
      const piecesProd =
        escala && !escalaEstaVazia(escala) && ivProd
          ? intervalosNaEscalaDoDia(row.data, ivProd.startMs, ivProd.endMs, escala)
          : ivProd
            ? [ivProd]
            : [];
      const accProd = diaAcc.get(row.data) ?? emptyDiaAcc();
      accProd.producaoPieces.push(...piecesProd);
      diaAcc.set(row.data, accProd);

      const peca = pecaLabel(row);
      if (piecesProd.length > 0) {
        const hits = pecasProducaoPorDia.get(row.data) ?? [];
        for (const piece of piecesProd) {
          hits.push({ startMs: piece.startMs, endMs: piece.endMs, peca });
        }
        pecasProducaoPorDia.set(row.data, hits);
      }

      // Sem escala: mantém os intervalos Camasi. Com escala, produção na grade =
      // gaps da escala − parado (reconstruído após as paradas / gaps sintéticos).
      if (!escala || escalaEstaVazia(escala)) {
        const justLive =
          (liveEmProducao.get(row.data) ?? []).length > 0 &&
          temHorarioInformado(row.fimProducao) &&
          (liveEmProducao.get(row.data) ?? []).some((iv) => {
            const t1 = hmsParaMsNoDia(row.data, row.fimProducao);
            return t1 != null && Math.abs(t1 - iv.endMs) < 1500;
          })
            ? CAMASI_EM_PRODUCAO
            : null;
        if (piecesProd.length === 0) {
          producaoValidas.push({
            id: row.id,
            data: row.data,
            inicioProducao: row.inicioProducao,
            fimProducao: row.fimProducao,
            horas: roundHoras(row.horasProducao),
            minutos: minutosDeHoras(row.horasProducao),
            peca,
            justificativa: justLive,
          });
        } else {
          for (const piece of piecesProd) {
            const horas = (piece.endMs - piece.startMs) / MS_HORA;
            const liveHit = (liveEmProducao.get(row.data) ?? []).some((iv) => {
              const a = Math.max(piece.startMs, iv.startMs);
              const b = Math.min(piece.endMs, iv.endMs);
              return b > a;
            });
            producaoValidas.push({
              id: row.id,
              data: row.data,
              inicioProducao: msParaHmsLocal(piece.startMs),
              fimProducao: msParaHmsLocal(piece.endMs),
              horas: roundHoras(horas),
              minutos: minutosEntreMs(piece.startMs, piece.endMs),
              peca,
              justificativa: liveHit ? CAMASI_EM_PRODUCAO : null,
            });
          }
        }
      }
    }

    if (row.horasParado > 0) {
      qtdeParadas += 1;
      const motivo = motivoLabel(row);
      const categoria = categoriaParadaCamasi(motivo);
      if (categoria === 'jornada') qtdeParadasJornada += 1;
      else qtdeParadasOperacionais += 1;

      {
        const mot = motivoMap.get(motivo) ?? { horas: 0, qtde: 0 };
        mot.horas += row.horasParado;
        mot.qtde += 1;
        motivoMap.set(motivo, mot);
      }

      const iv = intervaloEfetivoMs(row.data, row.inicioParado, row.fimParado, 'parado');
      const pieces =
        escala && !escalaEstaVazia(escala) && iv
          ? intervalosNaEscalaDoDia(row.data, iv.startMs, iv.endMs, escala)
          : iv
            ? [iv]
            : [];

      if (pieces.length === 0) {
        paradasValidas.push({
          id: row.id,
          data: row.data,
          inicioParado: row.inicioParado,
          fimParado: row.fimParado,
          horas: roundHoras(row.horasParado),
          minutos: minutosDeHoras(row.horasParado),
          peca: pecaLabel(row),
          justificativa: motivo,
          observacao: row.obsMotivo,
          categoria,
        });
      } else {
        for (const piece of pieces) {
          const horas = (piece.endMs - piece.startMs) / MS_HORA;
          paradasValidas.push({
            id: row.id,
            data: row.data,
            inicioParado: msParaHmsLocal(piece.startMs),
            fimParado: msParaHmsLocal(piece.endMs),
            horas: roundHoras(horas),
            minutos: minutosEntreMs(piece.startMs, piece.endMs),
            peca: pecaLabel(row),
            justificativa: motivo,
            observacao: row.obsMotivo,
            categoria,
          });
        }
      }

      const acc = diaAcc.get(row.data) ?? emptyDiaAcc();
      pushParadaPeca(acc, pieces, categoria, row.horasParado);
      diaAcc.set(row.data, acc);
    }

    const peca = pecaLabel(row);
    const pAgg = pecaMap.get(peca) ?? { horasProducao: 0, horasParado: 0 };
    pAgg.horasProducao += row.horasProducao;
    pAgg.horasParado += row.horasParado;
    pecaMap.set(peca, pAgg);
  }

  const allDays = new Set<string>();
  for (const row of workRows) allDays.add(row.data);
  if (linhaAberta) allDays.add(hojeYmd);

  // Status ao vivo da linha aberta (FIM_PRODUCAO vivo vs congelado).
  if (linhaAberta) {
    const peca = pecaLabel(linhaAberta.row);
    const acc = diaAcc.get(hojeYmd) ?? emptyDiaAcc();
    if (linhaAberta.tipo === 'producao') {
      const pieces =
        escala && !escalaEstaVazia(escala)
          ? intervalosNaEscalaDoDia(hojeYmd, linhaAberta.startMs, linhaAberta.endMs, escala)
          : [{ startMs: linhaAberta.startMs, endMs: linhaAberta.endMs }];
      acc.producaoPieces.push(...pieces);
      const hits = pecasProducaoPorDia.get(hojeYmd) ?? [];
      for (const piece of pieces) {
        hits.push({ startMs: piece.startMs, endMs: piece.endMs, peca });
      }
      pecasProducaoPorDia.set(hojeYmd, hits);
      if (!escala || escalaEstaVazia(escala)) {
        for (const piece of pieces) {
          const horas = (piece.endMs - piece.startMs) / MS_HORA;
          if (horas <= 0) continue;
          producaoValidas.push({
            id: linhaAberta.row.id,
            data: hojeYmd,
            inicioProducao: msParaHmsLocal(piece.startMs),
            fimProducao: msParaHmsLocal(piece.endMs),
            horas: roundHoras(horas),
            minutos: minutosEntreMs(piece.startMs, piece.endMs),
            peca,
            justificativa: CAMASI_EM_PRODUCAO,
          });
        }
      }
    } else {
      const horas = (linhaAberta.endMs - linhaAberta.startMs) / MS_HORA;
      if (horas > 0) {
        const motivo = CAMASI_AGUARDANDO_JUSTIFICATIVA;
        idSintetico += 1;
        qtdeParadas += 1;
        qtdeParadasOperacionais += 1;
        const mot = motivoMap.get(motivo) ?? { horas: 0, qtde: 0 };
        mot.horas += horas;
        mot.qtde += 1;
        motivoMap.set(motivo, mot);
        const pieces =
          escala && !escalaEstaVazia(escala)
            ? intervalosNaEscalaDoDia(hojeYmd, linhaAberta.startMs, linhaAberta.endMs, escala)
            : [{ startMs: linhaAberta.startMs, endMs: linhaAberta.endMs }];
        // Peça bruta até "agora" (mesmo fora de faixa): evita buraco na grade virar "produção".
        const coberturaAteAgora: MsInterval[] = [
          { startMs: linhaAberta.startMs, endMs: linhaAberta.endMs },
        ];
        pushParadaPeca(acc, coberturaAteAgora, 'operacional', horas);
        const paraExibir = pieces.length > 0 ? pieces : coberturaAteAgora;
        for (const piece of paraExibir) {
          const h = (piece.endMs - piece.startMs) / MS_HORA;
          if (h <= 0) continue;
          paradasValidas.push({
            id: -idSintetico,
            data: hojeYmd,
            inicioParado: msParaHmsLocal(piece.startMs),
            fimParado: msParaHmsLocal(piece.endMs),
            horas: roundHoras(h),
            minutos: minutosEntreMs(piece.startMs, piece.endMs),
            peca,
            justificativa: motivo,
            observacao: CAMASI_OBS_PARADA_INFERIDA,
            categoria: 'operacional',
          });
        }
        // Produção já ocorrida nesta linha aberta (início → fim congelado), para rotular gaps.
        const iniProd = hmsParaMsNoDia(hojeYmd, linhaAberta.row.inicioProducao);
        if (iniProd != null && iniProd < linhaAberta.startMs) {
          const prodPieces =
            escala && !escalaEstaVazia(escala)
              ? intervalosNaEscalaDoDia(hojeYmd, iniProd, linhaAberta.startMs, escala)
              : [{ startMs: iniProd, endMs: linhaAberta.startMs }];
          acc.producaoPieces.push(...prodPieces);
          const hits = pecasProducaoPorDia.get(hojeYmd) ?? [];
          for (const piece of prodPieces) {
            hits.push({ startMs: piece.startMs, endMs: piece.endMs, peca });
          }
          pecasProducaoPorDia.set(hojeYmd, hits);
        }
      }
    }
    diaAcc.set(hojeYmd, acc);
  }

  const debitarParadaRemovida = (p: CamasiParadaValida, acc: ReturnType<typeof emptyDiaAcc>) => {
    qtdeParadas = Math.max(0, qtdeParadas - 1);
    if (p.categoria === 'jornada') qtdeParadasJornada = Math.max(0, qtdeParadasJornada - 1);
    else qtdeParadasOperacionais = Math.max(0, qtdeParadasOperacionais - 1);
    const mot = motivoMap.get(p.justificativa);
    if (mot) {
      mot.horas = Math.max(0, mot.horas - p.horas);
      mot.qtde = Math.max(0, mot.qtde - 1);
      if (mot.qtde === 0 || mot.horas <= 0) motivoMap.delete(p.justificativa);
      else motivoMap.set(p.justificativa, mot);
    }
    acc.paradoSomaEventos = Math.max(0, acc.paradoSomaEventos - p.horas);
    acc.qtdeParadas = Math.max(0, acc.qtdeParadas - 1);
  };

  const subtrairPecaParada = (acc: ReturnType<typeof emptyDiaAcc>, cut: MsInterval) => {
    acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [cut]);
    acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [cut]);
    acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [cut]);
  };

  const subtrairJornadaPeca = (acc: ReturnType<typeof emptyDiaAcc>, cut: MsInterval) => {
    acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [cut]);
    acc.paradoPieces = unirIntervalos([...acc.operacionalPieces, ...acc.jornadaPieces]);
  };

  const reconstruirPecasDoDia = (acc: ReturnType<typeof emptyDiaAcc>, data: string) => {
    acc.paradoPieces = pecasParadasDoDia(paradasValidas, data, escala);
    acc.operacionalPieces = pecasParadasDoDia(paradasValidas, data, escala, 'operacional');
    acc.jornadaPieces = pecasParadasDoDia(paradasValidas, data, escala, 'jornada');
  };

  const creditarParadaSintetica = (
    acc: ReturnType<typeof emptyDiaAcc>,
    data: string,
    interval: MsInterval,
    justificativa: string,
    categoria: CamasiCategoriaParada,
    observacao: string | null
  ) => {
    const pieces =
      escala && !escalaEstaVazia(escala)
        ? intervalosNaEscalaDoDia(data, interval.startMs, interval.endMs, escala)
        : interval.endMs > interval.startMs
          ? [interval]
          : [];
    for (const piece of pieces) {
      const horas = (piece.endMs - piece.startMs) / MS_HORA;
      if (horas <= 0) continue;
      idSintetico += 1;
      qtdeParadas += 1;
      if (categoria === 'jornada') qtdeParadasJornada += 1;
      else qtdeParadasOperacionais += 1;
      const mot = motivoMap.get(justificativa) ?? { horas: 0, qtde: 0 };
      mot.horas += horas;
      mot.qtde += 1;
      motivoMap.set(justificativa, mot);
      pushParadaPeca(acc, [piece], categoria, horas);
      paradasValidas.push({
        id: -idSintetico,
        data,
        inicioParado: msParaHmsLocal(piece.startMs),
        fimParado: msParaHmsLocal(piece.endMs),
        horas: roundHoras(horas),
        minutos: minutosEntreMs(piece.startMs, piece.endMs),
        peca: '(sem peça)',
        justificativa,
        observacao,
        categoria,
      });
    }
  };

  // Carência padrão (5 min) no início da jornada: se não houver registro até +5 min,
  // gera INÍCIO JORNADA (carência) + SEM JUSTIFICATIVA até o 1º registro real.
  if (escala && !escalaEstaVazia(escala)) {
    for (const data of allDays) {
      const janelas = janelasEscalaNoDia(data, escala).sort(
        (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
      );
      // Carência só no início da jornada (primeira faixa do dia), não após intervalo.
      const janela = janelas[0];
      if (!janela) continue;
      const acc = diaAcc.get(data) ?? emptyDiaAcc();

      const carenciaFim = Math.min(janela.startMs + CAMASI_CARENCIA_MS, janela.endMs);
      if (carenciaFim <= janela.startMs) {
        diaAcc.set(data, acc);
        continue;
      }

      let primeiroRegistro: number | null = null;
      for (const p of acc.producaoPieces) {
        if (p.endMs <= janela.startMs || p.startMs >= janela.endMs) continue;
        const t = Math.max(p.startMs, janela.startMs);
        if (primeiroRegistro == null || t < primeiroRegistro) primeiroRegistro = t;
      }
      for (const p of paradasValidas) {
        if (p.data !== data || isParadaJornadaAuto(p)) continue;
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null) continue;
        if (t1 <= janela.startMs || t0 >= janela.endMs) continue;
        const t = Math.max(t0, janela.startMs);
        if (primeiroRegistro == null || t < primeiroRegistro) primeiroRegistro = t;
      }

      // Produção/registro dentro da carência: não força o corte automático.
      if (primeiroRegistro != null && primeiroRegistro <= carenciaFim) {
        diaAcc.set(data, acc);
        continue;
      }

      const ultimaJanela = janelas[janelas.length - 1]!;
      const carenciaFimDia = Math.max(ultimaJanela.endMs - CAMASI_CARENCIA_MS, ultimaJanela.startMs);
      // Sem 1º registro: não invade a carência final (deixa o FIM JORNADA de 5 min).
      const idleFim =
        primeiroRegistro != null ? primeiroRegistro : Math.min(janela.endMs, carenciaFimDia);
      if (idleFim <= janela.startMs) {
        diaAcc.set(data, acc);
        continue;
      }

      const corte: MsInterval = { startMs: janela.startMs, endMs: idleFim };

      // Remove INÍCIO JORNADA e FIM JORNADA longos no trecho (FIM 07:00–17:15 não pode ficar na tabela).
      const removidas: CamasiParadaValida[] = [];
      const mantidas: CamasiParadaValida[] = [];
      const caudas: CamasiParadaValida[] = [];
      for (const p of paradasValidas) {
        if (p.data !== data || !(isParadaInicioAuto(p) || isParadaFimAuto(p))) {
          mantidas.push(p);
          continue;
        }
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null || t1 <= corte.startMs || t0 >= corte.endMs) {
          mantidas.push(p);
          continue;
        }
        removidas.push(p);
        // Mantém a cauda após o corte (INÍCIO após o 1º registro; FIM 17:10–17:15).
        if (t1 > corte.endMs + 500) {
          const tailStart = Math.max(t0, corte.endMs);
          const horasTail = (t1 - tailStart) / MS_HORA;
          if (horasTail > 0) {
            const tail: CamasiParadaValida = {
              ...p,
              inicioParado: msParaHmsLocal(tailStart),
              fimParado: msParaHmsLocal(t1),
              horas: roundHoras(horasTail),
              minutos: minutosEntreMs(tailStart, t1),
            };
            mantidas.push(tail);
            caudas.push(tail);
          }
        }
      }
      paradasValidas.length = 0;
      paradasValidas.push(...mantidas);

      for (const p of removidas) debitarParadaRemovida(p, acc);
      for (const tail of caudas) {
        qtdeParadas += 1;
        if (tail.categoria === 'jornada') qtdeParadasJornada += 1;
        else qtdeParadasOperacionais += 1;
        const mot = motivoMap.get(tail.justificativa) ?? { horas: 0, qtde: 0 };
        mot.horas += tail.horas;
        mot.qtde += 1;
        motivoMap.set(tail.justificativa, mot);
        acc.paradoSomaEventos += tail.horas;
        acc.qtdeParadas += 1;
      }

      subtrairPecaParada(acc, corte);

      creditarParadaSintetica(
        acc,
        data,
        { startMs: janela.startMs, endMs: Math.min(carenciaFim, idleFim) },
        CAMASI_INICIO_JORNADA_LABEL,
        'jornada',
        null
      );

      if (idleFim > carenciaFim) {
        creditarParadaSintetica(
          acc,
          data,
          { startMs: carenciaFim, endMs: idleFim },
          CAMASI_PARADA_SEM_JUSTIFICATIVA,
          'operacional',
          CAMASI_OBS_INICIO_ESCALA
        );
      }

      diaAcc.set(data, acc);
    }

    // Dia corrente incompleto: não projetar FIM JORNADA / ociosidade até o fim da escala.
    // Tabelas: só até a última parada fechada (não inventa status ao vivo).
    for (const data of allDays) {
      const limiteMs = limiteMsEventos(data);
      if (limiteMs == null) continue;
      const janelas = janelasEscalaNoDia(data, escala).sort(
        (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
      );
      const ultima = janelas[janelas.length - 1];
      if (!ultima || limiteMs >= ultima.endMs) continue; // jornada do dia já fechou

      const acc = diaAcc.get(data) ?? emptyDiaAcc();
      const mantidas: CamasiParadaValida[] = [];
      for (const p of paradasValidas) {
        if (p.data !== data) {
          mantidas.push(p);
          continue;
        }
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null) {
          mantidas.push(p);
          continue;
        }
        // Em jornada aberta, FIM JORNADA / "fim da escala" é projeção — remove sempre
        // (mesmo se já estiver recortado à faixa da manhã, ex.: 09:42–11:30).
        if (isParadaFimAuto(p)) {
          debitarParadaRemovida(p, acc);
          const cut = { startMs: t0, endMs: t1 };
          acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [cut]);
          acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [cut]);
          acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [cut]);
          continue;
        }
        if (t0 >= limiteMs) {
          debitarParadaRemovida(p, acc);
          const cut = { startMs: t0, endMs: t1 };
          acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [cut]);
          acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [cut]);
          acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [cut]);
          continue;
        }
        if (t1 > limiteMs) {
          const horas = (limiteMs - t0) / MS_HORA;
          mantidas.push({
            ...p,
            fimParado: msParaHmsLocal(limiteMs),
            horas: roundHoras(horas),
            minutos: minutosEntreMs(t0, limiteMs),
          });
          const delta = p.horas - horas;
          if (delta > 0) {
            acc.paradoSomaEventos = Math.max(0, acc.paradoSomaEventos - delta);
            if (p.categoria === 'operacional') {
              const mot = motivoMap.get(p.justificativa);
              if (mot) {
                mot.horas = Math.max(0, mot.horas - delta);
                motivoMap.set(p.justificativa, mot);
              }
            }
          }
          // Remove a cauda futura das peças do memorial.
          acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [{ startMs: limiteMs, endMs: t1 }]);
          acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [{ startMs: limiteMs, endMs: t1 }]);
          acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [
            { startMs: limiteMs, endMs: t1 },
          ]);
          continue;
        }
        mantidas.push(p);
      }
      paradasValidas.length = 0;
      paradasValidas.push(...mantidas);

      acc.paradoPieces = clipIntervalosAte(acc.paradoPieces, limiteMs);
      acc.jornadaPieces = clipIntervalosAte(acc.jornadaPieces, limiteMs);
      acc.operacionalPieces = clipIntervalosAte(acc.operacionalPieces, limiteMs);
      acc.producaoPieces = clipIntervalosAte(acc.producaoPieces, limiteMs);
      diaAcc.set(data, acc);
    }

    // Carência padrão (5 min) no fim da jornada (última faixa do dia).
    for (const data of allDays) {
      const janelas = janelasEscalaNoDia(data, escala).sort(
        (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
      );
      const janela = janelas[janelas.length - 1];
      if (!janela) continue;
      // Só aplica quando a jornada do dia já terminou (ou é dia passado).
      const limiteMs = limiteMsKpi(data);
      if (limiteMs != null && limiteMs < janela.endMs) continue;
      const acc = diaAcc.get(data) ?? emptyDiaAcc();

      const carenciaIni = Math.max(janela.endMs - CAMASI_CARENCIA_MS, janela.startMs);
      if (carenciaIni >= janela.endMs) {
        diaAcc.set(data, acc);
        continue;
      }

      let ultimoReal: number | null = null;
      let producaoAteFimEscala = false;
      for (const p of acc.producaoPieces) {
        if (ultimoReal == null || p.endMs > ultimoReal) ultimoReal = p.endMs;
        if (p.endMs >= janela.endMs - 500) producaoAteFimEscala = true;
      }
      for (const p of paradasValidas) {
        if (p.data !== data || isParadaJornadaAuto(p)) continue;
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t1 == null) continue;
        if (ultimoReal == null || t1 > ultimoReal) ultimoReal = t1;
      }

      let idleIni: number | null = null;
      const longFims: CamasiParadaValida[] = [];
      for (const p of paradasValidas) {
        if (p.data !== data || !isParadaFimAuto(p)) continue;
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null) continue;
        // FIM que começa antes da carência final (inclui faixa da manhã de um FIM 07:00–17:15).
        if (t0 < carenciaIni - 500) longFims.push(p);
      }

      if (longFims.length > 0) {
        const mantidasLong: CamasiParadaValida[] = [];
        for (const p of paradasValidas) {
          if (p.data === data && longFims.some((f) => f.id === p.id && f.inicioParado === p.inicioParado)) {
            debitarParadaRemovida(p, acc);
            const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
            const t1 = hmsParaMsNoDia(p.data, p.fimParado);
            if (t0 != null && t1 != null && t1 > t0) subtrairJornadaPeca(acc, { startMs: t0, endMs: t1 });
            continue;
          }
          mantidasLong.push(p);
        }
        paradasValidas.length = 0;
        paradasValidas.push(...mantidasLong);

        let minFim = Infinity;
        for (const p of longFims) {
          const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
          if (t0 != null && t0 < minFim) minFim = t0;
        }
        idleIni = Number.isFinite(minFim) ? minFim : carenciaIni;
        if (producaoAteFimEscala) {
          // Camasi ainda em produção no fim da escala (ex.: 14:54 → 01:54 do dia seguinte).
          idleIni = null;
        } else if (ultimoReal != null && ultimoReal >= carenciaIni) {
          idleIni = carenciaIni;
        } else if (ultimoReal != null && ultimoReal > idleIni) {
          idleIni = ultimoReal;
        }
      } else {
        for (const p of paradasValidas) {
          if (p.data !== data || !isParadaFimAuto(p)) continue;
          const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
          const t1 = hmsParaMsNoDia(p.data, p.fimParado);
          if (t0 == null || t1 == null) continue;
          if (ultimoReal != null && t1 <= ultimoReal + 500) continue;
          if (idleIni == null || t0 < idleIni) idleIni = t0;
        }
        if (idleIni == null) {
          if (ultimoReal != null && ultimoReal >= janela.startMs && ultimoReal < carenciaIni) {
            idleIni = ultimoReal;
          }
        }
        if (idleIni == null || idleIni >= carenciaIni || idleIni >= janela.endMs) {
          diaAcc.set(data, acc);
          continue;
        }
      }

      if (idleIni == null || idleIni >= janela.endMs) {
        diaAcc.set(data, acc);
        continue;
      }

      const corte: MsInterval = { startMs: idleIni, endMs: janela.endMs };

      const removidas: CamasiParadaValida[] = [];
      const mantidas: CamasiParadaValida[] = [];
      for (const p of paradasValidas) {
        if (p.data !== data || !isParadaFimAuto(p)) {
          mantidas.push(p);
          continue;
        }
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null || t1 <= corte.startMs || t0 >= corte.endMs) {
          mantidas.push(p);
          continue;
        }
        removidas.push(p);
        // Não mantém cabeça de FIM longo (viraria 07:00–17:10 como FIM JORNADA).
      }
      paradasValidas.length = 0;
      paradasValidas.push(...mantidas);

      for (const p of removidas) {
        debitarParadaRemovida(p, acc);
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 != null && t1 != null && t1 > t0) subtrairJornadaPeca(acc, { startMs: t0, endMs: t1 });
      }

      subtrairJornadaPeca(acc, corte);

      if (idleIni < carenciaIni) {
        const cobertos = pecasParadasDoDia(paradasValidas, data, escala);
        const brutos =
          escala && !escalaEstaVazia(escala)
            ? intervalosNaEscalaDoDia(data, idleIni, carenciaIni, escala)
            : [{ startMs: idleIni, endMs: carenciaIni }];
        for (const piece of subtrairIntervalos(brutos, cobertos)) {
          creditarParadaSintetica(
            acc,
            data,
            piece,
            CAMASI_PARADA_SEM_JUSTIFICATIVA,
            'operacional',
            CAMASI_OBS_FIM_ESCALA
          );
        }
      }

      creditarParadaSintetica(
        acc,
        data,
        { startMs: Math.max(carenciaIni, idleIni), endMs: janela.endMs },
        CAMASI_FIM_JORNADA_LABEL,
        'jornada',
        null
      );

      reconstruirPecasDoDia(acc, data);
      diaAcc.set(data, acc);
    }
  }

  const kpiDays = new Set(allDays);
  const periodoIni = opts?.dataIni;
  const periodoFim = opts?.dataFim;
  if (periodoIni && periodoFim && escala && !escalaEstaVazia(escala)) {
    const fimAteHoje = periodoFim < hojeYmd ? periodoFim : hojeYmd;
    for (const ymd of ymdsNoPeriodo(periodoIni, fimAteHoje)) {
      if (horasEscalaNoDia(ymd, escala) > 0) kpiDays.add(ymd);
    }
  }

  // Memorial = tabela: peças de parado vêm dos eventos já recortados (não apaga AJUSTE/SET UP).
  for (const data of kpiDays) {
    const acc = diaAcc.get(data) ?? emptyDiaAcc();
    reconstruirPecasDoDia(acc, data);
    diaAcc.set(data, acc);
  }

  // Com escala: produção na grade = intervalos da escala sem parada.
  // Com FIM_PRODUCAO congelado, não inventa "Em produção" depois do congelamento.
  if (escala && !escalaEstaVazia(escala)) {
    let idProd = 0;
    const freezeMs =
      linhaAberta?.tipo === 'parada' && linhaAberta.row.data === hojeYmd
        ? linhaAberta.startMs
        : null;
    for (const data of kpiDays) {
      const limiteMs = limiteMsEventos(data);
      const janelas = clipJanelasAte(janelasEscalaNoDia(data, escala), limiteMs);
      if (janelas.length === 0) continue;
      const acc = diaAcc.get(data) ?? emptyDiaAcc();
      const gaps = subtrairIntervalos(janelas, pecasNaEscalaDoDia(acc.paradoPieces, data, escala));
      const hitsPeca = pecasProducaoPorDia.get(data) ?? [];
      for (const gap of gaps) {
        const horas = (gap.endMs - gap.startMs) / MS_HORA;
        if (horas <= 0) continue;
        // Parado aguardando: qualquer gap no/após o FIM congelado não é produção.
        if (freezeMs != null && data === hojeYmd && gap.startMs >= freezeMs - 500) continue;
        // Evita linha fantasma de milissegundos no limite "agora".
        if (gap.endMs - gap.startMs < 1000) continue;
        idProd += 1;
        let peca = '—';
        let melhorOverlap = 0;
        for (const h of hitsPeca) {
          const a = Math.max(gap.startMs, h.startMs);
          const b = Math.min(gap.endMs, h.endMs);
          const ov = b - a;
          if (ov > melhorOverlap) {
            melhorOverlap = ov;
            peca = h.peca;
          }
        }
        const lives = liveEmProducao.get(data) ?? [];
        let justLive: string | null = null;
        for (const live of lives) {
          const a = Math.max(gap.startMs, live.startMs);
          const b = Math.min(gap.endMs, live.endMs);
          if (b > a) {
            justLive = CAMASI_EM_PRODUCAO;
            break;
          }
        }
        producaoValidas.push({
          id: -(10_000 + idProd),
          data,
          inicioProducao: msParaHmsLocal(gap.startMs),
          fimProducao: msParaHmsLocal(gap.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(gap.startMs, gap.endMs),
          peca,
          justificativa: justLive,
        });
      }
    }
  }

  const resumoDias: CamasiResumoDia[] = [];
  let horasEscalaAteAgoraSum = 0;
  for (const data of kpiDays) {
    const acc = diaAcc.get(data) ?? emptyDiaAcc();
    const uniao = pecasNaEscalaDoDia(acc.paradoPieces, data, escala);
    const paradoHorasRaw = horasDosIntervalos(uniao);
    const paradoOperacionalHoras = horasDosIntervalos(
      pecasNaEscalaDoDia(acc.operacionalPieces, data, escala)
    );
    const paradoJornadaHoras = horasDosIntervalos(pecasNaEscalaDoDia(acc.jornadaPieces, data, escala));
    const limiteMs = limiteMsKpi(data);
    const janelasFull = janelasEscalaNoDia(data, escala);
    // Card "tempo previsto": escala completa do dia (até o fim da jornada, ex. 17:15).
    const escalaHoras = horasDosIntervalos(janelasFull);
    // Indicadores: previsto decorrido até "agora"; produção = previsto − parado confirmado.
    const escalaHorasAteAgora = horasDosIntervalos(clipJanelasAte(janelasFull, limiteMs));
    horasEscalaAteAgoraSum += escalaHorasAteAgora;
    const paradoHoras =
      escalaHorasAteAgora > 0 ? Math.min(paradoHorasRaw, escalaHorasAteAgora) : paradoHorasRaw;
    const producaoHoras =
      escala && !escalaEstaVazia(escala)
        ? Math.max(0, escalaHorasAteAgora - paradoHoras)
        : 0;
    const temSobreposicao = acc.paradoSomaEventos - paradoHoras > 0.05;
    resumoDias.push({
      data,
      escalaHoras: roundHoras(escalaHoras),
      paradoHoras: roundHoras(paradoHoras),
      paradoOperacionalHoras: roundHoras(paradoOperacionalHoras),
      paradoJornadaHoras: roundHoras(paradoJornadaHoras),
      producaoHoras: roundHoras(producaoHoras),
      paradoSomaEventos: roundHoras(acc.paradoSomaEventos),
      temSobreposicao,
      qtdeParadas: acc.qtdeParadas,
    });

    const mes = data.slice(0, 7);
    const mAgg = mesMap.get(mes) ?? { horasProducao: 0, horasParado: 0 };
    mAgg.horasParado += paradoHoras;
    mAgg.horasProducao += producaoHoras;
    mesMap.set(mes, mAgg);
  }
  resumoDias.sort((a, b) => b.data.localeCompare(a.data));

  let horasParado = 0;
  let horasProducao = 0;
  let horasParadoOperacional = 0;
  let horasParadoJornada = 0;
  for (const d of resumoDias) {
    horasParado += d.paradoHoras;
    horasProducao += d.producaoHoras;
    horasParadoOperacional += d.paradoOperacionalHoras;
    horasParadoJornada += d.paradoJornadaHoras;
  }

  // Sem escala: fallback legado (soma por evento) para não zerar o painel.
  if (!escala || escalaEstaVazia(escala)) {
    horasProducao = 0;
    horasParado = 0;
    horasParadoOperacional = 0;
    horasParadoJornada = 0;
    for (const row of workRows) {
      horasProducao += row.horasProducao;
      horasParado += row.horasParado;
      if (row.horasParado > 0) {
        if (categoriaParadaCamasi(motivoLabel(row)) === 'jornada') {
          horasParadoJornada += row.horasParado;
        } else {
          horasParadoOperacional += row.horasParado;
        }
      }
    }
    mesMap.clear();
    for (const row of workRows) {
      const mes = row.data.slice(0, 7);
      const mAgg = mesMap.get(mes) ?? { horasProducao: 0, horasParado: 0 };
      mAgg.horasProducao += row.horasProducao;
      mAgg.horasParado += row.horasParado;
      mesMap.set(mes, mAgg);
    }
  }

  const total = horasProducao + horasParado;
  const horasEscalaFromDias = resumoDias.reduce((s, d) => s + d.escalaHoras, 0);
  // Previsto = escala do período filtrado (todos os dias do range), não só dias com evento Camasi.
  // opts.horasEscala vem de horasEscalaNoPeriodo(dataIni, dataFim) na rota.
  const horasEscala =
    opts?.horasEscala != null && Number.isFinite(opts.horasEscala) && opts.horasEscala >= 0
      ? opts.horasEscala
      : escala && !escalaEstaVazia(escala) && resumoDias.length > 0
        ? horasEscalaFromDias
        : null;
  // Disponibilidade no dia aberto: produção ÷ escala decorrida (até agora).
  // Não usa o previsto cheio do período (que inclui dias futuros sem evento).
  const baseDisp =
    escala && !escalaEstaVazia(escala) && horasEscalaAteAgoraSum > 0
      ? horasEscalaAteAgoraSum
      : horasEscala;
  const horasEscalaDecorrida =
    baseDisp != null && Number.isFinite(baseDisp) && baseDisp > 0 ? roundHoras(baseDisp) : null;
  const kpis: CamasiDashboardKpis = {
    horasProducao: roundHoras(horasProducao),
    horasParado: roundHoras(horasParado),
    horasParadoOperacional: roundHoras(horasParadoOperacional),
    horasParadoJornada: roundHoras(horasParadoJornada),
    horasEscala: horasEscala != null ? roundHoras(horasEscala) : null,
    horasEscalaDecorrida,
    disponibilidadePct:
      horasEscalaDecorrida != null && horasEscalaDecorrida > 0
        ? round1((horasProducao / horasEscalaDecorrida) * 100)
        : total > 0
          ? round1((horasProducao / total) * 100)
          : null,
    qtdeParadas,
    qtdeParadasOperacionais,
    qtdeParadasJornada,
  };

  const porMes: CamasiMesAgg[] = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      label: mesLabel(mes),
      horasProducao: roundHoras(v.horasProducao),
      horasParado: roundHoras(v.horasParado),
    }));

  const totalMotivo = [...motivoMap.values()].reduce((s, v) => s + v.horas, 0);
  const motivos: CamasiMotivoAgg[] = [...motivoMap.entries()]
    .map(([motivo, v]) => ({
      motivo,
      horas: roundHoras(v.horas),
      qtde: v.qtde,
      pct: totalMotivo > 0 ? round1((v.horas / totalMotivo) * 100) : 0,
    }))
    .sort((a, b) => b.horas - a.horas);

  const pecas: CamasiPecaAgg[] = [...pecaMap.entries()]
    .map(([peca, v]) => ({
      peca,
      horasProducao: roundHoras(v.horasProducao),
      horasParado: roundHoras(v.horasParado),
    }))
    .sort((a, b) => b.horasProducao + b.horasParado - (a.horasProducao + a.horasParado));

  const pioresDiasParado: CamasiDiaParadoAgg[] = resumoDias
    .map((d) => ({
      data: d.data,
      horas: d.paradoHoras,
      qtde: d.qtdeParadas,
      pct: horasParado > 0 ? round1((d.paradoHoras / horasParado) * 100) : 0,
    }))
    .sort((a, b) => b.horas - a.horas || b.qtde - a.qtde)
    .slice(0, TOP_DIAS_PARADO);

  paradasValidas.sort(
    (a, b) =>
      b.data.localeCompare(a.data) ||
      (a.inicioParado ?? '99:99:99').localeCompare(b.inicioParado ?? '99:99:99') ||
      a.id - b.id
  );
  producaoValidas.sort(
    (a, b) =>
      b.data.localeCompare(a.data) ||
      (a.inicioProducao ?? '99:99:99').localeCompare(b.inicioProducao ?? '99:99:99') ||
      a.id - b.id
  );

  return { kpis, porMes, motivos, pecas, pioresDiasParado, paradasValidas, producaoValidas, resumoDias };
}

export function buildDiasDoMes(
  rows: TempoProducaoRow[],
  mes: string,
  tipo: 'producao' | 'parado',
  escala?: RecursoEscala | null
): { dias: CamasiDiaAgg[]; totalHoras: number } {
  if (tipo === 'parado' && escala && !escalaEstaVazia(escala)) {
    const byDay = new Map<string, MsInterval[]>();
    for (const row of rows) {
      if (!row.data.startsWith(mes) || row.horasParado <= 0) continue;
      const iv = intervaloEfetivoMs(row.data, row.inicioParado, row.fimParado, 'parado');
      if (!iv) continue;
      const pieces = intervalosNaEscalaDoDia(row.data, iv.startMs, iv.endMs, escala);
      const acc = byDay.get(row.data) ?? [];
      acc.push(...pieces);
      byDay.set(row.data, acc);
    }
    const diaMap = new Map<string, number>();
    for (const [data, pieces] of byDay) {
      diaMap.set(data, horasDosIntervalos(unirIntervalos(pieces)));
    }
    const totalHoras = roundHoras([...diaMap.values()].reduce((s, h) => s + h, 0));
    const dias = [...diaMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, horas]) => ({ data, horas: roundHoras(horas) }));
    return { dias, totalHoras };
  }

  const diaMap = new Map<string, number>();
  for (const row of rows) {
    if (!row.data.startsWith(mes)) continue;
    const h = tipo === 'producao' ? row.horasProducao : row.horasParado;
    if (h <= 0) continue;
    diaMap.set(row.data, (diaMap.get(row.data) ?? 0) + h);
  }
  const totalHoras = roundHoras([...diaMap.values()].reduce((s, h) => s + h, 0));
  const dias = [...diaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, horas]) => ({ data, horas: roundHoras(horas) }));
  return { dias, totalHoras };
}
