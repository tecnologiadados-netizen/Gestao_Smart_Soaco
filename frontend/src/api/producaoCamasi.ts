import { apiFetch, apiJson } from './client';
import type { ProgramacaoProducaoRecurso, RecursoEscalaExcecao } from '../components/programacao-producao/types';

export type CamasiStatusResponse = {
  ok: boolean;
  enabled: boolean;
  database: string;
  mensagem?: string | null;
  firebirdOk?: boolean;
  sync?: {
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    lastError: string | null;
    lastRowsUpserted: number;
    totalRows: number;
    fullSyncDone: boolean;
    modoUltimoSync: string | null;
  };
};

export type CamasiDashboardKpis = {
  horasProducao: number;
  horasParado: number;
  horasParadoOperacional?: number;
  horasParadoJornada?: number;
  horasEscala?: number | null;
  /** Escala já decorrida (até agora) — base do % de disponibilidade. */
  horasEscalaDecorrida?: number | null;
  disponibilidadePct: number | null;
  qtdeParadas: number;
  qtdeParadasOperacionais?: number;
  qtdeParadasJornada?: number;
};

export type CamasiMesAgg = {
  mes: string;
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
  data: string;
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
  minutos?: number;
  peca: string;
  justificativa: string;
  observacao: string | null;
  categoria?: 'jornada' | 'operacional';
  justificativaEditavel?: boolean;
};

export type CamasiProducaoValida = {
  id: number;
  data: string;
  inicioProducao: string | null;
  fimProducao: string | null;
  horas: number;
  minutos?: number;
  peca: string;
  justificativa?: string | null;
};

export type CamasiResumoDia = {
  data: string;
  escalaHoras: number;
  paradoHoras: number;
  paradoOperacionalHoras?: number;
  paradoJornadaHoras?: number;
  producaoHoras: number;
  paradoSomaEventos: number;
  temSobreposicao: boolean;
  qtdeParadas: number;
};

export type CamasiDashboardResponse = {
  dataIni: string;
  dataFim: string;
  /** firebird = ao vivo; cache = cópia local (PC Camasi offline). */
  fonte?: 'firebird' | 'cache';
  cacheSyncedAt?: string | null;
  kpis: CamasiDashboardKpis;
  porMes: CamasiMesAgg[];
  motivos: CamasiMotivoAgg[];
  pecas: CamasiPecaAgg[];
  pioresDiasParado: CamasiDiaParadoAgg[];
  paradasValidas?: CamasiParadaValida[];
  producaoValidas?: CamasiProducaoValida[];
  resumoDias?: CamasiResumoDia[];
  escala?: {
    recursoCod: string | null;
    recursoNome: string | null;
    diasSemana: number[];
    faixas: { inicio: string; fim: string }[];
    horasEscala: number | null;
    excecoes?: {
      id: string;
      dataIni: string;
      dataFim: string;
      tipo: 'folga' | 'substituir';
      faixas?: { inicio: string; fim: string }[];
    }[];
  } | null;
};

export type CamasiDiaAgg = {
  data: string;
  horas: number;
};

export type CamasiDiasResponse = {
  dataIni: string;
  dataFim: string;
  mes: string;
  label: string;
  tipo: 'producao' | 'parado';
  dias: CamasiDiaAgg[];
  totalHoras: number;
};

export async function getCamasiStatus(): Promise<CamasiStatusResponse> {
  return apiJson<CamasiStatusResponse>('/api/producao-camasi/status');
}

export async function fetchCamasiDashboard(
  dataIni: string,
  dataFim: string
): Promise<CamasiDashboardResponse> {
  const qs = new URLSearchParams({ dataIni, dataFim });
  return apiJson<CamasiDashboardResponse>(`/api/producao-camasi/dashboard?${qs}`);
}

export async function fetchCamasiDashboardDias(params: {
  dataIni: string;
  dataFim: string;
  mes: string;
  tipo: 'producao' | 'parado';
}): Promise<CamasiDiasResponse> {
  const qs = new URLSearchParams(params);
  return apiJson<CamasiDiasResponse>(`/api/producao-camasi/dashboard/dias?${qs}`);
}

export async function getCamasiRecursoEscala(): Promise<ProgramacaoProducaoRecurso> {
  const r = await apiJson<{ data: ProgramacaoProducaoRecurso }>('/api/producao-camasi/recurso-escala');
  if (!r.data) throw new Error('Recurso Camasi não encontrado.');
  return r.data;
}

export async function putCamasiRecursoEscalaExcecoes(
  escalaExcecoes: RecursoEscalaExcecao[]
): Promise<ProgramacaoProducaoRecurso> {
  const res = await apiFetch('/api/producao-camasi/recurso-escala/excecoes', {
    method: 'PUT',
    body: { escalaExcecoes },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar escala pontual.');
  }
  const r = (await res.json()) as { data: ProgramacaoProducaoRecurso };
  return r.data;
}

export type CamasiJustificativaOpcao = { nome: string; origem: 'camasi' | 'gs' };

export async function fetchCamasiJustificativas(): Promise<CamasiJustificativaOpcao[]> {
  const r = await apiJson<{ opcoes: CamasiJustificativaOpcao[] }>('/api/producao-camasi/justificativas');
  return r.opcoes ?? [];
}

export async function justificarParadaCamasi(body: {
  data: string;
  inicioParado: string;
  fimParado: string;
  observacao: string | null;
  nome: string;
}): Promise<{ ok: boolean; nome: string }> {
  const res = await apiFetch('/api/producao-camasi/paradas/justificar', {
    method: 'POST',
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; nome?: string };
  if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar justificativa.');
  return { ok: true, nome: json.nome ?? body.nome };
}
