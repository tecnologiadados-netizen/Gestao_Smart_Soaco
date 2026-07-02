import { useCallback, useEffect, useState } from 'react';
import {
  fetchPreCompraCotacoes,
  type FiltrosPreCompra,
  type PreCompraCotacaoItem,
} from '../../api/preCompra';
import PreCompraFiltros from '../../components/compras/preCompra/PreCompraFiltros';
import PreCompraTabela from '../../components/compras/preCompra/PreCompraTabela';
import ModalEmitirPdfPreCompra from '../../components/compras/preCompra/ModalEmitirPdfPreCompra';

const defaultFilters: FiltrosPreCompra = { page: 1, page_size: 20 };

export default function PreCompraPage() {
  const [filters, setFilters] = useState<FiltrosPreCompra>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FiltrosPreCompra>(defaultFilters);
  const [items, setItems] = useState<PreCompraCotacaoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfCotacao, setPdfCotacao] = useState<string | null>(null);
  const [generatingCotacao, setGeneratingCotacao] = useState<string | null>(null);

  const load = useCallback(async (f: FiltrosPreCompra) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPreCompraCotacoes(f);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(appliedFilters);
  }, [appliedFilters, load]);

  const handleSearch = () => setAppliedFilters({ ...filters, page: 1 });
  const handleClear = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const goToPage = (p: number) => {
    const next = { ...appliedFilters, page: p };
    setFilters(next);
    setAppliedFilters(next);
  };

  const pageSize = appliedFilters.page_size ?? 20;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="p-4 md:p-6 max-w-[100%]">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Pré Compra</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta e emissão de formulários — Decisão de compra e Encerrada
        </p>
      </header>

      <PreCompraFiltros
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm text-slate-600 dark:text-slate-400">
        <span>
          Resultados: <strong className="text-slate-800 dark:text-slate-200">{start}</strong> a{' '}
          <strong className="text-slate-800 dark:text-slate-200">{end}</strong> de{' '}
          <strong className="text-slate-800 dark:text-slate-200">{total}</strong>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            aria-label="Próxima"
          >
            ›
          </button>
        </div>
      </div>

      {loading && (
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Carregando cotações…
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && (
        <PreCompraTabela
          items={items}
          onEmitirPdf={setPdfCotacao}
          generatingCotacao={generatingCotacao}
        />
      )}

      <ModalEmitirPdfPreCompra
        cotacao={pdfCotacao}
        onClose={() => {
          setPdfCotacao(null);
          setGeneratingCotacao(null);
        }}
        onGeneratingChange={setGeneratingCotacao}
      />
    </div>
  );
}
