import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock } from 'lucide-react';
import {
  anexarCrmPendenciaPdfAssinado,
  baixarCrmPendenciaPdfAssinado,
  confirmarCrmPendenciaLiberacao,
  fetchCrmPendenciasContasCliente,
  fetchCrmPendenciasCredito,
  fetchCrmPendenciasEmailConfig,
  fetchCrmPendenciasHistorico,
  fetchCrmPendenciasUsuarios,
  removerCrmPendenciaPdfAssinado,
  salvarCrmPendenciaAcao,
  salvarCrmPendenciasEmailConfig,
  type AcaoPendenciaCredito,
  type HistoricoPendenciaEvento,
  type MonitorRegularizacaoCliente,
  type PendenciaCreditoItem,
  type SituacaoFilaPendencia,
  type UsuarioDestinatarioPendencia,
} from '../../../../api/crmFinanceiro';
import {
  criarMatcherTextoLivre,
  PLACEHOLDER_BUSCA_TEXTO_LIVRE,
} from '../../../../utils/textoLivreBusca';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  downloadPendenciasAprovacaoPdf,
  mapPendenciasParaAprovacaoPdf,
} from '../lib/generate-pendencias-aprovacao-pdf';

const FILAS: Array<{ id: SituacaoFilaPendencia; label: string }> = [
  { id: 'INADIMPLENTES', label: 'Inadimplentes — aguardando ação' },
  { id: 'REGULARIZADOS', label: 'Regularizados — aguardando ação' },
  { id: 'FINALIZADOS', label: 'Finalizados' },
];

function formatarBRL(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const raw = iso.includes('T') ? iso : `${iso}T12:00:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return iso;
  }
  return d.toLocaleDateString('pt-BR');
}

function labelUsuario(u: UsuarioDestinatarioPendencia): string {
  return u.nome?.trim() || u.login;
}

const ACOES: { value: AcaoPendenciaCredito; label: string }[] = [
  { value: 'CANCELADO', label: 'Pedido cancelado' },
  { value: 'PAUSADO', label: 'Pedido pausado' },
  { value: 'REALOCAR_MATERIAL', label: 'Realocar material' },
  { value: 'SEGUIR_PRODUCAO', label: 'Seguir com produção' },
];

function precisaPdfParaConfirmar(
  item: PendenciaCreditoItem,
  acaoSel: AcaoPendenciaCredito | '',
): boolean {
  if (!acaoSel || item.temPdfAssinado) return false;
  if (item.aguardandoConfirmacaoNomus) return true;
  if (acaoSel === 'SEGUIR_PRODUCAO') return true;
  const st = item.statusNomus;
  if (st == null) return false;
  if (acaoSel === 'PAUSADO' || acaoSel === 'REALOCAR_MATERIAL') return st === 1;
  if (acaoSel === 'CANCELADO') return st === 6 || st >= 4;
  return false;
}

type Props = {
  podeEditarDestinatarios: boolean;
  clienteInicial?: string | null;
  situacaoInicial?: SituacaoFilaPendencia | null;
};

type ListaDest = 'to' | 'cc' | 'gestorTo' | 'gestorCc';

function formatarTempoExecucao(item: PendenciaCreditoItem): {
  label: string;
  className: string;
} {
  const decorridas = item.horasDecorridas ?? 0;
  const prazo = item.prazoHorasSemAcao ?? 48;
  if (item.acao || item.encerrada) {
    return {
      label: item.acao ? `Ação em ${decorridas}h` : `${decorridas}h`,
      className: 'text-slate-500 dark:text-slate-400',
    };
  }
  if (item.slaEstourado) {
    return {
      label: `${decorridas}h · prazo ${prazo}h estourado`,
      className: 'font-semibold text-red-600 dark:text-red-400',
    };
  }
  const restam = item.horasRestantes ?? Math.max(0, prazo - decorridas);
  return {
    label: `${decorridas}h · restam ${restam}h`,
    className:
      restam <= 12
        ? 'font-medium text-amber-700 dark:text-amber-400'
        : 'text-slate-700 dark:text-slate-200',
  };
}

function ListaUsuariosDestinatarios({
  titulo,
  usuarios,
  selecionados,
  podeEditar,
  onRemover,
  onAdicionar,
  excluirIds,
}: {
  titulo: string;
  usuarios: UsuarioDestinatarioPendencia[];
  selecionados: UsuarioDestinatarioPendencia[];
  podeEditar: boolean;
  onRemover: (id: number) => void;
  onAdicionar: (id: number) => void;
  excluirIds: Set<number>;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);

  const selecionadosIds = useMemo(
    () => new Set(selecionados.map((u) => u.id)),
    [selecionados],
  );

  const resultados = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    return usuarios
      .filter((u) => !selecionadosIds.has(u.id) && !excluirIds.has(u.id))
      .filter(
        (u) =>
          match(u.login) ||
          match(u.nome ?? '') ||
          match(u.email ?? ''),
      )
      .slice(0, 12);
  }, [usuarios, selecionadosIds, excluirIds, busca]);

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {titulo}
      </span>

      <div
        className={`flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2 ${
          podeEditar
            ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
            : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60'
        }`}
      >
        {selecionados.length === 0 ? (
          <span className="px-1 py-0.5 text-xs text-slate-400 dark:text-slate-500">
            Nenhum usuário selecionado
          </span>
        ) : (
          selecionados.map((u) => {
            const semEmail = !u.email?.trim();
            return (
              <span
                key={u.id}
                className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  semEmail
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
                }`}
                title={u.email || 'Sem e-mail cadastrado'}
              >
                <span className="truncate">{labelUsuario(u)}</span>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => onRemover(u.id)}
                    className="ml-0.5 rounded-full px-1 hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label={`Remover ${labelUsuario(u)}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {podeEditar && (
        <div className="relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => {
              window.setTimeout(() => setAberto(false), 150);
            }}
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {aberto && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
              {resultados.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Nenhum usuário encontrado
                </div>
              ) : (
                resultados.map((u) => {
                  const semEmail = !u.email?.trim();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onAdicionar(u.id);
                        setBusca('');
                        setAberto(false);
                      }}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {labelUsuario(u)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {u.login}
                        {u.nome ? ` · ${u.nome}` : ''}
                      </span>
                      <span
                        className={`text-xs ${
                          semEmail
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {u.email || 'Sem e-mail cadastrado'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PendenciasCreditoPanel({
  podeEditarDestinatarios,
  clienteInicial = null,
  situacaoInicial = null,
}: Props) {
  const { login, nome } = useAuth();
  const [itens, setItens] = useState<PendenciaCreditoItem[]>([]);
  const [situacaoFila, setSituacaoFila] = useState<SituacaoFilaPendencia>(
    situacaoInicial ?? 'INADIMPLENTES',
  );
  const [contagens, setContagens] = useState<Record<SituacaoFilaPendencia, number>>({
    INADIMPLENTES: 0,
    REGULARIZADOS: 0,
    FINALIZADOS: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [pdfUploadingId, setPdfUploadingId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mensagemNomus, setMensagemNomus] = useState<{
    titulo: string;
    mensagem: string;
    pedido: string;
  } | null>(null);
  const [filtroCliente, setFiltroCliente] = useState(clienteInicial ?? '');

  const [draftAcao, setDraftAcao] = useState<Record<number, AcaoPendenciaCredito | ''>>({});
  const [draftObs, setDraftObs] = useState<Record<number, string>>({});

  const [usuarios, setUsuarios] = useState<UsuarioDestinatarioPendencia[]>([]);
  const [idsTo, setIdsTo] = useState<number[]>([]);
  const [idsCc, setIdsCc] = useState<number[]>([]);
  const [idsGestorTo, setIdsGestorTo] = useState<number[]>([]);
  const [idsGestorCc, setIdsGestorCc] = useState<number[]>([]);
  const [prazoHorasSemAcao, setPrazoHorasSemAcao] = useState(48);
  const [alertaPrazoAtivo, setAlertaPrazoAtivo] = useState(true);
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  /** Seção de destinatários expandida (visível). */
  const [destinatariosAberto, setDestinatariosAberto] = useState(true);
  /** Edição liberada só após clicar em Editar (e com permissão). */
  const [editandoDestinatarios, setEditandoDestinatarios] = useState(false);
  const destinatariosSnapshotRef = useRef<{
    to: number[];
    cc: number[];
    gestorTo: number[];
    gestorCc: number[];
    prazo: number;
    alertaAtivo: boolean;
  } | null>(null);
  const [historicoCliente, setHistoricoCliente] = useState<{
    clienteNome: string;
    eventos: HistoricoPendenciaEvento[];
    qtdEmailsAlerta: number;
    qtdEmailsAcao: number;
    qtdEmailsTotal: number;
    qtdAcoesRegistradas: number;
    alertaEm: string | null;
  } | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [monitorContas, setMonitorContas] = useState<MonitorRegularizacaoCliente | null>(null);
  const [clienteContasModal, setClienteContasModal] = useState<string | null>(null);
  const [carregandoContas, setCarregandoContas] = useState(false);
  const contasCacheRef = useRef(new Map<string, MonitorRegularizacaoCliente | null>());

  const usuariosById = useMemo(() => {
    const map = new Map<number, UsuarioDestinatarioPendencia>();
    for (const u of usuarios) map.set(u.id, u);
    return map;
  }, [usuarios]);

  const selecionadosTo = useMemo(
    () =>
      idsTo
        .map((id) => usuariosById.get(id))
        .filter((u): u is UsuarioDestinatarioPendencia => Boolean(u)),
    [idsTo, usuariosById],
  );
  const selecionadosCc = useMemo(
    () =>
      idsCc
        .map((id) => usuariosById.get(id))
        .filter((u): u is UsuarioDestinatarioPendencia => Boolean(u)),
    [idsCc, usuariosById],
  );
  const selecionadosGestorTo = useMemo(
    () =>
      idsGestorTo
        .map((id) => usuariosById.get(id))
        .filter((u): u is UsuarioDestinatarioPendencia => Boolean(u)),
    [idsGestorTo, usuariosById],
  );
  const selecionadosGestorCc = useMemo(
    () =>
      idsGestorCc
        .map((id) => usuariosById.get(id))
        .filter((u): u is UsuarioDestinatarioPendencia => Boolean(u)),
    [idsGestorCc, usuariosById],
  );

  const carregar = useCallback(
    async (opts?: {
      syncAlertas?: boolean;
      syncNomus?: boolean;
      cliente?: string;
      situacao?: SituacaoFilaPendencia;
    }) => {
      setCarregando(true);
      setErro(null);
      contasCacheRef.current.clear();
      const situacao = opts?.situacao ?? situacaoFila;
      try {
        const cliente = opts?.cliente ?? filtroCliente;
        const data = await fetchCrmPendenciasCredito({
          cliente: cliente || null,
          syncAlertas: opts?.syncAlertas ?? false,
          // Listagem rápida por padrão; sync Nomus só no Atualizar.
          syncNomus: opts?.syncNomus ?? false,
          situacao,
        });
        const lista = data.itens;
        setItens(lista);
        setContagens(data.contagens);
        setDraftAcao((prev) => {
          const next = { ...prev };
          for (const item of lista) {
            if (next[item.id] === undefined) {
              next[item.id] = (item.acao as AcaoPendenciaCredito) || '';
            }
          }
          return next;
        });
        setDraftObs((prev) => {
          const next = { ...prev };
          for (const item of lista) {
            if (next[item.id] === undefined) next[item.id] = item.observacao ?? '';
          }
          return next;
        });
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar pendências');
      } finally {
        setCarregando(false);
      }
    },
    [filtroCliente, situacaoFila],
  );

  const carregarEmailConfig = useCallback(async () => {
    try {
      const [cfg, listaUsuarios] = await Promise.all([
        fetchCrmPendenciasEmailConfig(),
        fetchCrmPendenciasUsuarios(),
      ]);
      const map = new Map(listaUsuarios.map((u) => [u.id, u]));
      for (const u of [
        ...cfg.destinatariosTo,
        ...cfg.destinatariosCc,
        ...(cfg.destinatariosGestorTo ?? []),
        ...(cfg.destinatariosGestorCc ?? []),
      ]) {
        map.set(u.id, u);
      }
      setUsuarios([...map.values()]);
      setIdsTo(cfg.usuarioIdsTo ?? cfg.destinatariosTo.map((u) => u.id));
      setIdsCc(cfg.usuarioIdsCc ?? cfg.destinatariosCc.map((u) => u.id));
      setIdsGestorTo(
        cfg.usuarioIdsGestorTo ?? (cfg.destinatariosGestorTo ?? []).map((u) => u.id),
      );
      setIdsGestorCc(
        cfg.usuarioIdsGestorCc ?? (cfg.destinatariosGestorCc ?? []).map((u) => u.id),
      );
      setPrazoHorasSemAcao(cfg.prazoHorasSemAcao ?? 48);
      setAlertaPrazoAtivo(cfg.alertaPrazoAtivo !== false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar destinatários');
    }
  }, []);

  useEffect(() => {
    // Abertura rápida: só lê o banco. Sync Nomus/alertas fica no botão Atualizar.
    void carregar({ syncAlertas: false, syncNomus: false, cliente: clienteInicial ?? '' });
    void carregarEmailConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montagem / deep link inicial
  }, []);

  useEffect(() => {
    if (clienteInicial != null && clienteInicial !== filtroCliente) {
      setFiltroCliente(clienteInicial);
      void carregar({ cliente: clienteInicial, syncAlertas: false, syncNomus: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteInicial]);

  const handleAtualizarTabela = () => {
    void carregar({
      syncAlertas: true,
      syncNomus: true,
      cliente: filtroCliente || undefined,
    });
  };

  const handleEmitirPdfAprovacao = () => {
    void (async () => {
      try {
        const tituloFila =
          FILAS.find((f) => f.id === situacaoFila)?.label ?? 'Pendências';
        await downloadPendenciasAprovacaoPdf({
          linhas: mapPendenciasParaAprovacaoPdf(itens),
          tituloFila,
          responsavel: nome?.trim() || login || '—',
        });
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
      }
    })();
  };

  const handleSalvarEmail = async () => {
    if (!podeEditarDestinatarios || !editandoDestinatarios) return;
    setSalvandoEmail(true);
    setErro(null);
    setAviso(null);
    try {
      const saved = await salvarCrmPendenciasEmailConfig({
        usuarioIdsTo: idsTo,
        usuarioIdsCc: idsCc,
        prazoHorasSemAcao,
        alertaPrazoAtivo: true,
        usuarioIdsGestorTo: idsGestorTo,
        usuarioIdsGestorCc: idsGestorCc,
      });
      setIdsTo(saved.usuarioIdsTo);
      setIdsCc(saved.usuarioIdsCc);
      setIdsGestorTo(saved.usuarioIdsGestorTo ?? []);
      setIdsGestorCc(saved.usuarioIdsGestorCc ?? []);
      setPrazoHorasSemAcao(saved.prazoHorasSemAcao);
      setAlertaPrazoAtivo(true);
      setUsuarios((prev) => {
        const map = new Map(prev.map((u) => [u.id, u]));
        for (const u of [
          ...saved.destinatariosTo,
          ...saved.destinatariosCc,
          ...saved.destinatariosGestorTo,
          ...saved.destinatariosGestorCc,
        ]) {
          map.set(u.id, u);
        }
        return [...map.values()];
      });
      destinatariosSnapshotRef.current = null;
      setEditandoDestinatarios(false);
      setAviso('Configuração de e-mails salva.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar destinatários');
    } finally {
      setSalvandoEmail(false);
    }
  };

  const iniciarEdicaoDestinatarios = () => {
    if (!podeEditarDestinatarios) return;
    destinatariosSnapshotRef.current = {
      to: [...idsTo],
      cc: [...idsCc],
      gestorTo: [...idsGestorTo],
      gestorCc: [...idsGestorCc],
      prazo: prazoHorasSemAcao,
      alertaAtivo: alertaPrazoAtivo,
    };
    setEditandoDestinatarios(true);
    setDestinatariosAberto(true);
    setErro(null);
    setAviso(null);
  };

  const cancelarEdicaoDestinatarios = () => {
    const snap = destinatariosSnapshotRef.current;
    if (snap) {
      setIdsTo(snap.to);
      setIdsCc(snap.cc);
      setIdsGestorTo(snap.gestorTo);
      setIdsGestorCc(snap.gestorCc);
      setPrazoHorasSemAcao(snap.prazo);
      setAlertaPrazoAtivo(snap.alertaAtivo);
    }
    destinatariosSnapshotRef.current = null;
    setEditandoDestinatarios(false);
    setErro(null);
  };

  const adicionarDest = (lista: ListaDest, id: number) => {
    if (lista === 'to') {
      setIdsTo((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setIdsCc((prev) => prev.filter((x) => x !== id));
    } else if (lista === 'cc') {
      setIdsCc((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setIdsTo((prev) => prev.filter((x) => x !== id));
    } else if (lista === 'gestorTo') {
      setIdsGestorTo((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setIdsGestorCc((prev) => prev.filter((x) => x !== id));
    } else {
      setIdsGestorCc((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setIdsGestorTo((prev) => prev.filter((x) => x !== id));
    }
  };

  const removerDest = (lista: ListaDest, id: number) => {
    if (lista === 'to') setIdsTo((prev) => prev.filter((x) => x !== id));
    else if (lista === 'cc') setIdsCc((prev) => prev.filter((x) => x !== id));
    else if (lista === 'gestorTo') setIdsGestorTo((prev) => prev.filter((x) => x !== id));
    else setIdsGestorCc((prev) => prev.filter((x) => x !== id));
  };

  const handleSalvarAcao = async (item: PendenciaCreditoItem) => {
    const acao = draftAcao[item.id];
    if (!acao) {
      setErro('Selecione uma ação para o pedido.');
      return;
    }
    if (precisaPdfParaConfirmar(item, acao)) {
      setErro('Anexe o PDF assinado pelo gestor antes de confirmar a ação.');
      return;
    }
    setSalvandoId(item.id);
    setErro(null);
    try {
      const result = await salvarCrmPendenciaAcao(item.id, {
        acao,
        observacao: draftObs[item.id] ?? '',
      });
      setMensagemNomus({
        titulo: result.emailEnviado
          ? 'Confirmado — e-mail enviado'
          : result.aguardandoConfirmacaoNomus
            ? 'Ação salva em rascunho'
            : result.pendencia.encerrada
              ? 'Pedido finalizado'
              : 'Ação registrada',
        mensagem:
          result.mensagem ||
          result.instrucaoNomus ||
          'A ação foi salva.',
        pedido: item.numeroPedidoExibicao,
      });
      if (result.pendencia.encerrada || result.pendencia.situacaoFila !== situacaoFila) {
        await carregar({ situacao: situacaoFila });
      } else {
        setItens((prev) =>
          prev.map((row) => {
            if (row.id === item.id) return result.pendencia;
            if (
              result.pendencia.clienteChave &&
              row.clienteChave === result.pendencia.clienteChave
            ) {
              return {
                ...row,
                qtdEmailsAlerta: result.pendencia.qtdEmailsAlerta,
                qtdEmailsAcao: result.pendencia.qtdEmailsAcao,
                qtdEmailsTotal: result.pendencia.qtdEmailsTotal,
                qtdAcoesRegistradas: result.pendencia.qtdAcoesRegistradas,
              };
            }
            return row;
          }),
        );
        setDraftAcao((prev) => ({
          ...prev,
          [item.id]: (result.pendencia.acao as AcaoPendenciaCredito) || acao,
        }));
        setDraftObs((prev) => ({ ...prev, [item.id]: result.pendencia.observacao ?? '' }));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar ação');
    } finally {
      setSalvandoId(null);
    }
  };

  const handleConfirmarLiberacao = async (item: PendenciaCreditoItem) => {
    setSalvandoId(item.id);
    setErro(null);
    try {
      const result = await confirmarCrmPendenciaLiberacao(item.id);
      setMensagemNomus({
        titulo: result.pendencia.encerrada
          ? 'Liberação confirmada'
          : 'Aguardando Nomus',
        mensagem: result.mensagem || result.instrucaoNomus || 'Processado.',
        pedido: item.numeroPedidoExibicao,
      });
      if (result.pendencia.encerrada || result.pendencia.situacaoFila !== situacaoFila) {
        await carregar({ situacao: situacaoFila });
      } else {
        setItens((prev) =>
          prev.map((row) => (row.id === item.id ? result.pendencia : row)),
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao confirmar liberação');
    } finally {
      setSalvandoId(null);
    }
  };

  const atualizarPendenciaLocal = (pendencia: PendenciaCreditoItem) => {
    setItens((prev) => prev.map((row) => (row.id === pendencia.id ? pendencia : row)));
  };

  const handleAnexarPdfAssinado = async (item: PendenciaCreditoItem, file: File | null) => {
    if (!file) return;
    setPdfUploadingId(item.id);
    setErro(null);
    setAviso(null);
    try {
      const pendencia = await anexarCrmPendenciaPdfAssinado(item.id, file);
      atualizarPendenciaLocal(pendencia);
      setAviso(`PDF assinado anexado em ${item.numeroPedidoExibicao}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao anexar PDF');
    } finally {
      setPdfUploadingId(null);
    }
  };

  const handleRemoverPdfAssinado = async (item: PendenciaCreditoItem) => {
    setPdfUploadingId(item.id);
    setErro(null);
    try {
      const pendencia = await removerCrmPendenciaPdfAssinado(item.id);
      atualizarPendenciaLocal(pendencia);
      setAviso('PDF assinado removido.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover PDF');
    } finally {
      setPdfUploadingId(null);
    }
  };

  const handleBaixarPdfAssinado = async (item: PendenciaCreditoItem) => {
    setErro(null);
    try {
      await baixarCrmPendenciaPdfAssinado(item.id, item.pdfAssinadoNome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao baixar PDF');
    }
  };

  const trocarFila = (fila: SituacaoFilaPendencia) => {
    setSituacaoFila(fila);
    void carregar({ situacao: fila });
  };

  const abrirHistoricoCliente = async (
    clienteNome: string,
    clienteChave: string | undefined,
    indicadores: {
      qtdEmailsAlerta: number;
      qtdEmailsAcao: number;
      qtdEmailsTotal: number;
      qtdAcoesRegistradas: number;
      alertaEm: string | null;
    },
  ) => {
    setCarregandoHistorico(true);
    setErro(null);
    try {
      const hist = await fetchCrmPendenciasHistorico(clienteChave || clienteNome);
      setHistoricoCliente({
        clienteNome: hist.clienteNome || clienteNome,
        eventos: hist.eventos ?? [],
        qtdEmailsAlerta: indicadores.qtdEmailsAlerta,
        qtdEmailsAcao: indicadores.qtdEmailsAcao,
        qtdEmailsTotal: indicadores.qtdEmailsTotal,
        qtdAcoesRegistradas: indicadores.qtdAcoesRegistradas,
        alertaEm: indicadores.alertaEm,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const abrirContasCliente = async (clienteNome: string, clienteChave?: string) => {
    const key = clienteChave || clienteNome;
    setClienteContasModal(clienteNome);
    setErro(null);
    const cached = contasCacheRef.current.get(key);
    if (cached !== undefined) {
      setMonitorContas(cached);
      return;
    }
    setCarregandoContas(true);
    setMonitorContas(null);
    try {
      const data = await fetchCrmPendenciasContasCliente(key);
      contasCacheRef.current.set(key, data.monitor);
      setMonitorContas(data.monitor);
      if (data.clienteNome) setClienteContasModal(data.clienteNome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar contas');
      setClienteContasModal(null);
    } finally {
      setCarregandoContas(false);
    }
  };

  const aguardandoAcao = useMemo(
    () => itens.filter((i) => !i.acao).length,
    [itens],
  );

  const gruposCliente = useMemo(() => {
    const map = new Map<string, PendenciaCreditoItem[]>();
    for (const item of itens) {
      const key = item.clienteNome.trim() || `pedido-${item.id}`;
      const lista = map.get(key);
      if (lista) lista.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].map(([clienteNome, pedidos]) => ({
      clienteNome,
      pedidos,
    }));
  }, [itens]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-2 p-4">
          <button
            type="button"
            onClick={() => setDestinatariosAberto((v) => !v)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-expanded={destinatariosAberto}
          >
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
                destinatariosAberto ? 'rotate-0' : '-rotate-90'
              }`}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                E-mail — ação e alerta de prazo
              </span>
              {!destinatariosAberto && (
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {selecionadosTo.length} To
                  {selecionadosTo.length
                    ? `: ${selecionadosTo.map(labelUsuario).join(', ')}`
                    : ''}
                  {' · '}
                  {selecionadosCc.length} Cc
                  {selecionadosCc.length
                    ? `: ${selecionadosCc.map(labelUsuario).join(', ')}`
                    : ''}
                  {' · '}
                  prazo {prazoHorasSemAcao}h
                </span>
              )}
            </span>
          </button>
          {podeEditarDestinatarios && !editandoDestinatarios && (
            <button
              type="button"
              onClick={iniciarEdicaoDestinatarios}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Editar
            </button>
          )}
        </div>

        {destinatariosAberto && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ao confirmar a ação (após o status no Nomus), o sistema envia um
              e-mail-resumo para To e Cc. Pesquise usuários do Gestão e adicione na
              lista — o envio usa o e-mail cadastrado no usuário.
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <ListaUsuariosDestinatarios
                titulo="Destinatários (To)"
                usuarios={usuarios}
                selecionados={selecionadosTo}
                podeEditar={podeEditarDestinatarios && editandoDestinatarios}
                excluirIds={new Set(idsCc)}
                onAdicionar={(id) => adicionarDest('to', id)}
                onRemover={(id) => removerDest('to', id)}
              />
              <ListaUsuariosDestinatarios
                titulo="Cópias (Cc)"
                usuarios={usuarios}
                selecionados={selecionadosCc}
                podeEditar={podeEditarDestinatarios && editandoDestinatarios}
                excluirIds={new Set(idsTo)}
                onAdicionar={(id) => adicionarDest('cc', id)}
                onRemover={(id) => removerDest('cc', id)}
              />
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Prazo sem ação (SLA)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Define quantas horas após o alerta a ação deve ser tomada (coluna
                Tempo / prazo). O e-mail de prazo estourado — dias, horários e
                destinatários — fica em{' '}
                <strong>Integração → E-mail</strong>, no tipo{' '}
                <em>Alerta de crédito — prazo de ação estourado</em>.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Prazo (horas)
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={prazoHorasSemAcao}
                    disabled={!podeEditarDestinatarios || !editandoDestinatarios}
                    onChange={(e) =>
                      setPrazoHorasSemAcao(
                        Math.min(720, Math.max(1, Number(e.target.value) || 48)),
                      )
                    }
                    className="mt-1 w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <span className="pb-2 text-xs text-slate-500 dark:text-slate-400">
                  Padrão: 48h
                </span>
              </div>
            </div>

            {podeEditarDestinatarios && editandoDestinatarios && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSalvarEmail()}
                  disabled={salvandoEmail}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {salvandoEmail ? 'Salvando…' : 'Salvar destinatários'}
                </button>
                <button
                  type="button"
                  onClick={cancelarEdicaoDestinatarios}
                  disabled={salvandoEmail}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
          {aviso}
        </div>
      )}

      {mensagemNomus &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mensagem-nomus-titulo"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setMensagemNomus(null);
            }}
          >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-800/70 dark:bg-slate-900">
              <div className="border-b border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-800/70 dark:bg-amber-950/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl dark:bg-amber-900/60">
                    !
                  </div>
                  <div>
                    <h3
                      id="mensagem-nomus-titulo"
                      className="text-base font-bold text-amber-950 dark:text-amber-200"
                    >
                      {mensagemNomus.titulo}
                    </h3>
                    <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
                      Pedido {mensagemNomus.pedido}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-200">
                  {mensagemNomus.mensagem}
                </p>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/60">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setMensagemNomus(null)}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 pt-2 dark:border-slate-700">
          {FILAS.map((fila) => {
            const ativo = situacaoFila === fila.id;
            const qtd = contagens[fila.id] ?? 0;
            return (
              <button
                key={fila.id}
                type="button"
                onClick={() => trocarFila(fila.id)}
                className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                  ativo
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {fila.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    ativo
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {situacaoFila === 'INADIMPLENTES' && aguardandoAcao > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {aguardandoAcao} aguardando ação
              </span>
            ) : situacaoFila === 'REGULARIZADOS' ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {itens.length} pedido{itens.length === 1 ? '' : 's'} — liberar no Nomus
              </span>
            ) : (
              <span>
                {itens.length}{' '}
                {situacaoFila === 'FINALIZADOS' ? 'finalizado' : 'pendência'}
                {itens.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEmitirPdfAprovacao}
              disabled={carregando || itens.length === 0}
              title="PDF para o gestor marcar a decisão e assinar"
              className="rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Emitir PDF aprovação
            </button>
            <button
              type="button"
              onClick={handleAtualizarTabela}
              disabled={carregando}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {carregando ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs leading-snug">
            <thead className="bg-blue-700 text-white dark:bg-blue-900">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Cliente</th>
                <th className="px-2 py-1.5 font-semibold">Pedido</th>
                <th className="px-2 py-1.5 font-semibold">Status Nomus</th>
                <th className="px-2 py-1.5 font-semibold">Atraso</th>
                <th className="px-2 py-1.5 font-semibold">Conta</th>
                <th className="px-2 py-1.5 font-semibold">Vencimento</th>
                <th className="px-2 py-1.5 font-semibold">Status conta</th>
                <th className="px-2 py-1.5 font-semibold">Ação</th>
                <th
                  className="px-2 py-1.5 font-semibold"
                  title="Tempo desde o alerta até a ação (prazo configurável)"
                >
                  Tempo / prazo
                </th>
                <th className="px-2 py-1.5 font-semibold">Observação</th>
                <th className="px-2 py-1.5 font-semibold" />
                <th
                  className="px-2 py-1.5 text-center font-semibold"
                  title="Histórico, e-mails e ações do cliente"
                >
                  Histórico
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando && itens.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Carregando…
                  </td>
                </tr>
              ) : itens.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    {situacaoFila === 'INADIMPLENTES'
                      ? 'Nenhuma pendência inadimplente. O alerta diário cria as linhas automaticamente.'
                      : situacaoFila === 'REGULARIZADOS'
                        ? 'Nenhum cliente regularizado aguardando liberação.'
                        : 'Nenhum pedido finalizado ainda.'}
                  </td>
                </tr>
              ) : (
                gruposCliente.flatMap((grupo, grupoIdx) => {
                  const rowSpan = grupo.pedidos.length;
                  const primeiro = grupo.pedidos[0];
                  const grupoBg =
                    grupoIdx % 2 === 0
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/80 dark:bg-slate-800/40';

                  return grupo.pedidos.map((item, pedidoIdx) => {
                    const acaoSel = draftAcao[item.id] ?? '';
                    const isPrimeira = pedidoIdx === 0;
                    const isUltima = pedidoIdx === rowSpan - 1;

                    return (
                      <tr
                        key={item.id}
                        className={`align-middle text-slate-700 dark:text-slate-200 ${grupoBg} ${
                          isUltima
                            ? 'border-b border-slate-200 dark:border-slate-700'
                            : 'border-b border-slate-100/80 dark:border-slate-700/50'
                        }`}
                      >
                        {isPrimeira && (
                          <td
                            rowSpan={rowSpan}
                            className="max-w-[11rem] border-r border-slate-100 px-2 py-1.5 align-middle font-medium text-slate-900 dark:border-slate-700 dark:text-slate-100"
                          >
                            <div className="break-words whitespace-normal leading-snug" title={grupo.clienteNome}>
                              {grupo.clienteNome}
                            </div>
                            {rowSpan > 1 && (
                              <div className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                {rowSpan} pedidos
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-1.5 align-middle font-medium">
                          <div className="break-words whitespace-normal">{item.numeroPedidoExibicao}</div>
                          {item.valorPedido != null && Number.isFinite(item.valorPedido) ? (
                            <div className="mt-0.5 break-words whitespace-normal text-[10px] font-normal tabular-nums text-slate-500 dark:text-slate-400">
                              {formatarBRL(item.valorPedido)}
                            </div>
                          ) : null}
                        </td>
                        <td className="max-w-[9rem] px-2 py-1.5 align-middle">
                          <div
                            className="break-words whitespace-normal leading-snug"
                            title={item.statusNomusLabel ?? undefined}
                          >
                            {item.statusNomusLabel ?? '—'}
                          </div>
                          {item.aguardandoConfirmacaoNomus && (
                            <span
                              className="mt-0.5 inline-block rounded bg-amber-100 px-1 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              title="Rascunho — aguardando confirmação no Nomus"
                            >
                              Rascunho · Nomus
                            </span>
                          )}
                          {item.emailAcaoEnviado && (
                            <span className="mt-0.5 inline-block rounded bg-emerald-100 px-1 py-px text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              E-mail ok
                            </span>
                          )}
                        </td>
                        {isPrimeira && (
                          <td
                            rowSpan={rowSpan}
                            className="border-x border-slate-100 px-2 py-1.5 align-middle dark:border-slate-700"
                          >
                            <div className="break-words whitespace-normal font-medium tabular-nums leading-snug">
                              {formatarBRL(primeiro.totalAtraso)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {primeiro.qtdTitulosAtraso ?? 0} tít.
                              {primeiro.maiorAtrasoDias != null
                                ? ` · ${primeiro.maiorAtrasoDias}d`
                                : ''}
                            </div>
                            {primeiro.regularizacaoSituacaoLabel && (
                              <div
                                className={`mt-0.5 text-[10px] font-medium ${
                                  primeiro.regularizacaoSituacao === 'REGULARIZADO'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {primeiro.regularizacaoSituacaoLabel}
                              </div>
                            )}
                          </td>
                        )}
                        {isPrimeira &&
                          (() => {
                            const contas = primeiro.contasAcompanhamento ?? [];
                            const cellClass =
                              'border-r border-slate-100 px-2 py-1.5 align-middle dark:border-slate-700';
                            if (contas.length === 0) {
                              return (
                                <>
                                  <td rowSpan={rowSpan} className={cellClass}>
                                    <span className="text-[10px] text-slate-400">—</span>
                                  </td>
                                  <td rowSpan={rowSpan} className={cellClass}>
                                    <span className="text-[10px] text-slate-400">—</span>
                                  </td>
                                  <td rowSpan={rowSpan} className={cellClass}>
                                    <span className="text-[10px] text-slate-400">—</span>
                                  </td>
                                </>
                              );
                            }
                            return (
                              <>
                                <td rowSpan={rowSpan} className={cellClass}>
                                  <ul className="space-y-0.5">
                                    {contas.map((c) => (
                                      <li
                                        key={c.codigoConta}
                                        className="whitespace-nowrap text-[11px] font-medium tabular-nums"
                                      >
                                        {c.codigoConta}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                                <td rowSpan={rowSpan} className={cellClass}>
                                  <ul className="space-y-0.5">
                                    {contas.map((c) => (
                                      <li
                                        key={`v-${c.codigoConta}`}
                                        className="whitespace-nowrap text-[11px] tabular-nums"
                                      >
                                        {formatarDataCurta(c.dataVencimento)}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                                <td rowSpan={rowSpan} className={cellClass}>
                                  <ul className="space-y-0.5">
                                    {contas.map((c) => (
                                      <li key={`s-${c.codigoConta}`}>
                                        <span
                                          className={`inline-block rounded px-1 py-px text-[10px] font-medium ${
                                            c.status === 'REGULARIZADO'
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                          }`}
                                        >
                                          {c.statusLabel}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </>
                            );
                          })()}
                        <td className="min-w-[9.5rem] max-w-[11rem] px-2 py-1.5 align-middle">
                          {situacaoFila === 'REGULARIZADOS' ? (
                            <div>
                              <div className="break-words whitespace-normal font-medium leading-snug text-emerald-800 dark:text-emerald-300">
                                Confirmar liberação
                              </div>
                              <div className="mt-0.5 break-words whitespace-normal text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                                {item.acaoLabel ?? 'Pausado / realocado'}
                                {item.acaoPorNome || item.acaoPorLogin
                                  ? ` · ${item.acaoPorNome || item.acaoPorLogin}`
                                  : ''}
                              </div>
                            </div>
                          ) : situacaoFila === 'FINALIZADOS' ? (
                            <div>
                              <div className="break-words whitespace-normal font-medium leading-snug text-slate-800 dark:text-slate-200">
                                {item.acaoLabel ?? '—'}
                              </div>
                              <div className="mt-0.5 break-words whitespace-normal text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                                Encerrado
                                {item.acaoPorNome || item.acaoPorLogin
                                  ? ` · ${item.acaoPorNome || item.acaoPorLogin}`
                                  : ''}
                              </div>
                              {item.temPdfAssinado ? (
                                <button
                                  type="button"
                                  onClick={() => void handleBaixarPdfAssinado(item)}
                                  className="mt-0.5 block max-w-full break-words whitespace-normal text-left text-[10px] font-medium leading-snug text-blue-700 hover:underline dark:text-blue-400"
                                  title={item.pdfAssinadoNome ?? 'PDF assinado'}
                                >
                                  PDF: {item.pdfAssinadoNome ?? 'Ver'}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <select
                                value={acaoSel}
                                onChange={(e) => {
                                  const value = e.target.value as AcaoPendenciaCredito | '';
                                  setDraftAcao((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }));
                                }}
                                className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              >
                                <option value="">Aguardando ação…</option>
                                {ACOES.map((a) => (
                                  <option key={a.value} value={a.value}>
                                    {a.label}
                                  </option>
                                ))}
                              </select>
                              {item.acaoLabel && (
                                <div
                                  className="mt-0.5 break-words whitespace-normal text-[10px] leading-snug text-slate-500 dark:text-slate-400"
                                  title={`Salvo: ${item.acaoLabel}${
                                    item.acaoPorNome || item.acaoPorLogin
                                      ? ` · ${item.acaoPorNome || item.acaoPorLogin}`
                                      : ''
                                  }`}
                                >
                                  Salvo: {item.acaoLabel}
                                  {item.acaoPorNome || item.acaoPorLogin
                                    ? ` · ${item.acaoPorNome || item.acaoPorLogin}`
                                    : ''}
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                {item.temPdfAssinado ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleBaixarPdfAssinado(item)}
                                      className="max-w-full break-words whitespace-normal text-left text-[10px] font-medium leading-snug text-blue-700 hover:underline dark:text-blue-400"
                                      title={item.pdfAssinadoNome ?? 'PDF assinado'}
                                    >
                                      PDF: {item.pdfAssinadoNome ?? 'Ver'}
                                    </button>
                                    {!item.emailAcaoEnviado && (
                                      <button
                                        type="button"
                                        onClick={() => void handleRemoverPdfAssinado(item)}
                                        disabled={pdfUploadingId === item.id}
                                        className="text-[10px] text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                                      >
                                        Remover
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <label
                                    className="inline-flex cursor-pointer items-center text-[10px] font-medium text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200"
                                    title={
                                      precisaPdfParaConfirmar(item, acaoSel)
                                        ? 'Obrigatório para confirmar (após Nomus / Seguir produção)'
                                        : 'Anexar PDF assinado pelo gestor'
                                    }
                                  >
                                    <input
                                      type="file"
                                      accept="application/pdf,.pdf"
                                      className="sr-only"
                                      disabled={pdfUploadingId === item.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        e.target.value = '';
                                        void handleAnexarPdfAssinado(item, file);
                                      }}
                                    />
                                    {pdfUploadingId === item.id
                                      ? 'Enviando…'
                                      : precisaPdfParaConfirmar(item, acaoSel)
                                        ? 'Anexar PDF *'
                                        : 'Anexar PDF'}
                                  </label>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 align-middle">
                          {(() => {
                            const t = formatarTempoExecucao(item);
                            return (
                              <div className={`text-[11px] leading-snug ${t.className}`}>
                                {t.label}
                                {item.emailSlaEnviado ? (
                                  <div className="mt-px text-[10px] font-normal text-slate-400">
                                    Gestor ok
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="min-w-[9rem] max-w-[12rem] px-2 py-1.5 align-middle">
                          {situacaoFila === 'FINALIZADOS' ? (
                            <div
                              className="break-words whitespace-normal text-[11px] leading-snug text-slate-600 dark:text-slate-300"
                              title={item.observacao?.trim() || undefined}
                            >
                              {item.observacao?.trim() || '—'}
                              {item.pedidoDestino ? (
                                <div className="mt-0.5 break-words text-[10px] text-slate-500">
                                  Destino: {item.pedidoDestino}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={draftObs[item.id] ?? ''}
                                onChange={(e) =>
                                  setDraftObs((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="Obs."
                                disabled={situacaoFila === 'REGULARIZADOS'}
                                className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                              />
                              {situacaoFila === 'REGULARIZADOS' && item.pedidoDestino ? (
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  Destino: {item.pedidoDestino}
                                </div>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {situacaoFila === 'FINALIZADOS' ? (
                            <span className="text-[10px] text-slate-400">—</span>
                          ) : situacaoFila === 'REGULARIZADOS' ? (
                            <button
                              type="button"
                              onClick={() => void handleConfirmarLiberacao(item)}
                              disabled={salvandoId === item.id}
                              className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {salvandoId === item.id
                                ? 'Confirmando…'
                                : 'Confirmar'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSalvarAcao(item)}
                              disabled={
                                salvandoId === item.id ||
                                !acaoSel ||
                                precisaPdfParaConfirmar(item, acaoSel) ||
                                pdfUploadingId === item.id
                              }
                              title={
                                precisaPdfParaConfirmar(item, acaoSel)
                                  ? 'Anexe o PDF assinado pelo gestor antes de confirmar'
                                  : undefined
                              }
                              className="rounded bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              {salvandoId === item.id
                                ? 'Salvando…'
                                : item.aguardandoConfirmacaoNomus
                                  ? 'Confirmar'
                                  : 'Salvar'}
                            </button>
                          )}
                        </td>
                        {isPrimeira && (
                          <td
                            rowSpan={rowSpan}
                            className="border-l border-slate-100 px-2 py-1.5 text-center align-middle dark:border-slate-700"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void abrirHistoricoCliente(
                                  grupo.clienteNome,
                                  primeiro.clienteChave,
                                  {
                                    qtdEmailsAlerta: primeiro.qtdEmailsAlerta ?? 0,
                                    qtdEmailsAcao: primeiro.qtdEmailsAcao ?? 0,
                                    qtdEmailsTotal: primeiro.qtdEmailsTotal ?? 0,
                                    qtdAcoesRegistradas: primeiro.qtdAcoesRegistradas ?? 0,
                                    alertaEm: primeiro.alertaEm ?? null,
                                  },
                                )
                              }
                              disabled={carregandoHistorico}
                              className="relative inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-700 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                              title={`Histórico e e-mails de ${grupo.clienteNome}`}
                              aria-label={`Histórico e e-mails de ${grupo.clienteNome}`}
                            >
                              <Clock className="h-5 w-5" aria-hidden />
                              {(primeiro.qtdEmailsTotal ?? 0) > 0 ? (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white">
                                  {primeiro.qtdEmailsTotal > 99
                                    ? '99+'
                                    : primeiro.qtdEmailsTotal}
                                </span>
                              ) : null}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historicoCliente &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historico-pendencia-titulo"
            onClick={() => setHistoricoCliente(null)}
          >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <h2
                  id="historico-pendencia-titulo"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Histórico
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {historicoCliente.clienteNome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoricoCliente(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    E-mails enviados
                  </div>
                  <div className="mt-0.5 text-xl font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                    {historicoCliente.qtdEmailsTotal}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ações tomadas
                  </div>
                  <div className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {historicoCliente.qtdAcoesRegistradas}
                  </div>
                </div>
              </div>
              {historicoCliente.alertaEm ? (
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Último alerta: {formatarDataHora(historicoCliente.alertaEm)}
                </p>
              ) : null}

              {historicoCliente.eventos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhum e-mail enviado ou ação registrada para este cliente.
                </p>
              ) : (
                <ul className="space-y-3">
                  {historicoCliente.eventos.map((ev) => {
                    const isEmail =
                      ev.tipo === 'EMAIL' ||
                      ev.tipo === 'EMAIL_ALERTA' ||
                      ev.tipo === 'EMAIL_REGULARIZADO';
                    const isAcao =
                      ev.tipo === 'ACAO' ||
                      ev.tipo === 'LIBERACAO' ||
                      ev.tipo === 'FINALIZADO' ||
                      ev.tipo === 'PDF_ASSINADO';
                    const mostrarPedido =
                      Boolean(ev.numeroPedidoExibicao) &&
                      (ev.tipo === 'ACAO' ||
                        ev.tipo === 'EMAIL' ||
                        ev.tipo === 'LIBERACAO' ||
                        ev.tipo === 'FINALIZADO' ||
                        ev.tipo === 'PDF_ASSINADO');
                    return (
                    <li
                      key={`${ev.tipo}-${ev.id}-${ev.createdAt}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isAcao
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isEmail
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {ev.tipoLabel}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatarDataHora(ev.createdAt)}
                        </span>
                      </div>
                      {mostrarPedido && (
                        <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                          Pedido {ev.numeroPedidoExibicao}
                        </div>
                      )}
                      {ev.detalhe && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {ev.detalhe}
                        </p>
                      )}
                      {ev.usuarioLogin && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Por: {ev.usuarioLogin}
                        </p>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {(clienteContasModal || carregandoContas) &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contas-pendencia-titulo"
            onClick={() => {
              setClienteContasModal(null);
              setMonitorContas(null);
            }}
          >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <h2
                  id="contas-pendencia-titulo"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  Contas do cliente
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {clienteContasModal}
                  {monitorContas?.situacaoLabel
                    ? ` · ${monitorContas.situacaoLabel}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setClienteContasModal(null);
                  setMonitorContas(null);
                }}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {carregandoContas ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Carregando contas…
                </p>
              ) : !monitorContas || monitorContas.titulos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhum título no ciclo de monitoramento. O acompanhamento inicia
                  após a pausa confirmada no Nomus.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Código</th>
                        <th className="px-3 py-2 font-semibold">Vencimento</th>
                        <th className="px-3 py-2 font-semibold text-right">Valor ref.</th>
                        <th className="px-3 py-2 font-semibold">NF-e</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Regularizado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorContas.titulos.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          <td className="px-3 py-2 font-medium">{t.codigoConta}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {t.dataVencimento
                              ? formatarDataHora(t.dataVencimento).split(',')[0]
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formatarBRL(t.valorReferencia)}
                          </td>
                          <td className="px-3 py-2">{t.nfeOrigem ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                t.status === 'REGULARIZADO'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {t.statusLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {t.regularizadoEm
                              ? formatarDataHora(t.regularizadoEm)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
