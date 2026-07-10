import { useMemo, useState } from 'react';
import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  agregarPedidosVenda,
  agregarProdutosVinculados,
  filtrarLinhasCarrada,
  formatDateBr,
  formatMoeda,
  formatQtde,
  listarItensPedido,
  SUBTOTAL_ROW_CLASS,
} from './sequenciamentoCarradasUtils';

type AbaDetalhe = 'pedidos' | 'itens' | 'produtos';

type Props = {
  carrada: SequenciamentoCarradaAgregada;
  linhas: Record<string, unknown>[];
  aoVivo?: boolean;
  onClose: () => void;
};

const TH = 'py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'py-2 px-2 text-slate-700 dark:text-slate-200';

export default function SequenciamentoCarradasDetalheModal({
  carrada,
  linhas,
  aoVivo = false,
  onClose,
}: Props) {
  const [aba, setAba] = useState<AbaDetalhe>('pedidos');

  useRegisterModalEscape({ id: 'seq-carradas-detalhe', onClose, zIndex: 130 });

  const linhasFiltradas = useMemo(() => filtrarLinhasCarrada(linhas, carrada), [linhas, carrada]);
  const pedidos = useMemo(() => agregarPedidosVenda(linhasFiltradas), [linhasFiltradas]);
  const itens = useMemo(() => listarItensPedido(linhasFiltradas), [linhasFiltradas]);
  const produtos = useMemo(() => agregarProdutosVinculados(linhasFiltradas), [linhasFiltradas]);

  const subtotalPedidos = useMemo(
    () => Math.round(pedidos.reduce((s, r) => s + r.total, 0) * 100) / 100,
    [pedidos]
  );
  const subtotalItens = useMemo(
    () => ({
      qtde: itens.reduce((s, r) => s + r.qtdeRomaneada, 0),
      total: Math.round(itens.reduce((s, r) => s + r.total, 0) * 100) / 100,
    }),
    [itens]
  );
  const subtotalProdutos = useMemo(
    () => produtos.reduce((s, r) => s + r.qtdeRomaneada, 0),
    [produtos]
  );

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seq-carrada-detalhe-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 id="seq-carrada-detalhe-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Carrada — {carrada.carrada}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Romaneio (Cód): <span className="font-medium">{carrada.cod}</span> · Somente leitura
              {aoVivo ? ' (consulta ao vivo)' : ' (snapshot)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Detalhes da carrada"
          className="flex shrink-0 gap-1 border-b border-slate-200 px-4 dark:border-slate-600"
        >
          {(
            [
              ['pedidos', 'Pedidos de venda vinculados'],
              ['itens', 'Itens de pedidos vinculados'],
              ['produtos', 'Produtos vinculados'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                aba === id
                  ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4" role="tabpanel">
          {aba === 'pedidos' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={TH}>Pedido</th>
                  <th className={TH}>Cliente</th>
                  <th className={TH}>Data de emissão</th>
                  <th className={TH}>Município</th>
                  <th className={TH}>UF</th>
                  <th className={`${TH} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum pedido nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {pedidos.map((r) => (
                      <tr key={r.pedido} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>{r.pedido}</td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>{r.municipio || '—'}</td>
                        <td className={TD}>{r.uf || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.total)}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={5}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatMoeda(subtotalPedidos)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {aba === 'itens' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={TH}>Pedido</th>
                  <th className={TH}>Cliente</th>
                  <th className={TH}>Data de emissão</th>
                  <th className={TH}>Código</th>
                  <th className={TH}>Descrição</th>
                  <th className={`${TH} text-right`}>Qtde romaneada</th>
                  <th className={`${TH} text-right`}>Preço unitário</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum item nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {itens.map((r, i) => (
                      <tr key={`${r.pedido}-${r.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>{r.pedido}</td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>{r.codigo || '—'}</td>
                        <td className={TD}>{r.descricao || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatQtde(r.qtdeRomaneada)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.precoUnitario)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.total)}</td>
                        <td className={TD}>{r.status || '—'}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={5}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatQtde(subtotalItens.qtde)}</td>
                      <td className={TD} />
                      <td className={`${TD} text-right tabular-nums`}>{formatMoeda(subtotalItens.total)}</td>
                      <td className={TD} />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {aba === 'produtos' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={TH}>Código do produto</th>
                  <th className={TH}>Descrição do produto</th>
                  <th className={`${TH} text-right`}>Qtde romaneada</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum produto nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {produtos.map((r) => (
                      <tr key={r.codigo} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>{r.codigo}</td>
                        <td className={TD}>{r.descricao || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatQtde(r.qtdeRomaneada)}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={2}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatQtde(subtotalProdutos)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
