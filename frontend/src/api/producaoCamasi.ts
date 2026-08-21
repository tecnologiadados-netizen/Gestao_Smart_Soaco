import { apiJson } from './client';

export type CamasiStatusResponse = {
  ok: boolean;
  enabled: boolean;
  database: string;
  mensagem?: string | null;
};

export type CamasiDashboardKpis = {
  horasProducao: number;
  horasParado: number;
  horasEscala?: number | null;
  disponibilidadePct: number | null;
  qtdeParadas: number;
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
};

export type CamasiProducaoValida = {
  id: number;
  data: string;
  inicioProducao: string | null;
  fimProducao: string | null;
  horas: number;
  minutos?: number;
  peca: string;
};

export type CamasiDashboardResponse = {
  dataIni: string;
  dataFim: string;
  kpis: CamasiDashboardKpis;
  porMes: CamasiMesAgg[];
  motivos: CamasiMotivoAgg[];
  pecas: CamasiPecaAgg[];
  pioresDiasParado: CamasiDiaParadoAgg[];
  paradasValidas?: CamasiParadaValida[];
  producaoValidas?: CamasiProducaoValida[];
  escala?: {
    recursoCod: string | null;
    recursoNome: string | null;
    diasSemana: number[];
    faixas: { inicio: string; fim: string }[];
    horasEscala: number | null;
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
