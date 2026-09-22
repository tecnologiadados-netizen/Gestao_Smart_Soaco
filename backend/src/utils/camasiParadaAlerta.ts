/**
 * Alerta WhatsApp de parada da Camasi (perfiladeira).
 *
 * Regras:
 * - Arma no corte de carência (início da escala + 5 min, ex. 07:05).
 * - 1º envio após 20 min contínuos parado depois desse corte (sem produção no dia).
 * - Só reenvia se houver movimentação de produção e, em seguida, mais 20 min direto parado.
 * - Não reenvia a cada 20 min na mesma ociosidade.
 */

import {
  CAMASI_AGUARDANDO_JUSTIFICATIVA,
  CAMASI_CARENCIA_MS,
  CAMASI_FIM_PRODUCAO_VIVO_MS,
  CAMASI_PARADA_SEM_JUSTIFICATIVA,
  type TempoProducaoRow,
} from '../data/camasiTempoProducaoRepository.js';
import {
  janelasEscalaNoDia,
  type RecursoEscala,
} from './recursoEscalaTrabalho.js';

export const CAMASI_PARADA_ALERTA_LIMIAR_MS = 20 * 60 * 1000;

export type CamasiParadaAlertaEstadoMem = {
  data: string;
  inicioEnviado: boolean;
  ultimaProducaoFim: string | null;
  posProducaoEnviado: boolean;
};

export type CamasiParadaAlertaTipoEnvio = 'inicio' | 'pos_producao';

export type CamasiParadaAlertaDecisao = {
  acao: 'skip' | 'send';
  motivo: string;
  tipoEnvio?: CamasiParadaAlertaTipoEnvio;
  mensagem?: string;
  next: CamasiParadaAlertaEstadoMem;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ymdLocalDeMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function hmsParaMsNoDia(ymd: string, hms: string | null | undefined): number | null {
  if (!hms) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hms).trim());
  if (!m) return null;
  const [y, mo, d] = ymd.split('-').map(Number);
  if (![y, mo, d].every((n) => Number.isFinite(n))) return null;
  return new Date(y!, mo! - 1, d!, Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0).getTime();
}

function msParaHhMm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function temHorario(hms: string | null | undefined): boolean {
  return hms != null && String(hms).trim() !== '';
}

/** Produção real: início ≠ fim (descarta dummy 06:00/07:00 mapeado). */
export function isProducaoRealCamasi(row: Pick<TempoProducaoRow, 'inicioProducao' | 'fimProducao'>): boolean {
  if (!temHorario(row.inicioProducao) || !temHorario(row.fimProducao)) return false;
  return String(row.inicioProducao).trim() !== String(row.fimProducao).trim();
}

function pecaLabel(row: TempoProducaoRow): string {
  return row.nomeOperador?.trim() || row.operador?.trim() || '(sem receita)';
}

export function estadoAlertaVazio(data: string): CamasiParadaAlertaEstadoMem {
  return {
    data,
    inicioEnviado: false,
    ultimaProducaoFim: null,
    posProducaoEnviado: false,
  };
}

export function montarMensagemAlertaParadaCamasi(input: {
  maquina: string;
  minutos: number;
  desdeMs: number;
  peca: string;
  motivo: string;
}): string {
  const minutos = Math.max(1, Math.round(input.minutos));
  return [
    `⚠️ ${input.maquina} parada há ${minutos} min.`,
    '',
    `Desde: ${msParaHhMm(input.desdeMs)}`,
    `Receita configurada: ${input.peca || '(sem receita)'}`,
    `Motivo: ${input.motivo}`,
    '',
    'Desloquem até a máquina para averiguar.',
  ].join('\n');
}

function ultimaProducaoReal(
  rows: TempoProducaoRow[],
  ymd: string
): (TempoProducaoRow & { startMs: number; fimMs: number }) | null {
  const doDia = rows.filter((r) => r.data === ymd && isProducaoRealCamasi(r));
  let best: (TempoProducaoRow & { startMs: number; fimMs: number }) | null = null;
  for (const row of doDia) {
    const startMs = hmsParaMsNoDia(ymd, row.inicioProducao);
    const fimMs = hmsParaMsNoDia(ymd, row.fimProducao);
    if (startMs == null || fimMs == null || startMs >= fimMs) continue;
    if (!best || fimMs > best.fimMs || (fimMs === best.fimMs && row.id > best.id)) {
      best = { ...row, startMs, fimMs };
    }
  }
  return best;
}

function agoraNaEscala(agoraMs: number, janelas: { startMs: number; endMs: number }[]): boolean {
  return janelas.some((j) => agoraMs >= j.startMs && agoraMs < j.endMs);
}

export function avaliarAlertaParadaCamasi(input: {
  agoraMs: number;
  escala: RecursoEscala | null | undefined;
  rows: TempoProducaoRow[];
  estado: CamasiParadaAlertaEstadoMem | null;
  maquina?: string;
  vivoMs?: number;
  carenciaMs?: number;
  limiarMs?: number;
}): CamasiParadaAlertaDecisao {
  const agoraMs = input.agoraMs;
  const ymd = ymdLocalDeMs(agoraMs);
  const vivoMs = input.vivoMs ?? CAMASI_FIM_PRODUCAO_VIVO_MS;
  const carenciaMs = input.carenciaMs ?? CAMASI_CARENCIA_MS;
  const limiarMs = input.limiarMs ?? CAMASI_PARADA_ALERTA_LIMIAR_MS;
  const maquina = (input.maquina ?? 'Perfiladeira').trim() || 'Perfiladeira';

  const prev =
    input.estado && input.estado.data === ymd ? input.estado : estadoAlertaVazio(ymd);
  const next: CamasiParadaAlertaEstadoMem = { ...prev, data: ymd };

  const skip = (motivo: string, patch?: Partial<CamasiParadaAlertaEstadoMem>): CamasiParadaAlertaDecisao => ({
    acao: 'skip',
    motivo,
    next: { ...next, ...patch },
  });

  const janelas = janelasEscalaNoDia(ymd, input.escala).sort(
    (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
  );
  if (janelas.length === 0) return skip('sem_escala_hoje');

  const janela0 = janelas[0]!;
  const corteMs = Math.min(janela0.startMs + carenciaMs, janela0.endMs);
  if (corteMs <= janela0.startMs) return skip('carencia_invalida');

  if (agoraMs < corteMs) return skip('ainda_na_carencia');
  if (!agoraNaEscala(agoraMs, janelas)) return skip('fora_da_escala');

  const lastProd = ultimaProducaoReal(input.rows, ymd);
  const produzindo = lastProd != null && agoraMs - lastProd.fimMs <= vivoMs;

  if (produzindo && lastProd) {
    const fimHms = lastProd.fimProducao;
    return skip('produzindo', {
      ultimaProducaoFim: fimHms,
      posProducaoEnviado: false,
    });
  }

  if (!lastProd) {
    if (prev.inicioEnviado) return skip('inicio_ja_enviado');
    const paradoMs = agoraMs - corteMs;
    if (paradoMs < limiarMs) return skip('aguardando_20min_inicio');
    const mensagem = montarMensagemAlertaParadaCamasi({
      maquina,
      minutos: paradoMs / 60_000,
      desdeMs: corteMs,
      peca: '',
      motivo: CAMASI_PARADA_SEM_JUSTIFICATIVA,
    });
    return {
      acao: 'send',
      motivo: 'inicio_20min',
      tipoEnvio: 'inicio',
      mensagem,
      next: { ...next, inicioEnviado: true },
    };
  }

  const stopStartMs = lastProd.fimMs;
  const fimKey = lastProd.fimProducao;
  const mesmoEpisodio = prev.ultimaProducaoFim === fimKey;
  if (mesmoEpisodio && prev.posProducaoEnviado) {
    return skip('pos_producao_ja_enviado', { ultimaProducaoFim: fimKey });
  }

  const paradoMs = agoraMs - stopStartMs;
  if (paradoMs < limiarMs) {
    return skip('aguardando_20min_pos_producao', {
      ultimaProducaoFim: fimKey,
      posProducaoEnviado: false,
    });
  }

  const mensagem = montarMensagemAlertaParadaCamasi({
    maquina,
    minutos: paradoMs / 60_000,
    desdeMs: stopStartMs,
    peca: pecaLabel(lastProd),
    motivo: CAMASI_AGUARDANDO_JUSTIFICATIVA,
  });
  return {
    acao: 'send',
    motivo: 'pos_producao_20min',
    tipoEnvio: 'pos_producao',
    mensagem,
    next: {
      ...next,
      inicioEnviado: prev.inicioEnviado,
      ultimaProducaoFim: fimKey,
      posProducaoEnviado: true,
    },
  };
}
