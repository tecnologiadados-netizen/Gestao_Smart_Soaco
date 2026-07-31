import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CardsResumo from '../components/CardsResumo';
import CardsResumoFinanceiro from '../components/CardsResumoFinanceiro';
import FiltroPedidos, { type FiltrosPedidosState, defaultFiltros } from '../components/FiltroPedidos';
import TabelaPedidos from '../components/TabelaPedidos';
import { loadFiltrosDashboard, saveFiltrosDashboard } from '../utils/persistFiltros';
import ModalAjustePrevisao, { type AjustePrevisaoSuccessMeta } from '../components/ModalAjustePrevisao';
import {
  listarPedidos,
  obterResumo,
  obterResumoFinanceiro,
  type Pedido,
  type Resumo,
  type ResumoFinanceiro,
} from '../api/pedidos';
import { logout } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../config/permissoes';
import {
  pdLabelFromPedidoRow,
  pedidoElegivelReprogramarGerenciador,
} from '../utils/canalReprogramacaoDatas';
import { normalizePdLabelForCompare } from '../utils/rotaCarrada';

const PAGE_SIZE = 100;

const filtrosIniciais: FiltrosPedidosState = {
  ...defaultFiltros,
  data_ini: '',
  data_fim: '',
};

function toApiFiltros(f: FiltrosPedidosState) {
  return {
    cliente: f.cliente?.trim() || undefined,
    data_ini: f.data_ini || undefined,
    data_fim: f.data_fim || undefined,
    atrasados: f.atrasados || undefined,
    observacoes: f.observacoes?.trim() || undefined,
    pd: f.pd?.trim() || undefined,
    grupo_produto: f.grupo_produto?.trim() || undefined,
    municipio_entrega: f.municipio_entrega?.trim() || undefined,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const podeAjustarPrevisao =
    hasPermission(PERMISSOES.PCP_AJUSTAR_PREVISAO) ||
    hasPermission(PERMISSOES.PCP_TOTAL) ||
    hasPermission(PERMISSOES.PEDIDOS_EDITAR);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [resumoFinanceiro, setResumoFinanceiro] = useState<ResumoFinanceiro | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [loadingResumoFinanceiro, setLoadingResumoFinanceiro] = useState(true);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosPedidosState>(() => loadFiltrosDashboard(filtrosIniciais));
  const filtrosRef = useRef<FiltrosPedidosState>(filtrosIniciais);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalReprogramar, setModalReprogramar] = useState<{
    pedido: Pedido;
    demaisItens: Pedido[];
  } | null>(null);
  const [pdIncompletoAtual, setPdIncompletoAtual] = useState<{
    pd: string;
    selecionados: Pedido[];
    todosDoPd: Pedido[];
  } | null>(null);
  const [pdIncompletoQueue, setPdIncompletoQueue] = useState<
    Array<{ pd: string; selecionados: Pedido[]; todosDoPd: Pedido[] }>
  >([]);
  const reprogramarResolvedRef = useRef<Map<string, Pedido>>(new Map());
  const [reprogramarLoading, setReprogramarLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const carregarResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const r = await obterResumo();
      setResumo(r);
    } catch {
      setResumo(null);
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  const carregarResumoFinanceiro = useCallback(async () => {
    setLoadingResumoFinanceiro(true);
    try {
      const r = await obterResumoFinanceiro();
      setResumoFinanceiro(r);
    } catch {
      setResumoFinanceiro(null);
    } finally {
      setLoadingResumoFinanceiro(false);
    }
  }, []);

  const carregarPedidos = useCallback(async (pagina: number = 1, filtrosParaUsar?: FiltrosPedidosState) => {
    const efetivos = filtrosParaUsar ?? filtros;
    setLoadingPedidos(true);
    try {
      const result = await listarPedidos({
        ...toApiFiltros(efetivos),
        page: pagina,
        limit: PAGE_SIZE,
      });
      const data = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
      setPedidos(data);
      setTotal(typeof result?.total === 'number' ? result.total : data.length);
      setPage(pagina);
    } catch {
      setPedidos([]);
      setTotal(0);
    } finally {
      setLoadingPedidos(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  useEffect(() => {
    carregarResumoFinanceiro();
  }, [carregarResumoFinanceiro]);

  useEffect(() => {
    carregarPedidos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFiltrosComRef = useCallback((novo: FiltrosPedidosState) => {
    filtrosRef.current = novo;
    setFiltros(novo);
  }, []);

  const aplicarFiltros = useCallback(() => {
    carregarPedidos(1, filtrosRef.current);
  }, [carregarPedidos]);

  useEffect(() => {
    filtrosRef.current = filtros;
  }, [filtros]);

  useEffect(() => {
    saveFiltrosDashboard(filtros);
  }, [filtros]);

  const handleAjusteSuccess = (atualizado: Pedido, meta?: AjustePrevisaoSuccessMeta) => {
    const lista = meta?.atualizadosMesmaCarrada ?? meta?.todosItensPdAtualizados;
    if (lista && lista.length > 0) {
      const mapById = new Map(lista.map((p) => [String(p.id_pedido ?? '').trim(), p]));
      setPedidos((prev) =>
        prev.map((p) => {
          const id = String(p.id_pedido ?? '').trim();
          return mapById.get(id) ?? (p.id_pedido === atualizado.id_pedido ? atualizado : p);
        })
      );
      setToast('Datas reprogramadas e grade atualizada.');
    } else {
      setPedidos((prev) => prev.map((p) => (p.id_pedido === atualizado.id_pedido ? atualizado : p)));
      setToast('Previsão atualizada com sucesso.');
    }
    setSelectedIds(new Set());
    setModalReprogramar(null);
    carregarResumo();
    carregarResumoFinanceiro();
    setTimeout(() => setToast(null), 3000);
  };

  const abrirModalReprogramarComItens = (itens: Pedido[]) => {
    if (itens.length === 0) {
      setToast('Nenhum item elegível para reprogramar.');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    const [primeiro, ...rest] = itens;
    setModalReprogramar({ pedido: primeiro!, demaisItens: rest });
  };

  const avancarFilaPdIncompleto = (queue: typeof pdIncompletoQueue) => {
    if (queue.length === 0) {
      setPdIncompletoAtual(null);
      setPdIncompletoQueue([]);
      abrirModalReprogramarComItens([...reprogramarResolvedRef.current.values()]);
      return;
    }
    const [atual, ...rest] = queue;
    setPdIncompletoAtual(atual!);
    setPdIncompletoQueue(rest);
  };

  const iniciarReprogramar = async () => {
    const elegiveis = pedidos.filter(
      (p) =>
        selectedIds.has(String(p.id_pedido ?? '').trim()) &&
        pedidoElegivelReprogramarGerenciador(p as unknown as Record<string, unknown>)
    );
    if (elegiveis.length === 0) {
      setToast('Selecione ao menos um pedido de Requisição para reprogramar.');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setReprogramarLoading(true);
    reprogramarResolvedRef.current = new Map();
    try {
      const porPd = new Map<string, Pedido[]>();
      for (const p of elegiveis) {
        const pd = pdLabelFromPedidoRow(p as unknown as Record<string, unknown>);
        if (!pd) {
          reprogramarResolvedRef.current.set(String(p.id_pedido).trim(), p);
          continue;
        }
        const list = porPd.get(pd) ?? [];
        list.push(p);
        porPd.set(pd, list);
      }
      const incompletos: Array<{ pd: string; selecionados: Pedido[]; todosDoPd: Pedido[] }> = [];
      for (const [pd, sel] of porPd) {
        let todosDoPd: Pedido[] = [];
        try {
          const res = await listarPedidos({ pd, limit: 500, page: 1 });
          todosDoPd = (res.data ?? []).filter(
            (r) =>
              pedidoElegivelReprogramarGerenciador(r as unknown as Record<string, unknown>) &&
              normalizePdLabelForCompare(String((r as Record<string, unknown>)['PD'] ?? '').trim()) === pd
          );
          if (todosDoPd.length === 0) todosDoPd = sel;
        } catch {
          todosDoPd = sel;
        }
        const selIds = new Set(sel.map((s) => String(s.id_pedido).trim()));
        if (todosDoPd.some((t) => !selIds.has(String(t.id_pedido).trim())) && todosDoPd.length > sel.length) {
          incompletos.push({ pd, selecionados: sel, todosDoPd });
        } else {
          for (const s of sel) reprogramarResolvedRef.current.set(String(s.id_pedido).trim(), s);
        }
      }
      if (incompletos.length > 0) avancarFilaPdIncompleto(incompletos);
      else abrirModalReprogramarComItens([...reprogramarResolvedRef.current.values()]);
    } finally {
      setReprogramarLoading(false);
    }
  };

  const responderPdIncompleto = (usarTodos: boolean) => {
    const atual = pdIncompletoAtual;
    if (!atual) return;
    const itens = usarTodos ? atual.todosDoPd : atual.selecionados;
    for (const p of itens) reprogramarResolvedRef.current.set(String(p.id_pedido).trim(), p);
    avancarFilaPdIncompleto(pdIncompletoQueue);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // rede: token já removido
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-700/50 bg-slate-900/80 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Sair
        </button>
      </header>
      <main className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <CardsResumo resumo={resumo} loading={loadingResumo} />
          <CardsResumoFinanceiro resumo={resumoFinanceiro} loading={loadingResumoFinanceiro} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarFiltros((v) => !v)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm"
          >
            {mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
          {podeAjustarPrevisao && (
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size === 0) {
                  setToast('Selecione ao menos um pedido de Requisição para reprogramar.');
                  setTimeout(() => setToast(null), 4000);
                  return;
                }
                void iniciarReprogramar();
              }}
              disabled={reprogramarLoading || !!pdIncompletoAtual}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {reprogramarLoading
                ? 'Preparando...'
                : selectedIds.size > 0
                  ? `Reprogramar (${selectedIds.size})`
                  : 'Reprogramar'}
            </button>
          )}
        </div>
        {mostrarFiltros && (
          <FiltroPedidos filtros={filtros} onChange={setFiltrosComRef} onAplicar={aplicarFiltros} />
        )}
        <TabelaPedidos
          pedidos={pedidos}
          loading={loadingPedidos}
          selectedIds={podeAjustarPrevisao ? selectedIds : undefined}
          onSelectionChange={podeAjustarPrevisao ? setSelectedIds : undefined}
        />
        {total > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm text-slate-300">
            <span>
              Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} registros
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => carregarPedidos(page - 1, filtrosRef.current)}
                disabled={page <= 1 || loadingPedidos}
                className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-slate-400">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => carregarPedidos(page + 1, filtrosRef.current)}
                disabled={page >= totalPages || loadingPedidos}
                className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </main>

      {pdIncompletoAtual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              PD {pdIncompletoAtual.pd} — itens incompletos
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Você marcou <strong>{pdIncompletoAtual.selecionados.length}</strong> de{' '}
              <strong>{pdIncompletoAtual.todosDoPd.length}</strong> itens de requisição deste pedido.
              Deseja aplicar só nos marcados ou em todos os itens do PD?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => responderPdIncompleto(false)}
                className="w-full px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium text-left"
              >
                Somente os itens marcados
              </button>
              <button
                type="button"
                onClick={() => responderPdIncompleto(true)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-700 text-left"
              >
                Todos os itens deste pedido
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdIncompletoAtual(null);
                  setPdIncompletoQueue([]);
                  reprogramarResolvedRef.current = new Map();
                }}
                className="w-full px-4 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalReprogramar && (
        <ModalAjustePrevisao
          pedido={modalReprogramar.pedido}
          demaisItens={modalReprogramar.demaisItens}
          onClose={() => setModalReprogramar(null)}
          onSuccess={handleAjusteSuccess}
          onError={(msg) => setToast(msg)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[160] rounded-lg bg-slate-700 border border-slate-600 px-4 py-2 text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
