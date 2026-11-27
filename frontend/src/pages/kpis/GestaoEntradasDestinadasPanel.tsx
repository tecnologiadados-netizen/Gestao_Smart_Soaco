import { useCallback, useEffect, useMemo, useState } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchGestaoEntradasDestinadas,
  type EtapaDestinada,
  type GradeDestinadas,
  type LinhaDestinada,
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

const ETAPAS: Array<{ id: EtapaDestinada; label: string }> = [
  { id: 'sem_documento', label: 'Sem documento' },
  { id: 'pre_entrada', label: 'Pré-entrada' },
  { id: 'verificar_double_check', label: 'Verificar Double Check' },
  { id: 'double_check_otimiza', label: 'Pendente Double Check e Otimiza' },
  { id: 'aguardando_material', label: 'Aguardando material' },
  { id: 'conferencia_fisica', label: 'Conferência física' },
  { id: 'aguardando_mesa', label: 'Aguardando a Mesa' },
  { id: 'efetivado', label: 'Efetivado' },
  { id: 'nao_e_compra', label: 'Não é compra nossa' },
];

const ETAPAS_PRE_ENTRADA = new Set<EtapaDestinada>([
  'pre_entrada',
  'verificar_double_check',
  'double_check_otimiza',
  'aguardando_material',
  'conferencia_fisica',
  'aguardando_mesa',
]);

const COLUNAS = [
  { id: 'nf', label: 'NF' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'emissao', label: 'Emissão' },
  { id: 'valor', label: 'Valor' },
  { id: 'documento', label: 'Documento' },
  { id: 'etapa', label: 'Etapa' },
  { id: 'otimiza', label: 'Otimiza' },
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

function labelEtapa(valor: EtapaDestinada): string {
  return ETAPAS.find((item) => item.id === valor)?.label ?? valor;
}

function labelFinalidade(codigo: number | null): string | null {
  if (codigo == null || codigo === 1) return null;
  if (codigo === 2) return 'Complementar';
  if (codigo === 3) return 'Ajuste';
  if (codigo === 4) return 'Devolução';
  return `Finalidade ${codigo}`;
}

type ChamadoDestinadaLinha = LinhaDestinada['chamados'][number];

function chamadoEmAndamento(item: ChamadoDestinadaLinha): boolean {
  return item.status === 'in_progress' || item.status == null;
}

function chamadosEmAndamento(linha: LinhaDestinada): LinhaDestinada['chamados'] {
  return linha.chamados.filter(chamadoEmAndamento);
}

function labelStatusOtimiza(status: ChamadoDestinadaLinha['status']): string {
  if (status === 'completed') return 'Concluído';
  if (status === 'cancelled') return 'Cancelado';
  return 'Em andamento';
}

function tomStatusOtimiza(status: ChamadoDestinadaLinha['status']): 'amber' | 'emerald' | 'rose' {
  if (status === 'completed') return 'emerald';
  if (status === 'cancelled') return 'rose';
  return 'amber';
}

function textoOtimizaChamado(item: ChamadoDestinadaLinha): string {
  const responsavel = item.responsavel?.trim();
  const base = responsavel ? `${item.numero} · ${responsavel}` : String(item.numero);
  return `${base} ${labelStatusOtimiza(item.status)}`;
}

function textoBusca(linha: LinhaDestinada): string {
  return [
    linha.numero,
    linha.serie,
    labelFinalidade(linha.finalidade),
    linha.nomeFornecedor,
    linha.numeroDocumento,
    linha.nomeTipo,
    labelEtapa(linha.etapa),
    ...linha.chamados.map(textoOtimizaChamado),
  ]
    .filter(Boolean)
    .join(' ');
}

function textoCelula(linha: LinhaDestinada, coluna: string): string {
  if (coluna === 'nf') return linha.numero;
  if (coluna === 'fornecedor') return linha.nomeFornecedor || '—';
  if (coluna === 'emissao') return fmtDataBr(linha.dataEmissao);
  if (coluna === 'valor') return fmtValor(linha.valor);
  if (coluna === 'documento') {
    if (!linha.numeroDocumento && !linha.nomeTipo) return '—';
    return [linha.numeroDocumento, linha.nomeTipo].filter(Boolean).join(' ');
  }
  if (coluna === 'etapa') return labelEtapa(linha.etapa);
  return linha.chamados.length > 0 ? linha.chamados.map(textoOtimizaChamado).join(', ') : '—';
}

function valoresFiltro(linha: LinhaDestinada, coluna: string): string[] | null {
  if (coluna !== 'otimiza') return null;
  return linha.chamados.length > 0 ? linha.chamados.map(textoOtimizaChamado) : ['—'];
}

function renderCelulaDestinada(linha: LinhaDestinada, coluna: string) {
  if (coluna === 'nf') {
    const finalidade = labelFinalidade(linha.finalidade);
    return (
      <>
        <p className="font-medium text-slate-900 dark:text-white">{linha.numero}</p>
        <p className="text-xs text-slate-500">
          Série {linha.serie || '—'}
          {finalidade ? ` · ${finalidade}` : ''}
        </p>
      </>
    );
  }
  if (coluna === 'documento') {
    if (!linha.numeroDocumento && !linha.nomeTipo) return '—';
    return (
      <>
        <p className="font-medium text-slate-900 dark:text-white">{linha.numeroDocumento || '—'}</p>
        {linha.nomeTipo ? <p className="max-w-[16rem] text-xs text-slate-500">{linha.nomeTipo}</p> : null}
      </>
    );
  }
  if (coluna === 'etapa') {
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classeSelo(tomEtapa(linha.etapa))}`}>
        {labelEtapa(linha.etapa)}
      </span>
    );
  }
  if (coluna === 'otimiza') {
    if (linha.chamados.length === 0) return '—';
    return (
      <ul className="space-y-1">
        {linha.chamados.map((item) => {
          const responsavel = item.responsavel?.trim();
          return (
            <li
              key={`${item.numero}-${item.status ?? 'aberto'}`}
              className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
            >
              <span>{responsavel ? `${item.numero} · ${responsavel}` : item.numero}</span>
              <span
                className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${classeSelo(tomStatusOtimiza(item.status))}`}
              >
                {labelStatusOtimiza(item.status)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  return textoCelula(linha, coluna);
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

type FiltroIndicador = 'destinadas' | 'efetivados' | 'pre-entrada' | 'nao-reconhecidas';

function emPreEntrada(linha: LinhaDestinada): boolean {
  return ETAPAS_PRE_ENTRADA.has(linha.etapa);
}

function passaFiltroIndicador(linha: LinhaDestinada, filtro: FiltroIndicador | null): boolean {
  if (!filtro || filtro === 'destinadas') return true;
  if (filtro === 'pre-entrada') return emPreEntrada(linha);
  if (filtro === 'efetivados') return linha.etapa === 'efetivado';
  return linha.etapa === 'nao_e_compra';
}

function tomEtapa(valor: EtapaDestinada): 'amber' | 'emerald' | 'slate' | 'violet' | 'cyan' | 'rose' {
  if (valor === 'efetivado') return 'emerald';
  if (valor === 'nao_e_compra') return 'rose';
  if (valor === 'pre_entrada' || valor === 'verificar_double_check' || valor === 'double_check_otimiza') {
    return 'amber';
  }
  if (valor === 'conferencia_fisica' || valor === 'aguardando_mesa' || valor === 'aguardando_material') {
    return 'cyan';
  }
  if (valor === 'sem_documento') return 'violet';
  return 'slate';
}

export default function GestaoEntradasDestinadasPanel() {
  const [dataInicio, setDataInicio] = useState(inicioMesYmd);
  const [dataFim, setDataFim] = useState(hojeYmd);
  const [busca, setBusca] = useState('');
  const [filtroIndicador, setFiltroIndicador] = useState<FiltroIndicador | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<GradeDestinadas | null>(null);

  const carregar = useCallback(async (di: string, df: string) => {
    setLoading(true);
    setErro(null);
    setFiltroIndicador(null);
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

  const indicadores = useMemo(() => {
    const periodo = dados?.linhas ?? [];
    const preEntradas = periodo.filter((linha) => emPreEntrada(linha));
    const cards: Array<{
      id: FiltroIndicador;
      titulo: string;
      detalhe: string;
      valor: number;
      sublegenda: string | null;
      barra: string;
      anel: string;
      numero: string;
    }> = [
      {
        id: 'destinadas',
        titulo: 'Notas destinadas',
        detalhe: 'No período',
        valor: periodo.length,
        sublegenda: null,
        barra: 'bg-sky-500',
        anel: 'ring-sky-500',
        numero: 'text-sky-700 dark:text-sky-200',
      },
      {
        id: 'efetivados',
        titulo: 'Efetivados',
        detalhe: 'Entradas efetivadas',
        valor: periodo.filter((linha) => linha.etapa === 'efetivado').length,
        sublegenda: null,
        barra: 'bg-emerald-500',
        anel: 'ring-emerald-500',
        numero: 'text-emerald-700 dark:text-emerald-200',
      },
      {
        id: 'pre-entrada',
        titulo: 'Pré-entradas',
        detalhe: 'Documento ainda não efetivado',
        valor: preEntradas.length,
        sublegenda: `${preEntradas.filter((linha) => chamadosEmAndamento(linha).length > 0).length} com Otimiza em andamento`,
        barra: 'bg-amber-500',
        anel: 'ring-amber-500',
        numero: 'text-amber-700 dark:text-amber-200',
      },
      {
        id: 'nao-reconhecidas',
        titulo: 'Não reconhecidas',
        detalhe: 'Não é compra nossa',
        valor: periodo.filter((linha) => linha.etapa === 'nao_e_compra').length,
        sublegenda: null,
        barra: 'bg-rose-500',
        anel: 'ring-rose-500',
        numero: 'text-rose-700 dark:text-rose-200',
      },
    ];
    return cards;
  }, [dados]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const linhas = useMemo(
    () =>
      (dados?.linhas ?? []).filter(
        (linha) => passaFiltroIndicador(linha, filtroIndicador) && match(textoBusca(linha)),
      ),
    [dados, filtroIndicador, match],
  );
  const filtroAtivo = indicadores.find((item) => item.id === filtroIndicador) ?? null;

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
          {dados.otimizaAviso ||
            'A consulta ao vivo no Otimiza não completou. A grade mostra o número e o status já gravados no Double Check, sem quem está com o chamado — esse nome não fica salvo aqui.'}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {indicadores.map((item) => {
          const ativo = item.id === 'destinadas' ? filtroIndicador == null : filtroIndicador === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={ativo}
              className={`relative overflow-hidden px-4 py-4 text-left ${panelSurface} ${
                ativo ? `ring-2 ${item.anel}` : 'hover:brightness-110'
              }`}
              onClick={() =>
                setFiltroIndicador((atual) => {
                  if (item.id === 'destinadas') return null;
                  return atual === item.id ? null : item.id;
                })
              }
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${item.barra}`} aria-hidden />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.titulo}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.detalhe}</p>
              <p className={`mt-3 text-3xl font-semibold tabular-nums leading-none ${item.numero}`}>{item.valor}</p>
              {item.sublegenda ? (
                <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-200">{item.sublegenda}</p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={`overflow-hidden ${panelSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <p>
            {linhas.length} {linhas.length === 1 ? 'nota destinada' : 'notas destinadas'}
            {filtroAtivo ? ` · ${filtroAtivo.titulo}` : ''}
          </p>
          <p>
            {exibidas.length} {exibidas.length === 1 ? 'linha' : 'linhas'}
            {exibidas.length !== linhas.length ? ' na seleção' : ''}
          </p>
        </div>
        {!loading && !erro && (dados?.linhas.length ?? 0) === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma nota destinada neste período.</p>
        ) : null}
        {!loading && !erro && (dados?.linhas.length ?? 0) > 0 && linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma nota neste indicador.</p>
        ) : null}
        {linhas.length > 0 ? (
          <div ref={grade.tableScrollRef} className="overflow-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
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
                    const celula = 'border-b border-slate-200 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200';
                    return (
                      <tr key={linha.idDestinada} className={faixa}>
                        {COLUNAS.map((coluna) => (
                          <td key={coluna.id} className={coluna.id === 'emissao' || coluna.id === 'valor' ? `${celula} tabular-nums` : celula}>
                            {renderCelulaDestinada(linha, coluna.id)}
                          </td>
                        ))}
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
