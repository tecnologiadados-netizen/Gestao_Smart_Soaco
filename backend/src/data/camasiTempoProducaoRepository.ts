/**
 * TEMPO_PRODUCAO (Camasi / RICMAQ) — leitura e agregações do painel.
 */

import { queryCamasi } from '../config/camasiFirebirdDb.js';
import {
  escalaEstaVazia,
  horasDosIntervalos,
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
export const CAMASI_PARADA_SEM_JUSTIFICATIVA = 'Sem justificativa';
/** Parada em andamento no dia corrente ainda sem motivo na Camasi. */
export const CAMASI_AGUARDANDO_JUSTIFICATIVA = 'Aguardando justificativa';
/** Produção em andamento (INICIO_PRODUCAO sem FIM no dia corrente). */
export const CAMASI_EM_PRODUCAO = 'Em produção';

export const CAMASI_INICIO_JORNADA_LABEL = 'INÍCIO JORNADA';
export const CAMASI_FIM_JORNADA_LABEL = 'FIM JORNADA';

export const CAMASI_OBS_INICIO_ESCALA = 'Cortado automaticamente: início da escala';
export const CAMASI_OBS_FIM_ESCALA = 'Cortado automaticamente: fim da escala';
export const CAMASI_OBS_PARADA_INFERIDA = 'Inferido: último fim de produção sem parada registrada';
export const CAMASI_OBS_PRODUCAO_ABERTA = 'Em andamento na Camasi (sem fim de produção)';
export const CAMASI_OBS_PARADA_ABERTA = 'Em andamento na Camasi (sem fim de parada)';

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
};

export type CamasiProducaoValida = {
  id: number;
  data: string;
  inicioProducao: string | null;
  fimProducao: string | null;
  horas: number;
  minutos: number;
  peca: string;
  /** Ex.: "Em produção" quando o trecho está em andamento no dia corrente. */
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

const SQL_TEMPO_PRODUCAO = `
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
    tp.NOME_MOTIVO,
    tp.OBS_MOTIVO,
    tp.OPERADOR,
    tp.NOME_OPERADOR
FROM TEMPO_PRODUCAO tp
WHERE tp."DATA" BETWEEN ? AND ?
ORDER BY tp.ID DESC
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
 * Linha Camasi utilizável no painel.
 * No dia corrente, só entra linha com parada fechada (INÍCIO e FIM_PARADO).
 * Linha atual só com produção (parada NULL) é ignorada por completo — produção
 * dessa linha só entra quando a Camasi gravar a parada.
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

/**
 * Dia corrente incompleto: não projeta FIM JORNADA até o fim da escala.
 * Cobertura registrada só até o fim da última linha com parada fechada
 * (não inventa produção/parada até "agora").
 */
function buildLimiteMsDoDia(
  hojeYmd: string,
  agoraMs: number,
  workRows: TempoProducaoRow[]
): (data: string) => number | null {
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

  return (data: string): number | null => {
    if (data !== hojeYmd) return null;
    if (fimCoberturaHoje == null) return 0; // sem linha fechada hoje: nada projetar
    return Math.min(agoraMs, fimCoberturaHoje);
  };
}

/**
 * @deprecated Mantido vazio: não inferimos mais status ao vivo da Camasi.
 * Produção/parada abertas do dia corrente são descartadas em `linhaCamasiUtilizavel`.
 */
function normalizarEventosAbertosDiaCorrente(
  rows: TempoProducaoRow[],
  _hojeYmd: string,
  _agoraMs: number,
  _escala: RecursoEscala | null
): { rows: TempoProducaoRow[]; liveEmProducao: Map<string, MsInterval[]> } {
  return { rows: rows.map((r) => ({ ...r })), liveEmProducao: new Map() };
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

function mapRow(raw: Record<string, unknown>): TempoProducaoRow | null {
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

export async function listTempoProducao(
  dataIni: string,
  dataFim: string,
  escala?: RecursoEscala | null
): Promise<TempoProducaoRow[]> {
  const raw = await queryCamasi<Record<string, unknown>>(SQL_TEMPO_PRODUCAO, [dataIni, dataFim]);
  const out: TempoProducaoRow[] = [];
  for (const r of raw) {
    const mapped = mapRow(r);
    if (mapped) out.push(aplicarEscalaNaRow(mapped, escala));
  }
  return out;
}

export function buildDashboardResumo(
  rows: TempoProducaoRow[],
  opts?: { horasEscala?: number | null; escala?: RecursoEscala | null; agoraMs?: number }
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
  const rowsFechadas = rows.filter((r) => linhaCamasiUtilizavel(r, hojeYmd));
  const { rows: workRows, liveEmProducao } = normalizarEventosAbertosDiaCorrente(
    rowsFechadas,
    hojeYmd,
    agoraMs,
    escala
  );
  const limiteMsDoDia = buildLimiteMsDoDia(hojeYmd, agoraMs, workRows);

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

  // Carência padrão (5 min) no início da jornada: se não houver registro até +5 min,
  // gera INÍCIO JORNADA (carência) + Sem justificativa até o 1º registro real.
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

      const idleFim = primeiroRegistro ?? janela.endMs;
      if (idleFim <= janela.startMs) {
        diaAcc.set(data, acc);
        continue;
      }

      const corte: MsInterval = { startMs: janela.startMs, endMs: idleFim };

      // Remove cobertura anterior no trecho (ex.: INÍCIO JORNADA Camasi 07:00–08:43).
      const removidas: CamasiParadaValida[] = [];
      const mantidas: CamasiParadaValida[] = [];
      for (const p of paradasValidas) {
        if (p.data !== data || !isParadaInicioAuto(p)) {
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
        // Mantém eventual cauda após o 1º registro (raro).
        if (t1 > corte.endMs + 500) {
          const tailStart = Math.max(t0, corte.endMs);
          const horasTail = (t1 - tailStart) / MS_HORA;
          if (horasTail > 0) {
            mantidas.push({
              ...p,
              inicioParado: msParaHmsLocal(tailStart),
              fimParado: msParaHmsLocal(t1),
              horas: roundHoras(horasTail),
              minutos: minutosEntreMs(tailStart, t1),
            });
          }
        }
      }
      paradasValidas.length = 0;
      paradasValidas.push(...mantidas);

      for (const p of removidas) {
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
      }

      acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [corte]);
      acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [corte]);
      acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [corte]);

      const pedacoCarencia: MsInterval = {
        startMs: janela.startMs,
        endMs: Math.min(carenciaFim, idleFim),
      };
      if (pedacoCarencia.endMs > pedacoCarencia.startMs) {
        const horas = (pedacoCarencia.endMs - pedacoCarencia.startMs) / MS_HORA;
        idSintetico += 1;
        qtdeParadas += 1;
        qtdeParadasJornada += 1;
        const motivoInicio = CAMASI_INICIO_JORNADA_LABEL;
        const motIni = motivoMap.get(motivoInicio) ?? { horas: 0, qtde: 0 };
        motIni.horas += horas;
        motIni.qtde += 1;
        motivoMap.set(motivoInicio, motIni);
        pushParadaPeca(acc, [pedacoCarencia], 'jornada', horas);
        paradasValidas.push({
          id: -idSintetico,
          data,
          inicioParado: msParaHmsLocal(pedacoCarencia.startMs),
          fimParado: msParaHmsLocal(pedacoCarencia.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(pedacoCarencia.startMs, pedacoCarencia.endMs),
          peca: '(sem peça)',
          justificativa: motivoInicio,
          observacao: null,
          categoria: 'jornada',
        });
      }

      if (idleFim > carenciaFim) {
        const pedacoSem: MsInterval = { startMs: carenciaFim, endMs: idleFim };
        const horas = (pedacoSem.endMs - pedacoSem.startMs) / MS_HORA;
        idSintetico += 1;
        qtdeParadas += 1;
        qtdeParadasOperacionais += 1;
        const motivo = CAMASI_PARADA_SEM_JUSTIFICATIVA;
        const mot = motivoMap.get(motivo) ?? { horas: 0, qtde: 0 };
        mot.horas += horas;
        mot.qtde += 1;
        motivoMap.set(motivo, mot);
        pushParadaPeca(acc, [pedacoSem], 'operacional', horas);
        paradasValidas.push({
          id: -idSintetico,
          data,
          inicioParado: msParaHmsLocal(pedacoSem.startMs),
          fimParado: msParaHmsLocal(pedacoSem.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(pedacoSem.startMs, pedacoSem.endMs),
          peca: '(sem peça)',
          justificativa: motivo,
          observacao: CAMASI_OBS_INICIO_ESCALA,
          categoria: 'operacional',
        });
      }

      diaAcc.set(data, acc);
    }

    // Dia corrente incompleto: não projetar FIM JORNADA / ociosidade até o fim da escala.
    // Cobertura só até o fim da última linha com parada fechada (não inventa até "agora").
    for (const data of allDays) {
      const limiteMs = limiteMsDoDia(data);
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
      const limiteMs = limiteMsDoDia(data);
      if (limiteMs != null && limiteMs < janela.endMs) continue;
      const acc = diaAcc.get(data) ?? emptyDiaAcc();

      const carenciaIni = Math.max(janela.endMs - CAMASI_CARENCIA_MS, janela.startMs);
      if (carenciaIni >= janela.endMs) {
        diaAcc.set(data, acc);
        continue;
      }

      let ultimoReal: number | null = null;
      for (const p of acc.producaoPieces) {
        if (ultimoReal == null || p.endMs > ultimoReal) ultimoReal = p.endMs;
      }
      for (const p of paradasValidas) {
        if (p.data !== data || isParadaJornadaAuto(p)) continue;
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t1 == null) continue;
        if (ultimoReal == null || t1 > ultimoReal) ultimoReal = t1;
      }

      let idleIni: number | null = null;
      for (const p of paradasValidas) {
        if (p.data !== data || !isParadaFimAuto(p)) continue;
        const t0 = hmsParaMsNoDia(p.data, p.inicioParado);
        const t1 = hmsParaMsNoDia(p.data, p.fimParado);
        if (t0 == null || t1 == null) continue;
        // Qualquer FIM JORNADA após o último registro real (cobre manhã+tarde quando há intervalo).
        if (ultimoReal != null && t1 <= ultimoReal + 500) continue;
        if (idleIni == null || t0 < idleIni) idleIni = t0;
      }
      if (idleIni == null) {
        // Sem FIM JORNADA: só se o último real estiver na última faixa, antes da carência.
        if (ultimoReal != null && ultimoReal >= janela.startMs && ultimoReal < carenciaIni) {
          idleIni = ultimoReal;
        }
      }

      if (idleIni == null || idleIni >= carenciaIni || idleIni >= janela.endMs) {
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
        // Mantém eventual cabeça antes do idle (raro).
        if (t0 < corte.startMs - 500) {
          const headEnd = Math.min(t1, corte.startMs);
          const horasHead = (headEnd - t0) / MS_HORA;
          if (horasHead > 0) {
            mantidas.push({
              ...p,
              inicioParado: msParaHmsLocal(t0),
              fimParado: msParaHmsLocal(headEnd),
              horas: roundHoras(horasHead),
              minutos: minutosEntreMs(t0, headEnd),
            });
          }
        }
      }
      paradasValidas.length = 0;
      paradasValidas.push(...mantidas);

      for (const p of removidas) {
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
      }

      acc.paradoPieces = subtrairIntervalos(acc.paradoPieces, [corte]);
      acc.jornadaPieces = subtrairIntervalos(acc.jornadaPieces, [corte]);
      acc.operacionalPieces = subtrairIntervalos(acc.operacionalPieces, [corte]);

      if (idleIni < carenciaIni) {
        const pedacoSem: MsInterval = { startMs: idleIni, endMs: carenciaIni };
        const horas = (pedacoSem.endMs - pedacoSem.startMs) / MS_HORA;
        idSintetico += 1;
        qtdeParadas += 1;
        qtdeParadasOperacionais += 1;
        const motivo = CAMASI_PARADA_SEM_JUSTIFICATIVA;
        const mot = motivoMap.get(motivo) ?? { horas: 0, qtde: 0 };
        mot.horas += horas;
        mot.qtde += 1;
        motivoMap.set(motivo, mot);
        pushParadaPeca(acc, [pedacoSem], 'operacional', horas);
        paradasValidas.push({
          id: -idSintetico,
          data,
          inicioParado: msParaHmsLocal(pedacoSem.startMs),
          fimParado: msParaHmsLocal(pedacoSem.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(pedacoSem.startMs, pedacoSem.endMs),
          peca: '(sem peça)',
          justificativa: motivo,
          observacao: CAMASI_OBS_FIM_ESCALA,
          categoria: 'operacional',
        });
      }

      const pedacoCarencia: MsInterval = {
        startMs: Math.max(carenciaIni, idleIni),
        endMs: janela.endMs,
      };
      if (pedacoCarencia.endMs > pedacoCarencia.startMs) {
        const horas = (pedacoCarencia.endMs - pedacoCarencia.startMs) / MS_HORA;
        idSintetico += 1;
        qtdeParadas += 1;
        qtdeParadasJornada += 1;
        const motivoFim = CAMASI_FIM_JORNADA_LABEL;
        const motFim = motivoMap.get(motivoFim) ?? { horas: 0, qtde: 0 };
        motFim.horas += horas;
        motFim.qtde += 1;
        motivoMap.set(motivoFim, motFim);
        pushParadaPeca(acc, [pedacoCarencia], 'jornada', horas);
        paradasValidas.push({
          id: -idSintetico,
          data,
          inicioParado: msParaHmsLocal(pedacoCarencia.startMs),
          fimParado: msParaHmsLocal(pedacoCarencia.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(pedacoCarencia.startMs, pedacoCarencia.endMs),
          peca: '(sem peça)',
          justificativa: motivoFim,
          observacao: null,
          categoria: 'jornada',
        });
      }

      diaAcc.set(data, acc);
    }
  }

  // Com escala: produção na grade = intervalos da escala sem parada (entre uma parada e outra).
  if (escala && !escalaEstaVazia(escala)) {
    let idProd = 0;
    for (const data of allDays) {
      const limiteMs = limiteMsDoDia(data);
      const janelas = clipJanelasAte(janelasEscalaNoDia(data, escala), limiteMs);
      if (janelas.length === 0) continue;
      const acc = diaAcc.get(data) ?? emptyDiaAcc();
      const gaps = subtrairIntervalos(janelas, unirIntervalos(acc.paradoPieces));
      const hitsPeca = pecasProducaoPorDia.get(data) ?? [];
      for (const gap of gaps) {
        const horas = (gap.endMs - gap.startMs) / MS_HORA;
        if (horas <= 0) continue;
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
        producaoValidas.push({
          id: -(10_000 + idProd),
          data,
          inicioProducao: msParaHmsLocal(gap.startMs),
          fimProducao: msParaHmsLocal(gap.endMs),
          horas: roundHoras(horas),
          minutos: minutosEntreMs(gap.startMs, gap.endMs),
          peca,
          justificativa: (() => {
            const lives = liveEmProducao.get(data) ?? [];
            for (const live of lives) {
              const a = Math.max(gap.startMs, live.startMs);
              const b = Math.min(gap.endMs, live.endMs);
              if (b > a) return CAMASI_EM_PRODUCAO;
            }
            return null;
          })(),
        });
      }
    }
  }

  const resumoDias: CamasiResumoDia[] = [];
  let horasEscalaAteAgoraSum = 0;
  for (const data of allDays) {
    const acc = diaAcc.get(data) ?? emptyDiaAcc();
    const uniao = unirIntervalos(acc.paradoPieces);
    const paradoHoras = horasDosIntervalos(uniao);
    const paradoOperacionalHoras = horasDosIntervalos(unirIntervalos(acc.operacionalPieces));
    const paradoJornadaHoras = horasDosIntervalos(unirIntervalos(acc.jornadaPieces));
    const limiteMs = limiteMsDoDia(data);
    const janelasFull = janelasEscalaNoDia(data, escala);
    // Card "tempo previsto": escala completa do dia (até o fim da jornada, ex. 17:15).
    const escalaHoras = horasDosIntervalos(janelasFull);
    // Produção no dia corrente: só até "agora" (não inventa o futuro).
    const escalaHorasAteAgora = horasDosIntervalos(clipJanelasAte(janelasFull, limiteMs));
    horasEscalaAteAgoraSum += escalaHorasAteAgora;
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
