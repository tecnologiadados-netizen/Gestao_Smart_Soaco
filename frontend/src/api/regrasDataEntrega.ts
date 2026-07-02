import { apiFetch, apiJson } from './client';

export type RegraDataEntregaCarradaConfig = {
  baseData: 'emissao';
  valorCorte: number;
  diasAbaixoCorte: number;
  diasIgualOuAcimaCorte: number;
  incluiInserirRomaneio: boolean;
};

export type RegraDataEntregaConfig = {
  carrada: RegraDataEntregaCarradaConfig;
};

export type RegraDataEntregaVersao = {
  id: number;
  vigenteApartirDe: string;
  payload: RegraDataEntregaConfig;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  createdAt: string;
};

export type RegrasDataEntregaResponse = {
  padraoSistema: RegraDataEntregaConfig;
  vigenteHoje: RegraDataEntregaVersao | null;
  versoes: RegraDataEntregaVersao[];
};

export async function obterRegrasDataEntrega(): Promise<RegrasDataEntregaResponse> {
  return apiJson<RegrasDataEntregaResponse>('/api/pcp/regras-data-entrega');
}

export async function criarVersaoRegraDataEntrega(input: {
  payload: RegraDataEntregaConfig;
  vigenteApartirDe: string;
}): Promise<RegraDataEntregaVersao> {
  const res = await apiFetch('/api/pcp/regras-data-entrega', {
    method: 'POST',
    body: input,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao gravar regra');
  }
  const data = (await res.json()) as { versao: RegraDataEntregaVersao };
  return data.versao;
}
