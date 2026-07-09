import { useRef, type MutableRefObject } from 'react';
import ModalConsultaEstoqueDetalhe from '../pcp/ModalConsultaEstoqueDetalhe';
import {
  obterHistoricoPrioridadeFixaPendencias,
  type PendenciasPrioridadeFixaHistoricoItem,
} from '../../api/pendenciasCompras';

type Props = {
  open: boolean;
  comprador: string;
  idProduto: number;
  codigo: string;
  descricao: string;
  onClose: () => void;
  cacheRef?: MutableRefObject<Map<string, PendenciasPrioridadeFixaHistoricoItem[]>>;
};

function fmtPrioridade(val: number | null): string {
  if (val == null) return '— (automática)';
  return String(val);
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function historicoPrioridadeCacheKey(comprador: string, idProduto: number): string {
  return `hist-pf-${comprador}-${idProduto}`;
}

export default function ModalPrioridadeFixaHistorico({
  open,
  comprador,
  idProduto,
  codigo,
  descricao,
  onClose,
  cacheRef,
}: Props) {
  const detailKey = open ? historicoPrioridadeCacheKey(comprador, idProduto) : null;

  return (
    <ModalConsultaEstoqueDetalhe
      open={open}
      detailKey={detailKey}
      titulo={`Histórico prioridade fixa — ${codigo}`}
      subtitulo={descricao}
      onClose={onClose}
      onLoad={async () => {
        const key = historicoPrioridadeCacheKey(comprador, idProduto);
        const cached = cacheRef?.current.get(key);
        if (cached) return {};

        const r = await obterHistoricoPrioridadeFixaPendencias({ comprador, idProduto });
        if (r.error) return { error: r.error };
        cacheRef?.current.set(key, r.historico);
        return {};
      }}
    >
      {({ carregando, erro }) => {
        if (carregando) return <p className="text-slate-500">Carregando…</p>;
        if (erro) return <p className="text-red-600">{erro}</p>;

        const key = historicoPrioridadeCacheKey(comprador, idProduto);
        const itens = cacheRef?.current.get(key) ?? [];

        if (itens.length === 0) {
          return <p className="text-slate-500">Nenhuma alteração registrada.</p>;
        }

        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  <th className="px-2 py-1.5 font-semibold">Data/hora</th>
                  <th className="px-2 py-1.5 font-semibold">Usuário</th>
                  <th className="px-2 py-1.5 text-center font-semibold">De</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Para</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-slate-100 dark:border-slate-700"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtDataHora(h.criadoEm)}</td>
                    <td className="px-2 py-1.5">{h.usuarioLogin}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{fmtPrioridade(h.prioridadeAnterior)}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{fmtPrioridade(h.prioridadeNova)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </ModalConsultaEstoqueDetalhe>
  );
}
