import { useCallback, useEffect, useMemo, useState } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchGestaoEntradasPreEntradas,
  fetchGestaoEntradasPreEntradasImpressao,
  type ConferenciaDoubleCheckPreEntrada,
  type GradePreEntrada,
  type LinhaPreEntrada,
  type SituacaoPreEntrada,
  type StatusOtimizaPreEntrada,
} from '../../api/gestaoEntradas';
import { imprimirRelacaoPreEntradas } from './imprimirPreEntradas';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

const COLUNAS = [
  { id: 'documento', label: 'Documento' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'alterado', label: 'Alterado por' },
  { id: 'emissao', label: 'Emissão da NF' },
  { id: 'entrada', label: 'Entrada' },
  { id: 'pedido', label: 'Pedido vinculado' },
  { id: 'conferencia', label: 'Double Check' },
  { id: 'conferido', label: 'Conferido por' },
  { id: 'otimiza', label: 'Comunicação Otimiza' },
  { id: 'situacao', label: 'Situação' },
];

const COL_IDS = COLUNAS.map((coluna) => coluna.id);
const ORDEM_ENTRADA = [{ id: 'entrada', dir: 'desc' as const }];
const COLUNAS_DATA = new Set(['emissao', 'entrada']);

function inicioMesYmd(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`;
}

function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function labelConferencia(valor: ConferenciaDoubleCheckPreEntrada): string {
  if (valor === 'conferida') return 'Conferida';
  if (valor === 'nao_aplicada') return 'Não aplicada';
  return 'Pendente';
}

function labelSituacao(valor: SituacaoPreEntrada): string {
  return valor === 'efetivada' ? 'Efetivada' : 'Pré-entrada';
}

function labelStatusOtimiza(status: StatusOtimizaPreEntrada): string {
  if (status === 'in_progress') return 'em andamento';
  if (status === 'completed') return 'concluída';
  if (status === 'cancelled') return 'cancelada';
  return '';
}

function textoPedidos(linha: LinhaPreEntrada): string {
  if (linha.pedidos.length === 0) return '';
  return linha.pedidos.map((pedido) => pedido.nome).join(', ');
}

function textoOtimiza(linha: LinhaPreEntrada): string {
  return linha.comunicacoes.map(textoOtimizaItem).join(', ');
}

function textoOtimizaItem(item: LinhaPreEntrada['comunicacoes'][number]): string {
  const status = labelStatusOtimiza(item.status);
  return status ? `${item.numero} · ${status}` : String(item.numero);
}

function textoBusca(linha: LinhaPreEntrada): string {
  return [
    linha.numeroDocumentoFiscal,
    linha.numeroNfe,
    linha.nomeParceiro,
    linha.usuarioAlteracao,
    linha.usuarioConferencia,
    textoPedidos(linha),
    textoOtimiza(linha),
    labelConferencia(linha.conferencia),
    labelSituacao(linha.situacao),
  ]
    .filter(Boolean)
    .join(' ');
}

function textoCelula(linha: LinhaPreEntrada, coluna: string): string {
  if (coluna === 'documento') return linha.numeroDocumentoFiscal || linha.numeroNfe || '—';
  if (coluna === 'fornecedor') return linha.nomeParceiro || '—';
  if (coluna === 'alterado') return linha.usuarioAlteracao || '—';
  if (coluna === 'emissao') return fmtDataBr(linha.dataEmissao);
  if (coluna === 'entrada') return fmtDataBr(linha.dataEntrada);
  if (coluna === 'pedido') return textoPedidos(linha) || '—';
  if (coluna === 'conferencia') return labelConferencia(linha.conferencia);
  if (coluna === 'conferido') return linha.usuarioConferencia || '—';
  if (coluna === 'otimiza') return textoOtimiza(linha) || '—';
  return labelSituacao(linha.situacao);
}

function valoresFiltro(linha: LinhaPreEntrada, coluna: string): string[] | null {
  if (coluna === 'documento') {
    const valores = [linha.numeroDocumentoFiscal, linha.numeroNfe].filter((valor): valor is string => Boolean(valor));
    return valores.length > 0 ? [...new Set(valores)] : ['—'];
  }
  if (coluna === 'pedido') {
    return linha.pedidos.length > 0 ? linha.pedidos.map((pedido) => pedido.nome) : ['—'];
  }
  if (coluna === 'otimiza') {
    return linha.comunicacoes.length > 0 ? linha.comunicacoes.map(textoOtimizaItem) : ['—'];
  }
  return null;
}

function valorOrdenacao(linha: LinhaPreEntrada, coluna: string): string {
  if (coluna === 'emissao') return linha.dataEmissao ?? '';
  if (coluna === 'entrada') return linha.dataEntrada ?? '';
  if (coluna === 'documento') return linha.numeroDocumentoFiscal ?? linha.numeroNfe ?? '';
  return textoCelula(linha, coluna);
}

function classeSelo(tom: 'amber' | 'emerald' | 'slate' | 'violet' | 'cyan'): string {
  if (tom === 'amber') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200';
  }
  if (tom === 'emerald') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200';
  }
  if (tom === 'violet') {
    return 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200';
  }
  if (tom === 'cyan') {
    return 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
}

function tomConferencia(valor: ConferenciaDoubleCheckPreEntrada): 'amber' | 'emerald' | 'slate' {
  if (valor === 'conferida') return 'emerald';
  if (valor === 'nao_aplicada') return 'slate';
  return 'amber';
}

export default function GestaoEntradasPreEntradaPanel() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoImpressao, setAvisoImpressao] = useState<string | null>(null);
  const [dados, setDados] = useState<GradePreEntrada | null>(null);

  const carregar = useCallback(async (di: string, df: string) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetchGestaoEntradasPreEntradas({
        dataInicio: di || null,
        dataFim: df || null,
      });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar as pré-entradas.');
        setDados(null);
        return;
      }
      setDados(r.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar('', '');
  }, [carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const linhas = useMemo(
    () => (dados?.linhas ?? []).filter((linha) => match(textoBusca(linha))),
    [dados, match],
  );
  const getCellText = useCallback((linha: LinhaPreEntrada, coluna: string) => textoCelula(linha, coluna), []);
  const getCellFilterValues = useCallback(
    (linha: LinhaPreEntrada, coluna: string) => valoresFiltro(linha, coluna),
    [],
  );
  const valueForSort = useCallback(
    (linha: LinhaPreEntrada, coluna: string) => valorOrdenacao(linha, coluna),
    [],
  );
  const grade = useGradeFiltrosExcel<LinhaPreEntrada>({
    rows: linhas,
    columnIds: COL_IDS,
    getCellText,
    getCellFilterValues,
    valueForSort,
    defaultSortLevels: ORDEM_ENTRADA,
    dateColumnIds: ['emissao', 'entrada'],
  });
  const exibidas = grade.rowsExibidas;

  const resumo = useMemo(() => {
    const todas = dados?.linhas ?? [];
    return {
      preEntrada: todas.length,
      pendente: todas.filter((linha) => linha.conferencia === 'pendente').length,
      comOtimiza: todas.filter((linha) => linha.comunicacoes.length > 0).length,
    };
  }, [dados]);

  function filtrarPeriodo() {
    if ((dataInicio === '') !== (dataFim === '')) {
      setErro('Informe o início e o fim da entrada, ou deixe os dois em branco.');
      return;
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setErro('A data final precisa ser igual ou posterior à inicial.');
      return;
    }
    void carregar(dataInicio, dataFim);
  }

  async function imprimir() {
    if (!dados || dados.linhas.length === 0) return;
    setImprimindo(true);
    setAvisoImpressao(null);
    try {
      const r = await fetchGestaoEntradasPreEntradasImpressao({
        dataInicio: dados.dataInicio,
        dataFim: dados.dataFim,
      });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao montar a relação das pré-entradas.');
        return;
      }
      const resultado = await imprimirRelacaoPreEntradas(r.data);
      if (resultado === 'baixado') {
        setAvisoImpressao('O navegador bloqueou a janela. O PDF foi baixado para você imprimir.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível imprimir as pré-entradas.');
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <div className="relative space-y-4">
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando pré-entradas…" mode="viewport" />
      <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${panelSurface}`}>
        <div>
          <label className={labelClass} htmlFor="ge-pre-inicio">
            Entrada início
          </label>
          <input
            id="ge-pre-inicio"
            type="date"
            className={inputClass}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ge-pre-fim">
            Entrada fim
          </label>
          <input
            id="ge-pre-fim"
            type="date"
            className={inputClass}
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <button type="button" className={btnPrimary} onClick={filtrarPeriodo} disabled={loading}>
          Filtrar
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={loading}
          onClick={() => {
            const di = inicioMesYmd();
            const df = hojeYmd();
            setDataInicio(di);
            setDataFim(df);
            void carregar(di, df);
          }}
        >
          Mês atual
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={loading}
          onClick={() => {
            setDataInicio('');
            setDataFim('');
            void carregar('', '');
          }}
        >
          Todas
        </button>
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor="ge-pre-busca">
            Busca
          </label>
          <input
            id="ge-pre-busca"
            type="search"
            className={`${inputClass} w-full`}
            value={busca}
            placeholder="Documento, fornecedor, pedido ou Otimiza. Use % para refinar"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {erro ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {erro}
        </p>
      ) : null}
      {avisoImpressao ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          {avisoImpressao}
        </p>
      ) : null}
      <div className={`overflow-hidden ${panelSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <p>
            {resumo.preEntrada} {resumo.preEntrada === 1 ? 'pré-entrada' : 'pré-entradas'}
            {' · '}
            {resumo.pendente} {resumo.pendente === 1 ? 'conferência pendente' : 'conferências pendentes'}
            {' · '}
            {resumo.comOtimiza}{' '}
            {resumo.comOtimiza === 1 ? 'comunicação em aberto' : 'comunicações em aberto'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btnSecondary}
              disabled={loading || imprimindo || !dados || dados.linhas.length === 0}
              onClick={() => void imprimir()}
            >
              {imprimindo ? 'Imprimindo…' : 'Imprimir'}
            </button>
            <p>
              {exibidas.length} {exibidas.length === 1 ? 'linha' : 'linhas'}
              {exibidas.length !== linhas.length ? ' na seleção' : ''}
            </p>
          </div>
        </div>
        {!loading && !erro && linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma pré-entrada nesta seleção.</p>
        ) : null}
        {linhas.length > 0 ? (
          <div ref={grade.tableScrollRef} className="overflow-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white">
                <tr className="bg-primary-600">
                  {COLUNAS.map((coluna) => {
                    const sortAtivo =
                      grade.sortState?.key === coluna.id || grade.sortLevels.some((nivel) => nivel.id === coluna.id);
                    return (
                      <th
                        key={coluna.id}
                        className="sticky top-0 z-10 border-b border-primary-500/40 bg-primary-600 px-3 py-2 font-medium"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <span className="min-w-0 truncate">{coluna.label}</span>
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(coluna.id) || sortAtivo}
                            onClick={(e) => grade.abrirFiltroExcel(coluna.id, e)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {exibidas.length === 0 ? (
                  <tr>
                    <td colSpan={COLUNAS.length} className="bg-white px-3 py-8 text-center text-slate-500 dark:bg-[#161822]">
                      Nenhum documento com os filtros da grade.
                    </td>
                  </tr>
                ) : (
                  exibidas.map((linha, indice) => {
                    const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                    return (
                      <tr key={linha.idDocumento} className={faixa}>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {linha.numeroDocumentoFiscal || linha.numeroNfe || '—'}
                          </p>
                          {linha.numeroNfe && linha.numeroNfe !== linha.numeroDocumentoFiscal ? (
                            <p className="text-xs text-slate-500">NF-e {linha.numeroNfe}</p>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.nomeParceiro || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.usuarioAlteracao || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {fmtDataBr(linha.dataEmissao)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {fmtDataBr(linha.dataEntrada)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.pedidos.length > 0 ? textoPedidos(linha) : '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classeSelo(tomConferencia(linha.conferencia))}`}
                          >
                            {labelConferencia(linha.conferencia)}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.usuarioConferencia || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.comunicacoes.length === 0 ? (
                            '—'
                          ) : (
                            <ul className="space-y-1">
                              {linha.comunicacoes.map((item) => (
                                <li key={item.numero}>{textoOtimizaItem(item)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classeSelo(
                              linha.situacao === 'efetivada' ? 'cyan' : 'violet',
                            )}`}
                          >
                            {labelSituacao(linha.situacao)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            showDateRangeFilters={COLUNAS_DATA.has(grade.colunaFiltroAberta)}
            sortAscLabel={COLUNAS_DATA.has(grade.colunaFiltroAberta) ? 'Mais antiga primeiro' : undefined}
            sortDescLabel={COLUNAS_DATA.has(grade.colunaFiltroAberta) ? 'Mais recente primeiro' : undefined}
            onSortAsc={(colId) => {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onSortDesc={(colId) => {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onAplicar={grade.aplicarFiltroExcel}
            onCancelar={grade.fecharFiltroExcel}
          />
        ) : null}
      </div>
    </div>
  );
}
