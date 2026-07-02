import { apiJson } from './client';

export type GrupoInconsistenciaQtdePendenteApi = {
  key: string;
  pdLabel: string;
  cod: string;
  pendenteItem: number;
  somaQtdePendenteReal: number;
};

export type InconsistenciaQtdePendenteResponse = {
  temInconsistencia: boolean;
  grupos: GrupoInconsistenciaQtdePendenteApi[];
  totalPedidosAnalisados: number;
};

export const MSG_BLOQUEIO_INCONSISTENCIA_QTDE_PENDENTE =
  'Existem inconsistências no Gerenciador de Pedidos: a soma de Qtde Pendente Real por pedido+código ultrapassa a coluna Pendente do item (faturamento parcial sem vínculo por rota no ERP). Corrija no Gerenciador antes de gerar a programação.';

export async function verificarInconsistenciaQtdePendente(): Promise<InconsistenciaQtdePendenteResponse> {
  return apiJson<InconsistenciaQtdePendenteResponse>('/api/pedidos/inconsistencia-qtde-pendente');
}

/** Retorna mensagem de bloqueio ou null se OK. */
export async function mensagemBloqueioInconsistenciaQtdePendente(): Promise<string | null> {
  const r = await verificarInconsistenciaQtdePendente();
  return r.temInconsistencia ? MSG_BLOQUEIO_INCONSISTENCIA_QTDE_PENDENTE : null;
}
