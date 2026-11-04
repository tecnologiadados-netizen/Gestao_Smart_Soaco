import { apiJson } from './client';

export type SituacaoPrazoSolicitacao = 'atrasada' | 'hoje' | 'proxima' | 'no_prazo' | 'sem_data';

export type SolicitacaoCompraRotinaLinha = {
  idSolicitacao: number;
  idProduto: number;
  codigo: string;
  descricao: string;
  nomeColeta: string;
  comprador: string;
  saldo: number;
  status: string;
  dataNecessidade: string | null;
  dataEmissao: string | null;
  diasEmAberto: number | null;
  diasAteNecessidade: number | null;
  situacaoPrazo: SituacaoPrazoSolicitacao;
  cotacoes: string;
  prioridade: number;
  necessidadeColeta: string | null;
};

export type SolicitacoesCompraRotinaConsulta = {
  linhas: SolicitacaoCompraRotinaLinha[];
  total: number;
  totalGeral: number;
  contagens: Record<string, number>;
  compradores: string[];
};

export async function consultarSolicitacoesCompraRotina(
  comprador: string
): Promise<{ data: SolicitacoesCompraRotinaConsulta | null; error?: string }> {
  try {
    const sp = new URLSearchParams({ comprador });
    const data = await apiJson<SolicitacoesCompraRotinaConsulta>(
      `/api/compras/rotina/solicitacoes?${sp}`
    );
    return { data };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Erro ao consultar solicitações',
    };
  }
}
