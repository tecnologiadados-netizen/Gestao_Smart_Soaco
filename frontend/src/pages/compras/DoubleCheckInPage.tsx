import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DoubleCheckInDashboardModal from './DoubleCheckInDashboardModal';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Eye, LayoutDashboard, RefreshCw, Settings2, Users } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { useAuth } from '../../contexts/AuthContext';
import {
  conferirDoubleCheckIn,
  fetchDoubleCheckInDestinatarios,
  fetchDoubleCheckInItens,
  fetchDoubleCheckInParametros,
  fetchDoubleCheckInStatus,
  saveDoubleCheckInDestinatarios,
  saveDoubleCheckInParametros,
  syncDoubleCheckIn,
  type DoubleCheckInItem,
  type DoubleCheckInNota,
  type DoubleCheckInUsuarioDest,
} from '../../api/compras';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';

const POLL_MS = 120_000;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_DEFAULT = 10;

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

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

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sinal = n > 0 ? '+' : '';
  return `${sinal}${n.toFixed(1).replace('.', ',')}%`;
}

function isAdminOuMaster(opts: {
  isMaster: boolean;
  login: string | null | undefined;
  grupo: string | null | undefined;
}): boolean {
  const { isMaster, login, grupo } = opts;
  return (
    isMaster ||
    login === 'admin' ||
    grupo === 'admin' ||
    grupo === 'Administrador' ||
    grupo === 'Master'
  );
}

type DetalheCache = {
  itens: DoubleCheckInItem[];
  limiarPct: number;
  dataEmissao: string | null;
};

export default function DoubleCheckInPage() {
  const { isMaster, login, grupo } = useAuth();
  const podeDestinatarios = isAdminOuMaster({ isMaster, login, grupo });

  const [dataInicio, setDataInicio] = useState('2024-01-01');
  const [dataFim, setDataFim] = useState(hojeYmd());
  const [filtroTexto, setFiltroTexto] = useState('');
  const [notas, setNotas] = useState<DoubleCheckInNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [limiarPct, setLimiarPct] = useState(10);
  const [alertaDesde, setAlertaDesde] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [alertasEnviados, setAlertasEnviados] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_DEFAULT);
  /** idDocumento → temForaLimiar (página atual / cache). */
  const [statusMap, setStatusMap] = useState<Record<number, boolean>>({});
  const [statusLoading, setStatusLoading] = useState(false);

  const [modalNota, setModalNota] = useState<DoubleCheckInNota | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [detalheItens, setDetalheItens] = useState<DoubleCheckInItem[]>([]);
  const [detalheLimiar, setDetalheLimiar] = useState(10);

  const [paramAberto, setParamAberto] = useState(false);
  const [paramDraft, setParamDraft] = useState('10');
  const [paramSalvando, setParamSalvando] = useState(false);
  const [paramErro, setParamErro] = useState<string | null>(null);

  const [destAberto, setDestAberto] = useState(false);
  const [destUsuarios, setDestUsuarios] = useState<DoubleCheckInUsuarioDest[]>([]);
  const [destIds, setDestIds] = useState<number[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [destSalvando, setDestSalvando] = useState(false);
  const [destErro, setDestErro] = useState<string | null>(null);
  const [destBusca, setDestBusca] = useState('');

  const [senhaAberto, setSenhaAberto] = useState(false);
  const [senhaDraft, setSenhaDraft] = useState('');
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaSalvando, setSenhaSalvando] = useState(false);
  const [dashAberto, setDashAberto] = useState(false);

  const detalheCacheRef = useRef(new Map<number, DetalheCache>());
  const statusCacheRef = useRef(new Map<string, boolean>());
  const syncSeqRef = useRef(0);
  const statusSeqRef = useRef(0);
  const appliedRef = useRef({ dataInicio: '2024-01-01', dataFim: hojeYmd() });

  const limparCachesGrade = useCallback(() => {
    detalheCacheRef.current.clear();
    statusCacheRef.current.clear();
    setStatusMap({});
  }, []);

  const carregarParametros = useCallback(async () => {
    const r = await fetchDoubleCheckInParametros();
    if (!r.erro) {
      setLimiarPct(r.limiarPct);
      if (r.alertaDesde) setAlertaDesde(r.alertaDesde);
    }
  }, []);

  const sincronizar = useCallback(
    async (opts?: { silencioso?: boolean }) => {
      const seq = ++syncSeqRef.current;
      const di = appliedRef.current.dataInicio;
      const df = appliedRef.current.dataFim;
      if (!opts?.silencioso) {
        setSyncing(true);
        setErro(null);
      }
      try {
        const r = await syncDoubleCheckIn({ dataInicio: di, dataFim: df });
        if (seq !== syncSeqRef.current) return;
        if (r.erro) {
          if (!opts?.silencioso) setErro(r.erro);
          return;
        }
        setNotas(r.notas);
        setLimiarPct(r.limiarPct);
        if (r.alertaDesde) setAlertaDesde(r.alertaDesde);
        setAlertasEnviados(r.alertasEnviados);
        setUltimaSync(new Date().toLocaleTimeString('pt-BR'));
        detalheCacheRef.current.clear();
      } catch (e) {
        if (seq !== syncSeqRef.current) return;
        if (!opts?.silencioso) {
          setErro(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (seq === syncSeqRef.current && !opts?.silencioso) setSyncing(false);
      }
    },
    []
  );

  const filtrar = useCallback(async () => {
    appliedRef.current = { dataInicio, dataFim };
    limparCachesGrade();
    setPage(1);
    setLoading(true);
    setErro(null);
    try {
      await sincronizar();
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, sincronizar, limparCachesGrade]);

  useEffect(() => {
    void carregarParametros();
    void filtrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void sincronizar({ silencioso: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [sincronizar]);

  const abrirDetalhe = useCallback(async (nota: DoubleCheckInNota) => {
    setModalNota(nota);
    setDetalheErro(null);
    // Sempre busca de novo: histórico depende de regras do backend (tipos, limiar).
    detalheCacheRef.current.delete(nota.idDocumento);
    setDetalheLoading(true);
    setDetalheItens([]);
    try {
      const r = await fetchDoubleCheckInItens(nota.idDocumento);
      if (r.erro) {
        setDetalheErro(r.erro);
        return;
      }
      detalheCacheRef.current.set(nota.idDocumento, {
        itens: r.itens,
        limiarPct: r.limiarPct,
        dataEmissao: r.dataEmissao,
      });
      const temFora = r.itens.some((i) => i.foraLimiar);
      statusCacheRef.current.set(`${nota.idDocumento}:${r.limiarPct}`, temFora);
      setStatusMap((prev) => ({ ...prev, [nota.idDocumento]: temFora }));
      setDetalheItens(r.itens);
      setDetalheLimiar(r.limiarPct);
    } catch (e) {
      setDetalheErro(e instanceof Error ? e.message : String(e));
    } finally {
      setDetalheLoading(false);
    }
  }, []);

  const notasFiltradas = (() => {
    const match = criarMatcherTextoLivre(filtroTexto);
    if (!filtroTexto.trim()) return notas;
    return notas.filter(
      (n) =>
        match(n.numeroDocumentoFiscal ?? '') ||
        match(n.numeroNfe ?? '') ||
        match(n.nomeParceiro ?? '') ||
        match(String(n.idParceiro ?? ''))
    );
  })();

  const totalParaPaginacao = notasFiltradas.length;
  const totalPages = Math.max(1, Math.ceil(totalParaPaginacao / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const notasPagina =
    totalParaPaginacao === 0
      ? []
      : notasFiltradas.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const idsPaginaKey = notasPagina.map((n) => n.idDocumento).join(',');

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!idsPaginaKey) {
      setStatusMap({});
      return;
    }
    const ids = idsPaginaKey.split(',').map(Number).filter((n) => n > 0);
    const fromCache: Record<number, boolean> = {};
    const missing: number[] = [];
    for (const id of ids) {
      const key = `${id}:${limiarPct}`;
      if (statusCacheRef.current.has(key)) {
        fromCache[id] = statusCacheRef.current.get(key)!;
      } else {
        missing.push(id);
      }
    }
    setStatusMap(fromCache);
    if (missing.length === 0) return;

    const seq = ++statusSeqRef.current;
    setStatusLoading(true);
    void (async () => {
      try {
        const r = await fetchDoubleCheckInStatus(missing);
        if (seq !== statusSeqRef.current) return;
        if (r.erro) return;
        const next: Record<number, boolean> = { ...fromCache };
        for (const row of r.status) {
          statusCacheRef.current.set(`${row.idDocumento}:${r.limiarPct}`, row.temForaLimiar);
          next[row.idDocumento] = row.temForaLimiar;
        }
        setStatusMap(next);
      } finally {
        if (seq === statusSeqRef.current) setStatusLoading(false);
      }
    })();
  }, [idsPaginaKey, limiarPct]);

  const abrirParametros = () => {
    setParamDraft(String(limiarPct));
    setParamErro(null);
    setParamAberto(true);
  };

  const salvarParametros = async () => {
    const n = Number(String(paramDraft).replace(',', '.'));
    setParamSalvando(true);
    setParamErro(null);
    try {
      const r = await saveDoubleCheckInParametros(n);
      if (r.erro) {
        setParamErro(r.erro);
        return;
      }
      setLimiarPct(r.limiarPct);
      limparCachesGrade();
      setParamAberto(false);
    } finally {
      setParamSalvando(false);
    }
  };

  const abrirDestinatarios = async () => {
    setDestAberto(true);
    setDestErro(null);
    setDestLoading(true);
    try {
      const r = await fetchDoubleCheckInDestinatarios();
      if (r.erro) {
        setDestErro(r.erro);
        return;
      }
      setDestUsuarios(r.usuarios);
      setDestIds(r.usuarioIds);
    } finally {
      setDestLoading(false);
    }
  };

  const salvarDestinatarios = async () => {
    setDestSalvando(true);
    setDestErro(null);
    try {
      const r = await saveDoubleCheckInDestinatarios({ usuarioIds: destIds });
      if (r.erro) {
        setDestErro(r.erro);
        return;
      }
      setDestAberto(false);
    } finally {
      setDestSalvando(false);
    }
  };

  const marcarNotaConferida = useCallback(
    (idDocumento: number, conferidoEm: string | null, conferidoPor: string | null) => {
      setNotas((prev) =>
        prev.map((n) =>
          n.idDocumento === idDocumento
            ? { ...n, conferido: true, conferidoEm, conferidoPor }
            : n
        )
      );
      setModalNota((prev) =>
        prev && prev.idDocumento === idDocumento
          ? { ...prev, conferido: true, conferidoEm, conferidoPor }
          : prev
      );
    },
    []
  );

  const abrirSenhaConferir = () => {
    setSenhaDraft('');
    setSenhaErro(null);
    setSenhaAberto(true);
  };

  const confirmarConferencia = async () => {
    if (!modalNota) return;
    const senha = senhaDraft.trim();
    if (!senha) {
      setSenhaErro('Digite sua senha.');
      return;
    }
    setSenhaSalvando(true);
    setSenhaErro(null);
    try {
      const r = await conferirDoubleCheckIn({
        idDocumento: modalNota.idDocumento,
        senha,
      });
      if (r.erro) {
        setSenhaErro(r.erro);
        return;
      }
      marcarNotaConferida(
        modalNota.idDocumento,
        r.conferidoEm ?? null,
        r.conferidoPor ?? null
      );
      setSenhaAberto(false);
      setSenhaDraft('');
    } finally {
      setSenhaSalvando(false);
    }
  };
  const destMatch = criarMatcherTextoLivre(destBusca);
  const destFiltrados = destUsuarios.filter(
    (u) =>
      !destBusca.trim() ||
      destMatch(u.login) ||
      destMatch(u.nome ?? '') ||
      destMatch(u.telefone ?? '')
  );

  return (
    <div className="space-y-4 relative">
      <CarregandoInformacoesOverlay show={loading || syncing} mode="contained" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Double Check NFe</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Conferência de entradas com variação de preço (limiar ±{limiarPct}%). Atualiza a cada 2 min.
            WhatsApp só para NFs com emissão
            {alertaDesde ? ` a partir de ${fmtDataBr(alertaDesde)}` : ' a partir do go-live'}.
            {ultimaSync ? ` Última sync: ${ultimaSync}` : ''}
            {alertasEnviados != null && alertasEnviados > 0
              ? ` · ${alertasEnviados} alerta(s) WhatsApp nesta sync`
              : ''}
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => setDashAberto(true)}>
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>Data início</label>
            <input
              type="date"
              className={inputClass}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Data fim</label>
            <input
              type="date"
              className={inputClass}
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className={labelClass}>Busca na grade</label>
            <input
              className={`${inputClass} w-full`}
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            />
          </div>
          <button type="button" className={btnPrimary} onClick={() => void filtrar()} disabled={loading || syncing}>
            Filtrar
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void sincronizar()}
            disabled={loading || syncing}
            title="Sincronizar agora"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          <button type="button" className={btnSecondary} onClick={abrirParametros}>
            <Settings2 className="h-4 w-4" />
            Parâmetros
          </button>
          {podeDestinatarios && (
            <button type="button" className={btnSecondary} onClick={() => void abrirDestinatarios()}>
              <Users className="h-4 w-4" />
              Destinatários WhatsApp
            </button>
          )}
        </div>
        {erro && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
            {erro}
          </p>
        )}
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Nº Doc. Fiscal</th>
              <th className="px-3 py-2.5 font-semibold">Nº NF-e</th>
              <th className="px-3 py-2.5 font-semibold">Emissão</th>
              <th className="px-3 py-2.5 font-semibold">ID Parceiro</th>
              <th className="px-3 py-2.5 font-semibold">Parceiro</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Conferência</th>
              <th className="px-3 py-2.5 font-semibold text-right">Itens</th>
              <th className="px-3 py-2.5 font-semibold text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {notasPagina.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma entrada no período.
                </td>
              </tr>
            ) : (
              notasPagina.map((n) => {
                const temFora = statusMap[n.idDocumento];
                const statusPronto = Object.prototype.hasOwnProperty.call(statusMap, n.idDocumento);
                const conferido = Boolean(n.conferido);
                return (
                  <tr
                    key={n.idDocumento}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      conferido
                        ? 'border-l-4 border-l-emerald-500'
                        : 'border-l-4 border-l-amber-400'
                    }`}
                  >
                    <td className="px-3 py-2 tabular-nums">{n.numeroDocumentoFiscal ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{n.numeroNfe ?? '—'}</td>
                    <td className="px-3 py-2">{fmtDataBr(n.dataEmissao)}</td>
                    <td className="px-3 py-2 tabular-nums">{n.idParceiro ?? '—'}</td>
                    <td className="px-3 py-2 max-w-[18rem] truncate" title={n.nomeParceiro ?? undefined}>
                      {n.nomeParceiro ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {!statusPronto ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          {statusLoading ? '…' : '—'}
                        </span>
                      ) : temFora ? (
                        <span
                          className="dci-status-atencao inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                          title="Há item(ns) com variação acima do limiar"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="animate-pulse">Atenção</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                          title="Todos os itens dentro do limiar"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {conferido ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                          title={
                            n.conferidoPor
                              ? `Conferido por ${n.conferidoPor}${n.conferidoEm ? ` em ${new Date(n.conferidoEm).toLocaleString('pt-BR')}` : ''}`
                              : 'Conferido'
                          }
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Conferido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{n.qtdeItens}</td>
                    <td className="px-3 py-2 text-center">
                      <GradeCelulaModalBtn
                        align="center"
                        title="Ver itens"
                        onClick={() => void abrirDetalhe(n)}
                      >
                        <Eye className="h-4 w-4" />
                      </GradeCelulaModalBtn>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <style>{`
          @keyframes dci-status-flash {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
          .dci-status-atencao {
            animation: dci-status-flash 1.4s ease-in-out infinite;
          }
        `}</style>
      </div>

      {totalParaPaginacao > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <span>
            Exibindo {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalParaPaginacao)} de{' '}
            {totalParaPaginacao} registros
            {filtroTexto.trim() ? (
              <span className="text-slate-500 dark:text-slate-400"> (busca ativa)</span>
            ) : null}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="whitespace-nowrap">Por página</span>
              <select
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-slate-700 dark:text-slate-200"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Registros por página"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1 || loading || syncing}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-slate-500 dark:text-slate-400">
              Página {pageSafe} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages || loading || syncing}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <DoubleCheckInDashboardModal aberto={dashAberto} onClose={() => setDashAberto(false)} />

      {/* Modal itens */}
      {modalNota &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            onClick={() => setModalNota(null)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Itens da entrada
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Doc {modalNota.numeroDocumentoFiscal ?? '—'} · NF-e {modalNota.numeroNfe ?? '—'} ·{' '}
                    {fmtDataBr(modalNota.dataEmissao)} · {modalNota.nomeParceiro ?? '—'} · limiar ±
                    {detalheLimiar}%
                  </p>
                </div>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setModalNota(null)}
                >
                  Fechar
                </button>
              </div>
              <div className="relative min-h-[12rem] flex-1 overflow-auto p-4">
                <CarregandoInformacoesOverlay show={detalheLoading} mode="contained" />
                {detalheErro && (
                  <p className="mb-3 text-sm text-rose-600" role="alert">
                    {detalheErro}
                  </p>
                )}
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2">UM</th>
                      <th className="px-2 py-2 text-right">Qtde</th>
                      <th className="px-2 py-2 text-right">Vl. unit.</th>
                      <th className="px-2 py-2 text-right">Vl. total</th>
                      <th className="px-2 py-2 text-right">Variação</th>
                      <th className="px-2 py-2">Histórico (3)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {detalheItens.map((it) => (
                      <tr
                        key={it.idItem}
                        className={
                          it.foraLimiar
                            ? 'dfc-dci-alerta bg-amber-50/90 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-400/70'
                            : undefined
                        }
                      >
                        <td className="px-2 py-2">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {it.codigoProduto ?? it.idProduto}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-2">
                            {it.descricaoProduto ?? '—'}
                          </div>
                        </td>
                        <td className="px-2 py-2">{it.unidadeMedida ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfNum.format(it.qtde)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfBrl.format(it.valorUnitario)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfBrl.format(it.valorTotal)}</td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums font-semibold ${
                            it.foraLimiar
                              ? 'text-amber-700 dark:text-amber-300 animate-pulse'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {fmtPct(it.variacaoPct)}
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {it.historico.length === 0 ? (
                            <span className="text-slate-400">Sem entradas anteriores</span>
                          ) : (
                            <ul className="space-y-1">
                              {it.historico.map((h, idx) => (
                                <li key={`${h.idDocumento}-${idx}`}>
                                  <span className={idx === 0 ? 'font-semibold' : ''}>
                                    {fmtDataBr(h.dataEmissao)} · {nfBrl.format(h.valorUnitario)}
                                    {idx === 0 ? ' (ref.)' : ''}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 truncate max-w-[14rem]">
                                    {h.nomeParceiro ?? '—'} · Doc {h.numeroDocumentoFiscal ?? '—'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-600 dark:bg-slate-900/40">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {modalNota.conferido ? (
                    <span>
                      Conferida
                      {modalNota.conferidoPor ? ` por ${modalNota.conferidoPor}` : ''}
                      {modalNota.conferidoEm
                        ? ` em ${new Date(modalNota.conferidoEm).toLocaleString('pt-BR')}`
                        : ''}
                      .
                    </span>
                  ) : (
                    <span>Confirme com sua senha para marcar esta NF como conferida.</span>
                  )}
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={Boolean(modalNota.conferido) || detalheLoading}
                  onClick={abrirSenhaConferir}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {modalNota.conferido ? 'Já conferida' : 'Confirmar conferência'}
                </button>
              </div>
            </div>
            <style>{`
              @keyframes dci-alerta-pulse {
                0%, 100% { box-shadow: inset 0 0 0 0 rgba(245, 158, 11, 0.35); }
                50% { box-shadow: inset 0 0 0 4px rgba(245, 158, 11, 0.2); }
              }
              .dfc-dci-alerta { animation: dci-alerta-pulse 1.6s ease-in-out infinite; }
            `}</style>
          </div>,
          document.body
        )}

      {/* Modal senha conferência */}
      {senhaAberto &&
        modalNota &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => !senhaSalvando && setSenhaAberto(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Confirmar conferência
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Digite sua senha para marcar a NF{' '}
                <strong>{modalNota.numeroNfe ?? modalNota.numeroDocumentoFiscal ?? modalNota.idDocumento}</strong>{' '}
                como conferida.
              </p>
              <div className="mt-4">
                <label className={labelClass}>Senha</label>
                <input
                  type="password"
                  className={inputClass}
                  value={senhaDraft}
                  onChange={(e) => setSenhaDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void confirmarConferencia();
                  }}
                />
              </div>
              {senhaErro && <p className="mt-2 text-sm text-rose-600">{senhaErro}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={senhaSalvando}
                  onClick={() => setSenhaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={senhaSalvando || !senhaDraft.trim()}
                  onClick={() => void confirmarConferencia()}
                >
                  {senhaSalvando ? 'Confirmando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal parâmetros */}
      {paramAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10055] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => setParamAberto(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Parâmetros Double Check NFe
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Limiar absoluto de variação de preço (±%). Itens com |variação| acima deste valor são
                destacados. WhatsApp só dispara para NF com emissão
                {alertaDesde ? ` a partir de ${fmtDataBr(alertaDesde)}` : ' a partir do go-live'} —
                histórico anterior é ignorado no alerta (evita bloqueio do número).
              </p>
              <div className="mt-4">
                <label className={labelClass}>Limiar (%)</label>
                <input
                  className={inputClass}
                  value={paramDraft}
                  onChange={(e) => setParamDraft(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              {paramErro && <p className="mt-2 text-sm text-rose-600">{paramErro}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className={btnSecondary} onClick={() => setParamAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={paramSalvando}
                  onClick={() => void salvarParametros()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal destinatários */}
      {destAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10055] flex items-center justify-center p-4 bg-slate-900/55"
            role="dialog"
            aria-modal="true"
            onClick={() => setDestAberto(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Destinatários WhatsApp
                </h3>
                <p className="text-sm text-slate-500">
                  Usuários que receberão alerta quando uma NF (emissão a partir do go-live) tiver item
                  fora do limiar. Requer telefone cadastrado.
                </p>
                <input
                  className={`${inputClass} mt-3 w-full`}
                  value={destBusca}
                  onChange={(e) => setDestBusca(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                />
              </div>
              <div className="relative min-h-[10rem] flex-1 overflow-auto px-5 py-3">
                <CarregandoInformacoesOverlay show={destLoading} mode="contained" />
                {destErro && <p className="mb-2 text-sm text-rose-600">{destErro}</p>}
                <ul className="space-y-1">
                  {destFiltrados.map((u) => {
                    const checked = destIds.includes(u.id);
                    const semTel = !u.telefone?.trim();
                    return (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            disabled={semTel}
                            onChange={() => {
                              setDestIds((prev) =>
                                checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                              {u.nome || u.login}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {u.login}
                              {semTel ? ' · sem telefone' : ` · ${u.telefone}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-600">
                <button type="button" className={btnSecondary} onClick={() => setDestAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={destSalvando || destLoading}
                  onClick={() => void salvarDestinatarios()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
