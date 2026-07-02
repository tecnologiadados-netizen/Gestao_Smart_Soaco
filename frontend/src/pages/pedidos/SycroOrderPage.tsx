import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  getSycroOrderOrders,
  getSycroOrderPedidosErp,
  createSycroOrderOrder,
  getSycroOrderUsersResponsavel,
  updateSycroOrderOrder,
  getSycroOrderHistory,
  getSycroOrderNotifications,
  markSycroOrderNotificationsRead,
  setSycroOrderNotificationRead,
  setSycroOrderRead,
  setSycroOrderResponsible,
  setSycroOrderTagDisponivel,
  searchSycroOrderUsers,
  type SycroOrderOrder as Order,
  type SycroOrderHistoryItem,
  type SycroOrderNotification,
  type SycroOrderPedidoErp,
} from '../../api/sycroorder';
import { listarMotivosSugestao, type MotivoSugestao } from '../../api/motivosSugestao';
import { listarPedidos } from '../../api/pedidos';
import SingleSelectWithSearch, { type OptionItem } from '../../components/SingleSelectWithSearch';
import ModalGerenciarMotivos from '../../components/ModalGerenciarMotivos';
import SycroOrderFiltrosBar from '../../components/sycroorder/SycroOrderFiltrosBar';
import SycroOrderKanbanCard, { type SycroOrderKanbanCardActions } from '../../components/sycroorder/SycroOrderKanbanCard';
import ModalFaturadoEntregue from '../../components/sycroorder/ModalFaturadoEntregue';
import HelpTooltipIcon from '../../components/HelpTooltipIcon';
import CampoLabelComAjuda, { AJUDA_CAMPO_MENSAGEM, AJUDA_CAMPO_OBSERVACAO } from '../../components/CampoLabelComAjuda';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import {
  isSycroOrderCommercialAuthor,
  SYCRO_ORDER_COMMERCIAL_AUTHOR_LOGINS,
} from '../../utils/sycroOrderComercial';

function parseFiltroMulti(value: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  } catch {
    return iso;
  }
}

/** Menor data ISO entre trecho "a ... b" ou string única (previsão do Gerenciador). */
function earliestIsoFromPrevisaoField(previsao: string | null | undefined, fallbackIso: string): string {
  const p = previsao?.trim();
  if (!p) return fallbackIso.slice(0, 10);
  if (p.includes(' a ')) {
    const parts = p.split(' a ').map((x) => x.trim().slice(0, 10)).filter(Boolean);
    if (parts.length === 0) return fallbackIso.slice(0, 10);
    return [...parts].sort((a, b) => a.localeCompare(b))[0]!;
  }
  return p.slice(0, 10);
}

function getEffectivePrevisaoDateIso(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): string {
  return earliestIsoFromPrevisaoField(o.previsao_atual ?? null, o.current_promised_date);
}

/** Dias até a previsão efetiva (0 = hoje). null se inválido ou data já passou. */
function getDaysUntilEffectivePrevisao(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): number | null {
  const dateStr = getEffectivePrevisaoDateIso(o);
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diff < 0) return null;
    return diff;
  } catch {
    return null;
  }
}

/** Mesma janela do filtro “Entrega em 7 dias”: hoje até hoje+7 (comparando à previsão atual). */
function isPromisedWithin7DaysFromPrevisao(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): boolean {
  const days = getDaysUntilEffectivePrevisao(o);
  return days != null && days <= 7;
}

/** Texto do selo no card; null se fora da janela de 7 dias. */
function entregaProximityLabel(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): string | null {
  const days = getDaysUntilEffectivePrevisao(o);
  if (days == null || days > 7) return null;
  if (days === 0) return 'Entrega HOJE';
  return `Entrega em ${days} dias`;
}

function getPrimaryResponsavelLabel(deliveryMethod: string): 'josenildo' | 'PCP' {
  const fm = (deliveryMethod ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const josenildo =
    (fm.includes('entrega') && fm.includes('grande')) ||
    (fm.includes('retirada') && fm.includes('moveis')) ||
    fm.includes('so aco');
  return josenildo ? 'josenildo' : 'PCP';
}

function formatResponsavelLine(deliveryMethod: string, extraLogin: string | null | undefined): string {
  const base = getPrimaryResponsavelLabel(deliveryMethod);
  const ex = (extraLogin ?? '').trim().toLowerCase();
  if (ex) return `Responsável por responder: ${base} | ${ex}`;
  return `Responsável por responder: ${base}`;
}

/** Tags para o filtro: regra josenildo/outros + login extra se houver. */
function responsavelTagsForCard(o: Order): string[] {
  const fm = (o.delivery_method ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const josenildo =
    (fm.includes('entrega') && fm.includes('grande')) ||
    (fm.includes('retirada') && fm.includes('moveis')) ||
    fm.includes('so aco');
  const tags: string[] = [josenildo ? 'josenildo' : 'PCP'];
  const ex = (o.responsible_user_login ?? '').trim().toLowerCase();
  if (ex) tags.push(ex);
  return tags;
}

function isCarradaRota(rota?: string | null): boolean {
  const n = (rota ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return n.startsWith('rota ');
}

/** Rotas definidas pela consulta SQL do Gerenciador — não entram na replicação por carrada. */
const EXCLUDED_SQL_ROTA_CATEGORIES = new Set([
  'retirada na so aco',
  'retirada na so moveis',
  'entrega grande teresina',
  'inserir em romaneio',
  'requisicao',
]);

function normalizeRotaNameStr(dm: string): string {
  return dm.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isExcludedSqlRotaCategory(dm: string): boolean {
  return EXCLUDED_SQL_ROTA_CATEGORIES.has(normalizeRotaNameStr(dm));
}

/** Rota / forma de entrega = "Inserir em romaneio" (Gerenciador). */
function isInserirEmRomaneio(rotaOuForma?: string | null): boolean {
  return normalizeRotaNameStr(rotaOuForma ?? '') === 'inserir em romaneio';
}

/** Card em coluna Carradas: alguma rota tipo "Rota …" ou inserir em romaneio (forma ou linha em carradas_info). */
function orderTemCarradaOuRomaneio(o: Order): boolean {
  if (isInserirEmRomaneio(o.delivery_method)) return true;
  if (isCarradaRota(o.delivery_method)) return true;
  for (const c of o.carradas_info ?? []) {
    if (isCarradaRota(c.rota)) return true;
    if (isInserirEmRomaneio(c.rota)) return true;
  }
  return false;
}

type KanbanLaneId = 'ABERTO' | 'CARRADAS_ANDAMENTO' | 'GTER_ANDAMENTO' | 'DISPONIVEL' | 'FATURADO';

function kanbanLaneIdForOrder(o: Order): KanbanLaneId {
  if (o.status === 'FINISHED') return 'FATURADO';
  if (o.tag_disponivel) return 'DISPONIVEL';
  if (o.status === 'PENDING') return 'ABERTO';
  if (orderTemCarradaOuRomaneio(o)) return 'CARRADAS_ANDAMENTO';
  return 'GTER_ANDAMENTO';
}

function normalizePersonToken(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** "Aguarda resposta de …" no card refere-se ao usuário logado (nome ou login no rótulo). */
function aguardaRespostaApontaParaUsuario(
  o: Pick<Order, 'aguarda_resposta_pendente' | 'aguarda_resposta_de_label'>,
  login: string | null | undefined,
  nome: string | null | undefined
): boolean {
  if (!login || !o.aguarda_resposta_pendente) return false;
  const labelRaw = (o.aguarda_resposta_de_label ?? '').trim();
  if (!labelRaw) return false;
  const lLogin = normalizePersonToken(login);
  const lNome = normalizePersonToken(nome ?? '');
  const labelNorm = normalizePersonToken(labelRaw);
  if (lNome && (labelNorm === lNome || labelNorm.includes(lNome))) return true;
  if (lLogin && (labelNorm === lLogin || labelNorm.includes(lLogin))) return true;
  for (const seg of labelRaw.split(',')) {
    const t = normalizePersonToken(seg);
    if (lNome && t === lNome) return true;
    if (lLogin && t === lLogin) return true;
  }
  return false;
}

/** Pendência ativa: card em andamento que aguarda resposta do usuário logado. */
function cardAguardaRespostaDoUsuarioAtivo(
  o: Pick<Order, 'status' | 'aguarda_resposta_pendente' | 'aguarda_resposta_de_label'>,
  login: string | null | undefined,
  nome: string | null | undefined
): boolean {
  if (o.status === 'FINISHED') return false;
  return aguardaRespostaApontaParaUsuario(o, login, nome);
}

/** Card em que o usuário tem vínculo direto: aguarda resposta dele, criador (por nome) ou segundo responsável (login). */
function cardVerMeuEnvolvimento(o: Order, login: string | null, nome: string | null): boolean {
  if (!login) return false;
  if (aguardaRespostaApontaParaUsuario(o, login, nome)) return true;
  const ru = (o.responsible_user_login ?? '').trim().toLowerCase();
  if (ru && ru === login.trim().toLowerCase()) return true;
  const cn = (o.creator_name ?? '').trim();
  if (nome?.trim() && cn && normalizePersonToken(cn) === normalizePersonToken(nome)) return true;
  return false;
}

function isEntregaHojeOuAmanha(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): boolean {
  const d = getDaysUntilEffectivePrevisao(o);
  return d != null && d <= 1;
}

function isCardNaoRespondido(o: Pick<Order, 'status' | 'aguarda_resposta_pendente'>): boolean {
  if (o.status === 'FINISHED') return false;
  return !!o.aguarda_resposta_pendente;
}

/** 1 = aguarda sua resposta; 2 = não respondido + entrega hoje/amanhã (e não é tier 1); 3 = demais. */
function sortTierForKanbanUser(o: Order, login: string | null, nome: string | null): 1 | 2 | 3 {
  if (login && cardAguardaRespostaDoUsuarioAtivo(o, login, nome)) return 1;
  if (isCardNaoRespondido(o) && isEntregaHojeOuAmanha(o)) return 2;
  return 3;
}

function lastActivityTimeMs(o: Order): number {
  return new Date(o.last_response_at || o.created_at).getTime();
}

function horasDesdeUltimaAtividade(o: Order): number {
  return (Date.now() - lastActivityTimeMs(o)) / (60 * 60 * 1000);
}

/** Ordenação por coluna do Kanban, personalizada pelo usuário logado. */
function compareOrdersKanbanForLoggedUser(a: Order, b: Order, login: string | null, nome: string | null): number {
  if (!login) {
    return lastActivityTimeMs(b) - lastActivityTimeMs(a);
  }
  const ta = sortTierForKanbanUser(a, login, nome);
  const tb = sortTierForKanbanUser(b, login, nome);
  if (ta !== tb) return ta - tb;
  if (ta === 1) {
    return lastActivityTimeMs(a) - lastActivityTimeMs(b);
  }
  if (ta === 2) {
    const da = getDaysUntilEffectivePrevisao(a);
    const db = getDaysUntilEffectivePrevisao(b);
    if (da != null && db != null && da !== db) return da - db;
    if (da == null && db != null) return 1;
    if (da != null && db == null) return -1;
    return lastActivityTimeMs(b) - lastActivityTimeMs(a);
  }
  const da = getDaysUntilEffectivePrevisao(a);
  const db = getDaysUntilEffectivePrevisao(b);
  if (da != null && db != null && da !== db) return da - db;
  if (da == null && db != null) return 1;
  if (da != null && db == null) return -1;
  return lastActivityTimeMs(b) - lastActivityTimeMs(a);
}

function rotaFromPedidoRow(row: Record<string, unknown>): string {
  return String(row['Observacoes'] ?? row['Observações'] ?? row['Rota'] ?? row['rota'] ?? '').trim();
}

/** Compara apenas a parte data (YYYY-MM-DD) — evita falha quando o card vem ISO e o input é type=date. */
function normalizeDateKeyForCompare(isoOrDate: string | undefined | null): string {
  if (isoOrDate == null) return '';
  const t = String(isoOrDate).trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : t.slice(0, 10);
}

/** PD "47146" vs "PD 47146" → mesmo pedido para contagem na rota. */
function normalizePdLabelForCompare(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function firstIsoFromRange(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === '') return null;
  const m = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function formatLinhaPrevisaoHistorico(opts: {
  actionType: string;
  previousDate: string | null;
  newDate: string | null;
  prazoOriginal?: string | null;
}): string | null {
  const newIso = firstIsoFromRange(opts.newDate);
  if (!newIso) return null;
  const newFmt = formatDate(newIso);
  let prevIso = firstIsoFromRange(opts.previousDate);
  if (!prevIso) prevIso = firstIsoFromRange(opts.prazoOriginal);
  const prevFmt = prevIso ? formatDate(prevIso) : null;
  if (prevFmt && prevFmt !== newFmt) {
    return `Previsão alterada de ${prevFmt} para ${newFmt}`;
  }
  if (opts.actionType === 'CREATE') {
    return `Previsão prometida no card: ${newFmt}`;
  }
  return `Previsão alterada para ${newFmt}`;
}

type HistoricoEventTone = 'create' | 'previsao' | 'tagDisponivel' | 'tagIndisponivel' | 'default';

function historicoEventTone(
  actionType: string,
  linhaPrevisao: string | null,
  linhaConteudo: string | null
): HistoricoEventTone {
  if (actionType === 'CREATE') return 'create';
  if (actionType === 'TAG_DISPONIVEL_TRUE') return 'tagDisponivel';
  if (actionType === 'TAG_DISPONIVEL_FALSE') return 'tagIndisponivel';
  if (actionType === 'AJUSTE_PREVISAO') return 'previsao';
  if (linhaPrevisao && linhaConteudo === linhaPrevisao) return 'previsao';
  return 'default';
}

const HISTORICO_EVENT_BOX: Record<Exclude<HistoricoEventTone, 'default'>, { li: string; badge: string; dot: string; badgeSub: string }> = {
  create: {
    li: 'relative rounded-lg border-l-[5px] border-blue-500 bg-blue-50/95 pl-3.5 pr-3 py-3 shadow-sm ring-1 ring-blue-600/20 last:pb-3 dark:border-blue-400 dark:bg-blue-950/50 dark:ring-blue-400/25',
    badge:
      'inline-flex flex-wrap items-center gap-1.5 rounded-md border border-primary-600/35 bg-blue-600/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-900 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200',
    dot: 'size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400',
    badgeSub: 'font-semibold normal-case tracking-normal text-[11px] text-blue-950 dark:text-blue-100',
  },
  previsao: {
    li: 'relative rounded-lg border-l-[5px] border-amber-500 bg-amber-50/95 pl-3.5 pr-3 py-3 shadow-sm ring-1 ring-amber-600/20 last:pb-3 dark:border-amber-400 dark:bg-amber-950/45 dark:ring-amber-400/25',
    badge:
      'inline-flex flex-wrap items-center gap-1.5 rounded-md border border-amber-600/35 bg-amber-600/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100',
    dot: 'size-1.5 shrink-0 rounded-full bg-amber-600 dark:bg-amber-400',
    badgeSub: 'font-semibold normal-case tracking-normal text-[11px] text-amber-950 dark:text-amber-50',
  },
  tagDisponivel: {
    li: 'relative rounded-lg border-l-[5px] border-emerald-500 bg-emerald-50/95 pl-3.5 pr-3 py-3 shadow-sm ring-1 ring-emerald-600/20 last:pb-3 dark:border-emerald-400 dark:bg-emerald-950/50 dark:ring-emerald-400/25',
    badge:
      'inline-flex flex-wrap items-center gap-1.5 rounded-md border border-emerald-600/35 bg-emerald-600/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200',
    dot: 'size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400',
    badgeSub: 'font-semibold normal-case tracking-normal text-[11px] text-emerald-950 dark:text-emerald-100',
  },
  tagIndisponivel: {
    li: 'relative rounded-lg border-l-[5px] border-red-500 bg-red-50/95 pl-3.5 pr-3 py-3 shadow-sm ring-1 ring-red-600/20 last:pb-3 dark:border-red-400 dark:bg-red-950/50 dark:ring-red-400/25',
    badge:
      'inline-flex flex-wrap items-center gap-1.5 rounded-md border border-red-600/35 bg-red-600/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-900 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-200',
    dot: 'size-1.5 shrink-0 rounded-full bg-red-600 dark:bg-red-400',
    badgeSub: 'font-semibold normal-case tracking-normal text-[11px] text-red-950 dark:text-red-100',
  },
};

const HISTORICO_EVENT_BADGE_TITULO: Record<Exclude<HistoricoEventTone, 'default'>, string> = {
  create: 'CRIAÇÃO DO CARD',
  previsao: 'ALTERAÇÃO DE PREVISÃO',
  tagDisponivel: 'MARCADO COMO DISPONÍVEL',
  tagIndisponivel: 'MARCADO COMO NÃO DISPONÍVEL',
};

/** Faixas do Kanban (lógica em `kanbanLaneIdForOrder`; backend mantém PENDING / ESCALATED / FINISHED). */
const KANBAN_LANES: { id: KanbanLaneId; label: string; headerClass: string }[] = [
  { id: 'ABERTO', label: 'Aberto', headerClass: 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:border-red-700' },
  {
    id: 'CARRADAS_ANDAMENTO',
    label: 'Carradas - Em andamento',
    headerClass: 'bg-amber-400 text-slate-900 border-amber-500 dark:bg-amber-500 dark:text-slate-900 dark:border-amber-600',
  },
  {
    id: 'GTER_ANDAMENTO',
    label: 'G. The e Retiradas - Em andamento',
    headerClass: 'bg-violet-500 text-white border-violet-600 dark:bg-violet-600 dark:border-violet-700',
  },
  {
    id: 'DISPONIVEL',
    label: 'Disponível',
    headerClass: 'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-700 dark:border-emerald-800',
  },
  { id: 'FATURADO', label: 'Faturado/Entregue', headerClass: 'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:border-green-700' },
];

/** Colunas exibidas no quadro principal (Faturado/Entregue fica no modal). */
const KANBAN_LANES_BOARD = KANBAN_LANES.filter((l) => l.id !== 'FATURADO');

/** Filtro rápido da barra MINHA FILA (um por vez; clique de novo limpa). */
type FiltroRapidoMinhaFila = 'aguardando' | 'entrega_hoje_amanha' | 'mais_24h' | 'ver_meus';

function alternarFiltroRapido(atual: FiltroRapidoMinhaFila | null, chave: FiltroRapidoMinhaFila): FiltroRapidoMinhaFila | null {
  return atual === chave ? null : chave;
}

export default function SycroOrderPage() {
  const { login, nome, grupo, hasPermission } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalFaturadoEntregue, setModalFaturadoEntregue] = useState(false);
  const [modalEditar, setModalEditar] = useState<Order | null>(null);
  const [modalEditarTagDisponivel, setModalEditarTagDisponivel] = useState<boolean | null>(null);
  const [tagLoadingOrderId, setTagLoadingOrderId] = useState<number | null>(null);
  const [modalHistorico, setModalHistorico] = useState<Order | null>(null);
  /** Evita aplicar resposta de um fetch antigo se o usuário trocar de card antes de concluir. */
  const historicoSeqRef = useRef(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [modalNotif, setModalNotif] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'todas' | 'lidas' | 'nao_lidas'>('nao_lidas');
  const [notifTogglingId, setNotifTogglingId] = useState<number | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [history, setHistory] = useState<SycroOrderHistoryItem[]>([]);
  const [historicoPrazoOriginal, setHistoricoPrazoOriginal] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<SycroOrderNotification[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalEditarResponsavel, setModalEditarResponsavel] = useState<Order | null>(null);
  const [usersResponsavel, setUsersResponsavel] = useState<Array<{ id: number; login: string; nome: string | null }>>([]);
  const [loadingUsersResp, setLoadingUsersResp] = useState(false);
  const [savingResponsible, setSavingResponsible] = useState(false);
  const [filtros, setFiltros] = useState<{
    pedido: string;
    criadoPor: string;
    ultimaRespostaPor: string;
    formaEntrega: string;
    responsavel: string;
    entrega7d: 'todos' | 'sim' | 'nao';
    leitura: 'todos' | 'lidos' | 'nao_lidos';
  }>({
    pedido: '',
    criadoPor: '',
    ultimaRespostaPor: '',
    formaEntrega: '',
    responsavel: '',
    entrega7d: 'todos',
    leitura: 'todos',
  });
  const [filtroRapidoMinhaFila, setFiltroRapidoMinhaFila] = useState<FiltroRapidoMinhaFila | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getSycroOrderOrders();
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    // Mantém o contador de não lidas no botão sem necessidade de clicar.
    getSycroOrderNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    if (!modalEditarResponsavel) return;
    let cancelled = false;
    setLoadingUsersResp(true);
    getSycroOrderUsersResponsavel()
      .then((list) => {
        if (!cancelled) setUsersResponsavel(list);
      })
      .catch(() => {
        if (!cancelled) setUsersResponsavel([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsersResp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalEditarResponsavel]);

  useEffect(() => {
    const handler = () => {
      setNotifFilter('nao_lidas');
      setModalNotif(true);
      getSycroOrderNotifications()
        .then(setNotifications)
        .catch(() => setNotifications([]));
    };
    window.addEventListener('sycroorder:openNotificacoes', handler);
    return () => window.removeEventListener('sycroorder:openNotificacoes', handler);
  }, []);

  const acionarTagDisponivel = useCallback(
    async (order: Order, available: boolean) => {
      setTagLoadingOrderId(order.id);
      try {
        await setSycroOrderTagDisponivel(order.id, available);
        setToast(available ? 'DISPONÍVEL ativado.' : 'NÃO DISPONÍVEL ativado.');
        setTimeout(() => setToast(null), 3000);
        await carregar();
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Erro ao atualizar a TAG de disponibilidade.');
        setTimeout(() => setToast(null), 5000);
      } finally {
        setTagLoadingOrderId(null);
      }
    },
    [carregar]
  );

  const filteredBySearch = orders;

  const opcoesFiltroSycro = useMemo(() => {
    const base = orders;
    const opResponsavel = [...new Set(base.flatMap((o) => responsavelTagsForCard(o)))].sort((a, b) => {
      const rank = (x: string) => (x === 'josenildo' ? 0 : x === 'PCP' ? 1 : 2);
      const r = rank(a) - rank(b);
      return r !== 0 ? r : a.localeCompare(b, 'pt-BR');
    });
    return {
      pedido: [...new Set(base.map((o) => o.order_number))].sort(),
      criadoPor: [...new Set(base.map((o) => (o.creator_name ?? '').trim() || '—'))].sort(),
      ultimaRespostaPor: [...new Set(base.map((o) => (o.last_responder_name ?? '').trim() || '—'))].sort(),
      formaEntrega: [...new Set(base.map((o) => (o.delivery_method ?? '').trim() || '—'))].sort(),
      responsavel: opResponsavel,
    };
  }, [orders]);

  const filtered = filteredBySearch.filter((o) => {
    if (filtroRapidoMinhaFila && login) {
      const aguardaMim = cardAguardaRespostaDoUsuarioAtivo(o, login, nome);
      if (filtroRapidoMinhaFila === 'aguardando') {
        if (!aguardaMim) return false;
      } else if (filtroRapidoMinhaFila === 'entrega_hoje_amanha') {
        if (!aguardaMim || !isEntregaHojeOuAmanha(o)) return false;
      } else if (filtroRapidoMinhaFila === 'mais_24h') {
        if (!aguardaMim || horasDesdeUltimaAtividade(o) < 24) return false;
      } else if (filtroRapidoMinhaFila === 'ver_meus') {
        if (!cardVerMeuEnvolvimento(o, login, nome)) return false;
      }
    }
    const pedidoSel = parseFiltroMulti(filtros.pedido);
    if (pedidoSel.length > 0 && !pedidoSel.includes(o.order_number)) return false;
    const criador = (o.creator_name ?? '').trim() || '—';
    const criadoPorSel = parseFiltroMulti(filtros.criadoPor);
    if (criadoPorSel.length > 0 && !criadoPorSel.includes(criador)) return false;
    const ultimaResp = (o.last_responder_name ?? '').trim() || '—';
    const ultimaRespostaSel = parseFiltroMulti(filtros.ultimaRespostaPor);
    if (ultimaRespostaSel.length > 0 && !ultimaRespostaSel.includes(ultimaResp)) return false;
    const forma = (o.delivery_method ?? '').trim() || '—';
    const formaEntregaSel = parseFiltroMulti(filtros.formaEntrega);
    if (formaEntregaSel.length > 0 && !formaEntregaSel.includes(forma)) return false;
    const responsavelSel = parseFiltroMulti(filtros.responsavel);
    if (responsavelSel.length > 0 && !responsavelSel.some((f) => responsavelTagsForCard(o).includes(f))) return false;
    if (filtros.entrega7d !== 'todos') {
      const within7 = isPromisedWithin7DaysFromPrevisao(o);
      if (filtros.entrega7d === 'sim' && !within7) return false;
      if (filtros.entrega7d === 'nao' && within7) return false;
    }
    if (filtros.leitura !== 'todos') {
      const isRead = !!o.read_by_me;
      if (filtros.leitura === 'lidos' && !isRead) return false;
      if (filtros.leitura === 'nao_lidos' && isRead) return false;
    }
    return true;
  });

  const minhaFilaResumo = useMemo(() => {
    if (!login) return { total: 0, entregaHojeAmanha: 0, mais24h: 0 };
    const pendentesMim = orders.filter((o) => cardAguardaRespostaDoUsuarioAtivo(o, login, nome));
    return {
      total: pendentesMim.length,
      entregaHojeAmanha: pendentesMim.filter((o) => isEntregaHojeOuAmanha(o)).length,
      mais24h: pendentesMim.filter((o) => horasDesdeUltimaAtividade(o) >= 24).length,
    };
  }, [orders, login, nome]);

  /** Pedidos por faixa: ordenação personalizada por usuário (tiers + previsão). */
  const ordersByLane = (laneId: KanbanLaneId) => {
    const lane = filtered.filter((o) => kanbanLaneIdForOrder(o) === laneId);
    return [...lane].sort((a, b) => compareOrdersKanbanForLoggedUser(a, b, login, nome));
  };

  const faturadoOrders = useMemo(() => ordersByLane('FATURADO'), [filtered, login, nome]);

  const fecharModalHistorico = useCallback(() => {
    historicoSeqRef.current += 1;
    setModalHistorico(null);
    setHistoryLoading(false);
    setHistory([]);
    setHistoricoPrazoOriginal(null);
  }, []);

  const abrirHistorico = async (order: Order) => {
    const seq = ++historicoSeqRef.current;
    setModalHistorico(order);
    setHistoryLoading(true);
    setHistory([]);
    setHistoricoPrazoOriginal(null);
    try {
      const resp = await getSycroOrderHistory(order.id);
      if (seq !== historicoSeqRef.current) return;
      setHistory(resp.items);
      setHistoricoPrazoOriginal(resp.prazo_original ?? order.data_original ?? null);
    } catch {
      if (seq !== historicoSeqRef.current) return;
      setHistory([]);
    } finally {
      if (seq === historicoSeqRef.current) setHistoryLoading(false);
    }
  };

  const cardActions = useMemo<SycroOrderKanbanCardActions>(
    () => ({
      onHistorico: (o) => {
        void abrirHistorico(o);
        void setSycroOrderRead(o.id, true).then(() => carregar()).catch(() => {});
      },
      onAtualizar: (o) => {
        setModalEditarTagDisponivel(null);
        setModalEditar(o);
        void setSycroOrderRead(o.id, true).then(() => carregar()).catch(() => {});
      },
      onMarcarNaoLida: (o) => {
        void setSycroOrderRead(o.id, false).then(() => carregar()).catch(() => {});
      },
      onTagDisponivelClick: (o) => {
        setModalEditarTagDisponivel(false);
        setModalEditar(o);
        void setSycroOrderRead(o.id, true).then(() => carregar()).catch(() => {});
      },
      acionarTagDisponivel,
    }),
    [acionarTagDisponivel, carregar]
  );

  const abrirHistoricoPorNotificacao = async (n: SycroOrderNotification) => {
    if (!n.order_id) {
      setToast('Esta notificação não está vinculada a um pedido.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    let order: Order | undefined = orders.find((o) => o.id === n.order_id);
    if (!order) {
      try {
        const list = await getSycroOrderOrders();
        order = list.find((o) => o.id === n.order_id);
      } catch {
        order = undefined;
      }
    }
    if (!order) {
      setToast('Pedido não encontrado na lista. Verifique os filtros ou atualize a página.');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setModalNotif(false);
    await abrirHistorico(order);
    setSycroOrderRead(order.id, true).then(() => carregar()).catch(() => {});
  };

  const abrirAtualizarDoHistorico = () => {
    const o = modalHistorico;
    if (!o || o.can_respond === false) return;
    fecharModalHistorico();
    setModalEditarTagDisponivel(null);
    setModalEditar(o);
    setSycroOrderRead(o.id, true).then(() => carregar()).catch(() => {});
  };

  const marcarLidas = async () => {
    try {
      await markSycroOrderNotificationsRead();
      const list = await getSycroOrderNotifications();
      setNotifications(list);
      window.dispatchEvent(new CustomEvent('sycroorder:notificationsUpdated'));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex shrink-0 items-center gap-3 pb-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Comunicação PD</h2>
          <button
            type="button"
            onClick={() => setMostrarFiltros((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
            title={mostrarFiltros ? 'Ocultar filtros' : 'Exibir filtros'}
            aria-label={mostrarFiltros ? 'Ocultar filtros' : 'Exibir filtros'}
          >
            {mostrarFiltros ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {mostrarFiltros && (
          <SycroOrderFiltrosBar
            variant="inline"
            hideActionButtons
            filtros={filtros}
            opcoes={opcoesFiltroSycro}
            temFiltro={
              filtroRapidoMinhaFila != null ||
              parseFiltroMulti(filtros.pedido).length > 0 ||
              parseFiltroMulti(filtros.criadoPor).length > 0 ||
              parseFiltroMulti(filtros.ultimaRespostaPor).length > 0 ||
              parseFiltroMulti(filtros.formaEntrega).length > 0 ||
              parseFiltroMulti(filtros.responsavel).length > 0 ||
              filtros.entrega7d !== 'todos' ||
              filtros.leitura !== 'todos'
            }
            onChange={setFiltros}
            onLimpar={() => {
              setFiltroRapidoMinhaFila(null);
              setFiltros({
                pedido: '',
                criadoPor: '',
                ultimaRespostaPor: '',
                formaEntrega: '',
                responsavel: '',
                entrega7d: 'todos',
                leitura: 'todos',
              });
            }}
          />
        )}
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setModalFaturadoEntregue(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100 dark:border-green-500 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50"
          >
            Faturado/Entregue
          </button>
          <button
            type="button"
            onClick={() => setModalNovo(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Novo Card
          </button>
        </div>
      </div>

      {login && (
        <div
          className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-4 transition shadow-md ${
            filtroRapidoMinhaFila
              ? 'border-primary-500/70 bg-slate-900 ring-2 ring-primary-500/50 dark:bg-slate-950'
              : 'border-slate-700/90 bg-slate-900 dark:bg-slate-950/95'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            <p className="text-sm font-bold text-slate-100 tracking-wide shrink-0">
              MINHA FILA <span className="font-normal text-slate-500">|</span>{' '}
              <span className="font-semibold text-slate-200">{nome?.trim() || login}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFiltroRapidoMinhaFila((c) => alternarFiltroRapido(c, 'aguardando'))}
                aria-pressed={filtroRapidoMinhaFila === 'aguardando'}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 min-w-[10rem] text-left transition bg-slate-800/80 ${
                  filtroRapidoMinhaFila === 'aguardando'
                    ? 'border-sky-300 ring-2 ring-sky-400/50 shadow-md'
                    : 'border-sky-500/80 hover:bg-slate-700/80'
                }`}
              >
                <span className="text-2xl font-bold text-sky-400 tabular-nums">{minhaFilaResumo.total}</span>
                <span className="text-xs text-slate-300 leading-tight">Aguardando sua resposta</span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroRapidoMinhaFila((c) => alternarFiltroRapido(c, 'entrega_hoje_amanha'))}
                aria-pressed={filtroRapidoMinhaFila === 'entrega_hoje_amanha'}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 min-w-[10rem] text-left transition bg-slate-800/80 ${
                  filtroRapidoMinhaFila === 'entrega_hoje_amanha'
                    ? 'border-red-300 ring-2 ring-red-400/50 shadow-md'
                    : 'border-red-500/80 hover:bg-slate-700/80'
                }`}
              >
                <span className="text-2xl font-bold text-red-400 tabular-nums">{minhaFilaResumo.entregaHojeAmanha}</span>
                <span className="text-xs text-slate-300 leading-tight inline-flex items-center gap-1">
                  Entrega hoje ou amanhã
                  <svg className="text-amber-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 3L2 20h20L12 3zm0 4.5L17.5 18h-11L12 7.5z" />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroRapidoMinhaFila((c) => alternarFiltroRapido(c, 'mais_24h'))}
                aria-pressed={filtroRapidoMinhaFila === 'mais_24h'}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 min-w-[10rem] text-left transition bg-slate-800/80 ${
                  filtroRapidoMinhaFila === 'mais_24h'
                    ? 'border-amber-300 ring-2 ring-amber-400/50 shadow-md'
                    : 'border-amber-500/80 hover:bg-slate-700/80'
                }`}
              >
                <span className="text-2xl font-bold text-amber-400 tabular-nums">{minhaFilaResumo.mais24h}</span>
                <span className="text-xs text-slate-300 leading-tight inline-flex items-center gap-1">
                  +24h sem resposta sua
                  <svg className="text-violet-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltroRapidoMinhaFila((c) => alternarFiltroRapido(c, 'ver_meus'))}
            aria-pressed={filtroRapidoMinhaFila === 'ver_meus'}
            className={`inline-flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-lg border transition ${
              filtroRapidoMinhaFila === 'ver_meus'
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 ring-2 ring-violet-300/60 border-white/20'
                : 'bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 border-white/10'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Ver apenas os meus
          </button>
        </div>
      )}
      {filtroRapidoMinhaFila && login && (
        <p className="text-xs text-sky-700 dark:text-sky-400 -mt-2">
          {filtroRapidoMinhaFila === 'aguardando' &&
            'Filtro: capa indica aguardar resposta de você.'}
          {filtroRapidoMinhaFila === 'entrega_hoje_amanha' &&
            'Filtro: entre os que aguardam você, entrega hoje ou amanhã.'}
          {filtroRapidoMinhaFila === 'mais_24h' &&
            'Filtro: aguardam você e sem sua resposta há mais de 24 h (desde a última movimentação no card).'}
          {filtroRapidoMinhaFila === 'ver_meus' &&
            'Filtro: você é criador (nome), segundo responsável ou a capa aguarda sua resposta.'}
        </p>
      )}

      {toast && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 text-sm text-green-800 dark:text-green-200">
          {toast}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Nenhum pedido encontrado.</div>
        ) : (
          <>
            <div className="flex gap-4 p-4 min-h-[420px] w-full overflow-x-auto">
              {KANBAN_LANES_BOARD.map(({ id, label, headerClass }) => (
                <div
                  key={id}
                  data-lane={id}
                  className="flex-none w-[min(100%,17.5rem)] sm:flex-1 sm:min-w-0 flex flex-col rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
                >
                  <div className={`px-3 py-2 border-b rounded-t-xl flex items-center justify-between gap-2 ${headerClass}`}>
                    <span className="font-medium text-sm leading-tight">{label}</span>
                    <span className="text-xs opacity-90 bg-black/10 dark:bg-white/20 px-2 py-0.5 rounded shrink-0">
                      {ordersByLane(id).length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[320px] overflow-y-auto max-h-[86rem] flex-1">
                    {ordersByLane(id).map((o) => (
                      <SycroOrderKanbanCard
                        key={o.id}
                        order={o}
                        hasPermission={hasPermission}
                        tagLoadingOrderId={tagLoadingOrderId}
                        actions={cardActions}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ModalFaturadoEntregue
        open={modalFaturadoEntregue}
        onClose={() => setModalFaturadoEntregue(false)}
        orders={faturadoOrders}
        hasPermission={hasPermission}
        tagLoadingOrderId={tagLoadingOrderId}
        cardActions={cardActions}
      />

      {/* Modal Novo Pedido */}
      {modalNovo && (
        <ModalNovoPedido
          onClose={() => setModalNovo(false)}
          onSuccess={() => {
            setModalNovo(false);
            carregar();
            setToast('Pedido criado.');
            setTimeout(() => setToast(null), 3000);
          }}
          saving={saving}
          setSaving={setSaving}
        />
      )}

      {/* Modal Atualizar */}
      {modalEditar && (
        <ModalAtualizarPedido
          order={modalEditar}
          tagDisponivelToSet={modalEditarTagDisponivel}
          onClose={() => {
            setModalEditar(null);
            setModalEditarTagDisponivel(null);
          }}
          onSuccess={() => {
            setModalEditar(null);
            setModalEditarTagDisponivel(null);
            carregar();
            setToast('Pedido atualizado.');
            setTimeout(() => setToast(null), 3000);
          }}
          saving={saving}
          setSaving={setSaving}
        />
      )}

      {/* Modal Histórico */}
      {modalHistorico && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={fecharModalHistorico}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-historico-title"
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-600 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 id="modal-historico-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
                  Histórico — {modalHistorico.order_number}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Prazo original:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDate(modalHistorico.data_original ?? modalHistorico.current_promised_date)}
                  </span>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-0.5" title={modalHistorico.cliente_name ?? '—'}>
                  {modalHistorico.cliente_name ?? '—'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 truncate" title={modalHistorico.vendedor_name ?? '—'}>
                  {modalHistorico.vendedor_name ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                {modalHistorico.can_respond !== false ? (
                  <button
                    type="button"
                    onClick={abrirAtualizarDoHistorico}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition"
                  >
                    Atualizar
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Apenas visualização</span>
                )}
                <button
                  type="button"
                  onClick={fecharModalHistorico}
                  className="rounded-lg p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition"
                  aria-label="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {historyLoading ? (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-12 text-slate-600 dark:text-slate-400"
                  role="status"
                  aria-live="polite"
                >
                  <svg
                    className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="text-sm font-medium">Carregando informações…</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 text-center max-w-xs">
                    Aguarde o histórico completo antes de decidir ou fechar.
                  </p>
                </div>
              ) : history.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhum registro.</p>
              ) : (
                <ul className="space-y-4">
                  {history.map((h) => {
                    const prazoOriginal =
                      historicoPrazoOriginal ?? modalHistorico?.data_original ?? null;
                    const isCreate = h.action_type === 'CREATE';
                    const obsStr = h.observation != null && String(h.observation).trim() !== '' ? String(h.observation).trim() : '';
                    const linhaPrevisao = formatLinhaPrevisaoHistorico({
                      actionType: h.action_type,
                      previousDate: h.previous_date,
                      newDate: h.new_date,
                      prazoOriginal,
                    });
                    const linhaConteudo =
                      h.action_type === 'UPDATE' && obsStr
                        ? obsStr
                        : h.action_type === 'AUTO_ATENDIDO'
                          ? 'Atendido automaticamente'
                          : h.action_type === 'TAG_DISPONIVEL_TRUE'
                            ? 'Marcado como disponível'
                            : h.action_type === 'TAG_DISPONIVEL_FALSE'
                              ? 'Marcado como não disponível'
                              : null;
                    const linhaCabecalho = [h.user_name || 'Sistema', h.created_at ? formatDateTime(h.created_at) : '']
                      .filter(Boolean)
                      .join(' em ');
                    const tone = historicoEventTone(h.action_type, linhaPrevisao, linhaConteudo ?? linhaPrevisao);
                    const isBoxed = tone !== 'default';
                    const box = isBoxed ? HISTORICO_EVENT_BOX[tone] : null;
                    const linhasCorpoBoxed: string[] = [];
                    if (isCreate || tone === 'previsao') {
                      if (linhaPrevisao) linhasCorpoBoxed.push(linhaPrevisao);
                      if (obsStr) linhasCorpoBoxed.push(obsStr);
                    }
                    return (
                      <li
                        key={h.id}
                        className={
                          isBoxed
                            ? box!.li
                            : 'relative pl-4 pb-1 border-l-2 border-primary-500 dark:border-primary-400 last:pb-0'
                        }
                      >
                        {isBoxed ? (
                          <>
                            <span className={box!.badge}>
                              <span className={box!.dot} aria-hidden />
                              <span>
                                {HISTORICO_EVENT_BADGE_TITULO[tone]}
                                {linhaCabecalho ? (
                                  <span className={box!.badgeSub}>
                                    {' — '}
                                    {linhaCabecalho}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            {linhasCorpoBoxed.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {linhasCorpoBoxed.map((linha, idx) => (
                                  <p key={idx} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {linha}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{linhaCabecalho}</p>
                            {linhaConteudo ? (
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{linhaConteudo}</p>
                            ) : null}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {modalEditarResponsavel && (
        <ModalEditarResponsavel
          order={modalEditarResponsavel}
          users={usersResponsavel}
          loadingUsers={loadingUsersResp}
          saving={savingResponsible}
          onClose={() => setModalEditarResponsavel(null)}
          onSubmit={async (userId) => {
            setSavingResponsible(true);
            try {
              await setSycroOrderResponsible(modalEditarResponsavel.id, { responsible_user_id: userId });
              setModalEditarResponsavel(null);
              await carregar();
              setToast('Segundo responsável atualizado.');
              setTimeout(() => setToast(null), 3000);
            } catch (err) {
              setToast(err instanceof Error ? err.message : 'Erro ao atualizar responsável.');
              setTimeout(() => setToast(null), 3500);
            } finally {
              setSavingResponsible(false);
            }
          }}
        />
      )}

      {/* Modal Notificações */}
      {modalNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setModalNotif(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notificações</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('nao_lidas')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                      notifFilter === 'nao_lidas'
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Não lidas
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('lidas')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                      notifFilter === 'lidas'
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Lidas
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('todas')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                      notifFilter === 'todas'
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Todas
                  </button>
                </div>
                <button type="button" onClick={marcarLidas} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">Marcar como lidas</button>
                <button type="button" onClick={() => setModalNotif(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {(() => {
                const list = notifications.filter((n) => {
                  if (notifFilter === 'todas') return true;
                  if (notifFilter === 'lidas') return !!n.is_read;
                  return !n.is_read;
                });
                if (list.length === 0) return <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma notificação.</p>;
                return (
                  <ul className="space-y-2">
                    {list.map((n) => (
                      <li
                        key={n.id}
                        className={`text-sm py-2 px-3 rounded-lg flex flex-col gap-1 ${
                          n.is_read
                            ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                            : 'bg-primary-50 dark:bg-primary-900/20 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            disabled={!n.order_id}
                            title={!n.order_id ? 'Notificação sem pedido vinculado' : 'Abrir histórico do pedido'}
                            onClick={() => void abrirHistoricoPorNotificacao(n)}
                            className={`text-left flex-1 min-w-0 rounded-md -m-1 p-1 transition ${
                              n.order_id
                                ? 'hover:bg-slate-100/80 dark:hover:bg-slate-700/50 cursor-pointer'
                                : 'cursor-not-allowed opacity-70'
                            }`}
                          >
                            {n.message}
                          </button>
                          <button
                            type="button"
                            disabled={notifTogglingId === n.id}
                            onClick={() => {
                              const nextRead = !n.is_read;
                              setNotifTogglingId(n.id);
                              setSycroOrderNotificationRead(n.id, { read: nextRead })
                                .then(() => {
                                  setNotifications((prev) =>
                                    prev.map((x) => (x.id === n.id ? { ...x, is_read: nextRead ? 1 : 0 } : x))
                                  );
                                  window.dispatchEvent(new CustomEvent('sycroorder:notificationsUpdated'));
                                })
                                .catch(() => {})
                                .finally(() => setNotifTogglingId(null));
                            }}
                            className={`shrink-0 text-xs rounded px-2 py-1 border transition ${
                              n.is_read
                                ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                : 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                            }`}
                            title={n.is_read ? 'Marcar como não lida' : 'Marcar como lida'}
                          >
                            {n.is_read ? 'Não lida' : 'Lida'}
                          </button>
                        </div>
                        <span className="block text-xs text-slate-500 dark:text-slate-500 mt-1">{formatDateTime(n.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Três posições: esquerda = não (respondido), meio = indefinido (obrigatório escolher ao salvar com comentário), direita = sim. */
type AguardaRespostaTri = 'unset' | 'nao' | 'sim';

type AguardaRespostaDestinoTime = 'unset' | 'comercial' | 'nao_comercial';

function AguardaRespostaDestinoTimeToggle({
  value,
  onChange,
  disabled,
  highlight,
}: {
  value: AguardaRespostaDestinoTime;
  onChange: (v: AguardaRespostaDestinoTime) => void;
  disabled?: boolean;
  /** Destaque quando a escolha é obrigatória e ainda não foi feita. */
  highlight?: boolean;
}) {
  const seg = (key: Exclude<AguardaRespostaDestinoTime, 'unset'>, label: string) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={() => onChange(key)}
      className={`px-2.5 py-1 rounded-md transition text-[11px] font-medium ${
        value === key
          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="shrink-0 w-full sm:w-auto font-medium">Aguarda resposta de</span>
      <div
        className={`inline-flex rounded-lg border p-0.5 ${
          highlight
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/50'
            : 'border-slate-300 dark:border-slate-600 bg-slate-100/90 dark:bg-slate-900/70'
        }`}
        role="group"
        aria-label="Time que deve responder"
      >
        {seg('comercial', 'Time comercial')}
        {seg('nao_comercial', 'Time não comercial')}
      </div>
    </div>
  );
}

function AguardaRespostaCommentToggle({
  value,
  onChange,
  disabled,
}: {
  value: AguardaRespostaTri;
  onChange: (v: AguardaRespostaTri) => void;
  disabled?: boolean;
}) {
  const seg = (key: AguardaRespostaTri, label: string) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={() => onChange(key)}
      className={`px-2.5 py-1 rounded-md transition text-[11px] font-medium min-w-[2.75rem] ${
        value === key
          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="shrink-0">Aguarda resposta</span>
      <div
        className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 p-0.5 bg-slate-100/90 dark:bg-slate-900/70"
        role="group"
        aria-label="Aguarda resposta ao comentário"
      >
        {seg('nao', 'Não')}
        {seg('unset', '—')}
        {seg('sim', 'Sim')}
      </div>
    </div>
  );
}

function ModalNovoPedido({
  onClose,
  onSuccess,
  saving,
  setSaving,
}: {
  onClose: () => void;
  onSuccess: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const { isCommercialTeam, login, hasPermission } = useAuth();
  const canEditResponsible =
    hasPermission(PERMISSOES.COMUNICACAO_EDITAR_RESPONSAVEL_CARD) ||
    hasPermission(PERMISSOES.COMUNICACAO_TOTAL);
  const [pedidosErpList, setPedidosErpList] = useState<SycroOrderPedidoErp[]>([]);
  const [pedidosErpOptions, setPedidosErpOptions] = useState<OptionItem[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<OptionItem | null>(null);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [searchPedidoLoading, setSearchPedidoLoading] = useState(false);
  const [delivery_method, setDelivery_method] = useState('');
  const [observation, setObservation] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedIdPedidos, setSelectedIdPedidos] = useState<Set<string>>(new Set());
  const [modalSelecionarCarrada, setModalSelecionarCarrada] = useState(false);
  const [carradasDisponiveis, setCarradasDisponiveis] = useState<Array<{ rota: string; itens: ItemPedido[] }>>([]);
  const [carradaEscolhida, setCarradaEscolhida] = useState<string>('');
  const [usersResponsavel, setUsersResponsavel] = useState<Array<{ id: number; login: string; nome: string | null }>>([]);
  const [loadingUsersResp, setLoadingUsersResp] = useState(false);
  /** Um único usuário opcional com permissão de atualizar card. */
  const [responsibleUserId, setResponsibleUserId] = useState<number | ''>('');
  // Na criação, o card SEMPRE nasce como "aguarda resposta" (toggle travado em "Sim").
  const [aguardaRespostaTri, setAguardaRespostaTri] = useState<AguardaRespostaTri>('sim');
  /** Só fecha pelo overlay se o pressionar começou no backdrop (evita fechar ao soltar após redimensionar o modal). */
  const pointerStartedOnBackdropNovo = useRef(false);

  const selectedPedidoFull = selectedPedido ? pedidosErpList.find((p) => p.id === selectedPedido.id) : null;

  const usersResponsavelSorted = [...usersResponsavel].sort((a, b) => {
    const aa = String(a.login ?? '').trim();
    const bb = String(b.login ?? '').trim();
    return aa.localeCompare(bb, 'pt-BR');
  });

  useEffect(() => {
    let cancelled = false;
    if (isCommercialTeam) {
      setUsersResponsavel([]);
      setLoadingUsersResp(false);
      return;
    }
    setLoadingUsersResp(true);
    getSycroOrderUsersResponsavel()
      .then((list) => {
        if (!cancelled) setUsersResponsavel(list);
      })
      .catch(() => {
        if (!cancelled) setUsersResponsavel([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsersResp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCommercialTeam]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPedidos(true);
    getSycroOrderPedidosErp()
      .then((list) => {
        if (cancelled) return;
        setPedidosErpList(list);
        const opts: OptionItem[] = list.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatDate(p.dataEmissao)}`,
        }));
        setPedidosErpOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setPedidosErpList([]);
        if (!cancelled) setPedidosErpOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPedidos(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSearchPedido = useCallback((term: string) => {
    const t = term.trim();
    if (!t) {
      setSearchPedidoLoading(false);
      getSycroOrderPedidosErp().then((list) => {
        setPedidosErpList(list);
        setPedidosErpOptions(list.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatDate(p.dataEmissao)}`,
        })));
      }).catch(() => {});
      return;
    }
    setSearchPedidoLoading(true);
    getSycroOrderPedidosErp({ nome: t })
      .then((list) => {
        setPedidosErpList(list);
        setPedidosErpOptions(list.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: `Cliente: ${p.cliente ?? '—'} — Emissão: ${formatDate(p.dataEmissao)}`,
        })));
      })
      .catch(() => {
        setPedidosErpList([]);
        setPedidosErpOptions([]);
      })
      .finally(() => setSearchPedidoLoading(false));
  }, []);

  const handleSelectPedido = (value: OptionItem | null) => {
    setSelectedPedido(value);
    const pedido = value ? pedidosErpList.find((p) => p.id === value.id) : null;
    setDelivery_method(pedido?.rota ?? '');
    setCarradasDisponiveis([]);
    setCarradaEscolhida('');
    setModalSelecionarCarrada(false);
  };

  useEffect(() => {
    const pdRaw = (selectedPedido?.nome ?? '').trim();
    // Normaliza para extrair apenas números (ex.: "PD 47483" -> "47483"),
    // evitando problemas com espaços/formatos diferentes do rótulo exibido.
    const pdDigits = pdRaw.replace(/\D+/g, '');
    const pd = pdDigits || pdRaw;
    if (!pdRaw) {
      setItensPedido([]);
      setSelectedIdPedidos(new Set());
      setCarradasDisponiveis([]);
      setCarradaEscolhida('');
      setModalSelecionarCarrada(false);
      return;
    }
    let cancelled = false;
    setLoadingItens(true);
    listarPedidos({ pd, limit: 500 })
      .then((res) => {
        if (cancelled) return;
        const itens: ItemPedido[] = (res.data ?? [])
          .map((row: Record<string, unknown>) => ({
            id_pedido: String(row.id_pedido ?? '').trim(),
            cod: String(row.Cod ?? row.cod ?? '—').trim(),
            descricao: String(row['Descricao do produto'] ?? row.descricao ?? '—').trim(),
            rota: String(row['Observacoes'] ?? row['Observações'] ?? row['Rota'] ?? row['rota'] ?? '').trim(),
            qtde: Number(row['Qtde Pendente Real'] ?? row.qtde ?? row['Qtde pedida'] ?? 0) || 0,
          }))
          .filter((i) => i.id_pedido);
        const itensOrdenados = [...itens].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
        const carradasMap = new Map<string, ItemPedido[]>();
        for (const item of itensOrdenados) {
          const rota = (item.rota ?? '').trim();
          if (!isCarradaRota(rota)) continue;
          const arr = carradasMap.get(rota) ?? [];
          arr.push(item);
          carradasMap.set(rota, arr);
        }
        const carradas = [...carradasMap.entries()]
          .map(([rota, itensRota]) => ({ rota, itens: itensRota }))
          .sort((a, b) => a.rota.localeCompare(b.rota, 'pt-BR'));

        if (carradas.length > 1) {
          setCarradasDisponiveis(carradas);
          setCarradaEscolhida(carradas[0]?.rota ?? '');
          setItensPedido([]);
          setSelectedIdPedidos(new Set());
          setModalSelecionarCarrada(true);
        } else {
          setCarradasDisponiveis(carradas);
          setCarradaEscolhida(carradas[0]?.rota ?? '');
          setModalSelecionarCarrada(false);
          setItensPedido(itensOrdenados);
          setSelectedIdPedidos(new Set(itensOrdenados.map((i) => i.id_pedido)));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setItensPedido([]);
        setSelectedIdPedidos(new Set());
        setCarradasDisponiveis([]);
        setCarradaEscolhida('');
        setModalSelecionarCarrada(false);
        // Se a listagem falhar (ex.: permissões), manter UI coerente e mostrar motivo ao usuário.
        setErro('Erro ao carregar os itens do pedido. Verifique suas permissões e tente novamente.');
      })
      .finally(() => {
        if (!cancelled) setLoadingItens(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPedido?.nome]);

  const toggleItemNovo = (id: string) => {
    setSelectedIdPedidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const order_number = selectedPedido?.nome ?? '';
    if (!order_number.trim() || !delivery_method.trim()) {
      setErro('Selecione o pedido (ERP) e a forma de entrega.');
      return;
    }
    if (modalSelecionarCarrada) {
      setErro('Selecione uma única carrada/rota para continuar.');
      return;
    }
    if (selectedIdPedidos.size === 0) {
      setErro('Selecione ao menos um item do pedido.');
      return;
    }
    if (!isCommercialTeam) {
      if (!canEditResponsible) {
        setErro('Seu perfil não possui permissão para editar responsável pelo card.');
        return;
      }
      if (responsibleUserId === '') {
        setErro('Para este perfil, o responsável adicional é obrigatório e deve pertencer ao Time comercial.');
        return;
      }
    }
    setSaving(true);
    try {
      const dataOriginal = selectedPedidoFull?.dataOriginalEntrega;
      const promisedDate = (dataOriginal && String(dataOriginal).trim().slice(0, 10)) || new Date().toISOString().slice(0, 10);
      await createSycroOrderOrder({
        order_number: order_number.trim(),
        delivery_method: delivery_method.trim(),
        promised_date: promisedDate,
        observation: observation.trim() || undefined,
        id_pedidos: [...selectedIdPedidos],
        responsible_user_id: isCommercialTeam ? undefined : (responsibleUserId === '' ? undefined : responsibleUserId),
        // Força o comportamento: na criação, nasce como "aguarda resposta".
        aguarda_resposta: true,
      });
      onSuccess();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onPointerDown={(e) => {
        pointerStartedOnBackdropNovo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pointerStartedOnBackdropNovo.current) onClose();
        pointerStartedOnBackdropNovo.current = false;
      }}
    >
      <div
        className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full min-w-[min(100%,280px)] max-w-[min(96vw,48rem)] min-h-[200px] max-h-[90vh] resize overflow-auto"
        title="Arraste o canto inferior direito para redimensionar"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} className="p-4 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Novo Card</h3>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número do pedido *</label>
            <SingleSelectWithSearch
              label=""
              placeholder="Pesquisar e selecionar pedido (ERP)..."
              options={pedidosErpOptions}
              value={selectedPedido}
              onChange={handleSelectPedido}
              onSearchChange={handleSearchPedido}
              searchLoading={searchPedidoLoading}
              labelClass="sr-only"
              inputClass="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
              listMaxHeight="180px"
              clearable
            />
            {(loadingPedidos || searchPedidoLoading) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {loadingPedidos ? 'Carregando pedidos do ERP...' : 'Buscando...'}
              </p>
            )}
          </div>
          {selectedPedidoFull && (
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Original de Entrega</label>
                <HelpTooltipIcon text="Conforme Gerenciador de Pedidos" />
              </div>
              <p className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-sm">
                {selectedPedidoFull.dataOriginalEntrega ? formatDate(selectedPedidoFull.dataOriginalEntrega) : '—'}
              </p>

              {!isCommercialTeam && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Previsão atual</label>
                    <HelpTooltipIcon text="Conforme Gerenciador de Pedidos" />
                  </div>
                  <p className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-sm">
                    {selectedPedidoFull.previsao_atual
                      ? formatDate(selectedPedidoFull.previsao_atual)
                      : selectedPedidoFull.dataEntregaPadrao
                        ? formatDate(selectedPedidoFull.dataEntregaPadrao)
                        : '—'}
                  </p>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Forma de entrega *</label>
            <input
              type="text"
              value={delivery_method}
              onChange={(e) => setDelivery_method(e.target.value)}
              placeholder="Preenchido pela rota do pedido ao selecionar"
              disabled={!!selectedPedidoFull}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-80 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
              required
            />
            {delivery_method.trim() ? (
              <p className="mt-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium">
                {formatResponsavelLine(
                  delivery_method,
                  isCommercialTeam
                    ? (login ?? null)
                    : responsibleUserId === ''
                      ? null
                      : usersResponsavel.find((u) => u.id === responsibleUserId)?.login ?? null
                )}
              </p>
            ) : null}
          </div>
          {!isCommercialTeam && (
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Responsável adicional por responder (obrigatório)
                </label>
                <HelpTooltipIcon text="Selecione o segundo responsável do card. A lista traz apenas usuários do Time comercial com acesso à Comunicação PD." />
              </div>
              {loadingUsersResp ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Carregando usuários...</p>
              ) : (
                <select
                  value={responsibleUserId === '' ? '' : String(responsibleUserId)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setResponsibleUserId(v === '' ? '' : parseInt(v, 10));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
                  required
                >
                  <option value="">Selecione...</option>
                  {usersResponsavelSorted.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.login}
                      {u.nome ? ` — ${u.nome}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div>
            <CampoLabelComAjuda label="Mensagem" ajuda={AJUDA_CAMPO_MENSAGEM} />
            <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
            <div className="mt-2">
              <AguardaRespostaCommentToggle value={aguardaRespostaTri} onChange={setAguardaRespostaTri} disabled={true} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Itens do pedido</label>
              <HelpTooltipIcon text="Escolha quais itens esse card vai acompanhar (evita duplicidade por itens)." />
            </div>
            {loadingItens ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Carregando itens...</p>
            ) : itensPedido.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Nenhum item encontrado para este pedido.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIdPedidos(new Set(itensPedido.map((i) => i.id_pedido)))}
                    disabled={modalSelecionarCarrada}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIdPedidos(new Set())}
                    disabled={modalSelecionarCarrada}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                  >
                    Limpar seleção
                  </button>
                </div>
                <div className="overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 max-h-40 bg-slate-50 dark:bg-slate-800/50">
                  {itensPedido.map((item) => (
                    <label key={item.id_pedido} className="flex items-start gap-2 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-2">
                      <input
                        type="checkbox"
                        checked={selectedIdPedidos.has(item.id_pedido)}
                        onChange={() => toggleItemNovo(item.id_pedido)}
                        disabled={modalSelecionarCarrada}
                        className="mt-1 rounded border-slate-300 dark:border-slate-600"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200">
                        <strong>{item.cod}</strong> — {item.descricao}
                      </span>
                    </label>
                  ))}
                </div>
                {modalSelecionarCarrada && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Este pedido possui itens em mais de uma carrada. Selecione uma única rota na janela abaixo para continuar.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50">Criar</button>
          </div>
        </form>

        {modalSelecionarCarrada && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl card-panel shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Selecione uma carrada para abrir o card</h4>
                <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕</button>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Este pedido possui itens em mais de uma carrada (rota iniciada por "ROTA"). Para evitar mistura de cargas, escolha apenas uma rota.
                </p>
                {carradasDisponiveis.map((c) => (
                  <div key={c.rota} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="carrada-rota"
                        checked={carradaEscolhida === c.rota}
                        onChange={() => setCarradaEscolhida(c.rota)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                      {c.rota}
                    </label>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-slate-700 dark:text-slate-300">
                        <thead>
                          <tr className="text-left">
                            <th className="py-1 pr-2">Código</th>
                            <th className="py-1 pr-2">Descrição</th>
                            <th className="py-1">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.itens.map((i) => (
                            <tr key={`${c.rota}-${i.id_pedido}`}>
                              <td className="py-1 pr-2 whitespace-nowrap">{i.cod}</td>
                              <td className="py-1 pr-2">{i.descricao}</td>
                              <td className="py-1 whitespace-nowrap">{i.qtde ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300">Cancelar</button>
                <button
                  type="button"
                  onClick={() => {
                    const selected = carradasDisponiveis.find((c) => c.rota === carradaEscolhida);
                    if (!selected) return;
                    setDelivery_method(selected.rota);
                    setItensPedido(selected.itens);
                    setSelectedIdPedidos(new Set(selected.itens.map((i) => i.id_pedido)));
                    setModalSelecionarCarrada(false);
                  }}
                  disabled={!carradaEscolhida}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  Confirmar rota
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type DialogStep = null | 'carrada_confirm' | 'todos_itens' | 'sim_motivo' | 'nao_itens';

interface ItemPedido {
  id_pedido: string;
  cod: string;
  descricao: string;
  rota?: string;
  qtde?: number;
}

function ModalEditarResponsavel({
  order,
  users,
  loadingUsers,
  saving,
  onClose,
  onSubmit,
}: {
  order: Order;
  users: Array<{ id: number; login: string; nome: string | null }>;
  loadingUsers: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (userId: number) => Promise<void>;
}) {
  const [selectedUserId, setSelectedUserId] = useState<number | ''>(order.responsible_user_id ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const pointerStartedOnBackdropResp = useRef(false);
  const usersSorted = [...users].sort((a, b) => String(a.login ?? '').localeCompare(String(b.login ?? ''), 'pt-BR'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (selectedUserId === '' || !Number.isFinite(selectedUserId)) {
      setErro('Selecione o segundo responsável.');
      return;
    }
    await onSubmit(selectedUserId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onPointerDown={(e) => {
        pointerStartedOnBackdropResp.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pointerStartedOnBackdropResp.current) onClose();
        pointerStartedOnBackdropResp.current = false;
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Editar segundo responsável — {order.order_number}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Apenas o segundo responsável pode ser alterado. O responsável primário (regra da forma de entrega) permanece inalterado.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          {loadingUsers ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Carregando usuários...</p>
          ) : (
            <select
              value={selectedUserId === '' ? '' : String(selectedUserId)}
              onChange={(e) => setSelectedUserId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
              required
            >
              <option value="">Selecione...</option>
              {usersSorted.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.login}
                  {u.nome ? ` — ${u.nome}` : ''}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving || loadingUsers} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalAtualizarPedido({
  order,
  tagDisponivelToSet,
  onClose,
  onSuccess,
  saving,
  setSaving,
}: {
  order: Order;
  tagDisponivelToSet?: boolean | null;
  onClose: () => void;
  onSuccess: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const { login, grupo, isMaster, isCommercialTeam } = useAuth();
  const podeGerenciarMotivos =
    isMaster || login === 'admin' || grupo === 'admin' || grupo === 'Administrador' || grupo === 'Master';
  const isAdminGrupo = (grupo ?? '').toLowerCase() === 'admin' || (grupo ?? '').toLowerCase() === 'administrador';
  const isCommentOnlyUser =
    SYCRO_ORDER_COMMERCIAL_AUTHOR_LOGINS.has((login ?? '').trim().toLowerCase()) && !isAdminGrupo;
  const autorTimeComercial = isSycroOrderCommercialAuthor(login, isCommercialTeam);

  const [querInformarNovaData, setQuerInformarNovaData] = useState<'sim' | 'nao' | null>(null);
  // Quando o usuário escolher "Sim", o campo deve aparecer vazio e ser obrigatório.
  const [new_date, setNew_date] = useState('');
  const [observation, setObservation] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCandidates, setMentionCandidates] = useState<Array<{ login: string; nome: string | null }>>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [aguardaRespostaTri, setAguardaRespostaTri] = useState<AguardaRespostaTri>('unset');
  const [aguardaRespostaDestinoTime, setAguardaRespostaDestinoTime] = useState<AguardaRespostaDestinoTime>('unset');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const q = mentionQuery.trim();
    if (!q || q.length < 2 || !mentionOpen) {
      setMentionCandidates([]);
      return;
    }
    let cancelled = false;
    setMentionLoading(true);
    searchSycroOrderUsers(q)
      .then((list) => {
        if (cancelled) return;
        setMentionCandidates(list);
      })
      .catch(() => {
        if (cancelled) return;
        setMentionCandidates([]);
      })
      .finally(() => {
        if (cancelled) return;
        setMentionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mentionQuery, mentionOpen, isCommentOnlyUser]);

  useEffect(() => {
    setAguardaRespostaTri('unset');
    setAguardaRespostaDestinoTime('unset');
  }, [order.id]);

  const exigeDestinoTime = !autorTimeComercial && aguardaRespostaTri === 'sim';

  const validarAguardaResposta = (): boolean => {
    if (observation.trim() && aguardaRespostaTri === 'unset') {
      setErro('Indique se aguarda resposta (Não ou Sim).');
      return false;
    }
    if (exigeDestinoTime && aguardaRespostaDestinoTime === 'unset') {
      setErro('Selecione se aguarda resposta do time comercial ou do time não comercial.');
      return false;
    }
    return true;
  };

  const onChangeDestinoTime = (v: AguardaRespostaDestinoTime) => {
    setAguardaRespostaDestinoTime(v);
    if (v !== 'unset') setErro(null);
  };

  const [dialogStep, setDialogStep] = useState<DialogStep>(null);
  const [carradaCheckLoading, setCarradaCheckLoading] = useState(false);
  const [carradaConfirmRota, setCarradaConfirmRota] = useState('');
  /** Usuário confirmou replicar data para todos os itens da mesma rota/carrada no Gerenciador. */
  const [replicateCarradaConfirmed, setReplicateCarradaConfirmed] = useState(false);
  const [motivos, setMotivos] = useState<MotivoSugestao[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedIdPedidos, setSelectedIdPedidos] = useState<Set<string>>(new Set());
  const [observacaoItens, setObservacaoItens] = useState('');
  const [observacaoSim, setObservacaoSim] = useState('');
  const [abrirGerenciarMotivos, setAbrirGerenciarMotivos] = useState(false);
  const pointerStartedOnBackdropAtualizar = useRef(false);

  const novaDataPreenchida = new_date.trim() !== '';
  const dataAlterada =
    novaDataPreenchida && normalizeDateKeyForCompare(new_date) !== normalizeDateKeyForCompare(order.current_promised_date);

  const carregarMotivos = useCallback(() => {
    setLoadingMotivos(true);
    listarMotivosSugestao()
      .then(setMotivos)
      .catch(() => setMotivos([]))
      .finally(() => setLoadingMotivos(false));
  }, []);

  const handleSalvarClick = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!validarAguardaResposta()) return;
    if (isCommentOnlyUser) {
      if (!observation.trim()) {
        setErro('Comentário é obrigatório.');
        return;
      }
      submitDireto();
      return;
    }
    if (querInformarNovaData === null) {
      setErro('Selecione "sim" ou "Não".');
      return;
    }
    if (querInformarNovaData !== 'sim') {
      if (!observation.trim()) {
        setErro('Comentário é obrigatório quando não informar uma nova data prometida.');
        return;
      }
      submitDireto();
      return;
    }
    if (querInformarNovaData === 'sim' && !new_date.trim()) {
      setErro('Nova data prometida é obrigatória.');
      return;
    }

    if (querInformarNovaData === 'sim' && novaDataPreenchida && !dataAlterada) {
      setErro('Informe uma data diferente da data prometida atual do card para continuar (ou escolha "Não" se for apenas comentário).');
      return;
    }

    if (dataAlterada) {
      const dm = (order.delivery_method ?? '').trim();
      if (isExcludedSqlRotaCategory(dm) || !isCarradaRota(dm)) {
        setReplicateCarradaConfirmed(false);
        setDialogStep('todos_itens');
        return;
      }
      setCarradaCheckLoading(true);
      try {
        // Importante: GET /api/pedidos sem filtro retorna só a 1ª página (ex.: 500 linhas) do total do ERP.
        // Filtramos pela própria rota (observacoes) para trazer só as linhas dessa carrada e contar PDs corretamente.
        const res = await listarPedidos({ observacoes: dm, limit: 500, page: 1 });
        if (res.erroConexao) {
          setErro(`Não foi possível consultar o Gerenciador de Pedidos: ${res.erroConexao}`);
          return;
        }
        const rows = res.data ?? [];
        const pds = new Set(
          rows.map((r) => normalizePdLabelForCompare(String((r as Record<string, unknown>)['PD'] ?? '').trim())).filter(Boolean)
        );
        if (pds.size > 1) {
          setCarradaConfirmRota(dm);
          setDialogStep('carrada_confirm');
        } else {
          setReplicateCarradaConfirmed(false);
          setDialogStep('todos_itens');
        }
      } catch {
        setErro('Erro ao consultar o Gerenciador de Pedidos. Tente novamente.');
      } finally {
        setCarradaCheckLoading(false);
      }
      return;
    }
    // Escolheu informar nova data, mas não alterou: salva apenas com comentário (opcional)
    submitDireto();
  };

  const submitDireto = async (payload?: {
    motivo?: string;
    id_pedidos?: string[];
    observacao?: string;
    replicate_carrada?: boolean;
  }) => {
    const coment = observation.trim();
    if (!validarAguardaResposta()) return;
    setSaving(true);
    try {
      await updateSycroOrderOrder(order.id, {
        ...(isCommentOnlyUser ? {} : (querInformarNovaData === 'sim' ? { new_date: new_date.trim() || undefined } : {})),
        ...(tagDisponivelToSet === undefined || tagDisponivelToSet === null ? {} : { tag_disponivel: tagDisponivelToSet }),
        comentario: coment || undefined,
        aguarda_resposta: coment ? aguardaRespostaTri === 'sim' : undefined,
        ...(coment && aguardaRespostaTri === 'sim' && !autorTimeComercial && aguardaRespostaDestinoTime !== 'unset'
          ? { aguarda_resposta_destino_time: aguardaRespostaDestinoTime }
          : {}),
        observacao: payload?.observacao?.trim() || undefined,
        motivo: payload?.motivo?.trim() || undefined,
        id_pedidos: payload?.replicate_carrada ? undefined : payload?.id_pedidos?.length ? payload.id_pedidos : undefined,
        replicate_carrada: payload?.replicate_carrada === true ? true : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTodosItensSim = () => {
    setReplicateCarradaConfirmed(false);
    setDialogStep('sim_motivo');
    carregarMotivos();
  };

  const handleCarradaConfirmSim = () => {
    setReplicateCarradaConfirmed(true);
    setDialogStep('sim_motivo');
    carregarMotivos();
  };

  const handleCarradaConfirmNao = () => {
    setDialogStep(null);
    setQuerInformarNovaData(null);
    setNew_date(order.current_promised_date);
    setReplicateCarradaConfirmed(false);
    setErro(null);
  };

  const handleTodosItensNao = () => {
    setReplicateCarradaConfirmed(false);
    setDialogStep('nao_itens');
    setLoadingItens(true);
    listarPedidos({ pd: order.order_number, limit: 500 })
      .then((res) => {
        const itens: ItemPedido[] = (res.data ?? []).map((row: Record<string, unknown>) => ({
          id_pedido: String(row.id_pedido ?? '').trim(),
          cod: String(row.Cod ?? row.cod ?? '—').trim(),
          descricao: String(row['Descricao do produto'] ?? row.descricao ?? '—').trim(),
        })).filter((i) => i.id_pedido);
        const itensOrdenados = [...itens].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
        setItensPedido(itensOrdenados);
        setSelectedIdPedidos(new Set(itensOrdenados.map((i) => i.id_pedido)));
      })
      .catch(() => setItensPedido([]))
      .finally(() => setLoadingItens(false));
    carregarMotivos();
  };

  const toggleItem = (id: string) => {
    setSelectedIdPedidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmitSimMotivo = (e: React.FormEvent) => {
    e.preventDefault();
    const motivoTrim = motivo.trim();
    if (!motivoTrim) {
      setErro('Selecione um motivo.');
      return;
    }
    setErro(null);
    submitDireto({
      motivo: motivoTrim,
      observacao: observacaoSim.trim() || undefined,
      replicate_carrada: replicateCarradaConfirmed ? true : undefined,
    });
  };

  const handleSubmitNaoItens = (e: React.FormEvent) => {
    e.preventDefault();
    const motivoTrim = motivo.trim();
    if (!motivoTrim) {
      setErro('Selecione um motivo.');
      return;
    }
    const ids = [...selectedIdPedidos];
    if (ids.length === 0) {
      setErro('Selecione ao menos um item do pedido.');
      return;
    }
    setErro(null);
    submitDireto({ motivo: motivoTrim, id_pedidos: ids, observacao: observacaoItens.trim() || undefined });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onPointerDown={(e) => {
        pointerStartedOnBackdropAtualizar.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pointerStartedOnBackdropAtualizar.current) onClose();
        pointerStartedOnBackdropAtualizar.current = false;
      }}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full min-w-[min(100%,280px)] max-w-[min(96vw,48rem)] min-h-[200px] max-h-[90vh] resize overflow-auto"
        title="Arraste o canto inferior direito para redimensionar"
        onClick={(e) => e.stopPropagation()}
      >
        {dialogStep === null && (
          <form onSubmit={handleSalvarClick} className="p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Atualizar — {order.order_number}</h3>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            {!isCommentOnlyUser && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Deseja informar uma nova data prometida?</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuerInformarNovaData('sim');
                      setNew_date('');
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      querInformarNovaData === 'sim'
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuerInformarNovaData('nao');
                      setNew_date(order.current_promised_date);
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      querInformarNovaData === 'nao'
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    Não
                  </button>
                </div>
                {querInformarNovaData === 'sim' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova data prometida</label>
                    <input
                      type="date"
                      value={new_date}
                      onChange={(e) => setNew_date(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      Informe a nova data e clique em <strong>Salvar</strong>. Se a rota tiver mais de um pedido, será pedida uma confirmação antes do motivo.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div>
              <CampoLabelComAjuda label="Mensagem" ajuda={AJUDA_CAMPO_MENSAGEM} />
              <div className="relative">
                <textarea
                  value={observation}
                  onChange={(e) => {
                    const next = e.target.value;
                    setObservation(next);
                    const m = next.match(/@([a-zA-Z0-9_.]+)$/);
                    if (m && (m[1] ?? '').trim()) {
                      setMentionQuery(String(m[1] ?? '').trim());
                      setMentionOpen(true);
                    } else {
                      setMentionQuery('');
                      setMentionOpen(false);
                      setMentionCandidates([]);
                    }
                  }}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
                {mentionOpen && mentionCandidates.length > 0 && !mentionLoading && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
                    {mentionCandidates.map((u) => (
                      <button
                        key={u.login}
                        type="button"
                        onClick={() => {
                          setObservation((prev) => (prev ? prev.replace(/@([a-zA-Z0-9_.]+)$/, `@${u.login}`) : `@${u.login}`));
                          setMentionQuery('');
                          setMentionOpen(false);
                          setMentionCandidates([]);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200"
                      >
                        @{u.login}{u.nome ? ` — ${u.nome}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {mentionOpen && mentionLoading && (
                  <div className="absolute left-0 right-0 z-20 mt-1 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                    Buscando...
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-3">
                <AguardaRespostaCommentToggle
                  value={aguardaRespostaTri}
                  onChange={(v) => {
                    setAguardaRespostaTri(v);
                    if (v !== 'sim') {
                      setAguardaRespostaDestinoTime('unset');
                    } else if (!autorTimeComercial) {
                      setErro(null);
                    }
                  }}
                  disabled={saving}
                />
                {exigeDestinoTime ? (
                  <div className="space-y-2 border-t border-slate-200 dark:border-slate-600 pt-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Quem deve responder a este comentário?
                    </p>
                    <AguardaRespostaDestinoTimeToggle
                      value={aguardaRespostaDestinoTime}
                      onChange={onChangeDestinoTime}
                      disabled={saving}
                      highlight={aguardaRespostaDestinoTime === 'unset'}
                    />
                    {aguardaRespostaDestinoTime === 'unset' && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Obrigatório escolher uma opção acima para salvar com &quot;Aguarda resposta = Sim&quot;.
                      </p>
                    )}
                  </div>
                ) : autorTimeComercial && aguardaRespostaTri === 'sim' ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-600 pt-2">
                    Como você é do time comercial, o sistema encaminha a resposta automaticamente — não é necessário
                    escolher o time destinatário.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm">Cancelar</button>
              <button type="submit" disabled={saving || carradaCheckLoading} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50">
                {carradaCheckLoading ? 'Verificando rota...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}

        {dialogStep === 'carrada_confirm' && (
          <div className="p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Replicação na mesma carrada</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Este pedido está presente na <strong>{carradaConfirmRota}</strong> e a mesma possui outros pedidos. Quando você informar a nova data deste pedido, essa mesma data será replicada para todos os outros itens de pedido que também estão nessa ROTA (mesmo motivo e observação enviados ao Gerenciador de Pedidos). Deseja continuar?
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleCarradaConfirmSim} className="flex-1 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">
                Sim
              </button>
              <button type="button" onClick={handleCarradaConfirmNao} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium">
                Não
              </button>
            </div>
          </div>
        )}

        {dialogStep === 'todos_itens' && (
          <div className="p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Atualizar — {order.order_number}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">A alteração deve ser para todos os itens do pedido?</p>
            <div className="flex gap-3">
              <button type="button" onClick={handleTodosItensSim} className="flex-1 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">Sim</button>
              <button type="button" onClick={handleTodosItensNao} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium">Não</button>
            </div>
            <button type="button" onClick={() => setDialogStep(null)} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">Voltar</button>
          </div>
        )}

        {dialogStep === 'sim_motivo' && (
          <form onSubmit={handleSubmitSimMotivo} className="p-4 space-y-4 overflow-y-auto">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Atualizar — {order.order_number}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {replicateCarradaConfirmed
                ? 'A alteração será aplicada a todos os itens desta rota no Gerenciador (todos os pedidos que compartilham a mesma carrada). Selecione o motivo.'
                : 'Alteração para todos os itens deste pedido. Selecione o motivo.'}
            </p>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
                {podeGerenciarMotivos && (
                  <button type="button" onClick={() => setAbrirGerenciarMotivos(true)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline" title="Gerenciar motivos">Gerenciar motivos</button>
                )}
              </div>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" required>
                <option value="">Selecione um motivo</option>
                {motivos.map((m) => (
                  <option key={m.id} value={m.descricao}>{m.descricao}</option>
                ))}
              </select>
              {loadingMotivos && <p className="text-xs text-slate-500 mt-1">Carregando motivos...</p>}
            </div>
            <div>
              <CampoLabelComAjuda label="Observação" ajuda={AJUDA_CAMPO_OBSERVACAO} />
              <textarea value={observacaoSim} onChange={(e) => setObservacaoSim(e.target.value)} rows={2} placeholder="Opcional" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-500" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (replicateCarradaConfirmed) {
                    setDialogStep('carrada_confirm');
                  } else {
                    setDialogStep('todos_itens');
                  }
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm"
              >
                Voltar
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50">Salvar</button>
            </div>
          </form>
        )}

        {dialogStep === 'nao_itens' && (
          <form onSubmit={handleSubmitNaoItens} className="p-4 flex flex-col min-h-0 flex-1 overflow-hidden">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">Atualizar — {order.order_number}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 shrink-0 mb-2">Selecione os itens que devem receber o ajuste e o motivo.</p>
            {erro && <p className="text-sm text-red-600 dark:text-red-400 shrink-0">{erro}</p>}
            {loadingItens ? (
              <p className="text-sm text-slate-500 py-4">Carregando itens...</p>
            ) : (
              <>
                <div className="mb-3 overflow-y-auto flex-1 min-h-0 border border-slate-200 dark:border-slate-600 rounded-lg p-2 max-h-48">
                  {itensPedido.map((item) => (
                    <label key={item.id_pedido} className="flex items-start gap-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-2">
                      <input type="checkbox" checked={selectedIdPedidos.has(item.id_pedido)} onChange={() => toggleItem(item.id_pedido)} className="mt-1 rounded border-slate-300 dark:border-slate-600" />
                      <span className="text-sm text-slate-800 dark:text-slate-200"><strong>{item.cod}</strong> — {item.descricao}</span>
                    </label>
                  ))}
                </div>
                <div className="shrink-0 mb-3">
                  <CampoLabelComAjuda label="Observação" ajuda={AJUDA_CAMPO_OBSERVACAO} />
                  <textarea value={observacaoItens} onChange={(e) => setObservacaoItens(e.target.value)} rows={2} placeholder="Opcional" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-500" />
                </div>
                <div className="shrink-0 mb-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
                    {podeGerenciarMotivos && (
                      <button type="button" onClick={() => setAbrirGerenciarMotivos(true)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Gerenciar motivos</button>
                    )}
                  </div>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" required>
                    <option value="">Selecione um motivo</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.descricao}>{m.descricao}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2 shrink-0">
                  <button type="button" onClick={() => setDialogStep('todos_itens')} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm">Voltar</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50">Salvar</button>
                </div>
              </>
            )}
          </form>
        )}

        {abrirGerenciarMotivos && podeGerenciarMotivos && (
          <ModalGerenciarMotivos
            onClose={() => setAbrirGerenciarMotivos(false)}
            onError={(msg) => setErro(msg)}
            onAtualizado={carregarMotivos}
          />
        )}
      </div>
    </div>
  );
}
