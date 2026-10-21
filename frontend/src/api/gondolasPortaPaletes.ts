import { apiJson, getApiBase, getCsrfToken, getStoredToken } from './client';

export type SetorGondola = 'Gôndolas' | 'Porta Paletes';
export type OrigemFicha = 'nomus' | 'planilha' | 'nenhuma';

export type ItemCarteiraGondola = {
  idItem: number;
  pedido: string;
  cliente: string;
  codigo: string;
  descricao: string;
  setor: SetorGondola;
  dataEntrega: string;
  status: string;
  qtdePedida: number;
  qtdeAtendida: number;
  pendente: number;
  qtdeRomaneada: number;
  qtdePendenteReal: number;
  observacoes: string;
  temFicha: boolean;
  origem: 'nomus' | 'planilha' | 'nenhuma';
  /** Tem lista de produção no Nomus e linhas na planilha ao mesmo tempo. */
  ambasFichas?: boolean;
  /** Ficha escolhida pelo usuário quando há as duas; null enquanto ninguém escolheu. */
  escolhaFicha?: EscolhaFicha | null;
};

export type EscolhaFicha = 'nomus' | 'planilha';

export async function salvarEscolhasFichaGondola(escolhas: { codigo: string; origem: EscolhaFicha }[]): Promise<void> {
  await apiJson('/api/pcp/gondolas-porta-paletes/preferencias-ficha', {
    method: 'PUT',
    body: { escolhas } as unknown as BodyInit,
  });
}

export type ComponenteFicha = {
  codigo: string;
  descricao: string;
  tipo: 'PI' | 'PP' | '';
  quantidade: number;
  quantidadeTotal: number;
  materiaPrima: string;
  medida01: string;
  medida02: string;
  modelo?: string;
  observacao?: string;
  /** Número da ordem em que esta peça do item já saiu. */
  ordemGerada?: string;
};

export type DetalheItemGondola = {
  item: ItemCarteiraGondola;
  origem: OrigemFicha;
  componentes: ComponenteFicha[];
  ambasFichas?: boolean;
};

export type TipoOrdemGondola = 'PI' | 'PP' | 'PLANILHA';

export type OrdemGondola = {
  id: number;
  numero: string;
  setor: SetorGondola;
  tipo: TipoOrdemGondola;
  criadoPorLogin: string | null;
  createdAt: string;
  detalhes: DetalheItemGondola[];
};

export async function listarOrdensGondola(): Promise<OrdemGondola[]> {
  const data = await apiJson<{ ordens: OrdemGondola[] }>('/api/pcp/gondolas-porta-paletes/ordens', {
    cache: 'no-store',
  });
  return data.ordens;
}

export async function gerarOrdemGondola(
  setor: SetorGondola,
  tipo: TipoOrdemGondola,
  detalhes: DetalheItemGondola[]
): Promise<OrdemGondola> {
  const data = await apiJson<{ ordem: OrdemGondola }>('/api/pcp/gondolas-porta-paletes/ordens', {
    method: 'POST',
    body: { setor, tipo, detalhes } as unknown as BodyInit,
  });
  return data.ordem;
}

export async function excluirOrdemGondola(id: number): Promise<void> {
  await apiJson(`/api/pcp/gondolas-porta-paletes/ordens/${id}`, { method: 'DELETE' });
}

export type ResumoPlanilhaGondola = {
  gondolas: number;
  portaPaletes: number;
  origem: 'importada' | 'inicial';
  atualizadoEm: string | null;
};

export async function listarItensGondolas(): Promise<{
  itens: ItemCarteiraGondola[];
  planilha: ResumoPlanilhaGondola;
}> {
  return apiJson('/api/pcp/gondolas-porta-paletes/itens');
}

export type DadosPecaGondola = {
  medida01: string;
  medida02: string;
  modelo: string;
  materiaPrima: string;
};

export async function salvarMedidaPecaGondola(
  codigo: string,
  dados: DadosPecaGondola
): Promise<DadosPecaGondola & { codigo: string }> {
  return apiJson('/api/pcp/gondolas-porta-paletes/medidas', {
    method: 'PUT',
    body: { codigo, ...dados } as unknown as BodyInit,
  });
}

export async function detalharItemGondola(idItem: number): Promise<DetalheItemGondola> {
  return apiJson(`/api/pcp/gondolas-porta-paletes/itens/${idItem}`, { cache: 'no-store' });
}

export async function baixarPlanilhaModeloGondolas(setor: SetorGondola): Promise<void> {
  const token = getStoredToken();
  const query = new URLSearchParams({ setor }).toString();
  const res = await fetch(`${getApiBase()}/api/pcp/gondolas-porta-paletes/planilha-modelo?${query}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Não foi possível baixar a planilha.');
  }
  const blob = await res.blob();
  const nome =
    res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/i)?.[1] ??
    `ficha-${setor === 'Gôndolas' ? 'gondolas' : 'porta-paletes'}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importarPlanilhaGondola(
  setor: SetorGondola,
  arquivo: File
): Promise<{ planilha: ResumoPlanilhaGondola; importadas: number }> {
  const csrf = await getCsrfToken();
  const token = getStoredToken();
  const fd = new FormData();
  fd.append('setor', setor);
  fd.append('arquivo', arquivo);
  const res = await fetch(`${getApiBase()}/api/pcp/gondolas-porta-paletes/planilha`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    planilha?: ResumoPlanilhaGondola;
    importadas?: number;
  };
  if (!res.ok || !data.planilha) {
    throw new Error(data.error || 'Não foi possível importar a planilha.');
  }
  return { planilha: data.planilha, importadas: data.importadas ?? 0 };
}
