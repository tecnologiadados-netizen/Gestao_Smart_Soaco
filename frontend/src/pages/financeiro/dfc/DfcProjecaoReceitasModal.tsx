import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDfcProjecaoReceitasDetalhe, type DfcSaldoFaturarLinha } from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import { SortableTh, compareStr, compareYmd, nextSortDir, type SortDir } from './dfcDetalheTabelaUtils';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function saldoFaturarPorParcela(row: DfcSaldoFaturarLinha): number {
  const parcelas = row.qtdeParcelas;
  if (parcelas == null || parcelas <= 0) return 0;
  return row.saldoFaturarReal / parcelas;
}

function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

export type DfcProjecaoReceitasModalProps = {
  aberto: boolean;
  onClose: () => void;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas: number[];
  periodo?: string;
};

export default function DfcProjecaoReceitasModal({
  aberto,
  onClose,
  titulo,
  dataInicio,
  dataFim,
  granularidade,
  idEmpresas,
  periodo,
}: DfcProjecaoReceitasModalProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<DfcSaldoFaturarLinha[]>([]);
  const [busca, setBusca] = useState('');
  type ColSort =
    | 'empresa'
    | 'pd'
    | 'parcela'
    | 'cliente'
    | 'previsao'
    | 'projVenc'
    | 'condicao'
    | 'valor';
  const [sortKey, setSortKey] = useState<ColSort>('projVenc');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const loadId = useRef(0);

  const carregar = useCallback(async () => {
    loadId.current += 1;
    const myId = loadId.current;
    setLoading(true);
    setErro(undefined);
    try {
      const r = await fetchDfcProjecaoReceitasDetalhe({
        dataInicio,
        dataFim,
        granularidade,
        idEmpresas,
        periodo,
      });
      if (myId !== loadId.current) return;
      setLinhas(r.linhas);
      if (r.erro) setErro(r.erro);
    } catch (e: unknown) {
      if (myId !== loadId.current) return;
      setLinhas([]);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (myId === loadId.current) setLoading(false);
    }
  }, [dataInicio, dataFim, granularidade, idEmpresas, periodo]);

  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    void carregar();
  }, [aberto, carregar]);

  const linhasFiltradas = useMemo(() => {
    if (!busca.trim()) return linhas;
    return linhas.filter((row) => {
      const hay = [row.pd, row.cliente, row.tipoPedido, row.formaPagamento, row.condicaoPagamento]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(busca, hay);
    });
  }, [linhas, busca]);

  const onSortCol = useCallback((key: string) => {
    const k = key as ColSort;
    setSortKey((prevKey) => {
      setSortDir((prevDir) => nextSortDir(prevKey, k, prevDir));
      return k;
    });
  }, []);

  const linhasOrdenadas = useMemo(() => {
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...linhasFiltradas].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'empresa':
          cmp = compareStr(labelEmpresaDfc(a.idEmpresa), labelEmpresaDfc(b.idEmpresa));
          break;
        case 'pd':
          cmp = compareStr(a.pd, b.pd);
          break;
        case 'parcela':
          cmp = (a.idParcela ?? 0) - (b.idParcela ?? 0);
          break;
        case 'cliente':
          cmp = compareStr(a.cliente, b.cliente);
          break;
        case 'previsao':
          cmp = compareYmd(a.dataPrevisao, b.dataPrevisao);
          break;
        case 'projVenc':
          cmp = compareYmd(a.dataProjVenc, b.dataProjVenc);
          break;
        case 'condicao':
          cmp = compareStr(a.condicaoPagamento, b.condicaoPagamento);
          break;
        case 'valor':
          cmp = saldoFaturarPorParcela(a) - saldoFaturarPorParcela(b);
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
  }, [linhasFiltradas, sortKey, sortDir]);

  const totalProj = useMemo(
    () => linhasOrdenadas.reduce((s, r) => s + saldoFaturarPorParcela(r), 0),
    [linhasOrdenadas],
  );

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[98vw] max-h-[min(92vh,900px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-projecao-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dfc-projecao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Projeção de Receitas
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm"
          />
        </div>

        {erro ? (
          <p className="shrink-0 px-4 py-2 text-sm text-red-600 dark:text-red-400">{erro}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500 animate-pulse">Carregando parcelas…</p>
          ) : linhas.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Nenhuma parcela neste recorte.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-white shadow-sm">
                  <SortableTh label="Empresa" sortKey="empresa" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="PD" sortKey="pd" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Parcela" sortKey="parcela" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Cliente" sortKey="cliente" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Previsão" sortKey="previsao" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Data Proj Venc" sortKey="projVenc" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Condição" sortKey="condicao" activeKey={sortKey} dir={sortDir} onSort={onSortCol} />
                  <SortableTh label="Saldo / parcela" sortKey="valor" activeKey={sortKey} dir={sortDir} onSort={onSortCol} align="right" />
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadas.map((row) => (
                  <tr
                    key={`${row.idParcela ?? 'x'}-${row.idPedido}-${row.pd}`}
                    className="border-t border-slate-100 dark:border-slate-700"
                  >
                    <td className="px-2 py-1.5">{labelEmpresaDfc(row.idEmpresa)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.pd ?? '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.idParcela ?? '—'}</td>
                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.cliente ?? ''}>
                      {row.cliente ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataBr(row.dataPrevisao)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataBr(row.dataProjVenc)}</td>
                    <td className="px-2 py-1.5 max-w-[160px] truncate" title={row.condicaoPagamento ?? ''}>
                      {row.condicaoPagamento ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {brl.format(saldoFaturarPorParcela(row))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 flex justify-between border-t border-slate-200 px-4 py-2 text-sm dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
          <span className="text-slate-600 dark:text-slate-400">
            {linhas.length} parcela{linhas.length !== 1 ? 's' : ''}
            {busca.trim() ? ' (filtrado)' : ''}
          </span>
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            Total: {brl.format(totalProj)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
