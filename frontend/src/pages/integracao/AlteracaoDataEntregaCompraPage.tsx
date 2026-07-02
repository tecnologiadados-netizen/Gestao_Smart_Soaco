import { useState, useEffect, useCallback } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import FiltroDatasPopoverPedidoCompra from '../../components/FiltroDatasPopoverPedidoCompra';
import ModalGerenciarMotivosDataEntregaCompra from '../../components/ModalGerenciarMotivosDataEntregaCompra';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import { listarMotivosAlteracaoDataEntregaCompra, type MotivoAlteracaoDataEntregaCompra } from '../../api/motivosAlteracaoDataEntregaCompra';
import {
  listarPedidoCompraDataEntrega,
  obterFiltrosOpcoesPedidoCompra,
  atualizarDataEntregaItemPedidoCompra,
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
  const [modalDataEntrega, setModalDataEntrega] = useState('');
  const [modalMotivo, setModalMotivo] = useState('');
  const [modalObservacao, setModalObservacao] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [motivosDataEntregaCompra, setMotivosDataEntregaCompra] = useState<MotivoAlteracaoDataEntregaCompra[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [abrirGerenciarMotivos, setAbrirGerenciarMotivos] = useState(false);
  const [historicoItem, setHistoricoItem] = useState<RowPedidoCompraDataEntrega | null>(null);
  const [historicoLista, setHistoricoLista] = useState<HistoricoAlteracaoDataEntregaItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const { hasPermission } = useAuth();
  const podeEditarIntegracao = hasPermission(PERMISSOES.INTEGRACAO_EDITAR);
  const podeGerenciarMotivos = podeEditarIntegracao;

  useEffect(() => {
    obterFiltrosOpcoesPedidoCompra()
      .then(setOpcoes)
      .catch(() => setOpcoes({ pedidos: [], fornecedores: [], codigosProduto: [], descricoesProduto: [] }));
  }, []);

  const carregarMotivos = useCallback(() => {
    setLoadingMotivos(true);
    listarMotivosAlteracaoDataEntregaCompra()
      .then(setMotivosDataEntregaCompra)
      .catch(() => setMotivosDataEntregaCompra([]))
      .finally(() => setLoadingMotivos(false));
  }, []);

  useEffect(() => {
    carregarMotivos();
  }, [carregarMotivos]);

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
    setModalDataEntrega(row.DataEntrega && row.DataEntrega.length >= 10 ? row.DataEntrega : '');
    setModalMotivo('');
    setModalObservacao('');
    setModalError(null);
    setModalSuccess(null);
  };

  const fecharModalAlterarData = () => {
    setModalItem(null);
    setModalError(null);
    setModalSuccess(null);
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

  const salvarDataEntrega = async () => {
    if (!modalItem || modalItem.idItemPedidoCompra <= 0) return;
    const dataValida = modalDataEntrega.trim().slice(0, 10);
    if (!dataValida || !/^\d{4}-\d{2}-\d{2}$/.test(dataValida)) {
      setModalError('Informe uma data válida (YYYY-MM-DD).');
      return;
    }
    const motivoTrim = modalMotivo.trim();
    if (!motivoTrim) {
      setModalError('Informe o motivo da alteração.');
      return;
    }
    if (motivoTrim.length > 500) {
      setModalError('Motivo deve ter no máximo 500 caracteres.');
      return;
    }
    setModalSaving(true);
    setModalError(null);
    try {
      const dataAnterior = modalItem.DataEntrega && modalItem.DataEntrega.length >= 10 ? modalItem.DataEntrega : dataValida;
      await atualizarDataEntregaItemPedidoCompra(modalItem.idItemPedidoCompra, {
        dataEntrega: dataValida,
        dataEntregaAnterior: dataAnterior,
        motivo: motivoTrim,
        observacao: modalObservacao.trim() || null,
      });
      setData((prev) =>
        prev.map((r) =>
          r.idItemPedidoCompra === modalItem.idItemPedidoCompra ? { ...r, DataEntrega: dataValida } : r
        )
      );
      setModalSuccess('Alteração do pedido no Nomus realizada com sucesso. Histórico gravado.');
      setTimeout(() => fecharModalAlterarData(), 2000);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setModalSaving(false);
    }
  };

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

      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-alterar-data-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 id="modal-alterar-data-title" className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
              Alterar data de entrega
            </h3>
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 mb-4">
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Pedido</span><br />{modalItem.Pedido || '—'}</p>
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Código do Produto</span><br />{modalItem.CodigoProduto || '—'}</p>
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Descrição do Produto</span><br />{modalItem.DescricaoProduto || '—'}</p>
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Data de Entrega Atual</span><br />{formatDate(modalItem.DataEntrega)}</p>
            </div>
            <div className="mb-4">
              <label className={labelClass}>Nova data de entrega</label>
              <input
                type="date"
                value={modalDataEntrega}
                onChange={(e) => setModalDataEntrega(e.target.value)}
                className={inputClass}
                disabled={modalSaving || !podeEditarIntegracao}
              />
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className={labelClass}>Motivo da alteração da data de entrega</label>
                {podeGerenciarMotivos && (
                  <button
                    type="button"
                    onClick={() => setAbrirGerenciarMotivos(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-600 transition-colors"
                    title="Gerenciar motivos (incluir, excluir, editar)"
                    aria-label="Gerenciar motivos"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={modalMotivo}
                onChange={(e) => setModalMotivo(e.target.value)}
                className={inputClass}
                required
                disabled={modalSaving || !podeEditarIntegracao}
              >
                <option value="">Selecione um motivo</option>
                {motivosDataEntregaCompra.map((s) => (
                  <option key={s.id} value={s.descricao}>
                    {s.descricao}
                  </option>
                ))}
              </select>
              {loadingMotivos && (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Carregando motivos...</p>
              )}
            </div>
            <div className="mb-4">
              <label className={labelClass}>Observação</label>
              <textarea
                value={modalObservacao}
                onChange={(e) => setModalObservacao(e.target.value)}
                rows={2}
                placeholder="Opcional"
                className={`${inputClass} resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                disabled={modalSaving || !podeEditarIntegracao}
              />
            </div>
            {modalSuccess && (
              <div className="mb-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm">
                {modalSuccess}
              </div>
            )}
            {modalError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">{modalError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={fecharModalAlterarData}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                disabled={modalSaving}
              >
                Cancelar
              </button>
              {podeEditarIntegracao && (
                <button
                  type="button"
                  onClick={salvarDataEntrega}
                  className={btnPrimaryClass}
                  disabled={modalSaving}
                >
                  {modalSaving ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
          {abrirGerenciarMotivos && podeGerenciarMotivos && (
            <ModalGerenciarMotivosDataEntregaCompra
              onClose={() => setAbrirGerenciarMotivos(false)}
              onError={(msg) => setModalError(msg)}
              onAtualizado={carregarMotivos}
            />
          )}
        </div>
      )}

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
