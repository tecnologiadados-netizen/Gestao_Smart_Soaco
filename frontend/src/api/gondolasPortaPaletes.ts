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
};

export type ComponenteFicha = {
  codigo: string;
  descricao: string;
  tipo: 'PI' | 'PP' | '';
  quantidade: number;
  quantidadeTotal: number;
  materiaPrima: string;
  medida01: string;
  medida02: string;
};

export type DetalheItemGondola = {
  item: ItemCarteiraGondola;
  origem: OrigemFicha;
  componentes: ComponenteFicha[];
};

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

export async function salvarMedidaPecaGondola(
  codigo: string,
  medida01: string,
  medida02: string
): Promise<{ codigo: string; medida01: string; medida02: string }> {
  return apiJson('/api/pcp/gondolas-porta-paletes/medidas', {
    method: 'PUT',
    body: { codigo, medida01, medida02 } as unknown as BodyInit,
  });
}

export async function detalharItemGondola(idItem: number): Promise<DetalheItemGondola> {
  return apiJson(`/api/pcp/gondolas-porta-paletes/itens/${idItem}`);
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
