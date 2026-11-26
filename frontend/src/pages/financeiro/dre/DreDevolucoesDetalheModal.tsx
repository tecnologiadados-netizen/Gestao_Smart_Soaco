import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

type ColSort = 'dataEmissao' | 'nf' | 'pedido' | 'cliente' | 'tipoMovimentacao' | 'valorTotal';

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

function textoUnico(valores: Array<string | null | undefined>, separador = ' · '): string {
  const unicos: string[] = [];
  const vistos = new Set<string>();
  for (const valor of valores) {
    const texto = (valor ?? '').trim();
    if (!texto) continue;
    const chave = texto.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(texto);
  }
  return unicos.join(separador);
}

type NotaDevolucao = {
  key: string;
  dataEmissao: string | null;
  nfPrincipal: string;
  documento: string | null;
  pedido: string;
  cliente: string;
  tipoMovimentacao: string;
  valorTotal: number;
  itens: DreDevolucoesDetalheLinha[];
};

function montarNota(itens: DreDevolucoesDetalheLinha[]): NotaDevolucao {
  const primeiro = itens[0];
  const nfPrincipal = textoUnico(itens.map((item) => item.numeroNfe || item.numeroDocumentoFiscal)) || '—';
  const documento = textoUnico(
    itens
      .map((item) => item.numeroDocumentoFiscal)
      .filter((doc) => doc && doc !== nfPrincipal),
  );
  const idDoc = primeiro.idDocumentoEstoque > 0 ? String(primeiro.idDocumentoEstoque) : `item-${primeiro.idItemDocumentoEstoque}`;
  return {
    key: idDoc,
    dataEmissao: primeiro.dataEmissao,
    nfPrincipal,
    documento: documento || null,
    pedido: textoUnico(itens.map((item) => item.pedido)) || '—',
    cliente: textoUnico(itens.map((item) => item.cliente)) || '—',
    tipoMovimentacao: textoUnico(itens.map((item) => item.tipoMovimentacao)) || '—',
    valorTotal: itens.reduce((soma, item) => soma + item.valorTotal, 0),
    itens: [...itens].sort((a, b) => compareNum(b.valorTotal, a.valorTotal) || compareStr(a.produto, b.produto)),
  };
}

function agruparPorNota(linhas: DreDevolucoesDetalheLinha[]): NotaDevolucao[] {
  const grupos = new Map<string, DreDevolucoesDetalheLinha[]>();
  for (const linha of linhas) {
    const key = linha.idDocumentoEstoque > 0 ? String(linha.idDocumentoEstoque) : `item-${linha.idItemDocumentoEstoque}`;
    const atual = grupos.get(key);
    if (atual) atual.push(linha);
    else grupos.set(key, [linha]);
  }
  return [...grupos.values()].map(montarNota);
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
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
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
    setAbertos(new Set());
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
        row.numeroDocumentoFiscal,
        row.numeroNfe,
        row.pedido,
        row.cliente,
        fmtDataBr(row.dataEmissao),
      ]
        .filter(Boolean)
        .join(' ');
      return textoPassaBuscaLivre(q, hay);
    });
  }, [linhas, busca]);

  const notas = useMemo(() => agruparPorNota(linhasFiltradas), [linhasFiltradas]);

  const notasOrdenadas = useMemo(() => {
    const list = [...notas];
    const sinal = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case 'dataEmissao':
          c = compareYmd(a.dataEmissao, b.dataEmissao);
          break;
        case 'nf':
          c = compareStr(a.nfPrincipal, b.nfPrincipal);
          break;
        case 'pedido':
          c = compareStr(a.pedido, b.pedido);
          break;
        case 'cliente':
          c = compareStr(a.cliente, b.cliente);
          break;
        case 'tipoMovimentacao':
          c = compareStr(a.tipoMovimentacao, b.tipoMovimentacao);
          break;
        case 'valorTotal':
          c = compareNum(a.valorTotal, b.valorTotal);
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c * sinal;
      return compareStr(a.key, b.key) * sinal;
    });
    return list;
  }, [notas, sortKey, sortDir]);

  const totalDetalhe = useMemo(
    () => linhasFiltradas.reduce((s, r) => s + r.valorTotal, 0),
    [linhasFiltradas],
  );

  const onSortCol = (key: ColSort) => {
    setSortDir((d) => nextSortDir(sortKey, key, d));
    setSortKey(key);
  };

  const toggleNota = (key: string) => {
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(key)) proximo.delete(key);
      else proximo.add(key);
      return proximo;
    });
  };

  const todasAbertas = notasOrdenadas.length > 0 && notasOrdenadas.every((nota) => abertos.has(nota.key));

  const alternarTodas = () => {
    setAbertos(todasAbertas ? new Set() : new Set(notasOrdenadas.map((nota) => nota.key)));
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
        className="relative flex w-full max-w-6xl max-h-[min(92vh,880px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
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
              {' · '}
              clique na nota para ver os produtos
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

        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-black dark:text-black"
          />
          {notasOrdenadas.length > 0 ? (
            <button
              type="button"
              onClick={alternarTodas}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-black hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {todasAbertas ? 'Recolher tudo' : 'Expandir tudo'}
            </button>
          ) : null}
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
                  <th className="w-8 px-2 py-2" aria-hidden />
                  <SortableTh label="Data" sortKey="dataEmissao" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="NF" sortKey="nf" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Pedido" sortKey="pedido" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Cliente" sortKey="cliente" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Movimentação" sortKey="tipoMovimentacao" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} />
                  <SortableTh label="Valor" sortKey="valorTotal" activeKey={sortKey} dir={sortDir} onSort={(k) => onSortCol(k as ColSort)} align="right" />
                </tr>
              </thead>
              <tbody>
                {notasOrdenadas.map((nota) => {
                  const aberta = abertos.has(nota.key);
                  return (
                    <Fragment key={nota.key}>
                      <tr
                        className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 ${
                          aberta ? 'bg-slate-50 dark:bg-slate-700/30' : ''
                        }`}
                        onClick={() => toggleNota(nota.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleNota(nota.key);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={aberta}
                      >
                        <td className={`${CELULA_CLASS} text-center text-xs`} aria-hidden>
                          {aberta ? '▼' : '▶'}
                        </td>
                        <td className={`${CELULA_CLASS} whitespace-nowrap`}>{fmtDataBr(nota.dataEmissao)}</td>
                        <td className={CELULA_CLASS}>
                          <div className="font-medium">{nota.nfPrincipal}</div>
                          {nota.documento ? (
                            <div className="text-xs text-black/60" title="Documento Nomus">
                              {nota.documento}
                            </div>
                          ) : null}
                        </td>
                        <td className={`${CELULA_CLASS} whitespace-nowrap`}>{nota.pedido}</td>
                        <td className={`${CELULA_CLASS} max-w-[220px] truncate`} title={nota.cliente}>
                          {nota.cliente}
                        </td>
                        <td className={`${CELULA_CLASS} max-w-[240px] truncate`} title={nota.tipoMovimentacao}>
                          {nota.tipoMovimentacao}
                        </td>
                        <td className={`${CELULA_CLASS} text-right font-medium whitespace-nowrap`}>
                          {nf.format(nota.valorTotal)}
                        </td>
                      </tr>
                      {aberta ? (
                        <tr className="border-t border-slate-100 dark:border-slate-700">
                          <td colSpan={7} className="bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="text-left text-xs text-black/70">
                                  <th className="px-2 py-1 font-semibold">Produto</th>
                                  <th className="px-2 py-1 font-semibold">Grupo</th>
                                  <th className="px-2 py-1 text-right font-semibold">Qtde</th>
                                  <th className="px-2 py-1 text-right font-semibold">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nota.itens.map((item) => (
                                  <tr key={item.idItemDocumentoEstoque} className="border-t border-slate-200/80">
                                    <td className={`${CELULA_CLASS} max-w-[280px] truncate`} title={item.produto ?? ''}>
                                      {item.produto ?? '—'}
                                    </td>
                                    <td className={CELULA_CLASS}>{item.grupoProduto}</td>
                                    <td className={`${CELULA_CLASS} text-right`}>{nf.format(item.qtde)}</td>
                                    <td className={`${CELULA_CLASS} text-right font-medium`}>{nf.format(item.valorTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-600 px-4 py-3 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-black">
            <span>
              {notas.length} nota(s) · {linhasFiltradas.length} produto(s)
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
