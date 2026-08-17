import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { listarMotivosSugestao, type MotivoSugestao } from '../../api/motivosSugestao';
import {
  formatDataCurta,
  formatQtdeInt,
  toISODate,
  type CarradaBaseline,
  type CarradaDataInvalida,
  type ExcessoQtdeRomaneadaCanon,
  type PedidoAlterado,
  type SimEntry,
} from './simulacaoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import BotaoObservacaoCelula from '../ressupAlmox/BotaoObservacaoCelula';
import ModalObservacaoCelula from '../ressupAlmox/ModalObservacaoCelula';
import SequenciamentoDateField from './SequenciamentoDateField';
import { DATE_COL_KEYS, focusSeqDateInput, type DateColKey } from './sequenciamentoGradeUi';
import { labelPedidoMapa } from '../../utils/mapaMunicipioPedido';
import {
  BADGE_GRADE_CLASS,
  classePillStatusPrazo,
  type StatusPedidoBadgeFields,
} from '../../utils/statusPedidoBadges';
import { chavePedidoGrupo } from './corrigirDatasSequenciamentoUtils';
import {
  itemPrevisaoConfiavelEscolhida,
  motivoComumIds,
  observacaoComumIds,
  previsaoConfiavelComumIds,
  previsaoConfiavelEfetiva,
} from './confirmacaoMotivosUtils';
import {
  linhaConclusaoPronta,
  montarLinhasConclusao,
  type LinhaConclusao,
} from './confirmacaoLinhasConclusao';
import { lerPdfAssinatura, type AnexoAssinaturaPayload } from '../../utils/lerPdfAssinatura';
import CampoAnexoAssinaturaPdf from '../CampoAnexoAssinaturaPdf';
import TogglePrevisaoConfiavel, { type PrevisaoConfiavelTri } from '../TogglePrevisaoConfiavel';
import CopiarTextoBtn, { numeroPedidoLimpo } from '../CopiarTextoBtn';

export type { LinhaConclusao } from './confirmacaoLinhasConclusao';
export { linhaConclusaoPronta, montarLinhasConclusao } from './confirmacaoLinhasConclusao';

type Props = {
  pedidosEntrega: PedidoAlterado[];
  /** Quantidade de carradas que terão apenas a Data de produção atualizada (sem mudança de previsão). */
  qtdCarradasSomenteProducao: number;
  /** Soma de Qtde Romaneada do item excede o Pendente — bloqueia confirmação. */
  excessosQtdeRomaneada?: ExcessoQtdeRomaneadaCanon[];
  /**
   * Itens/carradas com datas anteriores a hoje — corrigidos neste mesmo modal.
   */
  invalidasDatas?: CarradaDataInvalida[];
  /** Snapshot para expandir carradas agregadas (ROTA) em itens/pedidos. */
  linhasSnapshot?: Record<string, unknown>[];
  /** Simulação atual — datas efetivas nas linhas só-motivo. */
  sim?: Map<string, SimEntry>;
  baseline?: Map<string, CarradaBaseline>;
  onEditarData?: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void;
  salvando: boolean;
  erro: string | null;
  motivoPorId: Record<string, string>;
  onMotivoPorIdChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  observacaoPorId: Record<string, string>;
  onObservacaoPorIdChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  previsaoConfiavelPorId: Record<string, boolean | null>;
  onPrevisaoConfiavelPorIdChange: (
    updater: (prev: Record<string, boolean | null>) => Record<string, boolean | null>
  ) => void;
  onConfirmar: (
    motivoPorIdPedido: Record<string, string>,
    anexoAssinatura: AnexoAssinaturaPayload | null
  ) => void;
  onClose: () => void;
};

type ObsModalState = {
  ids: string[];
  codigo: string;
  descricao: string;
  valorInicial: string;
};

type FiltroStatusConclusao = 'pendentes' | 'concluidos' | 'todos';

const TH_STICKY =
  'sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2 text-left font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.12)] whitespace-nowrap';
const TR_ROW =
  'border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-700/30';
const TR_CONCLUIDA =
  'border-b border-slate-100 dark:border-slate-700 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/55';
const TR_PENDENTE =
  'border-b border-slate-100 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20';
const TD_MESCLADA = 'px-2 py-2 align-middle text-center text-slate-800 dark:text-slate-200';

/** Colunas do filtro Excel (inclui Cliente/Carrada ocultas na grade). */
const COLS_FILTRO = [
  'pedido',
  'cliente',
  'codigo',
  'descricao',
  'carrada',
  'dataProducao',
  'dataEntrega',
  'qtde',
  'motivo',
  'observacao',
  'confiavel',
] as const;

const COL_LABELS: Record<(typeof COLS_FILTRO)[number], string> = {
  pedido: 'Pedido',
  cliente: 'Cliente',
  codigo: 'Código',
  descricao: 'Descrição',
  carrada: 'Carrada',
  dataProducao: 'Data de produção',
  dataEntrega: 'Data de entrega',
  qtde: 'Qtde Pendente Real',
  motivo: 'Motivo',
  observacao: 'Obs.',
  confiavel: 'Confiável',
};

const RECENTES_STORAGE_KEY = 'seqCarradas:motivosRecentes';
const MAX_RECENTES = 2;

function lerMotivosRecentes(): string[] {
  try {
    const raw = localStorage.getItem(RECENTES_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENTES);
  } catch {
    return [];
  }
}

function registrarMotivoRecente(motivo: string): string[] {
  const atual = lerMotivosRecentes().filter((m) => m !== motivo);
  const next = [motivo, ...atual].slice(0, MAX_RECENTES);
  try {
    localStorage.setItem(RECENTES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage indisponível
  }
  return next;
}

function StatusPedidoPills({ badges }: { badges: StatusPedidoBadgeFields }) {
  const { statusPrazo, card, faturado } = badges;
  if (!statusPrazo && !card && !faturado) return null;
  return (
    <div className="mt-0.5 flex flex-col items-center gap-0.5">
      {statusPrazo ? (
        <span className={`${BADGE_GRADE_CLASS} ${classePillStatusPrazo(statusPrazo)}`}>{statusPrazo}</span>
      ) : null}
      {card === 'Card' ? (
        <span className={`${BADGE_GRADE_CLASS} bg-sky-500/20 text-sky-400`}>Card</span>
      ) : null}
      {card === 'Disponível' ? (
        <span className={`${BADGE_GRADE_CLASS} bg-emerald-600/25 text-emerald-300`}>Disponível</span>
      ) : null}
      {faturado ? (
        <span className={`${BADGE_GRADE_CLASS} bg-violet-500/20 text-violet-400`}>Faturado</span>
      ) : null}
    </div>
  );
}

/** Ícone de calendário para definir data em todos os itens do pedido. */
function PedidoLoteDataPicker({
  titulo,
  onSelecionar,
  iconClassName = '',
}: {
  titulo: string;
  onSelecionar: (value: string) => void;
  iconClassName?: string;
}) {
  return (
    <SequenciamentoDateField
      iconOnly
      iconTitle={titulo}
      className={iconClassName}
      onChange={onSelecionar}
    />
  );
}

function MotivoPicker({
  value,
  onSelect,
  motivos,
  recentes,
  compact = false,
  disabled = false,
}: {
  value: string;
  onSelect: (motivo: string) => void;
  motivos: MotivoSugestao[];
  recentes: string[];
  compact?: boolean;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`motivo-picker-${Math.random().toString(36).slice(2)}`);

  const fechar = useCallback(() => {
    setAberto(false);
    setBusca('');
  }, []);

  useRegisterModalEscape({ id: idRef.current, onClose: fechar, zIndex: 500, enabled: aberto });

  const abrir = () => {
    if (disabled) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto) return;
    const handle = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (dropRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      fechar();
    };
    document.addEventListener('mousedown', handle, true);
    return () => document.removeEventListener('mousedown', handle, true);
  }, [aberto, fechar]);

  const listaFiltrada = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    const todas = motivos.map((m) => m.descricao);
    const filtradas = busca.trim() ? todas.filter((d) => match(d)) : todas;
    const recSet = new Set(recentes);
    const rec = recentes.filter((r) => filtradas.includes(r));
    const resto = filtradas.filter((d) => !recSet.has(d));
    return { rec, resto };
  }, [motivos, recentes, busca]);

  const escolher = (motivo: string) => {
    onSelect(motivo);
    fechar();
  };

  const dropdown =
    aberto && rect
      ? createPortal(
          <div
            ref={dropRef}
            style={{
              position: 'fixed',
              top: Math.min(rect.top, window.innerHeight - 320),
              left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
              width: rect.width,
              zIndex: 13001,
            }}
            className="max-h-80 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          >
            <div className="border-b border-slate-200 p-2 dark:border-slate-600">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar motivo… (% = curinga)"
                autoFocus
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="max-h-64 overflow-auto p-1">
              {value && (
                <button
                  type="button"
                  onClick={() => escolher('')}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs italic text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  Limpar motivo
                </button>
              )}
              {listaFiltrada.rec.length > 0 && (
                <>
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Recentes
                  </p>
                  {listaFiltrada.rec.map((d) => (
                    <button
                      key={`rec-${d}`}
                      type="button"
                      onClick={() => escolher(d)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        d === value
                          ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-200 dark:border-slate-600" />
                </>
              )}
              {listaFiltrada.resto.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => escolher(d)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    d === value
                      ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
              {listaFiltrada.rec.length === 0 && listaFiltrada.resto.length === 0 && (
                <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">Nenhum motivo encontrado.</p>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={aberto ? fechar : abrir}
        disabled={disabled}
        className={`flex w-full min-w-[10rem] max-w-[14rem] items-center justify-between gap-1 rounded-md border px-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'py-1' : 'py-1.5'
        } ${
          value
            ? 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
            : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-200'
        }`}
        title={value || 'Selecionar motivo'}
      >
        <span className="truncate">{value || 'Selecione um motivo…'}</span>
        <span aria-hidden className="shrink-0 text-slate-400">
          ▾
        </span>
      </button>
      {dropdown}
    </>
  );
}

const ConfiavelToggleCelula = memo(function ConfiavelToggleCelula({
  value,
  onChange,
}: {
  value: PrevisaoConfiavelTri;
  onChange: (v: PrevisaoConfiavelTri) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Confiável</span>
      <TogglePrevisaoConfiavel
        value={value}
        onChange={onChange}
        compact
        showHelp={false}
        className="min-w-[7.5rem]"
      />
    </div>
  );
});

function classeLinha(l: LinhaConclusao, linhaOk: boolean): string {
  if (l.datasOk && (!l.exigeMotivo || linhaOk)) return TR_CONCLUIDA;
  if (!l.datasOk || (l.exigeMotivo && !linhaOk)) return TR_PENDENTE;
  return TR_ROW;
}

/** Texto estável para filtros Excel (não depende de motivo/obs/confiável ao vivo). */
function textoCelulaLinha(l: LinhaConclusao, colId: string): string {
  switch (colId) {
    case 'pedido':
      return labelPedidoMapa(l.pedido);
    case 'cliente':
      return l.cliente || '—';
    case 'codigo':
      return l.codigo;
    case 'descricao':
      return l.descricao || '—';
    case 'carrada':
      return l.carrada;
    case 'dataProducao':
      return l.dataProducao ? formatDataCurta(l.dataProducao) : '—';
    case 'dataEntrega':
      return l.dataEntrega ? formatDataCurta(l.dataEntrega) : '—';
    case 'qtde':
      return formatQtdeInt(l.qtdePendenteReal);
    case 'motivo':
      return l.exigeMotivo ? 'Motivo' : '—';
    case 'observacao':
      return '—';
    case 'confiavel':
      return '—';
    default:
      return '';
  }
}

type GrupoPedido = {
  pedidoChave: string;
  pedido: string;
  cliente: string;
  carrada: string;
  dataEmissao: string;
  itens: LinhaConclusao[];
};

function agruparPorPedido(
  linhas: LinhaConclusao[]
): Array<{ kind: 'grupo'; grupo: GrupoPedido } | { kind: 'solo'; row: LinhaConclusao }> {
  const gruposMap = new Map<string, LinhaConclusao[]>();

  for (const l of linhas) {
    if (!l.idPedido) continue;
    const chave = chavePedidoGrupo(l.pedido);
    let list = gruposMap.get(chave);
    if (!list) {
      list = [];
      gruposMap.set(chave, list);
    }
    list.push(l);
  }

  const entries: Array<{ kind: 'grupo'; grupo: GrupoPedido } | { kind: 'solo'; row: LinhaConclusao }> =
    [];
  const seen = new Set<string>();

  for (const l of linhas) {
    if (!l.idPedido) {
      entries.push({ kind: 'solo', row: l });
      continue;
    }
    const chave = chavePedidoGrupo(l.pedido);
    if (seen.has(chave)) continue;
    seen.add(chave);
    const itens = gruposMap.get(chave)!;
    const first = itens[0]!;
    entries.push({
      kind: 'grupo',
      grupo: {
        pedidoChave: chave,
        pedido: first.pedido,
        cliente: first.cliente,
        carrada: first.carrada,
        dataEmissao: itens.find((i) => i.dataEmissao)?.dataEmissao || first.dataEmissao || '',
        itens,
      },
    });
  }

  return entries;
}

/** Replica produção na entrega quando a produção for anterior à entrega. */
function aplicarProducaoComSyncEntrega(
  editar: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void,
  key: string,
  producao: string,
  entregaAtual: string
) {
  editar(key, 'dataProducao', producao);
  if (producao && entregaAtual && producao < entregaAtual) {
    editar(key, 'dataEntrega', producao);
  }
}

type DatasHandlers = {
  editar: ((key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void) | undefined;
  onDateKey: (e: KeyboardEvent<HTMLButtonElement>, rowKey: string, colKey: DateColKey) => void;
};

const DatasCelulas = memo(function DatasCelulas({
  l,
  handlers,
}: {
  l: LinhaConclusao;
  handlers: DatasHandlers;
}) {
  const { editar, onDateKey } = handlers;
  return (
    <>
      <td className="px-2 py-2 align-middle">
        {editar ? (
          <SequenciamentoDateField
            value={toISODate(l.dataProducao)}
            rowKey={l.key}
            colKey="dataProducao"
            className={`text-xs ${l.producaoPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
            onChange={(iso) => aplicarProducaoComSyncEntrega(editar, l.key, iso, l.dataEntrega)}
            onKeyDown={(e) => onDateKey(e, l.key, 'dataProducao')}
          />
        ) : (
          <span className="text-xs tabular-nums">
            {l.dataProducao ? formatDataCurta(l.dataProducao) : '—'}
          </span>
        )}
      </td>
      <td className="w-10 px-0.5 py-2 text-center align-middle">
        {editar ? (
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (l.dataProducao) editar(l.key, 'dataEntrega', l.dataProducao);
              }}
              disabled={!l.dataProducao}
              className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
              title="Replicar produção na entrega"
              aria-label="Replicar produção na entrega"
            >
              →
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (l.dataEntrega) editar(l.key, 'dataProducao', l.dataEntrega);
              }}
              disabled={!l.dataEntrega}
              className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
              title="Replicar entrega na produção"
              aria-label="Replicar entrega na produção"
            >
              ←
            </button>
          </div>
        ) : null}
      </td>
      <td className="px-2 py-2 align-middle">
        {editar ? (
          <SequenciamentoDateField
            value={toISODate(l.dataEntrega)}
            rowKey={l.key}
            colKey="dataEntrega"
            className={`text-xs ${l.entregaPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
            onChange={(iso) => editar(l.key, 'dataEntrega', iso)}
            onKeyDown={(e) => onDateKey(e, l.key, 'dataEntrega')}
          />
        ) : (
          <span className="text-xs tabular-nums">
            {l.dataEntrega ? formatDataCurta(l.dataEntrega) : '—'}
          </span>
        )}
      </td>
    </>
  );
});

type MotivoColsHandlers = {
  motivoPorId: Record<string, string>;
  observacaoPorId: Record<string, string>;
  previsaoConfiavelPorId: Record<string, boolean | null>;
  motivos: MotivoSugestao[];
  recentes: string[];
  onMotivo: (ids: string[], motivo: string) => void;
  onConfiavel: (ids: string[], v: PrevisaoConfiavelTri) => void;
  onAbrirObs: (state: ObsModalState) => void;
};

const MotivoCols = memo(function MotivoCols({
  l,
  handlers,
}: {
  l: LinhaConclusao;
  handlers: MotivoColsHandlers;
}) {
  const id = l.idPedido;
  const obs = id ? handlers.observacaoPorId[id] ?? '' : '';

  return (
    <>
      <td className="px-2 py-2 text-right text-xs tabular-nums align-middle">
        {formatQtdeInt(l.qtdePendenteReal)}
      </td>
      <td className="px-2 py-2 align-middle">
        {l.exigeMotivo && id ? (
          <MotivoPicker
            value={handlers.motivoPorId[id] ?? ''}
            onSelect={(m) => handlers.onMotivo([id], m)}
            motivos={handlers.motivos}
            recentes={handlers.recentes}
            compact
          />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-center align-middle">
        {l.exigeMotivo && id ? (
          <div className="flex flex-col items-center gap-1">
            <ConfiavelToggleCelula
              value={previsaoConfiavelEfetiva(id, handlers.previsaoConfiavelPorId)}
              onChange={(v) => handlers.onConfiavel([id], v)}
            />
            <BotaoObservacaoCelula
              hasObservacao={!!obs.trim()}
              bloqueado={false}
              titulo={obs.trim() ? 'Editar observação' : 'Adicionar observação'}
              onClick={() =>
                handlers.onAbrirObs({
                  ids: [id],
                  codigo: l.codigo,
                  descricao: l.descricao,
                  valorInicial: obs,
                })
              }
            />
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </>
  );
});

function CelulaPedidoContexto({
  pedido,
  cliente,
  carrada,
  dataEmissao,
  badges,
  previsaoPassada,
  previsaoAtual,
  grupoTodoOk,
  loteAcoes,
  motivoLote,
}: {
  pedido: string;
  cliente: string;
  carrada: string;
  dataEmissao: string;
  badges: StatusPedidoBadgeFields;
  previsaoPassada?: boolean;
  previsaoAtual?: string;
  grupoTodoOk: boolean;
  loteAcoes?: ReactNode;
  motivoLote?: ReactNode;
}) {
  const pdLabel = labelPedidoMapa(pedido);
  const pdCopy = numeroPedidoLimpo(pedido) || pdLabel;
  return (
    <div className="flex flex-col items-stretch gap-1 text-left">
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono font-semibold">{pdLabel}</span>
        <CopiarTextoBtn texto={pdCopy} title="Copiar PD" />
        {loteAcoes}
      </div>
      {dataEmissao ? (
        <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          Emissão: {formatDataCurta(dataEmissao)}
        </p>
      ) : null}
      <p className="truncate text-xs text-slate-700 dark:text-slate-200" title={cliente}>
        {cliente || '—'}
      </p>
      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={carrada}>
        {carrada || '—'}
      </p>
      <StatusPedidoPills badges={badges} />
      {previsaoPassada && previsaoAtual ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Previsão: {formatDataCurta(previsaoAtual)} (vencida)
        </p>
      ) : null}
      {motivoLote}
      {grupoTodoOk ? (
        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Concluído</span>
      ) : null}
    </div>
  );
}

type GrupoHandlers = DatasHandlers &
  MotivoColsHandlers & {
    editarDatasPedido: (
      itens: LinhaConclusao[],
      campo: 'dataProducao' | 'dataEntrega',
      value: string
    ) => void;
    replicarProducaoNaEntregaPedido: (itens: LinhaConclusao[]) => void;
    replicarEntregaNaProducaoPedido: (itens: LinhaConclusao[]) => void;
    linhaOk: (l: LinhaConclusao) => boolean;
  };

const GrupoPedidoRows = memo(function GrupoPedidoRows({
  grupo,
  handlers,
}: {
  grupo: GrupoPedido;
  handlers: GrupoHandlers;
}) {
  const rowSpan = grupo.itens.length;
  const idsPedido = grupo.itens.map((i) => i.idPedido).filter((id): id is string => !!id);
  const motivoComum = motivoComumIds(idsPedido, handlers.motivoPorId);
  const obsComum = observacaoComumIds(idsPedido, handlers.observacaoPorId);
  const confiavelComum = previsaoConfiavelComumIds(idsPedido, handlers.previsaoConfiavelPorId);
  const badges: StatusPedidoBadgeFields = {
    statusPrazo: grupo.itens.find((i) => i.statusPrazo)?.statusPrazo,
    card: grupo.itens.find((i) => i.card)?.card,
    faturado: grupo.itens.some((i) => i.faturado),
  };
  const grupoTodoOk = grupo.itens.every((i) => i.datasOk && handlers.linhaOk(i));
  const previsaoGrupo = grupo.itens.find((i) => i.previsaoPassada && i.previsaoAtual);
  const exigeMotivoGrupo = grupo.itens.some((i) => i.exigeMotivo);
  const temProducaoGrupo = grupo.itens.some((i) => !!i.dataProducao);
  const temEntregaGrupo = grupo.itens.some((i) => !!i.dataEntrega);
  const editar = handlers.editar;

  const loteAcoes = editar ? (
    <span className="inline-flex items-center gap-0.5">
      <PedidoLoteDataPicker
        titulo="Definir data de produção para todos os itens do pedido"
        iconClassName="text-sky-600 dark:text-sky-400"
        onSelecionar={(value) => handlers.editarDatasPedido(grupo.itens, 'dataProducao', value)}
      />
      <PedidoLoteDataPicker
        titulo="Definir data de entrega para todos os itens do pedido"
        iconClassName="text-emerald-600 dark:text-emerald-400"
        onSelecionar={(value) => handlers.editarDatasPedido(grupo.itens, 'dataEntrega', value)}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlers.replicarProducaoNaEntregaPedido(grupo.itens);
        }}
        disabled={!temProducaoGrupo}
        className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
        title="Replicar produção na entrega em todos os itens do pedido"
        aria-label="Replicar produção na entrega em todos os itens do pedido"
      >
        →
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlers.replicarEntregaNaProducaoPedido(grupo.itens);
        }}
        disabled={!temEntregaGrupo}
        className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
        title="Replicar entrega na produção em todos os itens do pedido"
        aria-label="Replicar entrega na produção em todos os itens do pedido"
      >
        ←
      </button>
    </span>
  ) : null;

  const motivoLote =
    exigeMotivoGrupo && idsPedido.length > 1 ? (
      <div className="mt-1 w-full min-w-[10rem] space-y-1">
        <MotivoPicker
          value={motivoComum}
          onSelect={(m) => handlers.onMotivo(idsPedido, m)}
          motivos={handlers.motivos}
          recentes={handlers.recentes}
          compact
        />
        <div className="flex flex-col items-center gap-1">
          <ConfiavelToggleCelula
            value={confiavelComum}
            onChange={(v) => handlers.onConfiavel(idsPedido, v)}
          />
          <BotaoObservacaoCelula
            hasObservacao={!!obsComum.trim()}
            bloqueado={false}
            titulo={
              obsComum.trim() ? 'Editar observação do pedido' : 'Adicionar observação do pedido'
            }
            onClick={() =>
              handlers.onAbrirObs({
                ids: idsPedido,
                codigo: labelPedidoMapa(grupo.pedido),
                descricao: grupo.cliente || '',
                valorInicial: obsComum,
              })
            }
          />
        </div>
      </div>
    ) : null;

  return (
    <>
      {grupo.itens.map((l, itemIdx) => {
        const isFirst = itemIdx === 0;
        const ok = handlers.linhaOk(l);
        return (
          <tr key={`${l.key}-${l.idPedido ?? itemIdx}`} className={classeLinha(l, ok)}>
            {isFirst ? (
              <td rowSpan={rowSpan} className={`${TD_MESCLADA} pl-4 pr-2`}>
                <CelulaPedidoContexto
                  pedido={grupo.pedido}
                  cliente={grupo.cliente}
                  carrada={grupo.carrada}
                  dataEmissao={grupo.dataEmissao}
                  badges={badges}
                  previsaoPassada={previsaoGrupo?.previsaoPassada}
                  previsaoAtual={previsaoGrupo?.previsaoAtual}
                  grupoTodoOk={grupoTodoOk}
                  loteAcoes={loteAcoes}
                  motivoLote={motivoLote}
                />
              </td>
            ) : null}
            <td className="px-2 py-2 align-middle font-mono text-slate-800 dark:text-slate-200">
              <div className="flex flex-wrap items-center gap-1">
                <span>{l.codigo}</span>
                <CopiarTextoBtn texto={l.codigo} title="Copiar código" />
                {l.datasOk && ok ? (
                  <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                    Concluído
                  </span>
                ) : null}
              </div>
            </td>
            <td
              className="max-w-[220px] px-2 py-2 align-middle text-slate-800 dark:text-slate-200"
              title={l.descricao}
            >
              <div className="line-clamp-2">{l.descricao || '—'}</div>
            </td>
            <DatasCelulas l={l} handlers={handlers} />
            <MotivoCols l={l} handlers={handlers} />
          </tr>
        );
      })}
    </>
  );
});

const SoloPedidoRow = memo(function SoloPedidoRow({
  l,
  handlers,
}: {
  l: LinhaConclusao;
  handlers: GrupoHandlers;
}) {
  const ok = handlers.linhaOk(l);
  const badges: StatusPedidoBadgeFields = {
    statusPrazo: l.statusPrazo,
    card: l.card,
    faturado: l.faturado,
  };
  return (
    <tr className={classeLinha(l, ok)}>
      <td className={`${TD_MESCLADA} pl-4 pr-2`}>
        <CelulaPedidoContexto
          pedido={l.pedido}
          cliente={l.cliente}
          carrada={l.carrada}
          dataEmissao={l.dataEmissao || ''}
          badges={badges}
          previsaoPassada={l.previsaoPassada}
          previsaoAtual={l.previsaoAtual}
          grupoTodoOk={l.datasOk && ok}
        />
      </td>
      <td className="px-2 py-2 align-middle font-mono text-slate-800 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          <span>{l.codigo}</span>
          <CopiarTextoBtn texto={l.codigo} title="Copiar código" />
        </div>
      </td>
      <td
        className="max-w-[220px] px-2 py-2 align-middle text-slate-800 dark:text-slate-200"
        title={l.descricao}
      >
        <div className="line-clamp-2">{l.descricao || '—'}</div>
      </td>
      <DatasCelulas l={l} handlers={handlers} />
      <MotivoCols l={l} handlers={handlers} />
    </tr>
  );
});

function FiltroStatusSegmentado({
  value,
  onChange,
  disabled,
}: {
  value: FiltroStatusConclusao;
  onChange: (v: FiltroStatusConclusao) => void;
  disabled?: boolean;
}) {
  const btn = (id: FiltroStatusConclusao, label: string) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={`px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        value === id
          ? 'bg-primary-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Filtrar por status de conclusão"
      className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600"
    >
      {btn('pendentes', 'Pendentes')}
      <span className="w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
      {btn('concluidos', 'Concluídos')}
      <span className="w-px bg-slate-300 dark:bg-slate-600" aria-hidden />
      {btn('todos', 'Todos')}
    </div>
  );
}

export default function ConfirmacaoSimulacaoModal({
  pedidosEntrega,
  qtdCarradasSomenteProducao,
  excessosQtdeRomaneada = [],
  invalidasDatas = [],
  linhasSnapshot = [],
  sim,
  baseline,
  onEditarData,
  salvando,
  erro,
  motivoPorId,
  onMotivoPorIdChange,
  observacaoPorId,
  onObservacaoPorIdChange,
  previsaoConfiavelPorId,
  onPrevisaoConfiavelPorIdChange,
  onConfirmar,
  onClose,
}: Props) {
  const [motivos, setMotivos] = useState<MotivoSugestao[]>([]);
  const [recentes, setRecentes] = useState<string[]>(() => lerMotivosRecentes());
  const [validacao, setValidacao] = useState<string | null>(null);
  const [obsModal, setObsModal] = useState<ObsModalState | null>(null);
  const [anexoAssinatura, setAnexoAssinatura] = useState<AnexoAssinaturaPayload | null>(null);
  const [anexoNome, setAnexoNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusConclusao>('todos');

  const linhas = useMemo(
    () =>
      montarLinhasConclusao(invalidasDatas, pedidosEntrega, linhasSnapshot, {
        sim,
        baseline,
      }),
    [invalidasDatas, pedidosEntrega, linhasSnapshot, sim, baseline]
  );

  const aindaDatasInvalidas = useMemo(() => linhas.some((l) => !l.datasOk), [linhas]);

  useEffect(() => {
    let ativo = true;
    listarMotivosSugestao()
      .then((lista) => {
        if (ativo) setMotivos(lista);
      })
      .catch(() => {
        if (ativo) setMotivos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const getCellText = useCallback((l: LinhaConclusao, colId: string) => textoCelulaLinha(l, colId), []);

  const grade = useGradeFiltrosExcel<LinhaConclusao>({
    rows: linhas,
    columnIds: [...COLS_FILTRO],
    getCellText,
    valueForSort: (l, colId) => {
      if (colId === 'qtde') return l.qtdePendenteReal;
      return getCellText(l, colId);
    },
    defaultSortLevels: [],
  });

  const linhaMotivoConfiavelOk = useCallback(
    (l: LinhaConclusao): boolean => linhaConclusaoPronta(l, motivoPorId, previsaoConfiavelPorId),
    [motivoPorId, previsaoConfiavelPorId]
  );

  const linhasAposStatus = useMemo(() => {
    if (filtroStatus === 'todos') return grade.rowsExibidas;
    return grade.rowsExibidas.filter((l) => {
      const ok = linhaMotivoConfiavelOk(l);
      return filtroStatus === 'concluidos' ? ok : !ok;
    });
  }, [filtroStatus, grade.rowsExibidas, linhaMotivoConfiavelOk]);

  const entries = useMemo(() => agruparPorPedido(linhasAposStatus), [linhasAposStatus]);

  useRegisterModalEscape({
    id: 'seq-carradas-confirmacao',
    onClose: () => {
      if (obsModal) {
        setObsModal(null);
        return;
      }
      if (grade.colunaFiltroAberta) {
        grade.fecharFiltroExcel();
        return;
      }
      onClose();
    },
    zIndex: 135,
    enabled: !salvando,
  });

  const selecionarMotivo = useCallback(
    (ids: string[], motivo: string) => {
      onMotivoPorIdChange((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (motivo) next[id] = motivo;
          else delete next[id];
        }
        return next;
      });
      if (motivo) setRecentes(registrarMotivoRecente(motivo));
    },
    [onMotivoPorIdChange]
  );

  const selecionarObservacao = useCallback(
    (ids: string[], observacao: string) => {
      onObservacaoPorIdChange((prev) => {
        const next = { ...prev };
        const valor = observacao.slice(0, 1000);
        for (const id of ids) {
          if (valor.trim()) next[id] = valor;
          else delete next[id];
        }
        return next;
      });
    },
    [onObservacaoPorIdChange]
  );

  const selecionarConfiavel = useCallback(
    (ids: string[], confiavel: PrevisaoConfiavelTri) => {
      onPrevisaoConfiavelPorIdChange((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (confiavel === true || confiavel === false) next[id] = confiavel;
          else delete next[id];
        }
        return next;
      });
    },
    [onPrevisaoConfiavelPorIdChange]
  );

  const pendentesMotivoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of linhas) {
      if (!l.exigeMotivo || !l.idPedido) continue;
      if (!motivoPorId[l.idPedido]?.trim()) ids.add(l.idPedido);
    }
    return [...ids];
  }, [linhas, motivoPorId]);

  const pendentesConfiavelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of linhas) {
      if (!l.exigeMotivo || !l.idPedido) continue;
      if (!itemPrevisaoConfiavelEscolhida(l.idPedido, previsaoConfiavelPorId)) ids.add(l.idPedido);
    }
    return [...ids];
  }, [linhas, previsaoConfiavelPorId]);

  const exigeAnexoAssinatura = useMemo(() => {
    const descNaoAbonadas = new Set(
      motivos.filter((m) => m.abonada === false).map((m) => m.descricao)
    );
    if (descNaoAbonadas.size === 0) return false;
    for (const l of linhas) {
      if (!l.exigeMotivo || !l.idPedido) continue;
      const m = motivoPorId[l.idPedido]?.trim();
      if (m && descNaoAbonadas.has(m)) return true;
    }
    return false;
  }, [linhas, motivoPorId, motivos]);

  /** PDF opcional quando há motivos; obrigatório se algum for não abonado. */
  const mostrarCampoAnexo = useMemo(() => {
    if (exigeAnexoAssinatura) return true;
    for (const l of linhas) {
      if (!l.exigeMotivo || !l.idPedido) continue;
      if (motivoPorId[l.idPedido]?.trim()) return true;
    }
    return false;
  }, [exigeAnexoAssinatura, linhas, motivoPorId]);

  const onChangeAnexoPdf = async (file: File | null) => {
    if (!file) {
      setAnexoAssinatura(null);
      setAnexoNome('');
      return;
    }
    try {
      const payload = await lerPdfAssinatura(file);
      setAnexoAssinatura(payload);
      setAnexoNome(payload.fileName);
      setValidacao(null);
    } catch (err) {
      setAnexoAssinatura(null);
      setAnexoNome('');
      setValidacao(err instanceof Error ? err.message : 'Não foi possível ler o PDF.');
    }
  };

  const confirmar = () => {
    if (excessosQtdeRomaneada.length > 0) {
      setValidacao(
        'Há itens com quantidade romaneada superior ao saldo a faturar (Pendente). Corrija no ERP antes de confirmar.'
      );
      return;
    }
    if (aindaDatasInvalidas) {
      setValidacao('Corrija todas as datas de produção/entrega anteriores a hoje antes de concluir.');
      return;
    }
    if (pendentesMotivoIds.length > 0) {
      setValidacao(
        `Selecione um motivo para todos os itens com data/previsão a ajustar (${pendentesMotivoIds.length} sem motivo).`
      );
      return;
    }
    if (pendentesConfiavelIds.length > 0) {
      setValidacao(
        `Escolha Sim ou Não em Previsão confiável para todos os itens (${pendentesConfiavelIds.length} sem escolha).`
      );
      return;
    }
    if (exigeAnexoAssinatura && !anexoAssinatura) {
      setValidacao(
        'Há justificativa não abonada: anexe um PDF assinado antes de concluir.'
      );
      return;
    }
    setValidacao(null);
    onConfirmar(motivoPorId, anexoAssinatura);
  };

  const editar = onEditarData;

  const editarDatasPedido = useCallback(
    (itens: LinhaConclusao[], campo: 'dataProducao' | 'dataEntrega', value: string) => {
      if (!editar || !value) return;
      const keys = new Set(itens.map((i) => i.key));
      if (campo === 'dataProducao') {
        for (const key of keys) {
          const item = itens.find((i) => i.key === key);
          aplicarProducaoComSyncEntrega(editar, key, value, item?.dataEntrega ?? '');
        }
        return;
      }
      for (const key of keys) editar(key, campo, value);
    },
    [editar]
  );

  const replicarProducaoNaEntregaPedido = useCallback(
    (itens: LinhaConclusao[]) => {
      if (!editar) return;
      for (const item of itens) {
        if (item.dataProducao) editar(item.key, 'dataEntrega', item.dataProducao);
      }
    },
    [editar]
  );

  const replicarEntregaNaProducaoPedido = useCallback(
    (itens: LinhaConclusao[]) => {
      if (!editar) return;
      for (const item of itens) {
        if (item.dataEntrega) editar(item.key, 'dataProducao', item.dataEntrega);
      }
    },
    [editar]
  );

  const handleDateKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, rowKey: string, colKey: DateColKey) => {
      if (e.key !== 'Tab' && e.key !== 'Enter') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        const colIdx = DATE_COL_KEYS.indexOf(colKey);
        const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
        if (nextColIdx >= 0 && nextColIdx < DATE_COL_KEYS.length) {
          focusSeqDateInput(rowKey, DATE_COL_KEYS[nextColIdx]!);
        }
        return;
      }
      e.preventDefault();
      const keys = linhasAposStatus.map((r) => r.key);
      const rowIdx = keys.indexOf(rowKey);
      const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
      if (targetIdx < 0 || targetIdx >= keys.length) return;
      focusSeqDateInput(keys[targetIdx]!, colKey);
    },
    [linhasAposStatus]
  );

  const onAbrirObs = useCallback((state: ObsModalState) => setObsModal(state), []);

  const grupoHandlers: GrupoHandlers = useMemo(
    () => ({
      editar,
      onDateKey: handleDateKey,
      motivoPorId,
      observacaoPorId,
      previsaoConfiavelPorId,
      motivos,
      recentes,
      onMotivo: selecionarMotivo,
      onConfiavel: selecionarConfiavel,
      onAbrirObs,
      editarDatasPedido,
      replicarProducaoNaEntregaPedido,
      replicarEntregaNaProducaoPedido,
      linhaOk: linhaMotivoConfiavelOk,
    }),
    [
      editar,
      handleDateKey,
      motivoPorId,
      observacaoPorId,
      previsaoConfiavelPorId,
      motivos,
      recentes,
      selecionarMotivo,
      selecionarConfiavel,
      onAbrirObs,
      editarDatasPedido,
      replicarProducaoNaEntregaPedido,
      replicarEntregaNaProducaoPedido,
      linhaMotivoConfiavelOk,
    ]
  );

  const renderThVisivel = (colId: (typeof COLS_FILTRO)[number], extraClass = '') => (
    <th key={colId} className={`${TH_STICKY} ${extraClass}`}>
      <div className="flex items-center justify-between gap-1">
        <span>{COL_LABELS[colId]}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
        />
      </div>
    </th>
  );

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={salvando ? undefined : onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[96vw] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-simulacao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2
              id="confirmacao-simulacao-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              Concluir sequenciamento
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {invalidasDatas.length > 0
                ? 'Corrija datas vencidas e informe motivo, observação e se a previsão é confiável na mesma grade. '
                : 'Informe motivo, observação e se a previsão é confiável (iguais ao Gerenciador de Pedidos). '}
              Itens prontos ficam com fundo verde. Ao fechar, o rascunho é salvo e o preenchimento é
              mantido.
              {qtdCarradasSomenteProducao > 0 &&
                ` Além disso, ${qtdCarradasSomenteProducao} carrada(s) terão apenas a Data de produção atualizada.`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <FiltroStatusSegmentado
              value={filtroStatus}
              onChange={setFiltroStatus}
              disabled={salvando}
            />
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>

        {excessosQtdeRomaneada.length > 0 && (
          <div
            className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            <p className="font-semibold">
              Confirmação bloqueada: a quantidade romaneada do item excede o saldo a faturar (Pendente).
            </p>
            <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-auto pl-5 text-xs">
              {excessosQtdeRomaneada.map((c) => (
                <li key={c.canon}>
                  <span className="font-medium">
                    {c.pd || c.canon}
                    {c.codigo ? ` / ${c.codigo}` : ''}
                  </span>
                  {`: romaneado ${formatQtdeInt(c.somaRomaneada)} > pendente ${formatQtdeInt(c.pendente)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {grade.temFiltrosOuOrdem && (
          <div className="flex shrink-0 items-center justify-end border-b border-slate-200 px-4 py-1.5 dark:border-slate-600">
            <button
              type="button"
              onClick={grade.limparFiltrosGrade}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Limpar filtros/ordem
            </button>
          </div>
        )}

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          {linhas.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-300">
              Nenhuma alteração de previsão exige motivo.
              {qtdCarradasSomenteProducao > 0
                ? ' As datas de produção informadas serão gravadas ao confirmar.'
                : ' Não há alterações para aplicar.'}
            </p>
          ) : linhasAposStatus.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-300">
              Nenhum item neste filtro de status
              {filtroStatus === 'pendentes'
                ? ' (Pendentes)'
                : filtroStatus === 'concluidos'
                  ? ' (Concluídos)'
                  : ''}
              .
            </p>
          ) : (
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className={`${TH_STICKY} pl-4`}>
                    <div className="flex items-center justify-between gap-1">
                      <span>Pedido</span>
                      <span className="inline-flex items-center gap-0.5">
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo('pedido')}
                          onClick={(e) => grade.abrirFiltroExcel('pedido', e)}
                          title="Filtrar Pedido"
                        />
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo('cliente')}
                          onClick={(e) => grade.abrirFiltroExcel('cliente', e)}
                          title="Filtrar Cliente"
                        />
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo('carrada')}
                          onClick={(e) => grade.abrirFiltroExcel('carrada', e)}
                          title="Filtrar Carrada"
                        />
                      </span>
                    </div>
                  </th>
                  {renderThVisivel('codigo')}
                  {renderThVisivel('descricao')}
                  {renderThVisivel('dataProducao')}
                  <th className={`${TH_STICKY} w-10 px-0.5 text-center`} aria-hidden />
                  {renderThVisivel('dataEntrega')}
                  {renderThVisivel('qtde')}
                  {renderThVisivel('motivo')}
                  <th className={`${TH_STICKY} text-center pr-4`}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Confiável / Obs.</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={
                          grade.colunaComFiltroAtivo('confiavel') ||
                          grade.colunaComFiltroAtivo('observacao')
                        }
                        onClick={(e) => grade.abrirFiltroExcel('confiavel', e)}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) =>
                  entry.kind === 'solo' ? (
                    <SoloPedidoRow key={entry.row.key} l={entry.row} handlers={grupoHandlers} />
                  ) : (
                    <GrupoPedidoRows
                      key={entry.grupo.pedidoChave}
                      grupo={entry.grupo}
                      handlers={grupoHandlers}
                    />
                  )
                )}
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
            showNumericFilters={grade.colunaFiltroAberta === 'qtde'}
          />
        )}

        {obsModal && (
          <ModalObservacaoCelula
            open
            tituloColuna="Observação"
            codigo={obsModal.codigo}
            descricao={obsModal.descricao}
            valorInicial={obsModal.valorInicial}
            somenteLeitura={false}
            onClose={() => setObsModal(null)}
            onSalvar={(texto) => {
              selecionarObservacao(obsModal.ids, texto);
              setObsModal(null);
            }}
          />
        )}

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          {mostrarCampoAnexo && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-600/60 dark:bg-amber-950/30">
              <CampoAnexoAssinaturaPdf
                className="max-w-xl"
                anexoNome={anexoNome}
                obrigatorio={exigeAnexoAssinatura}
                onFileChange={(file) => void onChangeAnexoPdf(file)}
                ajuda={
                  anexoNome
                    ? `Arquivo: ${anexoNome}`
                    : exigeAnexoAssinatura
                      ? 'Baixe o modelo, assine e anexe. Um único PDF vale para todos os ajustes do lote.'
                      : 'Opcional: anexe PDF assinado para auditoria. Um único arquivo vale para todo o lote.'
                }
              />
            </div>
          )}
          {(validacao || erro) && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {validacao ?? erro}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={
                salvando ||
                excessosQtdeRomaneada.length > 0 ||
                aindaDatasInvalidas ||
                pendentesMotivoIds.length > 0 ||
                pendentesConfiavelIds.length > 0
              }
              title={
                excessosQtdeRomaneada.length > 0
                  ? 'Há excesso de quantidade romaneada'
                  : aindaDatasInvalidas
                    ? 'Corrija as datas vencidas'
                    : pendentesMotivoIds.length > 0
                      ? 'Preencha todos os motivos'
                      : pendentesConfiavelIds.length > 0
                        ? 'Escolha Sim ou Não em Confiável'
                        : undefined
              }
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? 'Concluindo…' : 'Concluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
