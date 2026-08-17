import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, History, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  fetchCrmInadimplentePainel,
  fetchCrmInadimplentePainelDetalhe,
  type FatiaPainelInadimplencia,
  type TarefaInadimplente,
  type TituloPainelInadimplencia,
} from '../../../../api/crmFinanceiro';
import GradeFiltroCabecalhoBtn from '../../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../../../hooks/useGradeFiltrosExcel';
import { formatarPct, formatarReais } from '../../dashboard/dashboardFormat';
import { getPrimeiroDiaUtilDoVencimento } from '../lib/atraso-recebimento';
import { downloadPainelInadimplenciaDetalheXlsx } from '../lib/exportPainelInadimplenciaDetalheXlsx';
import { CelulaDataVencimento, textoFiltroDataVencimento } from './CelulaDataVencimento';
import ModalHistoricoContatosTarefa from './ModalHistoricoContatosTarefa';

const FILTRO_LABEL = 'mb-1 block text-xs text-slate-500 dark:text-slate-400';
const FILTRO_INPUT =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const PIE_PALETTE = [
  '#1E22AA',
  '#FFAD00',
  '#0d9488',
  '#7c3aed',
  '#e11d48',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#64748b',
];

const FATIA_VAZIA: FatiaPainelInadimplencia = { chave: '', valor: 0, qtd: 0 };

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function periodoUltimosDoisMeses(): { de: string; ate: string } {
  const ate = new Date();
  const de = new Date(ate.getFullYear(), ate.getMonth() - 2, ate.getDate());
  return { de: ymdLocal(de), ate: ymdLocal(ate) };
}

function formatYmd(ymd: string | null): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return ymd;
}

function parseYmdLocal(ymd: string | null): Date | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Recebido: atraso após o prazo efetivo (1º dia útil se o vencimento for sáb/dom/feriado). Aberto: hoje − vencimento. */
function diasAtrasoTitulo(row: TituloPainelInadimplencia): number | null {
  const venc = parseYmdLocal(row.vencimento);
  if (!venc) return null;
  const pagIso = row.pagamento ?? row.dataBaixa;
  if (pagIso) {
    const prazo = getPrimeiroDiaUtilDoVencimento(row.vencimento!);
    const ate = parseYmdLocal(pagIso);
    if (!prazo || !ate) return null;
    const dias = Math.round(
      (Date.UTC(ate.getFullYear(), ate.getMonth(), ate.getDate()) -
        Date.UTC(prazo.getFullYear(), prazo.getMonth(), prazo.getDate())) /
        86_400_000,
    );
    return Math.max(0, dias);
  }
  const hoje = new Date();
  const ate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((ate.getTime() - venc.getTime()) / 86_400_000);
  return Math.max(0, dias);
}

function moneyBr(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type SliceRow = FatiaPainelInadimplencia & { cor: string };

function fatiasComCor(fatias: FatiaPainelInadimplencia[]): SliceRow[] {
  return fatias.map((f, i) => ({ ...f, cor: PIE_PALETTE[i % PIE_PALETTE.length]! }));
}

function tituloParaTarefa(row: TituloPainelInadimplencia): TarefaInadimplente | null {
  if (row.tarefaId == null) return null;
  return {
    id: row.tarefaId,
    origem: row.origem,
    codigoConta: row.codigoConta,
    clienteNome: row.clienteNome,
    clienteChave: row.clienteNome,
    empresaId: null,
    empresaNome: row.empresaNome,
    banco: null,
    tipo: row.tipo,
    vencimento: row.vencimento,
    pagamento: row.pagamento,
    dataBaixa: row.dataBaixa,
    valor: row.valor,
    diasAtraso: diasAtrasoTitulo(row) ?? 0,
    nfPd: null,
    descricao: null,
    vendedor: null,
    status: 'concluida',
    responsavelUsuarioId: null,
    responsavelNome: null,
    responsavelLogin: null,
    contatosCount: row.contatosCount,
    concluidaEm: null,
    lastSeenAt: '',
    createdAt: '',
    updatedAt: '',
  };
}

function PizzaValor({
  titulo,
  fatias,
  onFatia,
}: {
  titulo: string;
  fatias: SliceRow[];
  onFatia: (f: SliceRow) => void;
}) {
  const total = fatias.reduce((acc, f) => acc + f.valor, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
      {fatias.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Sem títulos em aberto neste período.</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="valor"
                  nameKey="chave"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={84}
                  paddingAngle={1.5}
                  cursor="pointer"
                  onClick={(_, index) => {
                    const row = fatias[index];
                    if (row) onFatia(row);
                  }}
                >
                  {fatias.map((f) => (
                    <Cell key={f.chave} fill={f.cor} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, item) => {
                    const row = item?.payload as SliceRow | undefined;
                    const pct = total > 0 ? (Number(v) / total) * 100 : 0;
                    return [
                      `${formatarReais(Number(v) || 0)} (${formatarPct(pct)}) · ${row?.qtd ?? 0} tít.`,
                      row?.chave ?? '',
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-xs">
            {fatias.map((f) => {
              const pct = total > 0 ? (f.valor / total) * 100 : 0;
              return (
                <li key={f.chave}>
                  <button
                    type="button"
                    onClick={() => onFatia(f)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: f.cor }} />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{f.chave}</span>
                    <span className="shrink-0 tabular-nums font-medium text-slate-800 dark:text-slate-100">
                      {formatarReais(f.valor)}
                    </span>
                    <span className="w-12 shrink-0 text-right tabular-nums text-slate-500">{formatarPct(pct)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {total > 0 ? (
        <p className="mt-2 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          Total {formatarReais(total)}
        </p>
      ) : null}
    </div>
  );
}

function CardRecuperado({
  titulo,
  fatia,
  destaque,
  onClick,
}: {
  titulo: string;
  fatia: FatiaPainelInadimplencia;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition hover:border-blue-400 dark:hover:border-blue-500 ${
        destaque
          ? 'border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatarReais(fatia.valor)}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {fatia.qtd.toLocaleString('pt-BR')} título{fatia.qtd === 1 ? '' : 's'}
      </p>
    </button>
  );
}

const DETALHE_COLS = [
  'cliente',
  'empresa',
  'conta',
  'condicao',
  'vencimento',
  'recebimento',
  'atraso',
  'valor',
  'tratativas',
] as const;

type DetalheColId = (typeof DETALHE_COLS)[number];

const DETALHE_COL_LABELS: Record<DetalheColId, string> = {
  cliente: 'Cliente',
  empresa: 'Empresa',
  conta: 'Conta',
  condicao: 'Condição',
  vencimento: 'Vencim.',
  recebimento: 'Recebim.',
  atraso: 'Dias atraso',
  valor: 'Valor',
  tratativas: 'Trat.',
};

const DETALHE_NUMERIC = new Set<DetalheColId>(['atraso', 'valor', 'tratativas']);
const DETALHE_DATAS = new Set<DetalheColId>(['vencimento', 'recebimento']);

function detalheCellText(row: TituloPainelInadimplencia, col: DetalheColId): string {
  switch (col) {
    case 'cliente':
      return row.clienteNome;
    case 'empresa':
      return row.empresaNome?.trim() || '—';
    case 'conta':
      return row.codigoConta;
    case 'condicao':
      return row.tipo?.trim() || '—';
    case 'vencimento':
      return textoFiltroDataVencimento(row.vencimento);
    case 'recebimento':
      return formatYmd(row.pagamento ?? row.dataBaixa);
    case 'atraso': {
      const dias = diasAtrasoTitulo(row);
      return dias == null ? '—' : `${dias}d`;
    }
    case 'valor':
      return moneyBr(row.valor);
    case 'tratativas':
      return String(row.contatosCount);
    default:
      return '';
  }
}

function detalheSortValue(row: TituloPainelInadimplencia, col: DetalheColId): string | number {
  switch (col) {
    case 'vencimento':
      return row.vencimento ?? '';
    case 'recebimento':
      return row.pagamento ?? row.dataBaixa ?? '';
    case 'valor':
      return row.valor;
    case 'atraso':
      return diasAtrasoTitulo(row) ?? -1;
    case 'tratativas':
      return row.contatosCount;
    case 'conta':
      return Number(row.codigoConta) || row.codigoConta;
    default:
      return detalheCellText(row, col).toLowerCase();
  }
}

function ModalDetalhe({
  titulo,
  linhas,
  qtdConsolidado,
  carregando,
  carregandoMais,
  hasMore,
  onCarregarMais,
  onClose,
  onAbrirTratativas,
}: {
  titulo: string;
  linhas: TituloPainelInadimplencia[];
  qtdConsolidado: number;
  carregando: boolean;
  carregandoMais: boolean;
  hasMore: boolean;
  onCarregarMais: () => void;
  onClose: () => void;
  onAbrirTratativas: (row: TituloPainelInadimplencia) => void;
}) {
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState('');

  const grade = useGradeFiltrosExcel<TituloPainelInadimplencia>({
    rows: linhas,
    columnIds: [...DETALHE_COLS],
    getCellText: (r, c) => detalheCellText(r, c as DetalheColId),
    valueForSort: (r, c) => detalheSortValue(r, c as DetalheColId),
    defaultSortLevels: [{ id: 'vencimento', dir: 'desc' }],
    dateColumnIds: ['vencimento', 'recebimento'],
  });

  const total = grade.rowsExibidas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0);

  const exportarXlsx = async () => {
    setErroExport('');
    setExportando(true);
    try {
      await downloadPainelInadimplenciaDetalheXlsx({
        linhas: grade.rowsExibidas,
        titulo,
        diasAtraso: diasAtrasoTitulo,
      });
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : 'Não foi possível gerar o Excel.');
    } finally {
      setExportando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-16" onClick={onClose}>
      <div
        className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
            <p className="text-xs text-slate-500">
              {carregando
                ? 'Carregando…'
                : `${grade.rowsExibidas.length.toLocaleString('pt-BR')} de ${qtdConsolidado.toLocaleString('pt-BR')} título${
                    qtdConsolidado === 1 ? '' : 's'
                  } · ${formatarReais(total)} nesta lista`}
            </p>
            {erroExport ? <p className="mt-1 text-xs text-amber-700">{erroExport}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {grade.temFiltrosOuOrdem ? (
              <button
                type="button"
                onClick={() => grade.limparFiltrosGrade()}
                className="inline-flex h-7 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                Limpar filtros
              </button>
            ) : null}
            <button
              type="button"
              disabled={carregando || exportando || grade.rowsExibidas.length === 0}
              onClick={() => void exportarXlsx()}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              title="Exportar as linhas visíveis (com filtro) em Excel"
            >
              <FileSpreadsheet className="size-3.5" />
              {exportando ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div ref={grade.tableScrollRef} className="relative max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-blue-700 text-white">
              <tr>
                {DETALHE_COLS.map((colId) => (
                  <th key={colId} className="px-0 py-0 font-semibold">
                    <div className="flex min-h-[2.25rem] items-center justify-between gap-1 px-1.5 py-1">
                      <span
                        className={`min-w-0 flex-1 truncate text-[10px] uppercase leading-tight tracking-wide ${
                          DETALHE_NUMERIC.has(colId) ? 'text-right' : ''
                        }`}
                      >
                        {DETALHE_COL_LABELS[colId]}
                      </span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(colId)}
                        onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grade.rowsExibidas.map((r) => {
                const dias = diasAtrasoTitulo(r);
                return (
                <tr key={`${r.origem}:${r.codigoConta}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">{r.clienteNome}</td>
                  <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{r.empresaNome ?? '—'}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.codigoConta}</td>
                  <td className="px-2 py-1.5">{r.tipo?.trim() || '—'}</td>
                  <td className="px-2 py-1.5">
                    <CelulaDataVencimento value={r.vencimento} />
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{formatYmd(r.pagamento ?? r.dataBaixa)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {dias == null ? '—' : `${dias}d`}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moneyBr(r.valor)}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {r.contatosCount > 0 && r.tarefaId != null ? (
                      <button
                        type="button"
                        title="Ver tratativas"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrirTratativas(r);
                        }}
                        className="inline-flex items-center gap-1 rounded-md p-1 text-blue-700 hover:bg-blue-50 dark:text-sky-300 dark:hover:bg-blue-950/40"
                      >
                        <History className="size-4" />
                        {r.contatosCount}
                      </button>
                    ) : (
                      <span className="px-1 text-slate-400">{r.contatosCount}</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!carregando && hasMore ? (
            <div className="flex justify-center p-3">
              <button
                type="button"
                disabled={carregandoMais}
                onClick={onCarregarMais}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                {carregandoMais ? 'Carregando…' : 'Carregar mais'}
              </button>
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
              zIndex={14000}
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
              showNumericFilters={DETALHE_NUMERIC.has(grade.colunaFiltroAberta as DetalheColId)}
              showDateRangeFilters={DETALHE_DATAS.has(grade.colunaFiltroAberta as DetalheColId)}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type PedidoDetalhe = {
  titulo: string;
  universo: 'aberto' | 'recuperado';
  classe: 'empresa' | 'condicao' | 'total' | 'mesmo_mes' | 'outros_meses';
  chave?: string;
  qtd: number;
};

const DETALHE_PAGE = 400;

export default function PainelInadimplenciaPanel() {
  const padrao = periodoUltimosDoisMeses();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dataDe, setDataDe] = useState(padrao.de);
  const [dataAte, setDataAte] = useState(padrao.ate);
  const [porEmpresa, setPorEmpresa] = useState<SliceRow[]>([]);
  const [porCondicao, setPorCondicao] = useState<SliceRow[]>([]);
  const [totalRecuperado, setTotalRecuperado] = useState(FATIA_VAZIA);
  const [mesmoMes, setMesmoMes] = useState(FATIA_VAZIA);
  const [outrosMeses, setOutrosMeses] = useState(FATIA_VAZIA);
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoDetalhe | null>(null);
  const [linhasDetalhe, setLinhasDetalhe] = useState<TituloPainelInadimplencia[]>([]);
  const [hasMoreDetalhe, setHasMoreDetalhe] = useState(false);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [tarefaHist, setTarefaHist] = useState<TarefaInadimplente | null>(null);
  const detalheCacheRef = useRef(new Map<string, { data: TituloPainelInadimplencia[]; hasMore: boolean }>());

  const chaveDetalhe = (pedido: PedidoDetalhe, offset: number) =>
    [dataDe, dataAte, pedido.universo, pedido.classe, pedido.chave ?? '', String(offset)].join('|');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    detalheCacheRef.current.clear();
    try {
      const result = await fetchCrmInadimplentePainel({
        de: dataDe || undefined,
        ate: dataAte || undefined,
      });
      setPorEmpresa(fatiasComCor(result.porEmpresa));
      setPorCondicao(fatiasComCor(result.porCondicao));
      setTotalRecuperado(result.recuperado.total);
      setMesmoMes(result.recuperado.mesmoMes);
      setOutrosMeses(result.recuperado.outrosMeses);
      if (result.erros.length) setErro(result.erros.join(' · '));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, [dataDe, dataAte]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const buscarPagina = async (pedido: PedidoDetalhe, offset: number) => {
    const key = chaveDetalhe(pedido, offset);
    const cached = detalheCacheRef.current.get(key);
    if (cached) return cached;
    const result = await fetchCrmInadimplentePainelDetalhe({
      de: dataDe || undefined,
      ate: dataAte || undefined,
      universo: pedido.universo,
      classe: pedido.classe,
      chave: pedido.chave,
      offset,
      limit: DETALHE_PAGE,
    });
    detalheCacheRef.current.set(key, result);
    return result;
  };

  const abrirDetalhe = async (pedido: PedidoDetalhe) => {
    setPedidoDetalhe(pedido);
    setLinhasDetalhe([]);
    setHasMoreDetalhe(false);
    setCarregandoDetalhe(true);
    try {
      const result = await buscarPagina(pedido, 0);
      setLinhasDetalhe(result.data);
      setHasMoreDetalhe(result.hasMore);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o detalhe.');
      setPedidoDetalhe(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const carregarMaisDetalhe = async () => {
    if (!pedidoDetalhe || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const result = await buscarPagina(pedidoDetalhe, linhasDetalhe.length);
      setLinhasDetalhe((atual) => [...atual, ...result.data]);
      setHasMoreDetalhe(result.hasMore);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o detalhe.');
    } finally {
      setCarregandoMais(false);
    }
  };

  const padraoAtual = periodoUltimosDoisMeses();
  const periodoDoisMeses = dataDe === padraoAtual.de && dataAte === padraoAtual.ate;
  const periodoCompleto = !dataDe && !dataAte;

  return (
    <section className="space-y-3">
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">{erro}</p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Carregando indicadores…</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={FILTRO_LABEL} htmlFor="painel-inad-de">
            De
          </label>
          <input
            id="painel-inad-de"
            type="date"
            value={dataDe}
            max={dataAte || undefined}
            onChange={(e) => setDataDe(e.target.value)}
            className={FILTRO_INPUT}
          />
        </div>
        <div>
          <label className={FILTRO_LABEL} htmlFor="painel-inad-ate">
            Até
          </label>
          <input
            id="painel-inad-ate"
            type="date"
            value={dataAte}
            min={dataDe || undefined}
            onChange={(e) => setDataAte(e.target.value)}
            className={FILTRO_INPUT}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const p = periodoUltimosDoisMeses();
            setDataDe(p.de);
            setDataAte(p.ate);
          }}
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
            periodoDoisMeses
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Últimos 2 meses
        </button>
        <button
          type="button"
          onClick={() => {
            setDataDe('');
            setDataAte('');
          }}
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
            periodoCompleto
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Período completo
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Recuperado</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CardRecuperado
            destaque
            titulo="Total recuperado"
            fatia={totalRecuperado}
            onClick={() =>
              void abrirDetalhe({
                titulo: 'Recuperado',
                universo: 'recuperado',
                classe: 'total',
                qtd: totalRecuperado.qtd,
              })
            }
          />
          <CardRecuperado
            titulo="Recuperado no mês"
            fatia={mesmoMes}
            onClick={() =>
              void abrirDetalhe({
                titulo: 'Recuperado no mês',
                universo: 'recuperado',
                classe: 'mesmo_mes',
                qtd: mesmoMes.qtd,
              })
            }
          />
          <CardRecuperado
            titulo="Pago em meses seguintes"
            fatia={outrosMeses}
            onClick={() =>
              void abrirDetalhe({
                titulo: 'Pago em meses seguintes',
                universo: 'recuperado',
                classe: 'outros_meses',
                qtd: outrosMeses.qtd,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PizzaValor
          titulo="Inadimplência por empresa"
          fatias={porEmpresa}
          onFatia={(f) =>
            void abrirDetalhe({
              titulo: `Por empresa — ${f.chave}`,
              universo: 'aberto',
              classe: 'empresa',
              chave: f.chave,
              qtd: f.qtd,
            })
          }
        />
        <PizzaValor
          titulo="Inadimplência por condição de pagamento"
          fatias={porCondicao}
          onFatia={(f) =>
            void abrirDetalhe({
              titulo: `Por condição — ${f.chave}`,
              universo: 'aberto',
              classe: 'condicao',
              chave: f.chave,
              qtd: f.qtd,
            })
          }
        />
      </div>

      {pedidoDetalhe ? (
        <ModalDetalhe
          key={`${pedidoDetalhe.universo}:${pedidoDetalhe.classe}:${pedidoDetalhe.chave ?? ''}`}
          titulo={pedidoDetalhe.titulo}
          linhas={linhasDetalhe}
          qtdConsolidado={pedidoDetalhe.qtd}
          carregando={carregandoDetalhe}
          carregandoMais={carregandoMais}
          hasMore={hasMoreDetalhe}
          onCarregarMais={() => void carregarMaisDetalhe()}
          onClose={() => {
            setPedidoDetalhe(null);
            setLinhasDetalhe([]);
            setHasMoreDetalhe(false);
          }}
          onAbrirTratativas={(row) => setTarefaHist(tituloParaTarefa(row))}
        />
      ) : null}
      <ModalHistoricoContatosTarefa
        tarefa={tarefaHist}
        open={tarefaHist != null}
        onClose={() => setTarefaHist(null)}
        onChanged={() => void carregar()}
      />
    </section>
  );
}
