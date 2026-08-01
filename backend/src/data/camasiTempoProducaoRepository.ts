/**
 * TEMPO_PRODUCAO (Camasi / RICMAQ) — leitura e agregações do painel.
 */

import { queryCamasi } from '../config/camasiFirebirdDb.js';

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
  disponibilidadePct: number | null;
  qtdeParadas: number;
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

export type CamasiDiaAgg = {
  data: string; // YYYY-MM-DD
  horas: number;
};

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

export async function listTempoProducao(dataIni: string, dataFim: string): Promise<TempoProducaoRow[]> {
  const raw = await queryCamasi<Record<string, unknown>>(SQL_TEMPO_PRODUCAO, [dataIni, dataFim]);
  const out: TempoProducaoRow[] = [];
  for (const r of raw) {
    const mapped = mapRow(r);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function buildDashboardResumo(rows: TempoProducaoRow[]): {
  kpis: CamasiDashboardKpis;
  porMes: CamasiMesAgg[];
  motivos: CamasiMotivoAgg[];
  pecas: CamasiPecaAgg[];
} {
  let horasProducao = 0;
  let horasParado = 0;
  let qtdeParadas = 0;

  const mesMap = new Map<string, { horasProducao: number; horasParado: number }>();
  const motivoMap = new Map<string, { horas: number; qtde: number }>();
  const pecaMap = new Map<string, { horasProducao: number; horasParado: number }>();

  for (const row of rows) {
    horasProducao += row.horasProducao;
    horasParado += row.horasParado;
    if (row.horasParado > 0) qtdeParadas += 1;

    const mes = row.data.slice(0, 7);
    const mAgg = mesMap.get(mes) ?? { horasProducao: 0, horasParado: 0 };
    mAgg.horasProducao += row.horasProducao;
    mAgg.horasParado += row.horasParado;
    mesMap.set(mes, mAgg);

    if (row.horasParado > 0) {
      const motivo = motivoLabel(row);
      const mot = motivoMap.get(motivo) ?? { horas: 0, qtde: 0 };
      mot.horas += row.horasParado;
      mot.qtde += 1;
      motivoMap.set(motivo, mot);
    }

    const peca = pecaLabel(row);
    const pAgg = pecaMap.get(peca) ?? { horasProducao: 0, horasParado: 0 };
    pAgg.horasProducao += row.horasProducao;
    pAgg.horasParado += row.horasParado;
    pecaMap.set(peca, pAgg);
  }

  const total = horasProducao + horasParado;
  const kpis: CamasiDashboardKpis = {
    horasProducao: round1(horasProducao),
    horasParado: round1(horasParado),
    disponibilidadePct: total > 0 ? round1((horasProducao / total) * 100) : null,
    qtdeParadas,
  };

  const porMes: CamasiMesAgg[] = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      label: mesLabel(mes),
      horasProducao: round1(v.horasProducao),
      horasParado: round1(v.horasParado),
    }));

  const totalMotivo = [...motivoMap.values()].reduce((s, v) => s + v.horas, 0);
  const motivos: CamasiMotivoAgg[] = [...motivoMap.entries()]
    .map(([motivo, v]) => ({
      motivo,
      horas: round1(v.horas),
      qtde: v.qtde,
      pct: totalMotivo > 0 ? round1((v.horas / totalMotivo) * 100) : 0,
    }))
    .sort((a, b) => b.horas - a.horas);

  const pecas: CamasiPecaAgg[] = [...pecaMap.entries()]
    .map(([peca, v]) => ({
      peca,
      horasProducao: round1(v.horasProducao),
      horasParado: round1(v.horasParado),
    }))
    .sort((a, b) => b.horasProducao + b.horasParado - (a.horasProducao + a.horasParado));

  return { kpis, porMes, motivos, pecas };
}

export function buildDiasDoMes(
  rows: TempoProducaoRow[],
  mes: string,
  tipo: 'producao' | 'parado'
): { dias: CamasiDiaAgg[]; totalHoras: number } {
  const diaMap = new Map<string, number>();
  for (const row of rows) {
    if (!row.data.startsWith(mes)) continue;
    const h = tipo === 'producao' ? row.horasProducao : row.horasParado;
    if (h <= 0) continue;
    diaMap.set(row.data, (diaMap.get(row.data) ?? 0) + h);
  }
  const totalHoras = round1([...diaMap.values()].reduce((s, h) => s + h, 0));
  const dias = [...diaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, horas]) => ({ data, horas: round1(horas) }));
  return { dias, totalHoras };
}
