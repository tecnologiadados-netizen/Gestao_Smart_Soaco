import { useState, useEffect, useCallback, useMemo } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import FiltroDatasPopoverPedidoCompra from '../../components/FiltroDatasPopoverPedidoCompra';
import ModalAlterarDataEntregaCompra from '../../components/ModalAlterarDataEntregaCompra';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import {
  listarPedidoCompraDataEntrega,
  obterFiltrosOpcoesPedidoCompra,
  listarHistoricoAlteracaoDataEntregaCompra,
  type RowPedidoCompraDataEntrega,
  type FiltrosOpcoesPedidoCompra,
  type HistoricoAlteracaoDataEntregaItem,
} from '../../api/integracao';

export interface FiltrosState {
  data_emissao_ini: string;
  data_emissao_fim: string;
  data_entrega_ini: string;
  data_entrega_fim: string;
  pedido: string;
  fornecedor: string;
  codigo_produto: string;
  descricao_produto: string;
}

const defaultFiltros: FiltrosState = {
  data_emissao_ini: '2024-01-01',
  data_emissao_fim: '',
  data_entrega_ini: '',
  data_entrega_fim: '',
  pedido: '',
  fornecedor: '',
  codigo_produto: '',
  descricao_produto: '',
};

const btnPrimaryClass =
  'px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';
const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function normalizeMultiValue(v: string): string {
  if (!v?.trim()) return '';
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
}

/** Formata YYYY-MM-DD para pt-BR sem deslocar por timezone (evita dia a menos). */
function formatDate(s: string): string {
  if (!s || !s.trim()) return '—';
  const trimmed = s.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function CalendarEditIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AlteracaoDataEntregaCompraPage() {
  const [filtros, setFiltros] = useState<FiltrosState>(defaultFiltros);
  const [opcoes, setOpcoes] = useState<FiltrosOpcoesPedidoCompra>({
    pedidos: [],
    fornecedores: [],
    codigosProduto: [],
    descricoesProduto: [],
  });
  const [data, setData] = useState<RowPedidoCompraDataEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<RowPedidoCompraDataEntrega | null>(null);
  const [historicoItem, setHistoricoItem] = useState<RowPedidoCompraDataEntrega | null>(null);
  const [historicoLista, setHistoricoLista] = useState<HistoricoAlteracaoDataEntregaItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const { hasPermission } = useAuth();
  const podeEditarIntegracao = hasPermission(PERMISSOES.INTEGRACAO_EDITAR);

  useEffect(() => {
    obterFiltrosOpcoesPedidoCompra()
      .then(setOpcoes)
      .catch(() => setOpcoes({ pedidos: [], fornecedores: [], codigosProduto: [], descricoesProduto: [] }));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listarPedidoCompraDataEntrega({
        data_emissao_ini: filtros.data_emissao_ini || undefined,
        data_emissao_fim: filtros.data_emissao_fim || undefined,
        data_entrega_ini: filtros.data_entrega_ini || undefined,
        data_entrega_fim: filtros.data_entrega_fim || undefined,
        pedido: filtros.pedido || undefined,
        fornecedor: filtros.fornecedor || undefined,
        codigo_produto: filtros.codigo_produto || undefined,
        descricao_produto: filtros.descricao_produto || undefined,
      });
      setData(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const update = (key: keyof FiltrosState, value: string) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  };

  const updateDatas = (updates: Partial<Pick<FiltrosState, 'data_emissao_ini' | 'data_emissao_fim' | 'data_entrega_ini' | 'data_entrega_fim'>>) => {
    setFiltros((prev) => ({ ...prev, ...updates }));
  };

  const handleMultiChange = (key: keyof FiltrosState) => (value: string) => {
    update(key, normalizeMultiValue(value));
  };

  const limparFiltros = () => {
    setFiltros(defaultFiltros);
  };

  const abrirModalAlterarData = (row: RowPedidoCompraDataEntrega) => {
    setModalItem(row);
  };

  const abrirModalHistorico = useCallback((row: RowPedidoCompraDataEntrega) => {
    if (row.idItemPedidoCompra <= 0) return;
    setHistoricoItem(row);
    setHistoricoLista([]);
    setHistoricoLoading(true);
    listarHistoricoAlteracaoDataEntregaCompra(row.idItemPedidoCompra)
      .then(setHistoricoLista)
      .catch(() => setHistoricoLista([]))
      .finally(() => setHistoricoLoading(false));
  }, []);

  const fecharModalHistorico = () => setHistoricoItem(null);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const itemAlterarData = useMemo(
    () =>
      modalItem
        ? {
            idItemPedidoCompra: modalItem.idItemPedidoCompra,
            pedido: modalItem.Pedido,
            codigoProduto: modalItem.CodigoProduto,
            descricaoProduto: modalItem.DescricaoProduto,
            dataEntrega: modalItem.DataEntrega,
          }
        : null,
    [modalItem]
  );

  const onDataEntregaSalva = useCallback((idItem: number, dataNova: string) => {
    setData((prev) => prev.map((r) => (r.idItemPedidoCompra === idItem ? { ...r, DataEntrega: dataNova } : r)));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Alteração da Data de Entrega do Pedido de Compra
      </h2>

      <div className="flex flex-wrap items-end gap-3 p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <FiltroDatasPopoverPedidoCompra
          filtros={{
            data_emissao_ini: filtros.data_emissao_ini,
            data_emissao_fim: filtros.data_emissao_fim,
            data_entrega_ini: filtros.data_entrega_ini,
            data_entrega_fim: filtros.data_entrega_fim,
          }}
          onChange={updateDatas}
        />
        <MultiSelectWithSearch
          label="Pedido"
          placeholder="Todos"
          options={opcoes.pedidos}
          value={filtros.pedido}
          onChange={handleMultiChange('pedido')}
          labelClass={labelClass}
          inputClass={inputClass}
          minWidth="160px"
          optionLabel="pedidos"
        />
        <MultiSelectWithSearch
          label="Fornecedor"
          placeholder="Todos"
          options={opcoes.fornecedores}
          value={filtros.fornecedor}
          onChange={handleMultiChange('fornecedor')}
          labelClass={labelClass}
          inputClass={inputClass}
          minWidth="180px"
          optionLabel="fornecedores"
        />
        <MultiSelectWithSearch
          label="Código produto"
          placeholder="Todos"
          options={opcoes.codigosProduto}
          value={filtros.codigo_produto}
          onChange={handleMultiChange('codigo_produto')}
          labelClass={labelClass}
          inputClass={inputClass}
          minWidth="160px"
          optionLabel="códigos"
        />
        <MultiSelectWithSearch
          label="Descrição produto"
          placeholder="Todos"
          options={opcoes.descricoesProduto}
          value={filtros.descricao_produto}
          onChange={handleMultiChange('descricao_produto')}
          labelClass={labelClass}
          inputClass={inputClass}
          minWidth="200px"
          optionLabel="descrições"
        />
        <button type="button" onClick={carregar} className={btnPrimaryClass}>
          Filtrar
        </button>
        <button type="button" onClick={limparFiltros} className={btnPrimaryClass}>
          Limpar filtros
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-800 dark:text-amber-200">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-primary-600 text-white">
              <tr>
                <th className="py-3 px-4 font-semibold w-20" aria-label="Ações" />
                <th className="py-3 px-4 font-semibold">Pedido</th>
                <th className="py-3 px-4 font-semibold">Data Emissão</th>
                <th className="py-3 px-4 font-semibold">Código Produto</th>
                <th className="py-3 px-4 font-semibold">Descrição do Produto</th>
                <th className="py-3 px-4 font-semibold">Fornecedor</th>
                <th className="py-3 px-4 font-semibold">Data Entrega</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={row.idItemPedidoCompra ? `item-${row.idItemPedidoCompra}` : `${row.Pedido}-${row.CodigoProduto}-${idx}`}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="py-2 px-2 align-middle">
                      {row.idItemPedidoCompra > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {podeEditarIntegracao && (
                            <button
                              type="button"
                              onClick={() => abrirModalAlterarData(row)}
                              className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30 transition"
                              title="Alterar data de entrega"
                              aria-label="Alterar data de entrega"
                            >
                              <CalendarEditIcon />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirModalHistorico(row)}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50 transition"
                            title="Ver histórico de alterações"
                            aria-label="Ver histórico de alterações"
                          >
                            <HistoryIcon />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-block w-9" aria-hidden />
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-200">{row.Pedido}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{formatDate(row.DataEmissao)}</td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-200">{row.CodigoProduto}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={row.DescricaoProduto}>
                      {row.DescricaoProduto || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{row.Fornecedor || '—'}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{formatDate(row.DataEntrega)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalAlterarDataEntregaCompra
        item={itemAlterarData}
        podeEditar={podeEditarIntegracao}
        onClose={() => setModalItem(null)}
        onSalvo={onDataEntregaSalva}
      />

      {historicoItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-historico-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="modal-historico-title" className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Histórico de alterações
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Pedido <strong>{historicoItem.Pedido}</strong> · {historicoItem.CodigoProduto}
              </p>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {historicoLoading ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando...</p>
              ) : historicoLista.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma alteração registrada.</p>
              ) : (
                <ul className="space-y-4">
                  {historicoLista.map((h) => (
                    <li
                      key={h.id}
                      className="text-sm border-l-2 border-primary-500 pl-3 py-1"
                    >
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium">{formatDate(h.dataEntregaAnterior)}</span>
                        {' → '}
                        <span className="font-medium">{formatDate(h.dataEntregaNova)}</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">Motivo: {h.motivo}</p>
                      {h.observacao && (
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">Obs.: {h.observacao}</p>
                      )}
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                        {h.usuario} · {formatDateTime(h.dataAlteracao)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={fecharModalHistorico}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-100 text-sm font-medium transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
