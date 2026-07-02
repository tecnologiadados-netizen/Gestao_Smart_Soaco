import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDfcSaldoFaturar, type DfcSaldoFaturarLinha } from '../../../api/financeiro';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const inputFiltroClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 text-sm min-w-0';

type ColKey = keyof DfcSaldoFaturarLinha | 'saldoPorParcela';

type ColDef = {
  key: ColKey;
  label: string;
  align?: 'left' | 'right';
  date?: boolean;
  money?: boolean;
};

const COLUNAS: ColDef[] = [
  { key: 'idEmpresa', label: 'Empresa' },
  { key: 'tipoPedido', label: 'Tipo Pedido' },
  { key: 'idParcela', label: 'Parcela' },
  { key: 'pd', label: 'PD' },
  { key: 'dataEmissao', label: 'Emissão', date: true },
  { key: 'dataPrevisao', label: 'Previsão', date: true },
  { key: 'dataVencimento', label: 'Vencimento', date: true },
  { key: 'dataProjVenc', label: 'Data Proj Venc', date: true },
  { key: 'parc', label: 'Parc.', align: 'right' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'requisicaoLojaGrupo', label: 'Req. loja grupo?' },
  { key: 'uf', label: 'UF' },
  { key: 'municipioEntrega', label: 'Município entrega' },
  { key: 'formaPagamento', label: 'Forma pagamento' },
  { key: 'condicaoPagamento', label: 'Condição pagamento' },
  { key: 'vendaPorEmpresa', label: 'Venda por empresa?' },
  { key: 'vendedorRepresentante', label: 'Vendedor/Rep.' },
  { key: 'valorAdiantamento', label: 'Adiantamento', money: true },
  { key: 'saldoFaturarReal', label: 'Saldo a faturar', money: true },
  { key: 'qtdeParcelas', label: 'Qtd parcelas', align: 'right' },
  { key: 'saldoPorParcela', label: 'Saldo a faturar / parcelas', money: true, align: 'right' },
];

function saldoFaturarPorParcela(row: DfcSaldoFaturarLinha): number | null {
  const parcelas = row.qtdeParcelas;
  if (parcelas == null || parcelas <= 0) return null;
  return row.saldoFaturarReal / parcelas;
}

function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

function fmtCelula(row: DfcSaldoFaturarLinha, col: ColDef): string {
  if (col.key === 'saldoPorParcela') {
    const v = saldoFaturarPorParcela(row);
    return v == null ? '—' : brl.format(v);
  }
  const v = row[col.key as keyof DfcSaldoFaturarLinha];
  if (v == null || v === '') return '—';
  if (col.date) return fmtDataBr(String(v));
  if (col.money) return brl.format(Number(v));
  if (typeof v === 'number') return String(v);
  return String(v);
}

function linhaPassaFiltrosLocais(row: DfcSaldoFaturarLinha, busca: string): boolean {
  if (!busca.trim()) return true;
  const hay = [
    row.pd,
    row.cliente,
    row.tipoPedido,
    row.formaPagamento,
    row.condicaoPagamento,
    row.vendedorRepresentante,
    row.municipioEntrega,
    row.uf,
  ]
    .filter(Boolean)
    .join(' ');
  return textoPassaBuscaLivre(busca, hay);
}

export type DfcSaldoFaturarModalProps = {
  aberto: boolean;
  onClose: () => void;
  idEmpresas: number[];
};

const PAGE_SIZE = 100;

export default function DfcSaldoFaturarModal({ aberto, onClose, idEmpresas }: DfcSaldoFaturarModalProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<DfcSaldoFaturarLinha[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const [dataEmissaoInicio, setDataEmissaoInicio] = useState('');
  const [dataEmissaoFim, setDataEmissaoFim] = useState('');
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('');
  const [dataVencimentoFim, setDataVencimentoFim] = useState('');
  const [dataPrevisaoInicio, setDataPrevisaoInicio] = useState('');
  const [dataPrevisaoFim, setDataPrevisaoFim] = useState('');
  const [filtroPd, setFiltroPd] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroTipoPedido, setFiltroTipoPedido] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const loadId = useRef(0);

  const carregarPagina = useCallback(
    async (pagina: number) => {
      loadId.current += 1;
      const myId = loadId.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setErro(undefined);

      try {
        const r = await fetchDfcSaldoFaturar({
          idEmpresas,
          dataEmissaoInicio: dataEmissaoInicio || undefined,
          dataEmissaoFim: dataEmissaoFim || undefined,
          dataVencimentoInicio: dataVencimentoInicio || undefined,
          dataVencimentoFim: dataVencimentoFim || undefined,
          dataPrevisaoInicio: dataPrevisaoInicio || undefined,
          dataPrevisaoFim: dataPrevisaoFim || undefined,
          pd: filtroPd || undefined,
          cliente: filtroCliente || undefined,
          uf: filtroUf || undefined,
          tipoPedido: filtroTipoPedido || undefined,
          page: pagina,
          limit: PAGE_SIZE,
          signal: ac.signal,
        });
        if (myId !== loadId.current) return;
        setLinhas(r.linhas);
        setPage(r.page ?? pagina);
        setHasMore(r.hasMore ?? false);
        setTruncado(r.truncado ?? false);
        if (r.erro) setErro(r.erro);
      } catch (e: unknown) {
        if (myId !== loadId.current) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setLinhas([]);
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (myId === loadId.current) setLoading(false);
      }
    },
    [
      idEmpresas,
      dataEmissaoInicio,
      dataEmissaoFim,
      dataVencimentoInicio,
      dataVencimentoFim,
      dataPrevisaoInicio,
      dataPrevisaoFim,
      filtroPd,
      filtroCliente,
      filtroUf,
      filtroTipoPedido,
    ],
  );

  useEffect(() => {
    if (!aberto) return;
    setPage(1);
    void carregarPagina(1);
    return () => {
      abortRef.current?.abort();
      loadId.current += 1;
    };
  }, [aberto, carregarPagina]);

  const linhasFiltradas = useMemo(
    () => linhas.filter((row) => linhaPassaFiltrosLocais(row, filtroBusca)),
    [linhas, filtroBusca],
  );

  const somaSaldo = useMemo(
    () => linhasFiltradas.reduce((s, r) => s + (r.saldoFaturarReal ?? 0), 0),
    [linhasFiltradas],
  );

  const temFiltroLocal = Boolean(filtroBusca.trim());
  const temFiltroServidor = Boolean(
    dataEmissaoInicio ||
      dataEmissaoFim ||
      dataVencimentoInicio ||
      dataVencimentoFim ||
      dataPrevisaoInicio ||
      dataPrevisaoFim ||
      filtroPd.trim() ||
      filtroCliente.trim() ||
      filtroUf.trim() ||
      filtroTipoPedido.trim(),
  );

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[98vw] max-h-[min(92vh,900px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800 font-sans"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-saldo-faturar-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
          <h2 id="dfc-saldo-faturar-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Saldo a faturar
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Parcelas de pedidos liberados — previsão do Gerenciador de Pedidos
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-600 dark:hover:text-slate-100"
          aria-label="Fechar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/35 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Filtros (consulta Nomus)</span>
          <div className="flex items-center gap-2">
            {(temFiltroLocal || temFiltroServidor) && !loading ? (
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {linhasFiltradas.length} de {linhas.length}
              </span>
            ) : null}
            {temFiltroServidor ? (
              <button
                type="button"
                onClick={() => {
                  setDataEmissaoInicio('');
                  setDataEmissaoFim('');
                  setDataVencimentoInicio('');
                  setDataVencimentoFim('');
                  setDataPrevisaoInicio('');
                  setDataPrevisaoFim('');
                  setFiltroPd('');
                  setFiltroCliente('');
                  setFiltroUf('');
                  setFiltroTipoPedido('');
                }}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Limpar filtros Nomus
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Emissão de</span>
            <input type="date" value={dataEmissaoInicio} onChange={(e) => setDataEmissaoInicio(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Emissão até</span>
            <input type="date" value={dataEmissaoFim} onChange={(e) => setDataEmissaoFim(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Venc. de</span>
            <input type="date" value={dataVencimentoInicio} onChange={(e) => setDataVencimentoInicio(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Venc. até</span>
            <input type="date" value={dataVencimentoFim} onChange={(e) => setDataVencimentoFim(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Previsão de</span>
            <input type="date" value={dataPrevisaoInicio} onChange={(e) => setDataPrevisaoInicio(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Previsão até</span>
            <input type="date" value={dataPrevisaoFim} onChange={(e) => setDataPrevisaoFim(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex min-w-[7rem] flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">PD</span>
            <input type="search" value={filtroPd} onChange={(e) => setFiltroPd(e.target.value)} placeholder="Ex.: 48627" className={inputFiltroClass} />
          </label>
          <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Cliente</span>
            <input type="search" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE} className={inputFiltroClass} />
          </label>
          <label className="flex w-14 flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">UF</span>
            <input type="search" value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)} className={inputFiltroClass} />
          </label>
          <label className="flex min-w-[7rem] flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tipo pedido</span>
            <input type="search" value={filtroTipoPedido} onChange={(e) => setFiltroTipoPedido(e.target.value)} className={inputFiltroClass} />
          </label>
          <button
            type="button"
            onClick={() => void carregarPagina(1)}
            disabled={loading}
            className="self-end px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Carregando…' : 'Aplicar'}
          </button>
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Busca rápida na grade</span>
          <input
            type="search"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="PD, cliente, forma… (% refina)"
            className={inputFiltroClass}
            disabled={loading || linhas.length === 0}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500 animate-pulse">Carregando…</div>
        ) : erro && linhas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-amber-800 dark:text-amber-200">{erro}</div>
        ) : linhas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">Nenhum registro.</div>
        ) : (
          <table className="w-full border-collapse text-left text-xs min-w-[1400px]">
            <thead className="sticky top-0 z-[1]">
              <tr className="bg-primary-600 text-white">
                {COLUNAS.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-2 py-2 font-semibold ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma linha corresponde aos filtros.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((row, idx) => (
                  <tr
                    key={`${row.pd}-${row.idParcela}-${idx}`}
                    className="border-t border-slate-100 odd:bg-white even:bg-slate-50/90 dark:border-slate-700/80 dark:odd:bg-slate-800/30 dark:even:bg-slate-800/55"
                  >
                    {COLUNAS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 align-top text-slate-800 dark:text-slate-200 ${
                          col.align === 'right' ? 'text-right tabular-nums' : ''
                        } ${col.key === 'cliente' || col.key === 'municipioEntrega' ? 'max-w-[12rem] break-words' : 'whitespace-nowrap'}`}
                      >
                        {fmtCelula(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && linhas.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-600 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => void carregarPagina(page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Anterior
            </button>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
              Página {page}
              {hasMore ? ' · há mais' : ''}
            </span>
            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => void carregarPagina(page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Próxima
            </button>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{PAGE_SIZE} linhas por página</span>
        </div>
      ) : null}

      {!loading && linhas.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-primary-700/30 bg-primary-600 px-4 py-2.5 text-sm text-white">
          <span>Total saldo a faturar (página){temFiltroLocal ? ' · filtrado na grade' : ''}</span>
          <span className="font-semibold tabular-nums">{brl.format(somaSaldo)}</span>
        </div>
      ) : null}

      {truncado && !loading && linhas.length > 0 && !hasMore ? (
        <div className="shrink-0 border-t border-amber-200/80 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
          Limite de 8000 linhas na carga completa — refine os filtros Nomus.
        </div>
      ) : null}
      </div>
    </div>,
    document.body,
  );
}
