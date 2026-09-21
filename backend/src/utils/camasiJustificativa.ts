import {
  CAMASI_AGUARDANDO_JUSTIFICATIVA,
  CAMASI_EM_PRODUCAO,
  CAMASI_FIM_JORNADA_LABEL,
  CAMASI_INICIO_JORNADA_LABEL,
  CAMASI_OBS_FIM_ESCALA,
  CAMASI_OBS_INICIO_ESCALA,
  CAMASI_PARADA_SEM_JUSTIFICATIVA,
  type CamasiMotivoAgg,
  type CamasiParadaValida,
} from '../data/camasiTempoProducaoRepository.js';
import { isMotivoJornadaCamasi } from './camasiMotivoJornada.js';

export function chaveParadaJustificativa(p: {
  data: string;
  inicioParado?: string | null;
  fimParado?: string | null;
  observacao?: string | null;
}): string {
  return `${p.data}|${p.inicioParado ?? ''}|${p.fimParado ?? ''}|${p.observacao ?? ''}`;
}

export function isParadaJustificativaEditavel(p: {
  observacao: string | null;
}): boolean {
  const obs = (p.observacao ?? '').trim();
  return obs === CAMASI_OBS_INICIO_ESCALA || obs === CAMASI_OBS_FIM_ESCALA;
}

export function normalizarNomeJustificativa(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const RESERVADOS = new Set(
  [
    CAMASI_PARADA_SEM_JUSTIFICATIVA,
    CAMASI_AGUARDANDO_JUSTIFICATIVA,
    CAMASI_EM_PRODUCAO,
    CAMASI_INICIO_JORNADA_LABEL,
    CAMASI_FIM_JORNADA_LABEL,
  ].map(normalizarNomeJustificativa)
);

export function nomeJustificativaReservado(nome: string): boolean {
  const n = normalizarNomeJustificativa(nome);
  if (!n) return true;
  if (RESERVADOS.has(n)) return true;
  return isMotivoJornadaCamasi(nome);
}

export function aplicarJustificativasManuais(
  paradas: CamasiParadaValida[],
  manuais: { data: string; inicioParado: string; fimParado: string; observacaoOrigem: string; nome: string }[]
): void {
  const map = new Map<string, string>();
  for (const m of manuais) {
    map.set(
      chaveParadaJustificativa({
        data: m.data,
        inicioParado: m.inicioParado,
        fimParado: m.fimParado,
        observacao: m.observacaoOrigem,
      }),
      m.nome
    );
  }
  for (const p of paradas) {
    const editavel = isParadaJustificativaEditavel(p);
    p.justificativaEditavel = editavel;
    if (!editavel) continue;
    const nome = map.get(chaveParadaJustificativa(p));
    if (nome) p.justificativa = nome;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundHoras(n: number): number {
  return Math.round(n * 3600) / 3600;
}

export function motivosAPartirDeParadas(paradas: CamasiParadaValida[]): CamasiMotivoAgg[] {
  const map = new Map<string, { horas: number; qtde: number }>();
  for (const p of paradas) {
    const mot = map.get(p.justificativa) ?? { horas: 0, qtde: 0 };
    mot.horas += p.horas;
    mot.qtde += 1;
    map.set(p.justificativa, mot);
  }
  const total = [...map.values()].reduce((s, v) => s + v.horas, 0);
  return [...map.entries()]
    .map(([motivo, v]) => ({
      motivo,
      horas: roundHoras(v.horas),
      qtde: v.qtde,
      pct: total > 0 ? round1((v.horas / total) * 100) : 0,
    }))
    .sort((a, b) => b.horas - a.horas);
}
