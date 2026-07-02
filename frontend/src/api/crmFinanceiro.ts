import { apiFetch } from './client';
import type {
  ColunaIndicador,
  ContaFinanceira,
  DashboardDetalhesData,
  DashboardGlobalData,
  EmpresaOption,
  PessoaOption,
  Recebimento,
} from '../pages/financeiro/crm/lib/types';
import type { SaudeClienteResult } from '../pages/financeiro/crm/lib/saude-cliente';

export type { SaudeClienteResult };

export interface ResumoDetalheModal {
  quantidadeTotal: number;
  valorTotal: number;
  quantidadeCarregada: number;
  limite: number;
}

export type IndicadorDetalheResponse =
  | { modo: 'contas'; dados: ContaFinanceira[]; resumo?: ResumoDetalheModal }
  | {
      modo: 'recebimentos';
      dados: Recebimento[];
      resumo?: ResumoDetalheModal;
    };

function buildParams(
  params: Record<string, string | number | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      sp.set(key, String(value));
    }
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export async function fetchCrmDashboard(params: {
  pessoa?: string | null;
  empresaId?: number | null;
  refresh?: boolean;
}): Promise<DashboardGlobalData | DashboardDetalhesData> {
  const res = await apiFetch(
    `/api/financeiro/crm/dashboard${buildParams({
      pessoa: params.pessoa ?? undefined,
      empresa: params.empresaId ?? undefined,
      refresh: params.refresh ? '1' : undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | DashboardGlobalData
    | DashboardDetalhesData
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar indicadores',
    );
  }
  return body as DashboardGlobalData | DashboardDetalhesData;
}

export async function fetchCrmSaudeEmpresa(params: {
  empresaId?: number | null;
  refresh?: boolean;
}): Promise<SaudeClienteResult> {
  const res = await apiFetch(
    `/api/financeiro/crm/saude-empresa${buildParams({
      empresa: params.empresaId ?? undefined,
      refresh: params.refresh ? '1' : undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | SaudeClienteResult
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar saúde da empresa',
    );
  }
  return body as SaudeClienteResult;
}

export async function fetchCrmDetalhe(params: {
  tipo: 'receber' | 'pagar';
  coluna: ColunaIndicador;
  classificacao?: string | null;
  pessoa?: string | null;
  empresaId?: number | null;
}): Promise<IndicadorDetalheResponse> {
  const res = await apiFetch(
    `/api/financeiro/crm/detalhe${buildParams({
      tipo: params.tipo,
      coluna: params.coluna,
      classificacao: params.classificacao ?? undefined,
      pessoa: params.pessoa ?? undefined,
      empresa: params.empresaId ?? undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | IndicadorDetalheResponse
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar registros',
    );
  }
  return body as IndicadorDetalheResponse;
}

export async function fetchCrmPessoas(params: {
  q?: string;
  empresaId?: number | null;
}): Promise<PessoaOption[]> {
  const res = await apiFetch(
    `/api/financeiro/crm/pessoas${buildParams({
      q: params.q ?? undefined,
      empresa: params.empresaId ?? undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | PessoaOption[]
    | { error?: string };
  if (!res.ok) {
    return [];
  }
  return Array.isArray(body) ? body : [];
}

export async function fetchCrmEmpresas(): Promise<EmpresaOption[]> {
  const res = await apiFetch('/api/financeiro/crm/empresas');
  const body = (await res.json().catch(() => ({}))) as
    | EmpresaOption[]
    | { error?: string };
  if (!res.ok) {
    return [];
  }
  return Array.isArray(body) ? body : [];
}
