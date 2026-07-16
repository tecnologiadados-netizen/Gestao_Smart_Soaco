import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPreCompraCotacoes,
  type FiltrosPreCompra,
  type PreCompraCotacaoItem,
} from '../../api/preCompra';
import PreCompraFiltros from '../../components/compras/preCompra/PreCompraFiltros';
import PreCompraTabela from '../../components/compras/preCompra/PreCompraTabela';
import ModalEmitirPdfPreCompra from '../../components/compras/preCompra/ModalEmitirPdfPreCompra';

const PAGE_SIZE = 20;
/** Busca todos os registros do período de uma vez (filtros de coluna são client-side). */
const FETCH_PAGE_SIZE = 5000;

const defaultFilters: FiltrosPreCompra = {};

export default function PreCompraPage() {
  const [filters, setFilters] = useState<FiltrosPreCompra>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FiltrosPreCompra>(defaultFilters);
  const [items, setItems] = useState<PreCompraCotacaoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [exibidos, setExibidos] = useState(0);
  const [pdfCotacao, setPdfCotacao] = useState<string | null>(null);
  const [generatingCotacao, setGeneratingCotacao] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const limparFiltrosGradeRef = useRef<(() => void) | null>(null);

  const load = useCallback(async (f: FiltrosPreCompra) => {
    setLoading(true);
    setError('');
    try {
      const all: PreCompraCotacaoItem[] = [];
      let pageNum = 1;
      let totalPagesFetch = 1;
      do {
        const data = await fetchPreCompraCotacoes({
          data_inicio: f.data_inicio,
          data_fim: f.data_fim,
          page: pageNum,
          page_size: FETCH_PAGE_SIZE,
        });
        all.push(...data.items);
        totalPagesFetch = data.totalPages;
        pageNum += 1;
      } while (pageNum <= totalPagesFetch);
      setItems(all);
      setExibidos(all.length);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
      setItems([]);
      setExibidos(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(appliedFilters);
  }, [appliedFilters, load]);

  const handleSearch = () => {
    limparFiltrosGradeRef.current?.();
    setAppliedFilters({ ...filters });
  };

  const handleClear = () => {
    limparFiltrosGradeRef.current?.();
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const totalPages = Math.max(1, Math.ceil(exibidos / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = exibidos === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, exibidos);

  return (
    <div className="p-4 md:p-6 max-w-[100%]">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Pré Compra</h1>
          <button
            type="button"
            onClick={() => setMostrarFiltros((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
            title={mostrarFiltros ? 'Ocultar filtros' : 'Exibir filtros'}
            aria-label={mostrarFiltros ? 'Ocultar filtros' : 'Exibir filtros'}
          >
            {mostrarFiltros ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta e emissão de formulários — Decisão de compra e Encerrada
        </p>
      </header>

      {mostrarFiltros && (
        <PreCompraFiltros
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          onClear={handleClear}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm text-slate-600 dark:text-slate-400">
        <span>
          Resultados: <strong className="text-slate-800 dark:text-slate-200">{start}</strong> a{' '}
          <strong className="text-slate-800 dark:text-slate-200">{end}</strong> de{' '}
          <strong className="text-slate-800 dark:text-slate-200">{exibidos}</strong>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
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
          page={safePage}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onExibidosCountChange={setExibidos}
          limparFiltrosGradeRef={limparFiltrosGradeRef}
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
