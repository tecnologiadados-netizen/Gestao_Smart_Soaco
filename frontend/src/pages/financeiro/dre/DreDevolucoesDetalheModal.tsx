import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDreDevolucoesDetalhe, type DreDevolucoesDetalheLinha } from '../../../api/financeiro';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';
import {
  SortableTh,
  compareStr,
  compareYmd,
  nextSortDir,
  type SortDir,
} from '../dfc/dfcDetalheTabelaUtils';
import { periodoReceitaParaIntervalo } from './dreReceitaDetalheUtils';

type ColSort = 'dataEmissao' | 'nf' | 'produto' | 'grupoProduto' | 'tipoMovimentacao' | 'qtde' | 'valorTotal';

const CELULA_CLASS = 'px-2 py-1.5 text-sm text-black dark:text-black font-sans';

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function compareNum(a: number, b: number): number {
  return a - b;
}

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

export type DreDevolucoesDetalheModalProps = {
  onClose: () => void;
  titulo: string;
  idEmpresa: number;
  periodo: string | undefined;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  /** Valor da célula na grade DRE (dedução, normalmente negativo) — conferência de integridade. */
  valorEsperadoGrade?: number;
};

export default function DreDevolucoesDetalheModal({
  onClose,
  titulo,
  idEmpresa,
  periodo,
  dataInicio,
  dataFim,
  granularidade,
  valorEsperadoGrade,
}: DreDevolucoesDetalheModalProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<DreDevolucoesDetalheLinha[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<ColSort>('dataEmissao');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const loadId = useRef(0);

  const intervalo = useMemo(
    () => periodoReceitaParaIntervalo(periodo, granularidade, dataInicio, dataFim),
    [periodo, granularidade, dataInicio, dataFim],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const id = ++loadId.current;
    setLoading(true);
    setErro(undefined);
    setLinhas([]);
    setTruncado(false);
    void fetchDreDevolucoesDetalhe({
      dataInicio: intervalo.dataInicio,
      dataFim: intervalo.dataFim,
      idEmpresa,
    }).then((r) => {
      if (id !== loadId.current) return;
      if (r.erro) setErro(r.erro);
      setLinhas(r.detalhes);
      setTruncado(r.truncado === true);
      setLoading(false);
    });
  }, [intervalo.dataInicio, intervalo.dataFim, idEmpresa]);

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return linhas;
    return linhas.filter((row) => {
      const hay = [
        row.produto,
        row.grupoProduto,
        row.tipoMovimentacao,
        String(row.numeroDocumentoFiscal ?? ''),
        String(row.idItemDocumentoEstoque),
        fmtDataBr(row.dataEmissao),
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(q, hay);
    });
  }, [linhas, busca]);

  const linhasOrdenadas = useMemo(() => {
    const list = [...linhasFiltradas];
    const sinal = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case 'dataEmissao':
          c = compareYmd(a.dataEmissao, b.dataEmissao);
          break;
        case 'nf':
          c = compareNum(a.numeroDocumentoFiscal ?? 0, b.numeroDocumentoFiscal ?? 0);
          break;
        case 'produto':
          c = compareStr(a.produto, b.produto);
          break;
        case 'grupoProduto':
          c = compareStr(a.grupoProduto, b.grupoProduto);
          break;
        case 'tipoMovimentacao':
          c = compareStr(a.tipoMovimentacao, b.tipoMovimentacao);
          break;
        case 'qtde':
          c = compareNum(a.qtde, b.qtde);
          break;
        case 'valorTotal':
          c = compareNum(a.valorTotal, b.valorTotal);
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c * sinal;
      return compareNum(a.idItemDocumentoEstoque, b.idItemDocumentoEstoque) * sinal;
    });
    return list;
  }, [linhasFiltradas, sortKey, sortDir]);

  const totalDetalhe = useMemo(
    () => linhasFiltradas.reduce((s, r) => s + r.valorTotal, 0),
    [linhasFiltradas],
  );

  const onSortCol = (key: ColSort) => {
    setSortDir((d) => nextSortDir(sortKey, key, d));
    setSortKey(key);
  };

  const gradeAbs = valorEsperadoGrade != null ? Math.abs(valorEsperadoGrade) : null;
  const diffGrade = gradeAbs != null && gradeAbs !== 0 ? totalDetalhe - gradeAbs : null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-5xl max-h-[min(92vh,880px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dre-devolucoes-detalhe-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dre-devolucoes-detalhe-titulo" className="text-lg font-semibold text-black dark:text-black">
              Detalhe — Devoluções (Nomus)
            </h2>
            <p className="mt-0.5 break-words text-sm text-black/80 dark:text-black/80">{titulo}</p>
            <p className="mt-1 text-xs text-black/60 dark:text-black/60">
              {intervalo.dataInicio === intervalo.dataFim
                ? fmtDataBr(intervalo.dataInicio)
                : `${fmtDataBr(intervalo.dataInicio)} → ${fmtDataBr(intervalo.dataFim)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-black/70 hover:bg-slate-200 dark:hover:bg-slate-600"
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
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-black dark:text-black"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-black/60 animate-pulse">Carregando itens Nomus…</p>
          ) : erro ? (
            <p className="px-4 py-8 text-sm text-red-700">{erro}</p>
          ) : linhasFiltradas.length === 0 ? (
            <p className="px-4 py-8 text-sm text-black/60">Nenhum item de devolução para este recorte.</p>
          ) : (
            <table className="w-full text-sm border-collapse font-sans">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-xs text-white">
                  <SortableTh label="Emissão" sortKey="dataEmissao" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="NF" sortKey="nf" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Produto" sortKey="produto" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Grupo" sortKey="grupoProduto" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Movimentação" sortKey="tipoMovimentacao" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Qtde" sortKey="qtde" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} align="right" />
                  <SortableTh label="Valor" sortKey="valorTotal" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} align="right" />
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadas.map((row) => (
                  <tr key={row.idItemDocumentoEstoque} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={`${CELULA_CLASS} whitespace-nowrap`}>{fmtDataBr(row.dataEmissao)}</td>
                    <td className={CELULA_CLASS}>{row.numeroDocumentoFiscal ?? '—'}</td>
                    <td className={`${CELULA_CLASS} max-w-[220px] truncate`} title={row.produto ?? ''}>
                      {row.produto ?? '—'}
                    </td>
                    <td className={CELULA_CLASS}>{row.grupoProduto}</td>
                    <td className={CELULA_CLASS}>{row.tipoMovimentacao ?? '—'}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(row.qtde)}</td>
                    <td className={`${CELULA_CLASS} text-right font-medium`}>{nf.format(row.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-600 px-4 py-3 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-black">
            <span>
              {linhasFiltradas.length} item(ns)
              {truncado ? ' · exibindo até 8.000 (há mais no período)' : ''}
            </span>
            <span className="font-semibold">Total devoluções: {nf.format(totalDetalhe)}</span>
          </div>
          {gradeAbs != null && gradeAbs !== 0 ? (
            <p className="mt-1 text-xs text-black/70">
              Valor na grade: {nf.format(gradeAbs)}
              {diffGrade != null && Math.abs(diffGrade) >= 0.01 ? (
                <span className=" text-amber-800">
                  {' '}
                  · diferença: {diffGrade > 0 ? '+' : ''}
                  {nf.format(diffGrade)}
                </span>
              ) : (
                <span className=" text-emerald-800"> · confere com a grade</span>
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
