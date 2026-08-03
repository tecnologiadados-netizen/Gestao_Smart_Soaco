import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { listarMotivosSugestao, type MotivoSugestao } from '../../api/motivosSugestao';
import {
  formatDataCurta,
  formatQtdeInt,
  toISODate,
  type CarradaDataInvalida,
  type ExcessoQtdeRomaneadaCanon,
  type PedidoAlterado,
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
  motivoComumIds,
  observacaoComumIds,
  previsaoConfiavelComumIds,
  previsaoConfiavelEfetiva,
} from './confirmacaoMotivosUtils';
import {
  montarLinhasConclusao,
  type LinhaConclusao,
} from './confirmacaoLinhasConclusao';
import { lerPdfAssinatura, type AnexoAssinaturaPayload } from '../../utils/lerPdfAssinatura';
import CampoAnexoAssinaturaPdf from '../CampoAnexoAssinaturaPdf';

export type { LinhaConclusao } from './confirmacaoLinhasConclusao';
export { montarLinhasConclusao } from './confirmacaoLinhasConclusao';

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
  onEditarData?: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void;
  salvando: boolean;
  erro: string | null;
  motivoPorId: Record<string, string>;
  onMotivoPorIdChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  observacaoPorId: Record<string, string>;
  onObservacaoPorIdChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  previsaoConfiavelPorId: Record<string, boolean>;
  onPrevisaoConfiavelPorIdChange: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>
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

const TH_STICKY =
  'sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2 text-left font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.12)] whitespace-nowrap';
const TR_ROW =
  'border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-700/30';
const TR_CONCLUIDA =
  'border-b border-slate-100 dark:border-slate-700 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/55';
const TR_PENDENTE =
  'border-b border-slate-100 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20';
const TD_MESCLADA = 'px-2 py-2 align-middle text-center text-slate-800 dark:text-slate-200';

const COLS = [
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

const COL_LABELS: Record<(typeof COLS)[number], string> = {
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

function ConfiavelCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  title = 'Previsão confiável',
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      aria-label={title}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600 disabled:opacity-50 dark:border-slate-600"
    />
  );
}

function classeLinha(l: LinhaConclusao, motivoOk: boolean): string {
  if (l.datasOk && (!l.exigeMotivo || motivoOk)) return TR_CONCLUIDA;
  if (!l.datasOk || (l.exigeMotivo && !motivoOk)) return TR_PENDENTE;
  return TR_ROW;
}

function textoCelulaLinha(l: LinhaConclusao, colId: string, motivoPorId: Record<string, string>): string {
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
      if (!l.exigeMotivo || !l.idPedido) return '—';
      return motivoPorId[l.idPedido]?.trim() || 'Sem motivo';
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
        itens,
      },
    });
  }

  return entries;
}

export default function ConfirmacaoSimulacaoModal({
  pedidosEntrega,
  qtdCarradasSomenteProducao,
  excessosQtdeRomaneada = [],
  invalidasDatas = [],
  linhasSnapshot = [],
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

  const linhas = useMemo(
    () => montarLinhasConclusao(invalidasDatas, pedidosEntrega, linhasSnapshot),
    [invalidasDatas, pedidosEntrega, linhasSnapshot]
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

  const getCellText = useCallback(
    (l: LinhaConclusao, colId: string) => textoCelulaLinha(l, colId, motivoPorId),
    [motivoPorId]
  );

  const grade = useGradeFiltrosExcel<LinhaConclusao>({
    rows: linhas,
    columnIds: [...COLS],
    getCellText,
    valueForSort: (l, colId) => {
      if (colId === 'qtde') return l.qtdePendenteReal;
      return getCellText(l, colId);
    },
    defaultSortLevels: [],
  });

  const entries = useMemo(() => agruparPorPedido(grade.rowsExibidas), [grade.rowsExibidas]);

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
    (ids: string[], confiavel: boolean) => {
      onPrevisaoConfiavelPorIdChange((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (confiavel) delete next[id];
          else next[id] = false;
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
    if (exigeAnexoAssinatura && !anexoAssinatura) {
      setValidacao(
        'Há justificativa não abonada: anexe um PDF assinado antes de concluir.'
      );
      return;
    }
    setValidacao(null);
    onConfirmar(motivoPorId, exigeAnexoAssinatura ? anexoAssinatura : null);
  };

  const editar = onEditarData;

  const editarDatasPedido = (
    itens: LinhaConclusao[],
    campo: 'dataProducao' | 'dataEntrega',
    value: string
  ) => {
    if (!editar || !value) return;
    const keys = new Set(itens.map((i) => i.key));
    for (const key of keys) editar(key, campo, value);
  };

  const replicarProducaoNaEntregaPedido = (itens: LinhaConclusao[]) => {
    if (!editar) return;
    for (const item of itens) {
      if (item.dataProducao) editar(item.key, 'dataEntrega', item.dataProducao);
    }
  };

  const replicarEntregaNaProducaoPedido = (itens: LinhaConclusao[]) => {
    if (!editar) return;
    for (const item of itens) {
      if (item.dataEntrega) editar(item.key, 'dataProducao', item.dataEntrega);
    }
  };

  const handleDateKey = (
    e: KeyboardEvent<HTMLButtonElement>,
    rowKey: string,
    colKey: DateColKey
  ) => {
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
    const keys = grade.rowsExibidas.map((r) => r.key);
    const rowIdx = keys.indexOf(rowKey);
    const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= keys.length) return;
    focusSeqDateInput(keys[targetIdx]!, colKey);
  };

  const renderTh = (colId: (typeof COLS)[number], extraClass = '') => (
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

  const renderDatas = (l: LinhaConclusao) => (
    <>
      <td className="px-2 py-2 align-middle">
        {editar ? (
          <SequenciamentoDateField
            value={toISODate(l.dataProducao)}
            rowKey={l.key}
            colKey="dataProducao"
            className={`text-xs ${l.producaoPassada ? 'border-red-400 ring-1 ring-red-300' : ''}`}
            onChange={(iso) => editar(l.key, 'dataProducao', iso)}
            onKeyDown={(e) => handleDateKey(e, l.key, 'dataProducao')}
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
            onKeyDown={(e) => handleDateKey(e, l.key, 'dataEntrega')}
          />
        ) : (
          <span className="text-xs tabular-nums">
            {l.dataEntrega ? formatDataCurta(l.dataEntrega) : '—'}
          </span>
        )}
      </td>
    </>
  );

  const renderMotivoCols = (l: LinhaConclusao) => {
    const id = l.idPedido;
    const obs = id ? observacaoPorId[id] ?? '' : '';

    return (
      <>
        <td className="px-2 py-2 text-right text-xs tabular-nums align-middle">
          {formatQtdeInt(l.qtdePendenteReal)}
        </td>
        <td className="px-2 py-2 align-middle">
          {l.exigeMotivo && id ? (
            <MotivoPicker
              value={motivoPorId[id] ?? ''}
              onSelect={(m) => selecionarMotivo([id], m)}
              motivos={motivos}
              recentes={recentes}
              compact
            />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-center align-middle">
          {l.exigeMotivo && id ? (
            <BotaoObservacaoCelula
              hasObservacao={!!obs.trim()}
              bloqueado={false}
              titulo={obs.trim() ? 'Editar observação' : 'Adicionar observação'}
              onClick={() =>
                setObsModal({
                  ids: [id],
                  codigo: l.codigo,
                  descricao: l.descricao,
                  valorInicial: obs,
                })
              }
            />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-center align-middle">
          {l.exigeMotivo && id ? (
            <ConfiavelCheckbox
              checked={previsaoConfiavelEfetiva(id, previsaoConfiavelPorId)}
              onChange={(v) => selecionarConfiavel([id], v)}
            />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
      </>
    );
  };

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
              Itens prontos ficam com fundo verde.
              {qtdCarradasSomenteProducao > 0 &&
                ` Além disso, ${qtdCarradasSomenteProducao} carrada(s) terão apenas a Data de produção atualizada.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
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
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  {renderTh('pedido', 'pl-4')}
                  {renderTh('cliente')}
                  {renderTh('codigo')}
                  {renderTh('descricao')}
                  {renderTh('carrada')}
                  {renderTh('dataProducao')}
                  <th className={`${TH_STICKY} w-10 px-0.5 text-center`} aria-hidden />
                  {renderTh('dataEntrega')}
                  {renderTh('qtde')}
                  {renderTh('motivo')}
                  {renderTh('observacao', 'text-center')}
                  {renderTh('confiavel', 'text-center pr-4')}
                </tr>
              </thead>
              <tbody>
                {entries.flatMap((entry) => {
                  if (entry.kind === 'solo') {
                    const l = entry.row;
                    const motivoOk =
                      !l.exigeMotivo || (!!l.idPedido && !!motivoPorId[l.idPedido]?.trim());
                    return [
                      <tr key={l.key} className={classeLinha(l, motivoOk)}>
                        <td className="py-2 pl-4 pr-2 font-mono text-slate-800 dark:text-slate-200">
                          {l.idPedido ? labelPedidoMapa(l.pedido) : '—'}
                        </td>
                        <td
                          className="max-w-[120px] truncate px-2 py-2 text-slate-800 dark:text-slate-200"
                          title={l.cliente}
                        >
                          {l.cliente || '—'}
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-200">
                          {l.codigo}
                        </td>
                        <td
                          className="max-w-[180px] px-2 py-2 text-slate-800 dark:text-slate-200"
                          title={l.descricao}
                        >
                          <div className="line-clamp-2">{l.descricao || '—'}</div>
                        </td>
                        <td className="max-w-[140px] px-2 py-2 text-slate-800 dark:text-slate-200">
                          <div className="truncate" title={l.carrada}>
                            {l.carrada}
                          </div>
                          {l.previsaoPassada && l.previsaoAtual ? (
                            <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                              Previsão: {formatDataCurta(l.previsaoAtual)} (vencida)
                            </p>
                          ) : null}
                        </td>
                        {renderDatas(l)}
                        {renderMotivoCols(l)}
                      </tr>,
                    ];
                  }

                  const { grupo } = entry;
                  const rowSpan = grupo.itens.length;
                  const idsPedido = grupo.itens
                    .map((i) => i.idPedido)
                    .filter((id): id is string => !!id);
                  const motivoComum = motivoComumIds(idsPedido, motivoPorId);
                  const obsComum = observacaoComumIds(idsPedido, observacaoPorId);
                  const confiavelComum = previsaoConfiavelComumIds(idsPedido, previsaoConfiavelPorId);
                  const badges: StatusPedidoBadgeFields = {
                    statusPrazo: grupo.itens.find((i) => i.statusPrazo)?.statusPrazo,
                    card: grupo.itens.find((i) => i.card)?.card,
                    faturado: grupo.itens.some((i) => i.faturado),
                  };
                  const grupoTodoOk = grupo.itens.every((i) => {
                    const mOk =
                      !i.exigeMotivo || (!!i.idPedido && !!motivoPorId[i.idPedido]?.trim());
                    return i.datasOk && mOk;
                  });
                  const previsaoGrupo = grupo.itens.find((i) => i.previsaoPassada && i.previsaoAtual);
                  const exigeMotivoGrupo = grupo.itens.some((i) => i.exigeMotivo);
                  const temProducaoGrupo = grupo.itens.some((i) => !!i.dataProducao);
                  const temEntregaGrupo = grupo.itens.some((i) => !!i.dataEntrega);

                  return grupo.itens.map((l, itemIdx) => {
                    const isFirst = itemIdx === 0;
                    const motivoOk =
                      !l.exigeMotivo || (!!l.idPedido && !!motivoPorId[l.idPedido]?.trim());
                    return (
                      <tr key={`${l.key}-${l.idPedido ?? itemIdx}`} className={classeLinha(l, motivoOk)}>
                        {isFirst ? (
                          <td rowSpan={rowSpan} className={`${TD_MESCLADA} pl-4 pr-2 font-mono`}>
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <div className="flex flex-wrap items-center justify-center gap-1.5">
                                <span>{labelPedidoMapa(grupo.pedido)}</span>
                                {editar ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <PedidoLoteDataPicker
                                      titulo="Definir data de produção para todos os itens do pedido"
                                      iconClassName="text-sky-600 dark:text-sky-400"
                                      onSelecionar={(value) =>
                                        editarDatasPedido(grupo.itens, 'dataProducao', value)
                                      }
                                    />
                                    <PedidoLoteDataPicker
                                      titulo="Definir data de entrega para todos os itens do pedido"
                                      iconClassName="text-emerald-600 dark:text-emerald-400"
                                      onSelecionar={(value) =>
                                        editarDatasPedido(grupo.itens, 'dataEntrega', value)
                                      }
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        replicarProducaoNaEntregaPedido(grupo.itens);
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
                                        replicarEntregaNaProducaoPedido(grupo.itens);
                                      }}
                                      disabled={!temEntregaGrupo}
                                      className="rounded px-1 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
                                      title="Replicar entrega na produção em todos os itens do pedido"
                                      aria-label="Replicar entrega na produção em todos os itens do pedido"
                                    >
                                      ←
                                    </button>
                                  </span>
                                ) : null}
                              </div>
                              <StatusPedidoPills badges={badges} />
                              {exigeMotivoGrupo && idsPedido.length > 1 ? (
                                <div className="mt-1 w-full min-w-[10rem] space-y-1">
                                  <MotivoPicker
                                    value={motivoComum}
                                    onSelect={(m) => selecionarMotivo(idsPedido, m)}
                                    motivos={motivos}
                                    recentes={recentes}
                                    compact
                                  />
                                  <div className="flex items-center justify-center gap-2">
                                    <BotaoObservacaoCelula
                                      hasObservacao={!!obsComum.trim()}
                                      bloqueado={false}
                                      titulo={
                                        obsComum.trim()
                                          ? 'Editar observação do pedido'
                                          : 'Adicionar observação do pedido'
                                      }
                                      onClick={() =>
                                        setObsModal({
                                          ids: idsPedido,
                                          codigo: labelPedidoMapa(grupo.pedido),
                                          descricao: grupo.cliente || '',
                                          valorInicial: obsComum,
                                        })
                                      }
                                    />
                                    <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
                                      <ConfiavelCheckbox
                                        checked={confiavelComum !== false}
                                        indeterminate={confiavelComum === null}
                                        onChange={(v) => selecionarConfiavel(idsPedido, v)}
                                      />
                                      Confiável
                                    </label>
                                  </div>
                                </div>
                              ) : null}
                              {grupoTodoOk ? (
                                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                  Concluído
                                </span>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                        {isFirst ? (
                          <td
                            rowSpan={rowSpan}
                            className={`${TD_MESCLADA} max-w-[120px]`}
                            title={grupo.cliente}
                          >
                            <span className="block truncate">{grupo.cliente || '—'}</span>
                          </td>
                        ) : null}
                        <td className="px-2 py-2 align-middle font-mono text-slate-800 dark:text-slate-200">
                          <span>{l.codigo}</span>
                          {l.datasOk && motivoOk ? (
                            <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                              Concluído
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="max-w-[180px] px-2 py-2 align-middle text-slate-800 dark:text-slate-200"
                          title={l.descricao}
                        >
                          <div className="line-clamp-2">{l.descricao || '—'}</div>
                        </td>
                        {isFirst ? (
                          <td rowSpan={rowSpan} className={`${TD_MESCLADA} max-w-[140px]`}>
                            <div className="truncate" title={grupo.carrada}>
                              {grupo.carrada}
                            </div>
                            {previsaoGrupo?.previsaoAtual ? (
                              <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                Previsão: {formatDataCurta(previsaoGrupo.previsaoAtual)} (vencida)
                              </p>
                            ) : null}
                          </td>
                        ) : null}
                        {renderDatas(l)}
                        {renderMotivoCols(l)}
                      </tr>
                    );
                  });
                })}
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
          {exigeAnexoAssinatura && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-600/60 dark:bg-amber-950/30">
              <CampoAnexoAssinaturaPdf
                className="max-w-xl"
                anexoNome={anexoNome}
                onFileChange={(file) => void onChangeAnexoPdf(file)}
                ajuda={
                  anexoNome
                    ? `Arquivo: ${anexoNome}`
                    : 'Baixe o modelo, assine e anexe. Um único PDF vale para todos os ajustes com motivo não abonado.'
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
              disabled={salvando || excessosQtdeRomaneada.length > 0 || aindaDatasInvalidas}
              title={
                excessosQtdeRomaneada.length > 0
                  ? 'Resolva o excesso de quantidade romaneada vs pendente'
                  : aindaDatasInvalidas
                    ? 'Corrija todas as datas anteriores a hoje'
                    : undefined
              }
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Aplicando...' : 'Concluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
