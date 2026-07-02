import { listarPedidos } from '../data/pedidosRepository.js';
import {
  analisarInconsistenciaQtdePendenteReal,
  MSG_BLOQUEIO_INCONSISTENCIA_QTDE_PENDENTE,
  type GrupoInconsistenciaQtdePendente,
} from '../utils/qtdePendenteInconsistencia.js';

export async function obterInconsistenciaQtdePendenteReal(): Promise<{
  temInconsistencia: boolean;
  grupos: GrupoInconsistenciaQtdePendente[];
  totalPedidosAnalisados: number;
}> {
  const { data } = await listarPedidos({});
  const { hasIssue, grupos } = analisarInconsistenciaQtdePendenteReal(data);
  return {
    temInconsistencia: hasIssue,
    grupos,
    totalPedidosAnalisados: data.length,
  };
}

export async function garantirSemInconsistenciaQtdePendente(): Promise<
  { ok: true } | { ok: false; error: string; grupos: GrupoInconsistenciaQtdePendente[] }
> {
  const r = await obterInconsistenciaQtdePendenteReal();
  if (r.temInconsistencia) {
    return { ok: false, error: MSG_BLOQUEIO_INCONSISTENCIA_QTDE_PENDENTE, grupos: r.grupos };
  }
  return { ok: true };
}
