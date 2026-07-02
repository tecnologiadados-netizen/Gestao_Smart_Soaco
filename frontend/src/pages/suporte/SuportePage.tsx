import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  podeAbrirChamadoSuporte,
  podeAlterarStatusChamadoSuporte,
  podeResponderChamadoSuporte,
  podeVerTodosChamadosSuporte,
} from '../../utils/suportePermissoes';
import {
  createSupportMessage,
  createSupportTicket,
  FILTRO_STATUS_EXCLUIR_FECHADO,
  getSupportTicket,
  listSupportCatalog,
  listSupportModulosArea,
  listSupportTickets,
  type ModuloAreaOption,
  setSupportTicketRead,
  updateSupportStatus,
  updateSupportPrioridade,
  PRIORIDADE_PADRAO_CHAMADO,
  type SupportAttachmentInput,
  type SupportCatalogItem,
  type SupportTicketDetail,
  type SupportTicketListItem,
} from '../../api/suporte';
import { SuporteAnexosComPaste, fileToSupportAttachment } from '../../components/suporte/SuporteAnexosComPaste';
import { SuporteAnexoPreviewModal } from '../../components/suporte/SuporteAnexoPreviewModal';
import { resolveUploadUrl } from '../../api/client';
import { listModulosAreaParaUsuario } from '../../config/modulosNavTop';

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm';

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
  em_analise: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  aguardando_resposta_usuario: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  stand_by: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  fechado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  resolvido: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
};

const PRIORITY_BADGE: Record<string, string> = {
  a_definir: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  baixa: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  media: 'bg-primary-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  alta: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  critica: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
};

function toBrDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('pt-BR');
}

function labelMap(items: SupportCatalogItem[], kind: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items) {
    if (it.kind === kind) m.set(it.code, it.label);
  }
  return m;
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);

/** Anexo que pode ser mostrado em overlay (evita sair da tela do chamado). */
function isPreviewableImageAttachment(mimeType: string, originalName: string): boolean {
  const mime = String(mimeType ?? '').trim().toLowerCase();
  if (mime.startsWith('image/')) return true;
  const ext = originalName.includes('.') ? originalName.split('.').pop()?.toLowerCase() ?? '' : '';
  return IMAGE_EXT.has(ext);
}

type AnexoRef = { id: number; url: string; originalName: string; mimeType: string };

function AnexoSuporteItem({
  anexo,
  compact,
  onPreview,
}: {
  anexo: AnexoRef;
  compact?: boolean;
  onPreview: (url: string, title: string) => void;
}) {
  const displayUrl = resolveUploadUrl(anexo.url);
  if (isPreviewableImageAttachment(anexo.mimeType, anexo.originalName)) {
    return (
      <button
        type="button"
        className={`inline-flex flex-col items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 p-1 hover:ring-2 hover:ring-primary-400 cursor-zoom-in ${
          compact ? 'max-w-[6rem]' : 'max-w-[8rem]'
        }`}
        title="Ver imagem"
        onClick={() => onPreview(displayUrl, anexo.originalName)}
      >
        <img
          src={displayUrl}
          alt={anexo.originalName}
          className={`object-contain rounded bg-slate-100 dark:bg-slate-900/40 ${compact ? 'h-14 w-20' : 'h-20 w-28'}`}
        />
        <span className="text-[10px] text-slate-500 truncate w-full text-center">{anexo.originalName}</span>
      </button>
    );
  }
  return (
    <a
      className={`block text-primary-600 hover:underline ${compact ? 'text-xs' : 'text-sm'}`}
      href={displayUrl}
      target="_blank"
      rel="noreferrer"
    >
      {anexo.originalName}
    </a>
  );
}

/** Indicador na linha do chamado: há atualizações não lidas (abrir o detalhe marca como vistas). */
function ChamadoLinhaIndicadorAtualizacoes({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = `${count} atualização(ões) não lida(s) neste chamado`;
  return (
    <span
      className="pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-full bg-amber-500 py-0.5 pl-1 pr-1.5 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800"
      title={label}
      aria-label={label}
    >
      <svg className="h-3.5 w-3.5 shrink-0 opacity-95" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      {count > 99 ? '99+' : count}
    </span>
  );
}

type MasterLeaveChamadoPrompt =
  | {
      kind: 'switchTicket';
      ticketId: number;
      ticketNumber: string;
      currentStatus: string;
      chosenStatus: string;
      nextSelectedId: number | null;
    }
  | {
      kind: 'leavePage';
      ticketId: number;
      ticketNumber: string;
      currentStatus: string;
      chosenStatus: string;
    };

export default function SuportePage() {
  const { isMaster, login, hasPermission, permissoes } = useAuth();
  const modulosAreaVivos = useMemo(
    () => listModulosAreaParaUsuario(hasPermission, isMaster),
    [hasPermission, isMaster]
  );
  const verTodos = podeVerTodosChamadosSuporte(isMaster, hasPermission);
  const alterarStatus = podeAlterarStatusChamadoSuporte(isMaster, hasPermission);
  const podeCriar = podeAbrirChamadoSuporte(isMaster, hasPermission, permissoes);
  const podeResponder = podeResponderChamadoSuporte(isMaster, hasPermission, permissoes);

  const [catalog, setCatalog] = useState<SupportCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState(FILTRO_STATUS_EXCLUIR_FECHADO);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'prioridade'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [savingPrioridade, setSavingPrioridade] = useState(false);
  const [openForm, setOpenForm] = useState({
    /** Código do tipo no catálogo (configurável em Configurações de suporte). */
    tipo: '',
    area: '',
    titulo: '',
    descricao: '',
    attachments: [] as File[],
  });
  const [modulosAreaApi, setModulosAreaApi] = useState<ModuloAreaOption[] | null>(null);
  const [msgText, setMsgText] = useState('');
  const [msgFiles, setMsgFiles] = useState<File[]>([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  /** Pré-visualização de imagem (clique no anexo); não redireciona na mesma aba. */
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [masterLeavePrompt, setMasterLeavePrompt] = useState<MasterLeaveChamadoPrompt | null>(null);
  const [leaveModalErr, setLeaveModalErr] = useState<string | null>(null);
  const [savingMasterLeaveStatus, setSavingMasterLeaveStatus] = useState(false);
  const blockedNavHandledRef = useRef(false);
  const masterLeavePromptRef = useRef<MasterLeaveChamadoPrompt | null>(null);
  masterLeavePromptRef.current = masterLeavePrompt;

  const statusLabels = useMemo(() => labelMap(catalog, 'status'), [catalog]);
  const prioridadeLabels = useMemo(() => labelMap(catalog, 'prioridade'), [catalog]);
  const tipoLabels = useMemo(() => labelMap(catalog, 'tipo'), [catalog]);

  const activeStatusItems = useMemo(
    () =>
      catalog
        .filter((c) => c.kind === 'status' && c.active && c.code !== 'resolvido')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog]
  );
  const modulosAreaAbrirChamado = modulosAreaApi ?? modulosAreaVivos;
  const activePrioridadeItems = useMemo(
    () => catalog.filter((c) => c.kind === 'prioridade' && c.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog]
  );
  const activeTipoItems = useMemo(
    () => catalog.filter((c) => c.kind === 'tipo' && c.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog]
  );

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const cat = await listSupportCatalog();
      setCatalog(cat);
    } catch (e) {
      setCatalog([]);
      setCatalogError(e instanceof Error ? e.message : 'Falha ao carregar catálogo de suporte.');
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    setErrorList(null);
    try {
      const data = await listSupportTickets({
        status: filterStatus && filterStatus !== FILTRO_STATUS_EXCLUIR_FECHADO ? filterStatus : undefined,
        excluirStatus:
          filterStatus === FILTRO_STATUS_EXCLUIR_FECHADO ? 'fechado,resolvido' : undefined,
        prioridade: filterPriority || undefined,
        tipo: filterTipo || undefined,
        usuario: verTodos ? filterUsuario || undefined : undefined,
        search: filterSearch || undefined,
        sortBy,
        sortDir,
      });
      setTickets(data);
    } catch (e) {
      setErrorList(e instanceof Error ? e.message : 'Falha ao carregar chamados.');
    } finally {
      setLoadingList(false);
    }
  }, [filterPriority, filterSearch, filterStatus, filterTipo, filterUsuario, verTodos, sortBy, sortDir]);

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setDetailErr(null);
    try {
      const data = await getSupportTicket(id);
      setDetail(data);
      setTickets((prev) =>
        prev.map((tt) => (tt.id === id ? { ...tt, unreadUpdates: 0, readByMe: true } : tt))
      );
      window.dispatchEvent(new CustomEvent('suporte:notificationsUpdated'));
    } catch (e) {
      setDetail(null);
      setDetailErr(e instanceof Error ? e.message : 'Falha ao carregar detalhe.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleToggleRead = useCallback(
    async (ticketId: number, read: boolean) => {
      try {
        await setSupportTicketRead(ticketId, read);
        setTickets((prev) => prev.map((tt) => (tt.id === ticketId ? { ...tt, readByMe: read } : tt)));
      } catch (e) {
        setErrorList(e instanceof Error ? e.message : 'Falha ao atualizar leitura.');
      }
    },
    []
  );

  const shouldOfferMasterStatusOnLeave =
    isMaster && alterarStatus && selectedId != null && detail != null && detail.id === selectedId && !loadingDetail;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!shouldOfferMasterStatusOnLeave) return false;
    if (currentLocation.pathname !== '/suporte') return false;
    return nextLocation.pathname !== '/suporte';
  });

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      blockedNavHandledRef.current = false;
      return;
    }
    if (blockedNavHandledRef.current) return;
    if (!shouldOfferMasterStatusOnLeave || !detail) {
      blockedNavHandledRef.current = true;
      blocker.proceed?.();
      return;
    }
    blockedNavHandledRef.current = true;
    setLeaveModalErr(null);
    setMasterLeavePrompt({
      kind: 'leavePage',
      ticketId: detail.id,
      ticketNumber: detail.ticketNumber,
      currentStatus: detail.status,
      chosenStatus: detail.status,
    });
  }, [blocker.state, shouldOfferMasterStatusOnLeave, detail, blocker]);

  const requestSelectTicket = useCallback(
    (nextSelectedId: number | null) => {
      if (masterLeavePromptRef.current) return;
      if (!isMaster || !alterarStatus) {
        setSelectedId(nextSelectedId);
        return;
      }
      if (selectedId == null || detail == null || detail.id !== selectedId || loadingDetail) {
        setSelectedId(nextSelectedId);
        return;
      }
      if (nextSelectedId === selectedId) return;
      setLeaveModalErr(null);
      setMasterLeavePrompt({
        kind: 'switchTicket',
        ticketId: detail.id,
        ticketNumber: detail.ticketNumber,
        currentStatus: detail.status,
        chosenStatus: detail.status,
        nextSelectedId,
      });
    },
    [isMaster, alterarStatus, selectedId, detail, loadingDetail]
  );

  const dismissBlockedNavigationPrompt = useCallback(() => {
    blockedNavHandledRef.current = false;
    blocker.reset?.();
    setLeaveModalErr(null);
    setMasterLeavePrompt(null);
  }, [blocker]);

  const cancelSwitchTicketPromptOnly = useCallback(() => {
    setLeaveModalErr(null);
    setMasterLeavePrompt(null);
  }, []);

  const finishMasterLeavePrompt = useCallback(
    async (salvarStatus: boolean) => {
      const p = masterLeavePromptRef.current;
      if (!p) return;
      setLeaveModalErr(null);
      try {
        if (salvarStatus && p.chosenStatus !== p.currentStatus) {
          setSavingMasterLeaveStatus(true);
          await updateSupportStatus(p.ticketId, p.chosenStatus);
          await loadTickets();
          window.dispatchEvent(new CustomEvent('suporte:notificationsUpdated'));
        }
      } catch (e) {
        setLeaveModalErr(e instanceof Error ? e.message : 'Falha ao atualizar status.');
        return;
      } finally {
        setSavingMasterLeaveStatus(false);
      }
      setMasterLeavePrompt(null);
      if (p.kind === 'switchTicket') {
        setSelectedId(p.nextSelectedId);
      } else {
        blocker.proceed?.();
      }
    },
    [blocker, loadTickets]
  );

  const finishMasterLeaveWithoutStatusChange = useCallback(() => {
    const p = masterLeavePromptRef.current;
    if (!p) return;
    setLeaveModalErr(null);
    setMasterLeavePrompt(null);
    if (p.kind === 'switchTicket') {
      setSelectedId(p.nextSelectedId);
    } else {
      blocker.proceed?.();
    }
  }, [blocker]);

  useEffect(() => {
    if (!masterLeavePrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (savingMasterLeaveStatus) return;
      e.preventDefault();
      if (masterLeavePrompt.kind === 'leavePage') dismissBlockedNavigationPrompt();
      else cancelSwitchTicketPromptOnly();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [masterLeavePrompt, savingMasterLeaveStatus, dismissBlockedNavigationPrompt, cancelSwitchTicketPromptOnly]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePreview]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId == null) return;
    setImagePreview(null);
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  /** Se o tipo escolhido deixar de existir no catálogo (ex. inativado), volta para "Selecione". */
  useEffect(() => {
    if (!showCreate) return;
    const codes = catalog.filter((c) => c.kind === 'tipo' && c.active).map((c) => c.code);
    setOpenForm((s) => {
      if (s.tipo && codes.length > 0 && !codes.includes(s.tipo)) return { ...s, tipo: '' };
      return s;
    });
  }, [showCreate, catalog]);

  const fecharModalAbrirChamado = useCallback(() => {
    if (!window.confirm('Confirma encerrar o formulário? Os dados informados serão descartados.')) return;
    setShowCreate(false);
    setOpenForm({ tipo: '', area: '', titulo: '', descricao: '', attachments: [] });
    setCreateErr(null);
  }, []);

  /** ESC: fecha somente após confirmação (clique fora não fecha). */
  useEffect(() => {
    if (!showCreate || savingCreate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      fecharModalAbrirChamado();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate, savingCreate, fecharModalAbrirChamado]);

  function statusBadge(code: string): string {
    return STATUS_BADGE[code] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  }

  function priorityBadge(code: string): string {
    return PRIORITY_BADGE[code] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  }

  function statusLabel(code: string): string {
    return statusLabels.get(code) ?? code;
  }

  function prioridadeLabel(code: string): string {
    return prioridadeLabels.get(code) ?? code;
  }

  const tiposFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of activeTipoItems) set.add(t.code);
    for (const t of tickets) set.add(t.tipo);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [activeTipoItems, tickets]);

  const handleCreate = async () => {
    setCreateErr(null);
    const tipoSel = openForm.tipo.trim().toLowerCase();
    if (!tipoSel) {
      setCreateErr('Selecione um tipo de chamado válido (não é possível salvar com "Selecione").');
      return;
    }
    if (!openForm.area.trim()) {
      setCreateErr('Selecione a área do chamado.');
      return;
    }
    if (!openForm.titulo.trim() || !openForm.descricao.trim()) {
      setCreateErr('Título e descrição são obrigatórios.');
      return;
    }
    const areaSel = modulosAreaAbrirChamado.find((a) => a.code === openForm.area.trim());
    if (!areaSel) {
      setCreateErr('Área inválida ou sem permissão para este módulo.');
      return;
    }
    if (!window.confirm('Confirma a abertura deste chamado com os dados informados?')) return;
    setSavingCreate(true);
    try {
      const attachments = await Promise.all(openForm.attachments.map(fileToSupportAttachment));
      const created = await createSupportTicket({
        tipo: tipoSel,
        titulo: openForm.titulo.trim(),
        descricao: openForm.descricao.trim(),
        area: areaSel.code,
        categoria: areaSel.label,
        prioridade: PRIORIDADE_PADRAO_CHAMADO,
        attachments,
      });
      setOkMsg(`Chamado ${created.ticketNumber} aberto com sucesso.`);
      setShowCreate(false);
      setOpenForm({
        tipo: '',
        area: '',
        titulo: '',
        descricao: '',
        attachments: [],
      });
      await loadTickets();
      setSelectedId(created.id);
      window.dispatchEvent(new CustomEvent('suporte:notificationsUpdated'));
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Falha ao abrir chamado.');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleSendMessage = async () => {
    if (!detail || !msgText.trim()) return;
    setSendingMsg(true);
    setDetailErr(null);
    try {
      const attachments = await Promise.all(msgFiles.map(fileToSupportAttachment));
      await createSupportMessage(detail.id, { mensagem: msgText.trim(), attachments });
      setMsgText('');
      setMsgFiles([]);
      await loadDetail(detail.id);
      await loadTickets();
      setOkMsg('Mensagem enviada.');
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : 'Falha ao enviar mensagem.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleUpdatePrioridade = async (prioridade: string) => {
    if (!detail || !isMaster) return;
    setSavingPrioridade(true);
    setDetailErr(null);
    try {
      await updateSupportPrioridade(detail.id, prioridade);
      await loadDetail(detail.id);
      await loadTickets();
      setOkMsg('Criticidade atualizada.');
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : 'Falha ao atualizar criticidade.');
    } finally {
      setSavingPrioridade(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!detail) return;
    setSavingStatus(true);
    setDetailErr(null);
    try {
      await updateSupportStatus(detail.id, status);
      await loadDetail(detail.id);
      await loadTickets();
      setOkMsg('Status atualizado.');
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : 'Falha ao atualizar status.');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">Suporte</p>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Chamados</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMaster && alterarStatus && selectedId != null && (
            <button
              type="button"
              onClick={() => requestSelectTicket(null)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700/50"
            >
              Fechar chamado
            </button>
          )}
          {podeCriar && (
            <button
              type="button"
              onClick={() => {
                setCreateErr(null);
                setOpenForm({ tipo: '', area: '', titulo: '', descricao: '', attachments: [] });
                setModulosAreaApi(null);
                void listSupportModulosArea()
                  .then(setModulosAreaApi)
                  .catch(() => setModulosAreaApi(modulosAreaVivos));
                setShowCreate(true);
              }}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              Abrir chamado
            </button>
          )}
        </div>
      </div>
      {okMsg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{okMsg}</p>}

      <div className="card-panel p-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-2">
        <input
          className={inputClass}
          placeholder="Buscar por ID, título ou descrição"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
        />
        <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value={FILTRO_STATUS_EXCLUIR_FECHADO}>Exceto resolvido</option>
          <option value="">Todos os status</option>
          {activeStatusItems.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select className={inputClass} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">Criticidade</option>
          {activePrioridadeItems.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <select className={inputClass} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="">Tipo</option>
          {tiposFilterOptions.map((t) => (
            <option key={t} value={t}>
              {tipoLabels.get(t) ?? t}
            </option>
          ))}
        </select>
        {verTodos && (
          <input
            className={inputClass}
            placeholder="Usuário (login)"
            value={filterUsuario}
            onChange={(e) => setFilterUsuario(e.target.value)}
          />
        )}
        <select className={inputClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'prioridade')}>
          <option value="createdAt">Ordenar por data</option>
          <option value="prioridade">Ordenar por prioridade</option>
        </select>
        <select className={inputClass} value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>

      <div className="card-panel p-3 overflow-auto min-h-[calc(100vh-14rem)]">
          {loadingList && <p className="text-sm text-slate-500">Carregando...</p>}
          {errorList && <p className="text-sm text-red-600">{errorList}</p>}
          {!loadingList && !errorList && tickets.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum chamado encontrado.</p>
          )}
          {!loadingList && tickets.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">ID</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Título</th>
                  <th className="py-2">Usuário</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Criticidade</th>
                  <th className="py-2">Abertura</th>
                  <th className="py-2">Atualização</th>
                  {isMaster && <th className="py-2">Leitura</th>}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const unread = isMaster && !t.readByMe;
                  return (
                    <tr
                      key={t.id}
                      className={`relative border-t border-slate-100 dark:border-slate-700 cursor-pointer ${selectedId === t.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''} ${unread ? 'font-semibold' : ''}`}
                      onClick={() => requestSelectTicket(t.id)}
                    >
                      <td className="relative py-2 pr-10">
                        <ChamadoLinhaIndicadorAtualizacoes count={t.unreadUpdates ?? 0} />
                        <span className="inline-flex items-center gap-1.5">
                          {isMaster && (
                            <span
                              title={t.readByMe ? 'Lido' : 'Não lido'}
                              aria-label={t.readByMe ? 'Lido' : 'Não lido'}
                              className={`inline-block w-2.5 h-2.5 rounded-full ${t.readByMe ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            />
                          )}
                          {t.ticketNumber}
                        </span>
                      </td>
                      <td className="py-2">{tipoLabels.get(t.tipo) ?? t.tipo}</td>
                      <td className="py-2">{t.titulo}</td>
                      <td className="py-2">{t.ownerNome ?? t.ownerLogin}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${priorityBadge(t.prioridade)}`}>
                          {prioridadeLabel(t.prioridade)}
                        </span>
                      </td>
                      <td className="py-2">{toBrDate(t.createdAt)}</td>
                      <td className="py-2">{toBrDate(t.updatedAt)}</td>
                      {isMaster && (
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleRead(t.id, !t.readByMe);
                            }}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                            title={t.readByMe ? 'Marcar como não lida' : 'Marcar como lida'}
                          >
                            {t.readByMe ? 'Marcar como não lida' : 'Marcar como lida'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      {selectedId != null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-chamado-titulo"
          onClick={() => requestSelectTicket(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] overflow-y-auto card-panel p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <h2 id="modal-chamado-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100 pr-8">
                {detail ? `${detail.ticketNumber} — ${detail.titulo}` : 'Chamado'}
              </h2>
              <button
                type="button"
                onClick={() => requestSelectTicket(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            {loadingDetail && <p className="text-sm text-slate-500">Carregando detalhes...</p>}
          {detailErr && <p className="text-sm text-red-600">{detailErr}</p>}
          {!loadingDetail && detail && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(detail.status)}`}>
                    {statusLabel(detail.status)}
                  </span>
                  {isMaster ? (
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      Criticidade
                      <select
                        className={`${inputClass} !w-auto !py-1 text-xs`}
                        value={detail.prioridade}
                        disabled={savingPrioridade}
                        onChange={(e) => void handleUpdatePrioridade(e.target.value)}
                      >
                        {activePrioridadeItems.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${priorityBadge(detail.prioridade)}`}>
                      {prioridadeLabel(detail.prioridade)}
                    </span>
                  )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <b>Usuário:</b> {detail.ownerNome ?? detail.ownerLogin}
                {detail.categoria?.trim() ? (
                  <>
                    {' '}
                    · <b>Área:</b> {detail.categoria}
                  </>
                ) : null}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <b>Abertura:</b> {toBrDate(detail.createdAt)} | <b>Última atualização:</b> {toBrDate(detail.updatedAt)}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{detail.descricao}</p>
              {detail.openingAttachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase">Anexos da abertura</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.openingAttachments.map((a) => (
                      <AnexoSuporteItem
                        key={a.id}
                        anexo={a}
                        onPreview={(url, title) => setImagePreview({ url, title })}
                      />
                    ))}
                  </div>
                </div>
              )}
              {alterarStatus && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeStatusItems.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      disabled={savingStatus || detail.status === s.code}
                      onClick={() => void handleUpdateStatus(s.code)}
                      className="px-2 py-1 rounded border text-xs border-slate-300 dark:border-slate-600 disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-64 overflow-auto rounded border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                {detail.messages.length === 0 && <p className="text-sm text-slate-500">Sem mensagens ainda.</p>}
                {detail.messages.map((m) => (
                  <div key={m.id} className="rounded bg-slate-50 dark:bg-slate-700/40 p-2">
                    <p className="text-xs text-slate-500">
                      {m.authorType === 'master' ? 'equipe' : 'usuário'} · {m.authorNome ?? m.authorLogin} · {toBrDate(m.createdAt)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{m.mensagem}</p>
                    {m.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {m.attachments.map((a) => (
                          <AnexoSuporteItem
                            key={a.id}
                            anexo={a}
                            compact
                            onPreview={(url, title) => setImagePreview({ url, title })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {podeResponder && (
                <>
                  <textarea
                    className={inputClass}
                    rows={3}
                    placeholder="Responder chamado..."
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                  />
                  <SuporteAnexosComPaste
                    files={msgFiles}
                    onChange={setMsgFiles}
                    hint="Cole um print com Ctrl+V na área de anexos."
                    onPreviewImage={(url, title) => setImagePreview({ url, title })}
                  />
                  <button
                    type="button"
                    disabled={sendingMsg || !msgText.trim()}
                    onClick={() => void handleSendMessage()}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm disabled:opacity-50"
                  >
                    {sendingMsg ? 'Enviando...' : verTodos ? 'Responder' : 'Enviar resposta'}
                  </button>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {masterLeavePrompt && (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-leave-chamado-titulo"
        >
          <div
            className="w-full max-w-md card-panel p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="master-leave-chamado-titulo"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Atualizar status do chamado?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {masterLeavePrompt.kind === 'switchTicket'
                ? 'Você está saindo deste chamado para visualizar outro.'
                : 'Você está saindo da lista de chamados.'}{' '}
              Deseja gravar um novo status em{' '}
              <span className="font-medium text-slate-800 dark:text-slate-100">{masterLeavePrompt.ticketNumber}</span>{' '}
              antes de continuar?
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
            <select
              className={`${inputClass} mt-1`}
              value={masterLeavePrompt.chosenStatus}
              onChange={(e) =>
                setMasterLeavePrompt((prev) =>
                  prev ? { ...prev, chosenStatus: e.target.value } : prev
                )
              }
            >
              {activeStatusItems.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
            {leaveModalErr && <p className="mt-2 text-sm text-red-600">{leaveModalErr}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {masterLeavePrompt.kind === 'leavePage' ? (
                <button
                  type="button"
                  onClick={() => dismissBlockedNavigationPrompt()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
                >
                  Ficar nesta página
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => cancelSwitchTicketPromptOnly()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                disabled={savingMasterLeaveStatus}
                onClick={() => void finishMasterLeaveWithoutStatusChange()}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                Continuar sem alterar
              </button>
              <button
                type="button"
                disabled={savingMasterLeaveStatus}
                onClick={() => void finishMasterLeavePrompt(true)}
                className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {savingMasterLeaveStatus ? 'Salvando...' : 'Salvar status e continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && podeCriar && (
        <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-3xl card-panel p-4 max-h-[90vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-abrir-chamado-titulo"
          >
            <h2 id="modal-abrir-chamado-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Abrir chamado
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Criticidade inicial: <b>A definir</b> (a equipe master ajusta depois). Clicar fora não fecha o formulário —
              use Cancelar ou Esc com confirmação para descartar.
            </p>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Tipo de chamado *</label>
              {catalogError ? (
                <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                  {catalogError}
                </p>
              ) : activeTipoItems.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Nenhum tipo disponível. Um usuário com acesso a Configurações de suporte deve cadastrar e ativar tipos no
                  catálogo.
                </p>
              ) : (
                <select
                  className={inputClass}
                  value={openForm.tipo}
                  onChange={(e) => setOpenForm((s) => ({ ...s, tipo: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {activeTipoItems.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Área *</label>
              {modulosAreaAbrirChamado.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Nenhum módulo disponível para seu perfil. Solicite acesso ao administrador.
                </p>
              ) : (
                <select
                  className={inputClass}
                  value={openForm.area}
                  onChange={(e) => setOpenForm((s) => ({ ...s, area: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {modulosAreaAbrirChamado.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              className={`${inputClass} mt-2`}
              placeholder="Título"
              value={openForm.titulo}
              onChange={(e) => setOpenForm((s) => ({ ...s, titulo: e.target.value }))}
            />
            <textarea
              className={`${inputClass} mt-2`}
              rows={5}
              placeholder="Descrição"
              value={openForm.descricao}
              onChange={(e) => setOpenForm((s) => ({ ...s, descricao: e.target.value }))}
            />
            <SuporteAnexosComPaste
              className="mt-2"
              files={openForm.attachments}
              onChange={(attachments) => setOpenForm((s) => ({ ...s, attachments }))}
              onPreviewImage={(url, title) => setImagePreview({ url, title })}
            />
            {createErr && <p className="mt-2 text-sm text-red-600">{createErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={fecharModalAbrirChamado} className="px-3 py-2 rounded border border-slate-300 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={
                  savingCreate ||
                  !!catalogError ||
                  activeTipoItems.length === 0 ||
                  modulosAreaAbrirChamado.length === 0 ||
                  !openForm.tipo.trim() ||
                  !openForm.area.trim()
                }
                className="px-4 py-2 rounded bg-primary-600 text-white text-sm disabled:opacity-50"
              >
                {savingCreate ? 'Abrindo...' : 'Abrir chamado'}
              </button>
            </div>
          </div>
        </div>
      )}
      {imagePreview && (
        <SuporteAnexoPreviewModal
          url={imagePreview.url}
          title={imagePreview.title}
          onClose={() => setImagePreview(null)}
        />
      )}
      <p className="text-xs text-slate-500">Usuário atual: {login ?? '—'}</p>
    </div>
  );
}
