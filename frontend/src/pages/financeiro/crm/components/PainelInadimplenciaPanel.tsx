import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, History, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  fetchCrmInadimplentePainel,
  fetchCrmInadimplentePainelDetalhe,
  type FatiaPainelInadimplencia,
  type PontoSerieInadimplencia,
  type TarefaInadimplente,
  type TituloPainelInadimplencia,
} from '../../../../api/crmFinanceiro';
import GradeFiltroCabecalhoBtn from '../../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../../../hooks/useGradeFiltrosExcel';
import { parseDateRangeFilter } from '../../../../utils/gradeFiltroData';
import { formatarPct, formatarReais, rotuloPeriodoMes } from '../../dashboard/dashboardFormat';
import { getPrimeiroDiaUtilDoVencimento } from '../lib/atraso-recebimento';
import { downloadPainelInadimplenciaDetalheXlsx } from '../lib/exportPainelInadimplenciaDetalheXlsx';
import { CelulaDataVencimento, textoFiltroDataVencimento } from './CelulaDataVencimento';
import EvolucaoInadimplenciaChart from './EvolucaoInadimplenciaChart';
import LoadingOverlay from './LoadingOverlay';
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

const FATIA_VAZIA: FatiaPainelInadimplencia = { chave: '', valor: 0, qtd: 0, qtdNomus: 0, qtdShop9: 0 };

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

function corTextoSobre(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return '#fff';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f172a' : '#fff';
}

function PizzaValor({
  titulo,
  fatias,
  onFatia,
  maxBarrasVisiveis,
}: {
  titulo: string;
  fatias: SliceRow[];
  onFatia: (f: SliceRow) => void;
  maxBarrasVisiveis?: number;
}) {
  const total = fatias.reduce((acc, f) => acc + f.valor, 0);
  const rows = fatias
    .map((f) => ({
      ...f,
      pct: total > 0 ? (f.valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
  const maxPct = rows.reduce((m, r) => Math.max(m, r.pct), 0);
  const xMax = Math.max(10, Math.ceil(maxPct / 10) * 10);
  const altura = rows.length * 34 + 32;
  const alturaVisivel =
    maxBarrasVisiveis != null && rows.length > maxBarrasVisiveis
      ? maxBarrasVisiveis * 34 + 32
      : altura;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
      <p className="mb-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Atraso no período (pago após o prazo efetivo ou ainda aberto).
      </p>
      {fatias.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Sem atraso neste período.</p>
      ) : (
        <div
          className={alturaVisivel < altura ? 'w-full overflow-y-scroll overscroll-contain' : 'w-full'}
          style={{ height: alturaVisivel }}
        >
          <div style={{ height: altura }} className="w-full">
            <ResponsiveContainer width="100%" height={altura}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis
                type="number"
                domain={[0, xMax]}
                tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="chave"
                width={132}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                wrapperStyle={{ zIndex: 20, outline: 'none' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const row = payload[0].payload as SliceRow & { pct: number };
                  return (
                    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-50">{row.chave}</p>
                      <p className="tabular-nums">
                        {formatarReais(row.valor)} ({formatarPct(row.pct)}) · {row.qtd.toLocaleString('pt-BR')} tít.
                      </p>
                      <p className="mt-1.5 tabular-nums text-slate-600 dark:text-slate-300">
                        Nomus: {(row.qtdNomus ?? 0).toLocaleString('pt-BR')} tít.
                      </p>
                      <p className="tabular-nums text-slate-600 dark:text-slate-300">
                        Shop9: {(row.qtdShop9 ?? 0).toLocaleString('pt-BR')} tít.
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="pct"
                maxBarSize={22}
                cursor="pointer"
                isAnimationActive={false}
                onClick={(item) => {
                  const row = (item as { payload?: SliceRow })?.payload;
                  if (row) onFatia(row);
                }}
                label={(props) => {
                  const x = Number(props.x) || 0;
                  const y = Number(props.y) || 0;
                  const w = Number(props.width) || 0;
                  const h = Number(props.height) || 0;
                  const idx = Number(props.index) || 0;
                  const row = rows[idx];
                  if (!row) return null;
                  const dentro = w >= 44;
                  return (
                    <text
                      x={dentro ? x + w - 6 : x + w + 4}
                      y={y + h / 2}
                      textAnchor={dentro ? 'end' : 'start'}
                      dominantBaseline="middle"
                      fill={dentro ? corTextoSobre(row.cor) : undefined}
                      className={
                        dentro
                          ? 'pointer-events-none tabular-nums'
                          : 'pointer-events-none tabular-nums fill-slate-700 dark:fill-slate-200'
                      }
                      fontSize={11}
                      fontWeight={700}
                    >
                      {formatarPct(row.pct)}
                    </text>
                  );
                }}
              >
                {rows.map((r) => (
                  <Cell key={r.chave} fill={r.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
      {total > 0 ? (
        <p className="mt-auto pt-2 text-right text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            Total {formatarReais(total)}
          </span>
          <span className="mt-0.5 block font-normal">inclui o que ainda está em aberto</span>
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
  'origem',
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
  origem: 'Origem Sist.',
  conta: 'Conta',
  condicao: 'Forma',
  vencimento: 'Vencim.',
  recebimento: 'Recebim.',
  atraso: 'Dias atraso',
  valor: 'Valor',
  tratativas: 'Trat.',
};

const DETALHE_NUMERIC = new Set<DetalheColId>(['atraso', 'valor', 'tratativas']);
const DETALHE_DATAS = new Set<DetalheColId>(['vencimento', 'recebimento']);
const DETALHE_ORDEM_SERVIDOR = new Set<string>([
  'vencimento',
  'recebimento',
  'cliente',
  'empresa',
  'conta',
  'condicao',
  'valor',
  'atraso',
]);

type ConsultaDetalhe = {
  ordem: string;
  dir: 'asc' | 'desc';
  vencDe: string;
  vencAte: string;
  recDe: string;
  recAte: string;
};

const CONSULTA_DETALHE_PADRAO: ConsultaDetalhe = {
  ordem: 'vencimento',
  dir: 'desc',
  vencDe: '',
  vencAte: '',
  recDe: '',
  recAte: '',
};

function intersectPeriodo(panelDe: string, panelAte: string, colDe: string, colAte: string): { de: string; ate: string } {
  const starts = [panelDe, colDe].filter(Boolean);
  const ends = [panelAte, colAte].filter(Boolean);
  return {
    de: starts.length ? starts.reduce((a, b) => (a > b ? a : b)) : '',
    ate: ends.length ? ends.reduce((a, b) => (a < b ? a : b)) : '',
  };
}

function consultaFromGrade(
  sortState: { key: string; direction: 'asc' | 'desc' } | null,
  sortLevels: { id: string; dir: 'asc' | 'desc' }[],
  columnFilters: Record<string, string>,
): ConsultaDetalhe {
  const col = sortState?.key ?? sortLevels[0]?.id ?? 'vencimento';
  const dir = sortState?.direction ?? sortLevels[0]?.dir ?? 'desc';
  const ordem = DETALHE_ORDEM_SERVIDOR.has(col) ? col : 'vencimento';
  const venc = parseDateRangeFilter(columnFilters.vencimento ?? '');
  const rec = parseDateRangeFilter(columnFilters.recebimento ?? '');
  return {
    ordem,
    dir,
    vencDe: venc?.from ?? '',
    vencAte: venc?.to ?? '',
    recDe: rec?.from ?? '',
    recAte: rec?.to ?? '',
  };
}

function detalheCellText(row: TituloPainelInadimplencia, col: DetalheColId): string {
  switch (col) {
    case 'cliente':
      return row.clienteNome;
    case 'empresa':
      return row.empresaNome?.trim() || '—';
    case 'origem':
      return (row.origem ?? '').toUpperCase();
    case 'conta':
      return row.codigoConta;
    case 'condicao':
      return row.tipo?.trim() || '—';
    case 'vencimento':
      return textoFiltroDataVencimento(row.vencimento);
    case 'recebimento':
      return textoFiltroDataVencimento(row.pagamento ?? row.dataBaixa);
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
  valorUniverso,
  carregando,
  carregandoMais,
  hasMore,
  guiaAuditoria,
  onGuiaAuditoria,
  onCarregarMais,
  onClose,
  onAbrirTratativas,
  onConsultaServidor,
  onExportarUniverso,
}: {
  titulo: string;
  linhas: TituloPainelInadimplencia[];
  qtdConsolidado: number;
  valorUniverso: number | null;
  carregando: boolean;
  carregandoMais: boolean;
  hasMore: boolean;
  guiaAuditoria?: { ativa: 'principal' | 'vencido'; labelPrincipal: string };
  onGuiaAuditoria?: (guia: 'principal' | 'vencido') => void;
  onCarregarMais: () => void;
  onClose: () => void;
  onAbrirTratativas: (row: TituloPainelInadimplencia) => void;
  onConsultaServidor: (consulta: ConsultaDetalhe) => void;
  onExportarUniverso: () => Promise<TituloPainelInadimplencia[]>;
}) {
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState('');
  const skipConsultaRef = useRef(true);

  const grade = useGradeFiltrosExcel<TituloPainelInadimplencia>({
    rows: linhas,
    columnIds: [...DETALHE_COLS],
    getCellText: (r, c) => detalheCellText(r, c as DetalheColId),
    valueForSort: (r, c) => detalheSortValue(r, c as DetalheColId),
    defaultSortLevels: [{ id: 'vencimento', dir: 'desc' }],
    dateColumnIds: ['vencimento', 'recebimento'],
  });

  const onConsultaRef = useRef(onConsultaServidor);
  onConsultaRef.current = onConsultaServidor;

  useEffect(() => {
    if (skipConsultaRef.current) {
      skipConsultaRef.current = false;
      return;
    }
    onConsultaRef.current(consultaFromGrade(grade.sortState, grade.sortLevels, grade.columnFilters));
  }, [grade.sortState, grade.sortLevels, grade.columnFilters]);

  const total = grade.rowsExibidas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0);

  const exportarXlsx = async () => {
    setErroExport('');
    setExportando(true);
    try {
      const linhas = await onExportarUniverso();
      await downloadPainelInadimplenciaDetalheXlsx({
        linhas,
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
                  } no universo${
                    valorUniverso != null ? ` · ${formatarReais(valorUniverso)} no universo` : ''
                  } · ${formatarReais(total)} nesta página`}
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
              disabled={carregando || exportando || qtdConsolidado === 0}
              onClick={() => void exportarXlsx()}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              title="Exportar todos os títulos do universo em Excel"
            >
              <FileSpreadsheet className="size-3.5" />
              {exportando ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="size-4" />
            </button>
          </div>
        </div>
        {guiaAuditoria && onGuiaAuditoria ? (
          <div
            role="tablist"
            aria-label="Universo do detalhe"
            className="flex shrink-0 gap-0 border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-600 dark:bg-slate-900/50"
          >
            <button
              type="button"
              role="tab"
              aria-selected={guiaAuditoria.ativa === 'principal'}
              onClick={() => onGuiaAuditoria('principal')}
              className={`relative px-4 py-2.5 text-xs font-semibold transition-colors ${
                guiaAuditoria.ativa === 'principal'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {guiaAuditoria.labelPrincipal}
              {guiaAuditoria.ativa === 'principal' ? (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-blue-600 dark:bg-blue-400" aria-hidden />
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={guiaAuditoria.ativa === 'vencido'}
              onClick={() => onGuiaAuditoria('vencido')}
              className={`relative px-4 py-2.5 text-xs font-semibold transition-colors ${
                guiaAuditoria.ativa === 'vencido'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Todos os vencimentos
              {guiaAuditoria.ativa === 'vencido' ? (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-blue-600 dark:bg-blue-400" aria-hidden />
              ) : null}
            </button>
          </div>
        ) : null}
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
                  <td className="px-2 py-1.5 uppercase text-slate-600 dark:text-slate-300">{r.origem}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.codigoConta}</td>
                  <td className="px-2 py-1.5">{r.tipo?.trim() || '—'}</td>
                  <td className="px-2 py-1.5">
                    <CelulaDataVencimento value={r.vencimento} />
                  </td>
                  <td className="px-2 py-1.5">
                    <CelulaDataVencimento value={r.pagamento ?? r.dataBaixa} />
                  </td>
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
  universo: 'aberto' | 'recuperado' | 'atraso_lote' | 'vencido';
  classe: 'empresa' | 'condicao' | 'total' | 'mesmo_mes' | 'outros_meses';
  chave?: string;
  qtd: number;
  vencDe?: string;
  vencAte?: string;
  auditoriaMes?: {
    tituloPrincipal: string;
    universoPrincipal: 'atraso_lote' | 'aberto';
    qtdPrincipal: number;
    tituloVencido: string;
    qtdVencido: number;
  };
};

const DETALHE_PAGE = 400;

export default function PainelInadimplenciaPanel() {
  const padrao = periodoUltimosDoisMeses();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dataDe, setDataDe] = useState(padrao.de);
  const [dataAte, setDataAte] = useState(padrao.ate);
  const [rascunhoDe, setRascunhoDe] = useState(padrao.de);
  const [rascunhoAte, setRascunhoAte] = useState(padrao.ate);
  const [porEmpresa, setPorEmpresa] = useState<SliceRow[]>([]);
  const [porCondicao, setPorCondicao] = useState<SliceRow[]>([]);
  const [totalRecuperado, setTotalRecuperado] = useState(FATIA_VAZIA);
  const [mesmoMes, setMesmoMes] = useState(FATIA_VAZIA);
  const [outrosMeses, setOutrosMeses] = useState(FATIA_VAZIA);
  const [serieMensal, setSerieMensal] = useState<PontoSerieInadimplencia[]>([]);
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoDetalhe | null>(null);
  const [linhasDetalhe, setLinhasDetalhe] = useState<TituloPainelInadimplencia[]>([]);
  const [hasMoreDetalhe, setHasMoreDetalhe] = useState(false);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [tarefaHist, setTarefaHist] = useState<TarefaInadimplente | null>(null);
  const [consultaDetalhe, setConsultaDetalhe] = useState<ConsultaDetalhe>(CONSULTA_DETALHE_PADRAO);
  const [totalDetalhe, setTotalDetalhe] = useState<number | null>(null);
  const [valorTotalDetalhe, setValorTotalDetalhe] = useState<number | null>(null);
  const consultaDetalheRef = useRef(CONSULTA_DETALHE_PADRAO);
  const detalheCacheRef = useRef(
    new Map<
      string,
      { data: TituloPainelInadimplencia[]; hasMore: boolean; total: number | null; valorTotal: number | null }
    >(),
  );

  const chaveDetalhe = (pedido: PedidoDetalhe, offset: number, consulta: ConsultaDetalhe) =>
    [
      pedido.vencDe ?? dataDe,
      pedido.vencAte ?? dataAte,
      pedido.universo,
      pedido.classe,
      pedido.chave ?? '',
      consulta.ordem,
      consulta.dir,
      consulta.vencDe,
      consulta.vencAte,
      consulta.recDe,
      consulta.recAte,
      String(offset),
    ].join('|');

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
      setSerieMensal(result.serieMensal ?? []);
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

  const buscarPagina = async (pedido: PedidoDetalhe, offset: number, consulta: ConsultaDetalhe) => {
    const key = chaveDetalhe(pedido, offset, consulta);
    const cached = detalheCacheRef.current.get(key);
    if (cached) return cached;
    const venc = intersectPeriodo(
      pedido.vencDe ?? dataDe,
      pedido.vencAte ?? dataAte,
      consulta.vencDe,
      consulta.vencAte,
    );
    const result = await fetchCrmInadimplentePainelDetalhe({
      de: venc.de || undefined,
      ate: venc.ate || undefined,
      recDe: consulta.recDe || undefined,
      recAte: consulta.recAte || undefined,
      universo: pedido.universo,
      classe: pedido.classe,
      chave: pedido.chave,
      offset,
      limit: DETALHE_PAGE,
      ordem: consulta.ordem,
      dir: consulta.dir,
    });
    detalheCacheRef.current.set(key, result);
    return result;
  };

  const listarUniversoDetalhe = async () => {
    const pedido = pedidoDetalhe;
    if (!pedido) return [];
    const consulta = consultaDetalheRef.current;
    const venc = intersectPeriodo(
      pedido.vencDe ?? dataDe,
      pedido.vencAte ?? dataAte,
      consulta.vencDe,
      consulta.vencAte,
    );
    const pageSize = 800;
    const acc: TituloPainelInadimplencia[] = [];
    let offset = 0;
    for (;;) {
      const result = await fetchCrmInadimplentePainelDetalhe({
        de: venc.de || undefined,
        ate: venc.ate || undefined,
        recDe: consulta.recDe || undefined,
        recAte: consulta.recAte || undefined,
        universo: pedido.universo,
        classe: pedido.classe,
        chave: pedido.chave,
        offset,
        limit: pageSize,
        ordem: consulta.ordem,
        dir: consulta.dir,
        completo: true,
      });
      acc.push(...result.data);
      if (result.data.length < pageSize) break;
      offset += result.data.length;
      if (offset >= 80_000) break;
    }
    return acc;
  };

  const abrirDetalhe = async (pedido: PedidoDetalhe) => {
    const consulta = CONSULTA_DETALHE_PADRAO;
    consultaDetalheRef.current = consulta;
    setConsultaDetalhe(consulta);
    setPedidoDetalhe(pedido);
    setLinhasDetalhe([]);
    setHasMoreDetalhe(false);
    setTotalDetalhe(null);
    setValorTotalDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      const result = await buscarPagina(pedido, 0, consulta);
      setLinhasDetalhe(result.data);
      setHasMoreDetalhe(result.hasMore);
      if (result.total != null) setTotalDetalhe(result.total);
      if (result.valorTotal != null) setValorTotalDetalhe(result.valorTotal);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o detalhe.');
      setPedidoDetalhe(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const aplicarConsultaServidor = useCallback(
    async (consulta: ConsultaDetalhe) => {
      const pedido = pedidoDetalhe;
      if (!pedido) return;
      if (JSON.stringify(consultaDetalheRef.current) === JSON.stringify(consulta)) return;
      consultaDetalheRef.current = consulta;
      setConsultaDetalhe(consulta);
      setLinhasDetalhe([]);
      setHasMoreDetalhe(false);
      setCarregandoDetalhe(true);
      try {
        const result = await buscarPagina(pedido, 0, consulta);
        setLinhasDetalhe(result.data);
        setHasMoreDetalhe(result.hasMore);
        if (result.total != null) setTotalDetalhe(result.total);
        if (result.valorTotal != null) setValorTotalDetalhe(result.valorTotal);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar o detalhe.');
      } finally {
        setCarregandoDetalhe(false);
      }
    },
    [pedidoDetalhe, dataDe, dataAte],
  );

  const carregarMaisDetalhe = async () => {
    if (!pedidoDetalhe || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const result = await buscarPagina(pedidoDetalhe, linhasDetalhe.length, consultaDetalheRef.current);
      setLinhasDetalhe((atual) => [...atual, ...result.data]);
      setHasMoreDetalhe(result.hasMore);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o detalhe.');
    } finally {
      setCarregandoMais(false);
    }
  };

  const padraoAtual = periodoUltimosDoisMeses();
  const periodoDoisMeses = rascunhoDe === padraoAtual.de && rascunhoAte === padraoAtual.ate;
  const periodoCompleto = !rascunhoDe && !rascunhoAte;
  const filtrosPendentes = rascunhoDe !== dataDe || rascunhoAte !== dataAte;

  return (
    <section className="space-y-3">
      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">{erro}</p>
      ) : null}
      <LoadingOverlay show={loading} mensagem="Carregando indicadores..." subtitulo="Painel de inadimplência" />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={FILTRO_LABEL} htmlFor="painel-inad-de">
            De
          </label>
          <input
            id="painel-inad-de"
            type="date"
            value={rascunhoDe}
            max={rascunhoAte || undefined}
            onChange={(e) => setRascunhoDe(e.target.value)}
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
            value={rascunhoAte}
            min={rascunhoDe || undefined}
            onChange={(e) => setRascunhoAte(e.target.value)}
            className={FILTRO_INPUT}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const p = periodoUltimosDoisMeses();
            setRascunhoDe(p.de);
            setRascunhoAte(p.ate);
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
            setRascunhoDe('');
            setRascunhoAte('');
          }}
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
            periodoCompleto
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Período completo
        </button>
        {filtrosPendentes ? (
          <button
            type="button"
            onClick={() => {
              setPedidoDetalhe(null);
              setDataDe(rascunhoDe);
              setDataAte(rascunhoAte);
            }}
            className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-2.5 text-xs font-semibold text-white hover:bg-primary-700"
          >
            Aplicar filtro
          </button>
        ) : null}
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

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
        <PizzaValor
          titulo="Índice de atraso por empresa"
          fatias={porEmpresa}
          onFatia={(f) =>
            void abrirDetalhe({
              titulo: `Por empresa — ${f.chave}`,
              universo: 'atraso_lote',
              classe: 'empresa',
              chave: f.chave,
              qtd: f.qtd,
            })
          }
        />
        <PizzaValor
          titulo="Atraso por forma de pagamento"
          fatias={porCondicao}
          maxBarrasVisiveis={5}
          onFatia={(f) =>
            void abrirDetalhe({
              titulo: `Por forma — ${f.chave}`,
              universo: 'atraso_lote',
              classe: 'condicao',
              chave: f.chave,
              qtd: f.qtd,
            })
          }
        />
      </div>

      <EvolucaoInadimplenciaChart
        serie={serieMensal}
        onPonto={(ponto, modo) => {
          const [y, m] = ponto.mes.split('-').map(Number);
          const last = new Date(y, m, 0).getDate();
          const de = `${ponto.mes}-01`;
          const ate = `${ponto.mes}-${String(last).padStart(2, '0')}`;
          const mesLabel = rotuloPeriodoMes(ponto.mes);
          if (modo === 'pctAtraso') {
            void abrirDetalhe({
              titulo: `Índice de atraso — ${mesLabel}`,
              universo: 'atraso_lote',
              classe: 'total',
              qtd: ponto.qtdAtraso,
              vencDe: de,
              vencAte: ate,
              auditoriaMes: {
                tituloPrincipal: `Índice de atraso — ${mesLabel}`,
                universoPrincipal: 'atraso_lote',
                qtdPrincipal: ponto.qtdAtraso,
                tituloVencido: `Todos os vencimentos — ${mesLabel}`,
                qtdVencido: ponto.qtdVencido,
              },
            });
            return;
          }
          void abrirDetalhe({
            titulo: `% inadimplente — ${mesLabel}`,
            universo: 'aberto',
            classe: 'total',
            qtd: ponto.qtdAberto,
            vencDe: de,
            vencAte: ate,
            auditoriaMes: {
              tituloPrincipal: `% inadimplente — ${mesLabel}`,
              universoPrincipal: 'aberto',
              qtdPrincipal: ponto.qtdAberto,
              tituloVencido: `Todos os vencimentos — ${mesLabel}`,
              qtdVencido: ponto.qtdVencido,
            },
          });
        }}
      />

      {pedidoDetalhe ? (
        <ModalDetalhe
          key={`${pedidoDetalhe.universo}:${pedidoDetalhe.classe}:${pedidoDetalhe.chave ?? ''}:${pedidoDetalhe.vencDe ?? ''}`}
          titulo={pedidoDetalhe.titulo}
          linhas={linhasDetalhe}
          qtdConsolidado={totalDetalhe ?? pedidoDetalhe.qtd}
          valorUniverso={valorTotalDetalhe}
          carregando={carregandoDetalhe}
          carregandoMais={carregandoMais}
          hasMore={hasMoreDetalhe}
          guiaAuditoria={
            pedidoDetalhe.auditoriaMes
              ? {
                  ativa: pedidoDetalhe.universo === 'vencido' ? 'vencido' : 'principal',
                  labelPrincipal:
                    pedidoDetalhe.auditoriaMes.universoPrincipal === 'aberto' ? 'Em aberto' : 'Atraso',
                }
              : undefined
          }
          onGuiaAuditoria={
            pedidoDetalhe.auditoriaMes
              ? (guia) => {
                  const aud = pedidoDetalhe.auditoriaMes!;
                  if (guia === 'vencido') {
                    void abrirDetalhe({
                      ...pedidoDetalhe,
                      titulo: aud.tituloVencido,
                      universo: 'vencido',
                      qtd: aud.qtdVencido,
                    });
                    return;
                  }
                  void abrirDetalhe({
                    ...pedidoDetalhe,
                    titulo: aud.tituloPrincipal,
                    universo: aud.universoPrincipal,
                    qtd: aud.qtdPrincipal,
                  });
                }
              : undefined
          }
          onCarregarMais={() => void carregarMaisDetalhe()}
          onConsultaServidor={(c) => void aplicarConsultaServidor(c)}
          onExportarUniverso={() => listarUniversoDetalhe()}
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
