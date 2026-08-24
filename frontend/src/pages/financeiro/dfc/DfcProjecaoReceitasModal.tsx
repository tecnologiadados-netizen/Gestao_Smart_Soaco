import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDfcProjecaoReceitasDetalhe,
  type DfcProjecaoReceitaParcelaLinha,
} from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import { SortableTh, compareStr, compareYmd, nextSortDir, type SortDir } from './dfcDetalheTabelaUtils';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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
  sublinha?: string;
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
  sublinha,
}: DfcProjecaoReceitasModalProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhas, setLinhas] = useState<DfcProjecaoReceitaParcelaLinha[]>([]);
  const [busca, setBusca] = useState('');
  type ColSort =
    | 'empresa'
    | 'pd'
    | 'parcela'
    | 'cliente'
    | 'previsao'
    | 'projVenc'
    | 'condicao'
    | 'regra'
    | 'valor';
  const [sortKey, setSortKey] = useState<ColSort>('projVenc');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const loadId = useRef(0);
  const detalheCacheRef = useRef(new Map<string, DfcProjecaoReceitaParcelaLinha[]>());

  const cacheKey = `${dataInicio}|${dataFim}|${granularidade}|${periodo ?? ''}|${sublinha ?? ''}|${idEmpresas.join(',')}`;

  const carregar = useCallback(async () => {
    loadId.current += 1;
    const myId = loadId.current;
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      setLinhas(cached);
      setLoading(false);
      setErro(undefined);
      return;
    }
    setLoading(true);
    setErro(undefined);
    try {
      const r = await fetchDfcProjecaoReceitasDetalhe({
        dataInicio,
        dataFim,
        granularidade,
        idEmpresas,
        periodo,
        sublinha,
      });
      if (myId !== loadId.current) return;
      setLinhas(r.linhas);
      detalheCacheRef.current.set(cacheKey, r.linhas);
      if (r.erro) setErro(r.erro);
    } catch (e: unknown) {
      if (myId !== loadId.current) return;
      setLinhas([]);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (myId === loadId.current) setLoading(false);
    }
  }, [cacheKey, dataInicio, dataFim, granularidade, idEmpresas, periodo, sublinha]);

  useEffect(() => {
    if (!aberto) return;
    setBusca('');
    void carregar();
  }, [aberto, carregar]);

  const linhasFiltradas = useMemo(() => {
    if (!busca.trim()) return linhas;
    return linhas.filter((row) => {
      const hay = [
        row.pd,
        row.cliente,
        row.condicaoPagamento,
        row.regra,
        row.sublinha,
        row.uf,
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(busca, hay);
    });
  }, [linhas, busca]);

  const linhasOrdenadas = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const copy = [...linhasFiltradas];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'empresa':
          return dir * compareStr(labelEmpresaDfc(a.idEmpresa), labelEmpresaDfc(b.idEmpresa));
        case 'pd':
          return dir * compareStr(a.pd, b.pd);
        case 'parcela':
          return dir * (a.indiceParcela - b.indiceParcela);
        case 'cliente':
          return dir * compareStr(a.cliente, b.cliente);
        case 'previsao':
          return dir * compareYmd(a.dataPrevisao, b.dataPrevisao);
        case 'projVenc':
          return dir * compareYmd(a.dataProjVenc, b.dataProjVenc);
        case 'condicao':
          return dir * compareStr(a.condicaoPagamento, b.condicaoPagamento);
        case 'regra':
          return dir * compareStr(a.regra, b.regra);
        case 'valor':
          return dir * (a.valorParcela - b.valorParcela);
        default:
          return 0;
      }
    });
    return copy;
  }, [linhasFiltradas, sortKey, sortDir]);

  const total = useMemo(
    () => linhasFiltradas.reduce((s, r) => s + r.valorParcela, 0),
    [linhasFiltradas],
  );

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-3 sm:p-4 bg-black/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-proj-rec-titulo"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="dfc-proj-rec-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Saldo a Receber (Carteira) ÷ dias de <code className="text-[11px]">condicaopagamento.regra</code>, a
              partir da previsão. Detalhamento ({linhasFiltradas.length} linha
              {linhasFiltradas.length === 1 ? '' : 's'})
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <input
            type="search"
            className="min-w-[200px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
            Total: {brl.format(total)}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Carregando…</p>
          ) : erro ? (
            <p className="p-6 text-center text-sm text-red-600">{erro}</p>
          ) : linhasOrdenadas.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Nenhuma parcela neste recorte.</p>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {(
                    [
                      ['empresa', 'Empresa'],
                      ['pd', 'PD'],
                      ['parcela', 'Parc.'],
                      ['cliente', 'Cliente'],
                      ['previsao', 'Previsão'],
                      ['projVenc', 'Data proj.'],
                      ['condicao', 'Condição'],
                      ['regra', 'Regra (dias)'],
                      ['valor', 'Valor'],
                    ] as const
                  ).map(([key, label]) => (
                    <SortableTh
                      key={key}
                      label={label}
                      sortKey={key}
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => {
                        setSortDir(nextSortDir(sortKey, k, sortDir));
                        setSortKey(k as ColSort);
                      }}
                      align={key === 'valor' ? 'right' : 'left'}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadas.map((row) => (
                  <tr
                    key={`${row.idPedido}-${row.indiceParcela}-${row.dataProjVenc}`}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{labelEmpresaDfc(row.idEmpresa)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.pd ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.indiceParcela}/{row.qtdeParcelas}
                      <span className="ml-1 text-xs text-slate-400">(+{row.diasRegra}d)</span>
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate" title={row.cliente ?? undefined}>
                      {row.cliente ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDataBr(row.dataPrevisao)}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDataBr(row.dataProjVenc)}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={row.condicaoPagamento ?? undefined}>
                      {row.condicaoPagamento ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs text-slate-500">{row.regra ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{brl.format(row.valorParcela)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
