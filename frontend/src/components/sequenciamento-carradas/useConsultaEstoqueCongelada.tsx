import { useMemo } from 'react';
import type { ConsultaEstoqueLinha, SaldoSetorDetalhe } from '../../api/consultaEstoque';
import type { RessupEmpenhoPedidoResultado } from '../../api/compras';
import { consultarCongeladaSnapshot } from '../../api/sequenciamentoCarradas';
import type { FontesConsultaEstoqueEmbed } from '../pcp/ModalConsultaEstoqueEmbed';

/**
 * Fontes da Consulta de estoque congeladas dentro de um snapshot de sequência.
 * A primeira abertura de cada produto grava o resultado no snapshot; as seguintes leem o gravado.
 * Sem `snapshotId` devolve `undefined`, mantendo o modal em tempo real.
 */
export function useConsultaEstoqueCongelada(
  snapshotId: number | null | undefined
): FontesConsultaEstoqueEmbed | undefined {
  return useMemo(() => {
    if (snapshotId == null) return undefined;
    return {
      consultar: async (codigo, considerarRequisicoes) => {
        const r = await consultarCongeladaSnapshot<{ data: ConsultaEstoqueLinha[] }>(
          snapshotId,
          'estoque',
          { codigo, considerarRequisicoes }
        );
        return { data: r.body?.data ?? [], error: r.error };
      },
      saldoDetalhe: async (idProduto) => {
        const r = await consultarCongeladaSnapshot<{ data: SaldoSetorDetalhe[] }>(
          snapshotId,
          'saldoSetor',
          { idProduto }
        );
        return { data: r.body?.data ?? [], error: r.error };
      },
      empenhoPorPedido: async (idProduto, considerarRequisicoes) => {
        const r = await consultarCongeladaSnapshot<{ data: RessupEmpenhoPedidoResultado | null }>(
          snapshotId,
          'empenhoPedido',
          { idProduto, considerarRequisicoes }
        );
        return { data: r.body?.data ?? null, error: r.error };
      },
    };
  }, [snapshotId]);
}
