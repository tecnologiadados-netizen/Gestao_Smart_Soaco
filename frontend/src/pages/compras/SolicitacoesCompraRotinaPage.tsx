import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  consultarSolicitacoesCompraRotina,
  type SituacaoPrazoSolicitacao,
  type SolicitacaoCompraRotinaLinha,
} from '../../api/solicitacoesCompraRotina';
import { listarCompradoresPendencias } from '../../api/pendenciasCompras';

const STORAGE_COMPRADOR = 'solicitacoesCompraRotina.comprador';
const VISAO_TODOS = 'todos';

const BTN_PRIMARY =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';

const COLUNAS = [
  { key: 'sc', label: 'SC', numeric: true, align: 'left' as const },
  { key: 'produto', label: 'Produto', numeric: false, align: 'left' as const },
  { key: 'comprador', label: 'Comprador', numeric: false, align: 'left' as const, soTodos: true },
  { key: 'saldo', label: 'Saldo', numeric: true, align: 'right' as const },
  { key: 'status', label: 'Status', numeric: false, align: 'left' as const },
  { key: 'necessidade', label: 'Necessidade', numeric: false, align: 'left' as const, data: true },
  { key: 'prazo', label: 'Prazo', numeric: false, align: 'left' as const },
  { key: 'emAberto', label: 'Em aberto', numeric: true, align: 'left' as const },
  { key: 'cotacao', label: 'Cotação', numeric: false, align: 'left' as const },
] as const;

type ColKey = (typeof COLUNAS)[number]['key'];
const COLUNAS_NUMERICAS = new Set<ColKey>(['sc', 'saldo', 'emAberto']);
const COLUNAS_DATA = ['necessidade'];
const STORAGE_LARGURAS = 'solicitacoesCompraRotina.colWidths.v1';
const MIN_LARGURA_COL = 56;
const MAX_LARGURA_COL = 720;
const LARGURA_PADRAO: Record<ColKey, number> = {
  sc: 88,
  produto: 460,
  comprador: 140,
  saldo: 88,
  status: 150,
  necessidade: 124,
  prazo: 148,
  emAberto: 156,
  cotacao: 140,
};

function limitarLarguraColuna(largura: number): number {
  return Math.max(MIN_LARGURA_COL, Math.min(MAX_LARGURA_COL, Math.round(largura)));
}

function lerLargurasColunas(): Record<ColKey, number> {
  try {
    const raw = localStorage.getItem(STORAGE_LARGURAS);
    if (!raw) return { ...LARGURA_PADRAO };
    const salvo = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...LARGURA_PADRAO };
    for (const key of Object.keys(LARGURA_PADRAO) as ColKey[]) {
      const valor = salvo[key];
      if (typeof valor === 'number' && Number.isFinite(valor)) out[key] = limitarLarguraColuna(valor);
    }
    return out;
  } catch {
    return { ...LARGURA_PADRAO };
  }
}

function lerCompradorSalvo(): string | null {
  try {
    const valor = sessionStorage.getItem(STORAGE_COMPRADOR);
    return valor?.trim() || null;
  } catch {
    return null;
  }
}

function salvarComprador(valor: string) {
  try {
    sessionStorage.setItem(STORAGE_COMPRADOR, valor);
  } catch {
    /* modo privado */
  }
}

function compradorInicial(nomes: string[]): string {
  const salvo = lerCompradorSalvo();
  if (salvo === VISAO_TODOS) return VISAO_TODOS;
  if (salvo && nomes.includes(salvo)) return salvo;
  return nomes.find((nome) => /^comprador\s+\d+/i.test(nome)) ?? nomes[0] ?? VISAO_TODOS;
}

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function formatarQtde(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor);
}

function textoPrazo(linha: SolicitacaoCompraRotinaLinha): string {
  if (linha.situacaoPrazo === 'sem_data') return 'Sem data';
  if (linha.situacaoPrazo === 'hoje') return 'Hoje';
  const dias = linha.diasAteNecessidade ?? 0;
  if (linha.situacaoPrazo === 'atrasada') {
    const atraso = Math.abs(dias);
    return atraso === 1 ? 'Atrasada 1 dia' : `Atrasada ${atraso} dias`;
  }
  return dias === 1 ? 'Em 1 dia' : `Em ${dias} dias`;
}

function tomPrazo(situacao: SituacaoPrazoSolicitacao): {
  barra: string;
  selo: string;
  texto: string;
} {
  if (situacao === 'atrasada') {
    return {
      barra: 'border-l-red-500',
      selo: 'bg-red-600 text-white',
      texto: 'text-red-700 dark:text-red-300',
    };
  }
  if (situacao === 'hoje' || situacao === 'proxima') {
    return {
      barra: 'border-l-amber-500',
      selo: 'bg-amber-500 text-white',
      texto: 'text-amber-800 dark:text-amber-200',
    };
  }
  return {
    barra: 'border-l-primary-600',
    selo: 'bg-primary-600 text-white',
    texto: 'text-slate-600 dark:text-slate-300',
  };
}

type Grupo = {
  prioridade: number;
  nomeColeta: string;
  necessidadeColeta: string | null;
  situacao: SituacaoPrazoSolicitacao;
  linhas: SolicitacaoCompraRotinaLinha[];
};

const URGENCIA: Record<SituacaoPrazoSolicitacao, number> = {
  atrasada: 0,
  hoje: 1,
  proxima: 2,
  no_prazo: 3,
  sem_data: 4,
};

function agrupar(linhas: SolicitacaoCompraRotinaLinha[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const linha of linhas) {
    const atual = grupos[grupos.length - 1];
    if (atual && atual.prioridade === linha.prioridade && atual.nomeColeta === linha.nomeColeta) {
      atual.linhas.push(linha);
      if (
        linha.dataNecessidade &&
        (!atual.necessidadeColeta || linha.dataNecessidade < atual.necessidadeColeta)
      ) {
        atual.necessidadeColeta = linha.dataNecessidade;
      }
      if (URGENCIA[linha.situacaoPrazo] < URGENCIA[atual.situacao]) {
        atual.situacao = linha.situacaoPrazo;
      }
      continue;
    }
    grupos.push({
      prioridade: linha.prioridade,
      nomeColeta: linha.nomeColeta,
      necessidadeColeta: linha.dataNecessidade,
      situacao: linha.situacaoPrazo,
      linhas: [linha],
    });
  }
  return grupos;
}

export default function SolicitacoesCompraRotinaPage() {
  const [compradores, setCompradores] = useState<string[]>([]);
  const [comprador, setComprador] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<SolicitacaoCompraRotinaLinha[]>([]);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [totalGeral, setTotalGeral] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const reqId = useRef(0);
  const colResizeRef = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);
  const [colWidths, setColWidths] = useState(lerLargurasColunas);
  const mostrarComprador = comprador === VISAO_TODOS;

  const getCellText = useCallback((row: SolicitacaoCompraRotinaLinha, key: string): string => {
    if (key === 'sc') return String(row.idSolicitacao);
    if (key === 'produto') return `${row.codigo} ${row.descricao}`.trim();
    if (key === 'comprador') return row.comprador;
    if (key === 'saldo') return formatarQtde(row.saldo);
    if (key === 'status') return row.status;
    if (key === 'necessidade') return formatarData(row.dataNecessidade);
    if (key === 'prazo') return textoPrazo(row);
    if (key === 'emAberto') {
      return row.diasEmAberto == null
        ? '—'
        : `${row.diasEmAberto} d · ${formatarData(row.dataEmissao)}`;
    }
    if (key === 'cotacao') return row.cotacoes || 'Sem cotação';
    return '';
  }, []);

  const valueForSort = useCallback((row: SolicitacaoCompraRotinaLinha, key: string): string | number => {
    if (key === 'sc') return row.idSolicitacao;
    if (key === 'saldo') return row.saldo;
    if (key === 'emAberto') return row.diasEmAberto ?? Number.NEGATIVE_INFINITY;
    if (key === 'necessidade') return row.dataNecessidade ?? '';
    return getCellText(row, key);
  }, [getCellText]);

  const colunasVisiveis = useMemo(
    () => COLUNAS.filter((c) => !('soTodos' in c && c.soTodos) || mostrarComprador),
    [mostrarComprador]
  );
  const columnIds = useMemo(() => colunasVisiveis.map((c) => c.key), [colunasVisiveis]);

  const grade = useGradeFiltrosExcel({
    rows: linhas,
    columnIds,
    getCellText,
    valueForSort,
    dateColumnIds: COLUNAS_DATA,
  });

  const larguraMinimaTabela = useMemo(
    () => colunasVisiveis.reduce((total, coluna) => total + colWidths[coluna.key], 0),
    [colunasVisiveis, colWidths]
  );

  const onColResizePointerDown = useCallback(
    (key: ColKey, e: PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      colResizeRef.current = { key, startX: e.clientX, startW: colWidths[key] };
    },
    [colWidths]
  );

  const onColResizePointerMove = useCallback((e: PointerEvent<HTMLSpanElement>) => {
    const arraste = colResizeRef.current;
    if (!arraste) return;
    const delta = e.clientX - arraste.startX;
    setColWidths((prev) => ({
      ...prev,
      [arraste.key]: limitarLarguraColuna(arraste.startW + delta),
    }));
  }, []);

  const onColResizePointerEnd = useCallback((e: PointerEvent<HTMLSpanElement>) => {
    if (!colResizeRef.current) return;
    colResizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* captura já liberada */
    }
    setColWidths((larguras) => {
      try {
        localStorage.setItem(STORAGE_LARGURAS, JSON.stringify(larguras));
      } catch {
        /* quota / privado */
      }
      return larguras;
    });
  }, []);

  const consultar = useCallback(async (escopo: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setErroApi(null);
    const r = await consultarSolicitacoesCompraRotina(escopo);
    if (id !== reqId.current) return;
    if (r.error || !r.data) {
      setErroApi(r.error ?? 'Erro ao consultar solicitações');
      setLinhas([]);
    } else {
      setLinhas(r.data.linhas);
      setContagens(r.data.contagens);
      setTotalGeral(r.data.totalGeral);
      if (r.data.compradores.length > 0) setCompradores(r.data.compradores);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelado = false;
    void listarCompradoresPendencias()
      .then((nomes) => {
        if (cancelado) return;
        setCompradores(nomes);
        setComprador(compradorInicial(nomes));
      })
      .catch(() => {
        if (cancelado) return;
        setComprador(VISAO_TODOS);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!comprador) return;
    salvarComprador(comprador);
    void consultar(comprador);
  }, [comprador, consultar]);

  const selecionarComprador = (valor: string) => {
    grade.limparFiltrosGrade();
    setComprador(valor);
  };

  const ordenacaoManual = grade.sortState != null;
  const grupos = useMemo(
    () => (ordenacaoManual ? [] : agrupar(grade.rowsExibidas)),
    [grade.rowsExibidas, ordenacaoManual]
  );

  const resumo = useMemo(() => {
    let atrasadas = 0;
    let semCotacao = 0;
    for (const linha of grade.rowsExibidas) {
      if (linha.situacaoPrazo === 'atrasada') atrasadas += 1;
      if (!linha.cotacoes) semCotacao += 1;
    }
    return { atrasadas, semCotacao, coletas: new Set(grade.rowsExibidas.map((l) => l.nomeColeta)).size };
  }, [grade.rowsExibidas]);

  const rotuloEscopo = comprador === VISAO_TODOS ? 'Todos os compradores' : comprador;

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      <CarregandoInformacoesOverlay
        show={loading}
        mensagem="Montando a fila de solicitações…"
        mode="contained"
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <h1 className="mr-1 text-base font-semibold text-slate-800 dark:text-slate-100">
          Solicitações de compra
        </h1>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => selecionarComprador(VISAO_TODOS)}
          className={classeChip(comprador === VISAO_TODOS)}
          aria-pressed={comprador === VISAO_TODOS}
        >
          Todos
          <span className="tabular-nums opacity-80">{totalGeral}</span>
        </button>
        {compradores
          .filter(
            (nome) =>
              Object.keys(contagens).length === 0 ||
              (contagens[nome] ?? 0) > 0 ||
              comprador === nome
          )
          .map((nome) => (
          <button
            key={nome}
            type="button"
            onClick={() => selecionarComprador(nome)}
            className={classeChip(comprador === nome)}
            aria-pressed={comprador === nome}
          >
            {nome}
            <span className="tabular-nums opacity-80">{contagens[nome] ?? 0}</span>
          </button>
        ))}
        </div>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={loading || !comprador}
          onClick={() => comprador && void consultar(comprador)}
        >
          <RefreshCw className="size-4" aria-hidden />
          Atualizar
        </button>
      </div>

      {erroApi && (
        <p className="shrink-0 text-sm text-red-600 dark:text-red-300" role="alert">
          {erroApi}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {grade.rowsExibidas.length === linhas.length
            ? `${linhas.length} solicitações`
            : `${grade.rowsExibidas.length} de ${linhas.length}`}
          {rotuloEscopo ? ` · ${rotuloEscopo}` : ''}
        </span>
        <span className={resumo.atrasadas > 0 ? 'font-medium text-red-600 dark:text-red-300' : ''}>
          {resumo.atrasadas} vencidas
        </span>
        <span>{resumo.semCotacao} sem cotação</span>
        <span>{resumo.coletas} coletas</span>
        <span className="ml-auto hidden md:inline">
          Vermelho: necessidade vencida. Âmbar: vence em até 7 dias.
        </span>
      </div>

      <div
        ref={grade.tableScrollRef}
        className="min-h-0 w-full min-w-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"
      >
        {!loading && linhas.length === 0 && !erroApi && (
          <p className="py-12 text-center text-sm text-slate-500">
            Nenhuma solicitação pendente neste recorte.
          </p>
        )}
        {linhas.length > 0 && (
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
            style={{ minWidth: larguraMinimaTabela }}
          >
            <colgroup>
              {colunasVisiveis.map((coluna) => (
                <col key={coluna.key} style={{ width: colWidths[coluna.key] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 text-xs uppercase tracking-wide text-white">
              <tr>
                {colunasVisiveis.map((coluna) => {
                  const sortAtivo =
                    grade.sortState?.key === coluna.key ||
                    grade.sortLevels.some((nivel) => nivel.id === coluna.key);
                  return (
                    <th
                      key={coluna.key}
                      className={`relative bg-primary-600 px-2 py-2 font-semibold ${
                        coluna.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div
                        className={`flex min-w-0 items-center gap-1 ${
                          coluna.align === 'right' ? 'justify-end' : 'justify-between'
                        }`}
                      >
                        <span className="min-w-0 truncate">{coluna.label}</span>
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(coluna.key) || sortAtivo}
                          onClick={(e) => grade.abrirFiltroExcel(coluna.key, e)}
                        />
                      </div>
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionar coluna ${coluna.label}`}
                        title="Arraste para ajustar a largura"
                        className="absolute right-0 top-0 z-30 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/70 active:bg-sky-300"
                        onPointerDown={(e) => onColResizePointerDown(coluna.key, e)}
                        onPointerMove={onColResizePointerMove}
                        onPointerUp={onColResizePointerEnd}
                        onPointerCancel={onColResizePointerEnd}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grade.rowsExibidas.length === 0 && (
                <tr>
                  <td colSpan={colunasVisiveis.length} className="py-12 text-center text-sm text-slate-500">
                    Nenhuma solicitação passa pelo filtro das colunas.
                  </td>
                </tr>
              )}
              {ordenacaoManual
                ? grade.rowsExibidas.map((linha) => (
                    <LinhaSolicitacao
                      key={linha.idSolicitacao}
                      linha={linha}
                      mostrarComprador={mostrarComprador}
                    />
                  ))
                : grupos.map((grupo) => (
                    <GrupoLinhas
                      key={`${grupo.prioridade}-${grupo.nomeColeta}`}
                      grupo={grupo}
                      tom={tomPrazo(grupo.situacao)}
                      colSpan={colunasVisiveis.length}
                      mostrarComprador={mostrarComprador}
                    />
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={COLUNAS_NUMERICAS.has(grade.colunaFiltroAberta as ColKey)}
          showDateRangeFilters={grade.colunaFiltroAberta === 'necessidade'}
          sortAscLabel={
            COLUNAS_NUMERICAS.has(grade.colunaFiltroAberta as ColKey) ||
            grade.colunaFiltroAberta === 'necessidade'
              ? 'Menor para o maior'
              : undefined
          }
          sortDescLabel={
            COLUNAS_NUMERICAS.has(grade.colunaFiltroAberta as ColKey) ||
            grade.colunaFiltroAberta === 'necessidade'
              ? 'Maior para o menor'
              : undefined
          }
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
      )}
    </div>
  );
}

function classeChip(ativo: boolean): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
    ativo
      ? 'border-primary-600 bg-primary-600 text-white'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
  }`;
}

function LinhaSolicitacao({
  linha,
  mostrarComprador,
}: {
  linha: SolicitacaoCompraRotinaLinha;
  mostrarComprador: boolean;
}) {
  const prazo = tomPrazo(linha.situacaoPrazo);
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 font-mono font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
        {linha.idSolicitacao}
      </td>
      <td className="border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
            {linha.codigo || '—'}
          </span>
          <span className="min-w-0 truncate text-slate-800 dark:text-slate-100" title={linha.descricao}>
            {linha.descricao || '—'}
          </span>
        </div>
      </td>
      {mostrarComprador && (
        <td className="truncate border-b border-slate-100 px-2 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-200">
          {linha.comprador}
        </td>
      )}
      <td
        className={`whitespace-nowrap border-b border-slate-100 px-2 py-2 text-right font-medium tabular-nums dark:border-slate-800 ${
          linha.saldo <= 0 ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'
        }`}
        title={linha.saldo <= 0 ? 'Saldo da solicitação já coberto ou zerado' : undefined}
      >
        {formatarQtde(linha.saldo)}
      </td>
      <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            linha.status === 'Liberada'
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
          }`}
        >
          {linha.status}
        </span>
      </td>
      <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 tabular-nums text-slate-700 dark:border-slate-800 dark:text-slate-200">
        {formatarData(linha.dataNecessidade)}
      </td>
      <td className={`whitespace-nowrap border-b border-slate-100 px-2 py-2 font-medium dark:border-slate-800 ${prazo.texto}`}>
        {textoPrazo(linha)}
      </td>
      <td
        className="whitespace-nowrap border-b border-slate-100 px-2 py-2 tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300"
        title={`Emitida em ${formatarData(linha.dataEmissao)}`}
      >
        {linha.diasEmAberto == null ? '—' : `${linha.diasEmAberto} d · ${formatarData(linha.dataEmissao)}`}
      </td>
      <td className="border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        {linha.cotacoes ? (
          <span className="block truncate text-slate-700 dark:text-slate-200" title={linha.cotacoes}>
            {linha.cotacoes}
          </span>
        ) : (
          <span className="italic text-slate-400">Sem cotação</span>
        )}
      </td>
    </tr>
  );
}

function GrupoLinhas({
  grupo,
  tom,
  colSpan,
  mostrarComprador,
}: {
  grupo: Grupo;
  tom: ReturnType<typeof tomPrazo>;
  colSpan: number;
  mostrarComprador: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colSpan}
          className={`border-y border-slate-200 bg-slate-100 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 ${tom.barra} border-l-4`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${tom.selo}`}
            >
              {grupo.prioridade}
            </span>
            <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
              {grupo.nomeColeta}
            </span>
            <span className={`truncate text-xs ${tom.texto}`}>
              necessidade {formatarData(grupo.necessidadeColeta)} · {grupo.linhas.length}{' '}
              {grupo.linhas.length === 1 ? 'solicitação' : 'solicitações'}
            </span>
          </div>
        </td>
      </tr>
      {grupo.linhas.map((linha) => (
        <LinhaSolicitacao
          key={linha.idSolicitacao}
          linha={linha}
          mostrarComprador={mostrarComprador}
        />
      ))}
    </>
  );
}
