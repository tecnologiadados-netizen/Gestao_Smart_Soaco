import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDreReceitaIndiretaDetalhe,
  fetchDreReceitaMoveisDiretoDetalhe,
  fetchDreReceitaVendasDetalhe,
  type DreReceitaIndiretaDetalheLinha,
  type DreReceitaVendasDetalheLinha,
} from '../../../api/financeiro';
import { DFC_ID_EMPRESA_MOVEIS } from '../dfc/dfcEmpresas';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE, textoPassaBuscaLivre } from '../../../utils/textoLivreBusca';
import {
  SortableTh,
  compareStr,
  compareYmd,
  nextSortDir,
  type SortDir,
} from '../dfc/dfcDetalheTabelaUtils';
import type { DreReceitaDetalheContexto } from './dreReceitaDetalheUtils';
import { periodoReceitaParaIntervalo } from './dreReceitaDetalheUtils';
import { formatarVariacaoMkp, nomeGrupoProdutoDre, normalizarGrupoProduto } from './dreMkpVariacoes';

type ColSortDireto = 'dataEmissao' | 'pedido' | 'produto' | 'grupoProduto' | 'nf' | 'qtde' | 'valorTotal';
type ColSortIndireto = ColSortDireto | 'valorUnitario' | 'percMarkup' | 'valorIndireto';

const CELULA_CLASS = 'px-2 py-1.5 text-sm text-black dark:text-black font-sans';

function compareNum(a: number, b: number): number {
  return a - b;
}

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

function escopoIndireto(escopo: DreReceitaDetalheContexto['escopo']): boolean {
  return (
    escopo === 'faturamento_indireto_bruto' ||
    escopo === 'faturamento_indireto_liquido' ||
    escopo === 'grupo_indireto'
  );
}

function escopoMoveisDireto(escopo: DreReceitaDetalheContexto['escopo']): boolean {
  return escopo === 'faturamento_direto_moveis';
}

function valorLinhaDireto(row: DreReceitaVendasDetalheLinha): number {
  return row.valorTotal;
}

function valorLinhaIndireto(
  row: DreReceitaIndiretaDetalheLinha,
  escopo: DreReceitaDetalheContexto['escopo'],
): number {
  return escopo === 'faturamento_indireto_bruto' ? row.valorTotal : row.valorIndireto;
}

export type DreReceitaVendasDetalheModalProps = {
  onClose: () => void;
  titulo: string;
  contexto: DreReceitaDetalheContexto;
  periodo: string | undefined;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresaSaida?: number;
  valorEsperadoGrade?: number;
};

export default function DreReceitaVendasDetalheModal({
  onClose,
  titulo,
  contexto,
  periodo,
  dataInicio,
  dataFim,
  granularidade,
  idEmpresaSaida = 1,
  valorEsperadoGrade,
}: DreReceitaVendasDetalheModalProps) {
  const indireto = escopoIndireto(contexto.escopo);
  const moveisDireto = escopoMoveisDireto(contexto.escopo);
  const idEmpresaDetalhe = moveisDireto ? DFC_ID_EMPRESA_MOVEIS : idEmpresaSaida;
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [linhasDireto, setLinhasDireto] = useState<DreReceitaVendasDetalheLinha[]>([]);
  const [linhasIndireto, setLinhasIndireto] = useState<DreReceitaIndiretaDetalheLinha[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [busca, setBusca] = useState('');
  const [sortKeyDireto, setSortKeyDireto] = useState<ColSortDireto>('dataEmissao');
  const [sortKeyIndireto, setSortKeyIndireto] = useState<ColSortIndireto>('dataEmissao');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const loadId = useRef(0);

  const onSortColDireto = useCallback((key: ColSortDireto) => {
    setSortDir((d) => nextSortDir(sortKeyDireto, key, d));
    setSortKeyDireto(key);
  }, [sortKeyDireto]);

  const onSortColIndireto = useCallback((key: ColSortIndireto) => {
    setSortDir((d) => nextSortDir(sortKeyIndireto, key, d));
    setSortKeyIndireto(key);
  }, [sortKeyIndireto]);

  const intervalo = useMemo(
    () => periodoReceitaParaIntervalo(periodo, granularidade, dataInicio, dataFim),
    [periodo, granularidade, dataInicio, dataFim],
  );

  useEffect(() => {
    const id = ++loadId.current;
    setLoading(true);
    setErro(undefined);
    setLinhasDireto([]);
    setLinhasIndireto([]);
    setTruncado(false);

    const grupoFiltro =
      contexto.escopo === 'grupo_direto' || contexto.escopo === 'grupo_indireto'
        ? contexto.grupoProduto
        : undefined;

    const fetcher = indireto
      ? fetchDreReceitaIndiretaDetalhe({
          dataInicio: intervalo.dataInicio,
          dataFim: intervalo.dataFim,
          idEmpresaSaida: idEmpresaDetalhe,
          grupoProduto: grupoFiltro,
        })
      : moveisDireto
        ? fetchDreReceitaMoveisDiretoDetalhe({
            dataInicio: intervalo.dataInicio,
            dataFim: intervalo.dataFim,
            idEmpresaSaida: idEmpresaDetalhe,
          })
        : fetchDreReceitaVendasDetalhe({
            dataInicio: intervalo.dataInicio,
            dataFim: intervalo.dataFim,
            idEmpresaSaida: idEmpresaDetalhe,
            grupoProduto: grupoFiltro,
          });

    void fetcher.then((r) => {
      if (id !== loadId.current) return;
      if (r.erro) setErro(r.erro);

      if (indireto) {
        let det = (r as { detalhes: DreReceitaIndiretaDetalheLinha[] }).detalhes;
        if (contexto.escopo === 'grupo_indireto' && contexto.grupoProduto) {
          const alvo = normalizarGrupoProduto(contexto.grupoProduto);
          det = det.filter(
            (row) => normalizarGrupoProduto(nomeGrupoProdutoDre(row.grupoProduto)) === alvo,
          );
        }
        setLinhasIndireto(det);
      } else {
        let det = (r as { detalhes: DreReceitaVendasDetalheLinha[] }).detalhes;
        if (contexto.escopo === 'grupo_direto' && contexto.grupoProduto) {
          const alvo = normalizarGrupoProduto(contexto.grupoProduto);
          det = det.filter(
            (row) => normalizarGrupoProduto(nomeGrupoProdutoDre(row.grupoProduto)) === alvo,
          );
        }
        setLinhasDireto(det);
      }

      setTruncado(r.truncado === true);
      setLoading(false);
    });
  }, [intervalo.dataInicio, intervalo.dataFim, idEmpresaDetalhe, contexto, indireto, moveisDireto]);

  const linhasFiltradasDireto = useMemo(() => {
    const q = busca.trim();
    if (!q) return linhasDireto;
    return linhasDireto.filter((row) => {
      const hay = [
        row.pedido,
        row.produto,
        row.grupoProduto,
        row.tipoMovimentacao,
        row.statusNfe,
        String(row.numeroDocumentoFiscal ?? ''),
        String(row.idItemDocumentoEstoque),
        fmtDataBr(row.dataEmissao),
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(q, hay);
    });
  }, [linhasDireto, busca]);

  const linhasFiltradasIndireto = useMemo(() => {
    const q = busca.trim();
    if (!q) return linhasIndireto;
    return linhasIndireto.filter((row) => {
      const hay = [
        row.pedido,
        row.produto,
        row.grupoProduto,
        row.tipoMovimentacao,
        row.statusNfe,
        String(row.numeroDocumentoFiscal ?? ''),
        String(row.idItemDocumentoEstoque),
        fmtDataBr(row.dataEmissao),
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(q, hay);
    });
  }, [linhasIndireto, busca]);

  const linhasOrdenadasDireto = useMemo(() => {
    const list = [...linhasFiltradasDireto];
    const sinal = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      switch (sortKeyDireto) {
        case 'dataEmissao':
          c = compareYmd(a.dataEmissao, b.dataEmissao);
          break;
        case 'pedido':
          c = compareStr(a.pedido, b.pedido);
          break;
        case 'produto':
          c = compareStr(a.produto, b.produto);
          break;
        case 'grupoProduto':
          c = compareStr(a.grupoProduto, b.grupoProduto);
          break;
        case 'nf':
          c = compareNum(a.numeroDocumentoFiscal ?? 0, b.numeroDocumentoFiscal ?? 0);
          break;
        case 'qtde':
          c = compareNum(a.qtde, b.qtde);
          break;
        case 'valorTotal':
          c = compareNum(valorLinhaDireto(a), valorLinhaDireto(b));
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c * sinal;
      return compareNum(a.idItemDocumentoEstoque, b.idItemDocumentoEstoque) * sinal;
    });
    return list;
  }, [linhasFiltradasDireto, sortKeyDireto, sortDir, contexto.escopo]);

  const linhasOrdenadasIndireto = useMemo(() => {
    const list = [...linhasFiltradasIndireto];
    const sinal = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      switch (sortKeyIndireto) {
        case 'dataEmissao':
          c = compareYmd(a.dataEmissao, b.dataEmissao);
          break;
        case 'pedido':
          c = compareStr(a.pedido, b.pedido);
          break;
        case 'produto':
          c = compareStr(a.produto, b.produto);
          break;
        case 'grupoProduto':
          c = compareStr(a.grupoProduto, b.grupoProduto);
          break;
        case 'nf':
          c = compareNum(a.numeroDocumentoFiscal ?? 0, b.numeroDocumentoFiscal ?? 0);
          break;
        case 'qtde':
          c = compareNum(a.qtde, b.qtde);
          break;
        case 'valorUnitario':
          c = compareNum(a.valorUnitario, b.valorUnitario);
          break;
        case 'percMarkup':
          c = compareNum(a.percMarkup, b.percMarkup);
          break;
        case 'valorTotal':
          c = compareNum(a.valorTotal, b.valorTotal);
          break;
        case 'valorIndireto':
          c = compareNum(a.valorIndireto, b.valorIndireto);
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c * sinal;
      return compareNum(a.idItemDocumentoEstoque, b.idItemDocumentoEstoque) * sinal;
    });
    return list;
  }, [linhasFiltradasIndireto, sortKeyIndireto, sortDir]);

  const totalDetalhe = useMemo(() => {
    if (indireto) {
      return linhasFiltradasIndireto.reduce(
        (s, r) => s + valorLinhaIndireto(r, contexto.escopo),
        0,
      );
    }
    return linhasFiltradasDireto.reduce((s, r) => s + valorLinhaDireto(r), 0);
  }, [indireto, linhasFiltradasIndireto, linhasFiltradasDireto, contexto.escopo]);

  const diffGrade =
    valorEsperadoGrade != null && valorEsperadoGrade !== 0
      ? totalDetalhe - valorEsperadoGrade
      : null;

  const qtdLinhas = indireto ? linhasFiltradasIndireto.length : linhasFiltradasDireto.length;
  const subtituloGrupo = contexto.grupoProduto
    ? ` · grupo: ${contexto.grupoProduto}`
    : indireto
      ? ' · todos os grupos (Só Móveis)'
      : moveisDireto
        ? ' · Só Móveis — faturamento direto (valor total)'
        : ' · todos os grupos (Só Aço)';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-6xl max-h-[min(92vh,880px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dre-receita-detalhe-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dre-receita-detalhe-titulo" className="text-lg font-semibold text-black dark:text-black">
              Detalhe — {indireto ? 'Faturamento indireto' : 'Receita de vendas'} (Nomus)
            </h2>
            <p className="mt-0.5 break-words text-sm text-black/80 dark:text-black/80">{titulo}</p>
            <p className="mt-1 text-xs text-black/60 dark:text-black/60">
              {intervalo.dataInicio === intervalo.dataFim
                ? fmtDataBr(intervalo.dataInicio)
                : `${fmtDataBr(intervalo.dataInicio)} → ${fmtDataBr(intervalo.dataFim)}`}
              {subtituloGrupo}
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
          ) : qtdLinhas === 0 ? (
            <p className="px-4 py-8 text-sm text-black/60">Nenhum item encontrado para este recorte.</p>
          ) : indireto ? (
            <table className="w-full text-sm border-collapse font-sans">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-xs text-white">
                  <SortableTh label="Emissão" sortKey="dataEmissao" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} />
                  <SortableTh label="Pedido" sortKey="pedido" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} />
                  <SortableTh label="Produto" sortKey="produto" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} />
                  <SortableTh label="Grupo" sortKey="grupoProduto" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} />
                  <SortableTh label="NF" sortKey="nf" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} />
                  <SortableTh label="Qtde" sortKey="qtde" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} align="right" />
                  <SortableTh label="V. unit." sortKey="valorUnitario" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} align="right" />
                  <SortableTh label="MKP %" sortKey="percMarkup" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} align="right" />
                  <SortableTh label="V. bruto" sortKey="valorTotal" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} align="right" />
                  <SortableTh label="V. indireto" sortKey="valorIndireto" activeKey={sortKeyIndireto} dir={sortDir} onSort={(k) => onSortColIndireto(k as ColSortIndireto)} align="right" />
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadasIndireto.map((row) => (
                  <tr key={row.idItemDocumentoEstoque} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={`${CELULA_CLASS} whitespace-nowrap`}>{fmtDataBr(row.dataEmissao)}</td>
                    <td className={CELULA_CLASS}>{row.pedido ?? '—'}</td>
                    <td className={`${CELULA_CLASS} max-w-[180px] truncate`} title={row.produto ?? ''}>
                      {row.produto ?? '—'}
                    </td>
                    <td className={CELULA_CLASS}>{row.grupoProduto}</td>
                    <td className={CELULA_CLASS}>{row.numeroDocumentoFiscal ?? '—'}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(row.qtde)}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(row.valorUnitario)}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{formatarVariacaoMkp(row.percMarkup)}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(row.valorTotal)}</td>
                    <td className={`${CELULA_CLASS} text-right font-medium`}>{nf.format(row.valorIndireto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm border-collapse font-sans">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-xs text-white">
                  <SortableTh label="Emissão" sortKey="dataEmissao" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} />
                  <SortableTh label="Pedido" sortKey="pedido" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} />
                  <SortableTh label="Produto" sortKey="produto" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} />
                  <SortableTh label="Grupo" sortKey="grupoProduto" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} />
                  <SortableTh label="NF" sortKey="nf" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} />
                  <SortableTh label="Qtde" sortKey="qtde" activeKey={sortKeyDireto} dir={sortDir} onSort={(k) => onSortColDireto(k as ColSortDireto)} align="right" />
                  <SortableTh
                    label={moveisDireto ? 'V. c/ desconto' : 'Valor total'}
                    sortKey="valorTotal"
                    activeKey={sortKeyDireto}
                    dir={sortDir}
                    onSort={(k) => onSortColDireto(k as ColSortDireto)}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadasDireto.map((row) => (
                  <tr key={row.idItemDocumentoEstoque} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={`${CELULA_CLASS} whitespace-nowrap`}>{fmtDataBr(row.dataEmissao)}</td>
                    <td className={CELULA_CLASS}>{row.pedido ?? '—'}</td>
                    <td className={`${CELULA_CLASS} max-w-[200px] truncate`} title={row.produto ?? ''}>
                      {row.produto ?? '—'}
                    </td>
                    <td className={CELULA_CLASS}>{row.grupoProduto}</td>
                    <td className={CELULA_CLASS}>{row.numeroDocumentoFiscal ?? '—'}</td>
                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(row.qtde)}</td>
                    <td className={`${CELULA_CLASS} text-right font-medium`}>
                      {nf.format(valorLinhaDireto(row))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-600 px-4 py-3 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-black">
            <span>
              {qtdLinhas} item(ns)
              {truncado ? ' · exibindo até 8.000 (há mais no período)' : ''}
            </span>
            <span className="font-semibold">
              Total detalhe: {nf.format(totalDetalhe)}
              {indireto && contexto.escopo !== 'faturamento_indireto_bruto' ? ' (líquido MKP)' : ''}
            </span>
          </div>
          {valorEsperadoGrade != null && valorEsperadoGrade !== 0 ? (
            <p className="mt-1 text-xs text-black/70">
              Valor na grade: {nf.format(valorEsperadoGrade)}
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

