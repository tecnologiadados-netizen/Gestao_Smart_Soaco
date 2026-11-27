import { useCallback, useEffect, useMemo, useState } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchGestaoEntradasDestinadas,
  type ConferenciaDoubleCheckDestinada,
  type ConferenciaFisicaDestinada,
  type GradeDestinadas,
  type LinhaDestinada,
  type SituacaoDestinada,
} from '../../api/gestaoEntradas';
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

const SITUACOES: Array<{ id: SituacaoDestinada; label: string }> = [
  { id: 'aguardando_confirmacao', label: 'Aguardando confirmação' },
  { id: 'em_confirmacao', label: 'Em confirmação' },
  { id: 'confirmada_sem_documento', label: 'Confirmada, sem pré-entrada' },
  { id: 'nao_e_compra', label: 'Não é compra nossa' },
  { id: 'pre_entrada_pendente', label: 'Pré-entrada, Double Check pendente' },
  { id: 'divergencia_responsavel', label: 'Divergência com o responsável' },
  { id: 'aguardando_mesa', label: 'Conferida, aguardando a Mesa' },
  { id: 'em_conferencia_fisica', label: 'Em conferência física' },
  { id: 'documento_lancado', label: 'Documento lançado' },
];

const COLUNAS = [
  { id: 'nf', label: 'NF' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'emissao', label: 'Emissão' },
  { id: 'valor', label: 'Valor' },
  { id: 'nomus', label: 'No Nomus' },
  { id: 'manifestacao', label: 'Manifestação' },
  { id: 'otimiza', label: 'Otimiza' },
  { id: 'documento', label: 'Documento' },
  { id: 'movimentacao', label: 'Movimentação' },
  { id: 'pedido', label: 'Pedido' },
  { id: 'doublecheck', label: 'Double Check' },
  { id: 'fisica', label: 'Conferência física' },
  { id: 'situacao', label: 'Situação' },
];

const COL_IDS = COLUNAS.map((coluna) => coluna.id);
const ORDEM_EMISSAO = [{ id: 'emissao', dir: 'desc' as const }];
const COLUNAS_DATA = new Set(['emissao']);

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

function fmtValor(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function labelSituacao(valor: SituacaoDestinada): string {
  return SITUACOES.find((item) => item.id === valor)?.label ?? valor;
}

function labelNomus(status: number | null): string {
  if (status === 1) return 'Autorizada';
  if (status === 2) return 'Importada';
  if (status == null) return '—';
  return `Status ${status}`;
}

function labelManifestacao(codigo: number | null): string {
  if (codigo == null) return 'Sem manifestação';
  if (codigo === 1) return 'Ciência';
  if (codigo === 2) return 'Confirmação';
  if (codigo === 3) return 'Desconhecimento';
  if (codigo === 4) return 'Operação não realizada';
  return `Manifestação ${codigo}`;
}

function labelFinalidade(codigo: number | null): string | null {
  if (codigo == null || codigo === 1) return null;
  if (codigo === 2) return 'Complementar';
  if (codigo === 3) return 'Ajuste';
  if (codigo === 4) return 'Devolução';
  return `Finalidade ${codigo}`;
}

function labelConferencia(valor: ConferenciaDoubleCheckDestinada): string {
  if (valor === 'conferida') return 'Conferida';
  if (valor === 'nao_aplicada') return 'Não aplicada';
  if (valor === 'pendente') return 'Pendente';
  return '—';
}

function labelFisica(valor: ConferenciaFisicaDestinada): string {
  if (valor === 'aguardando_double_check') return 'Aguardando Double Check';
  if (valor === 'aguardando_conferente') return 'Aguardando conferente';
  if (valor === 'em_conferencia') return 'Em conferência';
  if (valor === 'divergencia') return 'Divergência física';
  if (valor === 'tratamento_compras') return 'Tratamento compras';
  if (valor === 'aguardando_devolucao') return 'Aguardando devolução';
  if (valor === 'devolucao_vinculada') return 'Devolução vinculada';
  if (valor === 'aguardando_movimentacao') return 'Aguardando movimentação';
  if (valor === 'finalizada') return 'Finalizada';
  if (valor === 'cancelada') return 'Cancelada';
  return '—';
}

function labelStatusOtimiza(status: LinhaDestinada['chamados'][number]['status']): string {
  if (status === 'in_progress') return 'em andamento';
  if (status === 'completed') return 'concluída';
  if (status === 'cancelled') return 'cancelada';
  return 'status não consultado';
}

function textoOtimizaItem(item: LinhaDestinada['chamados'][number]): string {
  const base = `${item.numero} · ${labelStatusOtimiza(item.status)}`;
  return item.responsavel ? `${base} · ${item.responsavel}` : base;
}

function textoPedidos(linha: LinhaDestinada): string {
  return linha.pedidos.map((pedido) => pedido.nome).join(', ');
}

function textoBusca(linha: LinhaDestinada): string {
  return [
    linha.numero,
    linha.serie,
    labelFinalidade(linha.finalidade),
    linha.nomeFornecedor,
    linha.numeroDocumento,
    linha.nomeTipo,
    textoPedidos(linha),
    linha.chamados.map(textoOtimizaItem).join(' '),
    labelNomus(linha.statusNomus),
    labelManifestacao(linha.manifestacao),
    labelConferencia(linha.conferencia),
    labelFisica(linha.fisica),
    labelSituacao(linha.situacao),
    linha.conferidoPor,
  ]
    .filter(Boolean)
    .join(' ');
}

function textoCelula(linha: LinhaDestinada, coluna: string): string {
  if (coluna === 'nf') return linha.numero;
  if (coluna === 'fornecedor') return linha.nomeFornecedor || '—';
  if (coluna === 'emissao') return fmtDataBr(linha.dataEmissao);
  if (coluna === 'valor') return fmtValor(linha.valor);
  if (coluna === 'nomus') return labelNomus(linha.statusNomus);
  if (coluna === 'manifestacao') return labelManifestacao(linha.manifestacao);
  if (coluna === 'otimiza') return linha.chamados.map(textoOtimizaItem).join(', ') || '—';
  if (coluna === 'documento') return linha.numeroDocumento || '—';
  if (coluna === 'movimentacao') return linha.nomeTipo || '—';
  if (coluna === 'pedido') return textoPedidos(linha) || '—';
  if (coluna === 'doublecheck') return labelConferencia(linha.conferencia);
  if (coluna === 'fisica') return labelFisica(linha.fisica);
  return labelSituacao(linha.situacao);
}

function valoresFiltro(linha: LinhaDestinada, coluna: string): string[] | null {
  if (coluna === 'otimiza') {
    return linha.chamados.length > 0 ? linha.chamados.map(textoOtimizaItem) : ['—'];
  }
  if (coluna === 'pedido') {
    return linha.pedidos.length > 0 ? linha.pedidos.map((pedido) => pedido.nome) : ['—'];
  }
  return null;
}

function valorOrdenacao(linha: LinhaDestinada, coluna: string): string | number {
  if (coluna === 'emissao') return linha.dataEmissao ?? '';
  if (coluna === 'valor') return linha.valor ?? -1;
  if (coluna === 'nf') return linha.numero;
  return textoCelula(linha, coluna);
}

function classeSelo(tom: 'amber' | 'emerald' | 'slate' | 'violet' | 'cyan' | 'rose'): string {
  if (tom === 'amber') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200';
  if (tom === 'emerald') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (tom === 'violet') return 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200';
  if (tom === 'cyan') return 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100';
  if (tom === 'rose') return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200';
  return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
}

function tomSituacao(valor: SituacaoDestinada): 'amber' | 'emerald' | 'slate' | 'violet' | 'cyan' | 'rose' {
  if (valor === 'documento_lancado') return 'emerald';
  if (valor === 'nao_e_compra') return 'rose';
  if (valor === 'divergencia_responsavel' || valor === 'em_confirmacao') return 'amber';
  if (valor === 'aguardando_confirmacao' || valor === 'confirmada_sem_documento') return 'violet';
  if (valor === 'em_conferencia_fisica' || valor === 'aguardando_mesa') return 'cyan';
  return 'slate';
}

export default function GestaoEntradasDestinadasPanel() {
  const [dataInicio, setDataInicio] = useState(inicioMesYmd);
  const [dataFim, setDataFim] = useState(hojeYmd);
  const [busca, setBusca] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoDestinada | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<GradeDestinadas | null>(null);

  const carregar = useCallback(async (di: string, df: string) => {
    setLoading(true);
    setErro(null);
    setSituacaoFiltro(null);
    try {
      const r = await fetchGestaoEntradasDestinadas({ dataInicio: di, dataFim: df });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar as notas destinadas.');
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
    void carregar(inicioMesYmd(), hojeYmd());
  }, [carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const buscadas = useMemo(
    () => (dados?.linhas ?? []).filter((linha) => match(textoBusca(linha))),
    [dados, match],
  );
  const contagem = useMemo(() => {
    const mapa = new Map<SituacaoDestinada, number>();
    for (const item of SITUACOES) mapa.set(item.id, 0);
    for (const linha of buscadas) mapa.set(linha.situacao, (mapa.get(linha.situacao) ?? 0) + 1);
    return mapa;
  }, [buscadas]);
  const linhas = useMemo(
    () => (situacaoFiltro ? buscadas.filter((linha) => linha.situacao === situacaoFiltro) : buscadas),
    [buscadas, situacaoFiltro],
  );

  const getCellText = useCallback((linha: LinhaDestinada, coluna: string) => textoCelula(linha, coluna), []);
  const getCellFilterValues = useCallback(
    (linha: LinhaDestinada, coluna: string) => valoresFiltro(linha, coluna),
    [],
  );
  const valueForSort = useCallback(
    (linha: LinhaDestinada, coluna: string) => valorOrdenacao(linha, coluna),
    [],
  );
  const grade = useGradeFiltrosExcel<LinhaDestinada>({
    rows: linhas,
    columnIds: COL_IDS,
    getCellText,
    getCellFilterValues,
    valueForSort,
    defaultSortLevels: ORDEM_EMISSAO,
    dateColumnIds: ['emissao'],
  });
  const exibidas = grade.rowsExibidas;

  function filtrarPeriodo() {
    if (!dataInicio || !dataFim) {
      setErro('Informe o início e o fim da emissão.');
      return;
    }
    if (dataFim < dataInicio) {
      setErro('A data final precisa ser igual ou posterior à inicial.');
      return;
    }
    void carregar(dataInicio, dataFim);
  }

  return (
    <div className="relative space-y-4">
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando notas destinadas…" mode="viewport" />
      <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${panelSurface}`}>
        <div>
          <label className={labelClass} htmlFor="ge-dest-inicio">
            Emissão início
          </label>
          <input
            id="ge-dest-inicio"
            type="date"
            className={inputClass}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ge-dest-fim">
            Emissão fim
          </label>
          <input
            id="ge-dest-fim"
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
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor="ge-dest-busca">
            Busca
          </label>
          <input
            id="ge-dest-busca"
            type="search"
            className={`${inputClass} w-full`}
            value={busca}
            placeholder="NF, fornecedor, documento, pedido ou Otimiza. Use % para refinar"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {erro ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {erro}
        </p>
      ) : null}
      {dados?.otimizaIndisponivel ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          O Otimiza não respondeu nesta consulta. A grade mostra o número já gravado no Double Check.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {SITUACOES.map((item) => {
          const ativo = situacaoFiltro === item.id;
          const qtde = contagem.get(item.id) ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={ativo}
              className={`rounded-2xl border px-3 py-3 text-left ${panelSurface} ${
                ativo ? 'ring-2 ring-primary-500' : ''
              }`}
              onClick={() => setSituacaoFiltro((atual) => (atual === item.id ? null : item.id))}
            >
              <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-snug tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{qtde}</p>
            </button>
          );
        })}
      </div>

      <div className={`overflow-hidden ${panelSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <p>
            {buscadas.length} {buscadas.length === 1 ? 'nota destinada' : 'notas destinadas'}
            {situacaoFiltro ? ` · ${labelSituacao(situacaoFiltro)}` : ''}
          </p>
          <p>
            {exibidas.length} {exibidas.length === 1 ? 'linha' : 'linhas'}
            {exibidas.length !== linhas.length ? ' na seleção' : ''}
          </p>
        </div>
        {!loading && !erro && buscadas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma nota destinada neste período.</p>
        ) : null}
        {!loading && !erro && buscadas.length > 0 && linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma nota nesta situação.</p>
        ) : null}
        {linhas.length > 0 ? (
          <div ref={grade.tableScrollRef} className="overflow-auto">
            <table className="w-full min-w-[1680px] border-separate border-spacing-0 text-left text-sm">
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
                      Nenhuma nota com os filtros da grade.
                    </td>
                  </tr>
                ) : (
                  exibidas.map((linha, indice) => {
                    const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                    const finalidade = labelFinalidade(linha.finalidade);
                    return (
                      <tr key={linha.idDestinada} className={faixa}>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <p className="font-medium text-slate-900 dark:text-white">{linha.numero}</p>
                          <p className="text-xs text-slate-500">
                            Série {linha.serie || '—'}
                            {finalidade ? ` · ${finalidade}` : ''}
                          </p>
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.nomeFornecedor || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {fmtDataBr(linha.dataEmissao)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top tabular-nums text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {fmtValor(linha.valor)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {labelNomus(linha.statusNomus)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {labelManifestacao(linha.manifestacao)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.chamados.length === 0 ? (
                            '—'
                          ) : (
                            <ul className="space-y-1">
                              {linha.chamados.map((item) => (
                                <li key={item.numero} title={item.processo || undefined}>
                                  {textoOtimizaItem(item)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.numeroDocumento || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {linha.nomeTipo || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {textoPedidos(linha) || '—'}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classeSelo(linha.conferencia === 'conferida' ? 'emerald' : linha.conferencia === 'pendente' ? 'amber' : 'slate')}`}>
                            {labelConferencia(linha.conferencia)}
                          </span>
                          {linha.conferidoPor ? (
                            <p className="mt-1 text-xs text-slate-500">{linha.conferidoPor}</p>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">
                          {labelFisica(linha.fisica)}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-white/10">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classeSelo(tomSituacao(linha.situacao))}`}>
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
