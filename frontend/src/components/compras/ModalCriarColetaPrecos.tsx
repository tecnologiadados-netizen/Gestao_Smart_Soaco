import { useState, useRef, useEffect, useCallback } from 'react';
import { listarProdutosColeta, confirmarColetaPrecos, adicionarItensColeta, type ProdutoColetaRow, type ItemColetaPayload, type ColetaEmConflito, type ColetaBloqueante } from '../../api/compras';

/** Item de produto exibido no pop-up (mapeado do Nomus). */
export interface ItemProdutoColeta {
  id: string;
  nomeProduto: string;
  descricao: string;
  unidadeMedida: string;
  codigoSolicitacao: string;
  codigoSolicitacaoNum: number | null;
  qtdeSolicitada: string;
  ultimoFornecedor: string;
  familia: string;
}

function mapRowToItem(r: ProdutoColetaRow): ItemProdutoColeta {
  return {
    id: String(r.idProduto),
    nomeProduto: r.codigoProduto ?? '',
    descricao: r.descricaoProduto ?? '',
    unidadeMedida: r.unidadeMedida ?? '',
    codigoSolicitacao: r.codigoSolicitacao != null ? String(r.codigoSolicitacao) : '—',
    codigoSolicitacaoNum: r.codigoSolicitacao != null && r.codigoSolicitacao > 0 ? r.codigoSolicitacao : null,
    qtdeSolicitada: r.qtdeSolicitada != null ? String(r.qtdeSolicitada) : '—',
    ultimoFornecedor: r.ultimoFornecedor ?? '',
    familia: r.familiaProduto ?? '',
  };
}

/** Chave única por linha (produto + solicitação) para seleção. */
function getRowKey(item: ItemProdutoColeta): string {
  return `${item.id}-${item.codigoSolicitacaoNum ?? 'n'}`;
}

interface ModalCriarColetaPrecosProps {
  onClose: () => void;
  onConfirmar?: (idsSelecionados: string[], opts?: { bloqueante?: boolean; coletas?: ColetaBloqueante[] }) => void;
  /** Quando definido, o modal adiciona itens a esta coleta em vez de criar nova. */
  coletaIdToAddTo?: number;
}

const ROW_HEIGHT_PX = 40;
const inputClass =
  'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 text-sm min-w-0 focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const labelClass = 'text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap block mb-0.5';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50 transition';
const btnConfirmarColeta = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 transition';
const btnSecondary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm font-medium disabled:opacity-50 transition';

export default function ModalCriarColetaPrecos({ onClose, onConfirmar, coletaIdToAddTo }: ModalCriarColetaPrecosProps) {
  const isAdicionarItens = coletaIdToAddTo != null;
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [familia, setFamilia] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [coleta, setColeta] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [apenasComSolicitacao, setApenasComSolicitacao] = useState(false);
  /** Chaves das linhas selecionadas (idProduto-codigoSolicitacao) para escolha isolada por solicitação. */
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [itens, setItens] = useState<ItemProdutoColeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [coletaId, setColetaId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [coletasEmConflito, setColetasEmConflito] = useState<ColetaEmConflito[] | null>(null);
  /** Modal: vincular cotação à(s) solicitação(ões) selecionada(s)? */
  const [modalVincular, setModalVincular] = useState<{ aberto: boolean; itensPayload: ItemColetaPayload[] } | null>(null);

  const getFiltros = useCallback(() => ({
    codigo: codigo.trim() || undefined,
    descricao: descricao.trim() || undefined,
    familia: familia.trim() || undefined,
    fornecedor: fornecedor.trim() || undefined,
    coleta: coleta.trim() || undefined,
    diaSemana: diaSemana.trim() || undefined,
    apenasComSolicitacao: apenasComSolicitacao || undefined,
  }), [codigo, descricao, familia, fornecedor, coleta, diaSemana, apenasComSolicitacao]);

  const carregar = useCallback(async (filtrosOverride?: Parameters<typeof listarProdutosColeta>[0]) => {
    const filtros = filtrosOverride ?? getFiltros();
    setLoading(true);
    setErro(null);
    setColetasEmConflito(null);
    try {
      const res = await listarProdutosColeta(filtros);
      setItens((res.data ?? []).map(mapRowToItem));
      if (res.error) setErro(res.error);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar produtos.');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [getFiltros]);

  useEffect(() => {
    carregar({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuscar = () => carregar();
  const handleAtualizar = () => carregar();

  const handleLimparFiltros = () => {
    setCodigo('');
    setDescricao('');
    setFamilia('');
    setFornecedor('');
    setColeta('');
    setDiaSemana('');
    setApenasComSolicitacao(false);
  };

  const toggleSelect = (rowKey: string) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRowKeys.size === itens.length) {
      setSelectedRowKeys(new Set());
    } else {
      setSelectedRowKeys(new Set(itens.map(getRowKey)));
    }
  };

  const executarConfirmacao = async (itensPayload: ItemColetaPayload[]) => {
    if (itensPayload.length === 0) return;
    setConfirmando(true);
    setErro(null);
    setColetasEmConflito(null);
    setSucesso(false);
    setModalVincular(null);
    try {
      if (isAdicionarItens) {
        const result = await adicionarItensColeta(coletaIdToAddTo!, itensPayload);
        if (result.ok) {
          setSucesso(true);
          setConfirmando(false);
          onConfirmar?.(Array.from(selectedRowKeys));
        } else {
          setErro(result.error ?? 'Erro ao adicionar itens.');
          setConfirmando(false);
        }
      } else {
        const result = await confirmarColetaPrecos(itensPayload);
        if (result.ok) {
          setColetaId(result.coletaId ?? null);
          setSucesso(true);
          setConfirmando(false);
        } else {
          if (result.bloqueante && result.coletas?.length) {
            onConfirmar?.([], { bloqueante: true, coletas: result.coletas });
            onClose();
            setConfirmando(false);
            return;
          }
          setErro(result.error ?? 'Erro ao confirmar seleção.');
          setColetasEmConflito(result.coletasEmConflito ?? null);
          setConfirmando(false);
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar seleção.');
      setColetasEmConflito(null);
      setConfirmando(false);
    }
  };

  const handleConfirmar = () => {
    const selectedItems = itens.filter((i) => selectedRowKeys.has(getRowKey(i)));
    if (selectedItems.length === 0) return;
    const itensPayload: ItemColetaPayload[] = selectedItems.map((i) => ({
      idProduto: Number(i.id),
      codigoSolicitacao: i.codigoSolicitacaoNum ?? undefined,
    }));
    const temSolicitacao = itensPayload.some((i) => i.codigoSolicitacao != null && i.codigoSolicitacao > 0);
    if (temSolicitacao) {
      setModalVincular({ aberto: true, itensPayload });
      return;
    }
    executarConfirmacao(itensPayload);
  };

  const handleConfirmarVinculacao = (vincular: boolean) => {
    if (!modalVincular?.itensPayload) return;
    const itensPayload = vincular
      ? modalVincular.itensPayload
      : modalVincular.itensPayload.map(({ idProduto }) => ({ idProduto, codigoSolicitacao: null }));
    executarConfirmacao(itensPayload);
  };

  const handleFecharAposSucesso = () => {
    onConfirmar?.(Array.from(selectedRowKeys));
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (confirmando || sucesso)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmando, sucesso]);

  const allSelected = itens.length > 0 && selectedRowKeys.size === itens.length;
  const someSelected = selectedRowKeys.size > 0;
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRangeRef = useRef({ start: 0, end: 0 });
  const handleScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const top = el.scrollTop;
      const height = el.clientHeight;
      const start = Math.max(0, Math.floor(top / ROW_HEIGHT_PX) - 8);
      const count = Math.ceil(height / ROW_HEIGHT_PX) + 20;
      const end = Math.min(itens.length, start + count);
      const last = lastRangeRef.current;
      if (last.start === start && last.end === end) return;
      lastRangeRef.current = { start, end };
      setScrollTop(top);
      setContainerHeight(height);
    });
  }, [itens.length]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const height = el.clientHeight;
    setScrollTop(top);
    setContainerHeight(height);
    lastRangeRef.current = { start: 0, end: Math.min(itens.length, Math.ceil(height / ROW_HEIGHT_PX) + 20) };
    const ro = new ResizeObserver(() => {
      if (el) {
        setContainerHeight(el.clientHeight);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, itens.length]);
  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - 8);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT_PX) + 20;
  const visibleEnd = Math.min(itens.length, visibleStart + visibleCount);
  const visibleItems = itens.slice(visibleStart, visibleEnd);

  const bloqueado = confirmando || sucesso;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={bloqueado ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-criar-coleta-title"
    >
      <div
        className={`rounded-xl shadow-xl w-full max-w-6xl max-h-[94vh] flex flex-col relative overflow-hidden border ${loading ? 'min-h-[320px] bg-slate-900 border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900 pointer-events-auto min-h-full w-full" style={{ borderRadius: 'inherit' }} aria-live="polite" aria-busy="true">
            <div className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mb-4 shrink-0" role="status" aria-label="Carregando" />
            <p className="text-white font-medium text-center px-6">Carregando dados...</p>
            <p className="text-slate-300 text-sm text-center mt-1 px-6">Aguarde enquanto buscamos os produtos.</p>
          </div>
        )}
        {confirmando && !loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm pointer-events-auto" aria-live="polite">
            <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" role="status" aria-label="Carregando" />
            <p className="text-white font-medium text-center px-6">
              {isAdicionarItens ? 'Adicionando itens à coleta…' : 'Criando coleta e carregando preços do sistema externo…'}
            </p>
            {!isAdicionarItens && (
              <p className="text-slate-300 text-sm text-center mt-1 px-6">
                Isso pode levar até 1 minuto. Não feche esta janela.
              </p>
            )}
          </div>
        )}
        {sucesso && !confirmando && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-xl bg-slate-900/90 backdrop-blur-sm pointer-events-auto" aria-live="polite">
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg text-center px-6">
              {isAdicionarItens ? 'Itens adicionados à coleta!' : 'Coleta criada com sucesso!'}
            </p>
            {!isAdicionarItens && coletaId != null && (
              <p className="text-emerald-200 text-sm text-center mt-1 px-6">
                Coleta #{coletaId} disponível na lista.
              </p>
            )}
            <button
              type="button"
              onClick={isAdicionarItens ? onClose : handleFecharAposSucesso}
              className="mt-6 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
            >
              Fechar
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-600 shrink-0">
          <h2 id="modal-criar-coleta-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isAdicionarItens ? 'Adicionar itens à coleta' : 'Criação da Coleta de Preços'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            className="rounded p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 dark:hover:text-slate-200 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Filtros – duas linhas, caixas mais largas */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-600 shrink-0">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2 items-end">
            <div className="min-w-0">
              <label className={labelClass}>Código</label>
              <input type="text" placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} className={`${inputClass} w-full`} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Descrição</label>
              <input type="text" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} className={`${inputClass} w-full`} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Família</label>
              <input type="text" placeholder="Família" value={familia} onChange={(e) => setFamilia(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} className={`${inputClass} w-full`} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Fornecedor</label>
              <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} className={`${inputClass} w-full`} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Coleta</label>
              <input type="text" placeholder="Coleta" value={coleta} onChange={(e) => setColeta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBuscar()} className={`${inputClass} w-full`} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Dia da Semana</label>
              <select value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)} className={`${inputClass} w-full`}>
                <option value="">Todos</option>
                <option value="Segunda">Segunda</option>
                <option value="Terça">Terça</option>
                <option value="Quarta">Quarta</option>
                <option value="Quinta">Quinta</option>
                <option value="Sexta">Sexta</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={apenasComSolicitacao} onChange={(e) => setApenasComSolicitacao(e.target.checked)} className="rounded border-slate-400 text-primary-600 focus:ring-primary-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Com solicitação</span>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBuscar} disabled={loading} className={btnPrimary} title="Buscar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                Buscar
              </button>
              <button type="button" onClick={handleLimparFiltros} className={btnSecondary} title="Limpar filtros">Limpar</button>
              <button type="button" onClick={handleAtualizar} disabled={loading} className={btnSecondary} title="Atualizar lista">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0015 6.74L21 16" /><path d="M16 21h5v-5" /></svg>
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Itens selecionados + ações */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-600 shrink-0 bg-slate-50 dark:bg-slate-700/30">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {selectedRowKeys.size} itens selecionados.
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelectedRowKeys(new Set())} disabled={!someSelected} className={btnSecondary} title="Limpar seleção">Limpar</button>
          </div>
        </div>

        {/* Tabela de produtos (scroll com ref para virtualização) */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-auto px-4 py-2 relative">
          {erro && !(coletasEmConflito && coletasEmConflito.length > 0) && (
            <div className="py-2 text-amber-600 dark:text-amber-400 text-sm">
              {erro}
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 rounded-lg min-h-[200px]" aria-live="polite" aria-busy="true">
              <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-300 py-8">
                <svg className="animate-spin h-10 w-10 text-primary-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium">Carregando...</span>
              </div>
            </div>
          )}
          {!loading && (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-primary-600 text-white shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <tr>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-400 text-primary-600 focus:ring-primary-500"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Nome Produto</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Descrição</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Unidade Medida</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Código Solicitação</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Qtde Solicitada</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Último Fornecedor</th>
                  <th className="sticky top-0 z-20 bg-primary-600 text-left py-2 px-2 font-semibold">Família</th>
                </tr>
              </thead>
              <tbody className="relative z-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                {itens.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum produto encontrado. Ajuste os filtros e clique em Buscar.
                    </td>
                  </tr>
                )}
                {itens.length > 0 && visibleStart > 0 && (
                  <tr aria-hidden="true"><td colSpan={8} style={{ height: visibleStart * ROW_HEIGHT_PX, padding: 0, border: 'none', lineHeight: 0 }} /></tr>
                )}
                {visibleItems.map((item, idx) => (
                  <tr
                    key={getRowKey(item)}
                    style={{ height: ROW_HEIGHT_PX }}
                    className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                      selectedRowKeys.has(getRowKey(item)) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="py-2 px-2">
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.has(getRowKey(item))}
                        onChange={() => toggleSelect(getRowKey(item))}
                        className="rounded border-slate-400 text-primary-600 focus:ring-primary-500"
                        aria-label={`Selecionar ${item.nomeProduto}`}
                      />
                    </td>
                    <td className="py-2 px-2 font-medium">{item.nomeProduto}</td>
                    <td className="py-2 px-2 max-w-[220px] truncate" title={item.descricao}>{item.descricao}</td>
                    <td className="py-2 px-2">{item.unidadeMedida}</td>
                    <td className="py-2 px-2">{item.codigoSolicitacao}</td>
                    <td className="py-2 px-2">{item.qtdeSolicitada}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={item.ultimoFornecedor}>{item.ultimoFornecedor}</td>
                    <td className="py-2 px-2">{item.familia}</td>
                  </tr>
                ))}
                {itens.length > 0 && visibleEnd < itens.length && (
                  <tr aria-hidden="true"><td colSpan={8} style={{ height: (itens.length - visibleEnd) * ROW_HEIGHT_PX, padding: 0, border: 'none', lineHeight: 0 }} /></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé com ações */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-600 shrink-0 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl">
          <button type="button" onClick={onClose} disabled={bloqueado} className={btnSecondary}>Cancelar</button>
          <button type="button" onClick={handleConfirmar} disabled={selectedRowKeys.size === 0 || confirmando} className={btnConfirmarColeta}>
            {confirmando ? 'Criando coleta...' : `Confirmar seleção (${selectedRowKeys.size})`}
          </button>
        </div>
      </div>

      {/* Modal de aviso: solicitação já vinculada a coleta existente */}
      {erro && coletasEmConflito && coletasEmConflito.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75"
          onClick={() => { setErro(null); setColetasEmConflito(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-aviso-vinculacao-title"
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-w-lg w-full p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-aviso-vinculacao-title" className="text-lg font-semibold text-amber-700 dark:text-amber-400">
              Não é possível criar a coleta
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              {erro}
            </p>
            <div className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Coletas com vínculo: </span>
              <span className="text-slate-600 dark:text-slate-300">
                {coletasEmConflito.map((c) => `#${c.id} (${c.status})`).join(', ')}
              </span>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => { setErro(null); setColetasEmConflito(null); }}
                className={btnPrimary}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalVincular?.aberto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75"
          onClick={() => setModalVincular(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vincular-solicitacao-title"
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-vincular-solicitacao-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Vincular à(s) solicitação(ões)?
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              Existem itens com solicitação de compra. Deseja vincular a cotação a essa(s) solicitação(ões) selecionada(s)?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => handleConfirmarVinculacao(false)}
                className={btnSecondary}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => handleConfirmarVinculacao(true)}
                className={btnConfirmarColeta}
              >
                Sim, vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
