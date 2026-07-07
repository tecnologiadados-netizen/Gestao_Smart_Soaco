import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  consultarSequenciamentoAoVivo,
  gravarSequenciamentoSnapshot,
  listarSequenciamentoSnapshots,
  obterSequenciamentoSnapshot,
  type SequenciamentoCarradaAgregada,
  type SequenciamentoCarradasPayloadV1,
  type SequenciamentoSimulacao,
  type SequenciamentoSnapshotListItem,
} from '../../api/sequenciamentoCarradas';
import { ajustarDataProducaoLote, ajustarPrevisaoLote } from '../../api/pedidos';
import SequenciamentoCarradasDetalheModal from '../../components/sequenciamento-carradas/SequenciamentoCarradasDetalheModal';
import CalendarioProducaoModal from '../../components/sequenciamento-carradas/CalendarioProducaoModal';
import ConfirmacaoSimulacaoModal from '../../components/sequenciamento-carradas/ConfirmacaoSimulacaoModal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import {
  formatDateTimeBr,
  formatMoeda,
  formatPercentual,
  classPercentualEmDia,
  ordenarCarradas,
  subtotalCarradas,
  SUBTOTAL_ROW_CLASS,
} from '../../components/sequenciamento-carradas/sequenciamentoCarradasUtils';
import {
  carradaAlterada,
  carradaKeyDe,
  computarBaselines,
  computarItensDataProducao,
  computarPedidosComEntregaAlterada,
  formatDataCurta,
  hojeISO,
  valorEfetivo,
  type SimEntry,
} from '../../components/sequenciamento-carradas/simulacaoCarradas';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const COL_IDS = [
  'cod',
  'carrada',
  'dataProducao',
  'dataEntrega',
  'saldoAFaturar',
  'percentualEmDia',
  'adiantamento',
  'valorAVistaAte10d',
] as const;

const COL_NUMERICAS = new Set(['saldoAFaturar', 'percentualEmDia', 'adiantamento', 'valorAVistaAte10d']);

const COL_LABELS: Record<(typeof COL_IDS)[number], string> = {
  cod: 'Cód',
  carrada: 'Carrada',
  dataProducao: 'Data de produção',
  dataEntrega: 'Data de entrega',
  saldoAFaturar: 'Saldo a faturar',
  percentualEmDia: '% Em dia',
  adiantamento: 'Adiantamento',
  valorAVistaAte10d: 'Valor adiantamento + até 10d',
};

const DATE_INPUT_CLASS =
  'w-[9.5rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800';

type SnapshotVisualizado = {
  id: number | null;
  cod: string;
  createdAt: string;
  usuarioLogin: string;
  carradaCount: number;
  aoVivo: boolean;
};

function aplicarPayload(
  payload: SequenciamentoCarradasPayloadV1
): { carradas: SequenciamentoCarradaAgregada[]; linhas: Record<string, unknown>[] } {
  return {
    carradas: ordenarCarradas(payload.carradas ?? []),
    linhas: payload.linhas ?? [],
  };
}

export default function SequenciamentoCarradasPage() {
  const [mostrarHistorico, setMostrarHistorico] = useState(true);
  const [historicoLista, setHistoricoLista] = useState<SequenciamentoSnapshotListItem[]>([]);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);
  const [historicoVersao, setHistoricoVersao] = useState(0);

  const [snapshotVisualizado, setSnapshotVisualizado] = useState<SnapshotVisualizado | null>(null);
  const [carradas, setCarradas] = useState<SequenciamentoCarradaAgregada[]>([]);
  const [linhasSnapshot, setLinhasSnapshot] = useState<Record<string, unknown>[]>([]);
  const [detalheCarregando, setDetalheCarregando] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  const [gravando, setGravando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [feedbackGravacao, setFeedbackGravacao] = useState<string | null>(null);

  const [carradaDetalhe, setCarradaDetalhe] = useState<SequenciamentoCarradaAgregada | null>(null);

  // Simulação
  const [sim, setSim] = useState<Map<string, SimEntry>>(new Map());
  const [ordemManual, setOrdemManual] = useState<string[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const detalheReqRef = useRef(0);

  const aoVivo = snapshotVisualizado?.aoVivo ?? false;
  const editavel = aoVivo; // datas/ordem só editáveis na consulta ao vivo (snapshot é congelado)

  const baseline = useMemo(() => computarBaselines(linhasSnapshot), [linhasSnapshot]);

  const efProducao = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataProducao'),
    [sim, baseline]
  );
  const efEntrega = useCallback(
    (key: string) => valorEfetivo(sim, baseline, key, 'dataEntrega'),
    [sim, baseline]
  );

  const getCellText = useCallback(
    (c: SequenciamentoCarradaAgregada, colId: string): string => {
      const key = carradaKeyDe(c);
      switch (colId) {
        case 'cod':
          return c.cod;
        case 'carrada':
          return c.carrada;
        case 'dataProducao':
          return formatDataCurta(efProducao(key));
        case 'dataEntrega':
          return formatDataCurta(efEntrega(key));
        case 'saldoAFaturar':
          return formatMoeda(c.saldoAFaturar);
        case 'percentualEmDia':
          return formatPercentual(c.percentualEmDia ?? 0);
        case 'adiantamento':
          return formatMoeda(c.adiantamento);
        case 'valorAVistaAte10d':
          return formatMoeda(c.valorAVistaAte10d);
        default:
          return '';
      }
    },
    [efProducao, efEntrega]
  );

  const valueForSort = useCallback(
    (c: SequenciamentoCarradaAgregada, colId: string): string | number => {
      const key = carradaKeyDe(c);
      switch (colId) {
        case 'cod':
          return c.cod;
        case 'carrada':
          return c.carrada;
        case 'dataProducao':
          return efProducao(key) || '9999-12-31';
        case 'dataEntrega':
          return efEntrega(key) || '9999-12-31';
        case 'saldoAFaturar':
          return c.saldoAFaturar;
        case 'percentualEmDia':
          return c.percentualEmDia ?? 0;
        case 'adiantamento':
          return c.adiantamento;
        case 'valorAVistaAte10d':
          return c.valorAVistaAte10d;
        default:
          return '';
      }
    },
    [efProducao, efEntrega]
  );

  const grade = useGradeFiltrosExcel<SequenciamentoCarradaAgregada>({
    rows: carradas,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    defaultSortLevels: [],
  });

  const carradasFinais = useMemo(() => {
    const base = grade.rowsExibidas;
    if (!ordemManual) return base;
    const idx = new Map(ordemManual.map((k, i) => [k, i]));
    return [...base].sort(
      (a, b) => (idx.get(carradaKeyDe(a)) ?? 1e9) - (idx.get(carradaKeyDe(b)) ?? 1e9)
    );
  }, [grade.rowsExibidas, ordemManual]);

  const subtotal = useMemo(() => subtotalCarradas(carradasFinais), [carradasFinais]);

  const temAlteracoes = useMemo(
    () => [...sim.keys()].some((k) => carradaAlterada(sim, baseline, k)),
    [sim, baseline]
  );

  const pedidosEntrega = useMemo(
    () => computarPedidosComEntregaAlterada(linhasSnapshot, sim, baseline),
    [linhasSnapshot, sim, baseline]
  );
  const itensProducao = useMemo(
    () => computarItensDataProducao(linhasSnapshot, sim, baseline),
    [linhasSnapshot, sim, baseline]
  );

  const qtdCarradasSomenteProducao = useMemo(() => {
    const carradasComEntrega = new Set(pedidosEntrega.map((p) => p.rota));
    const carradasComProducao = new Set<string>();
    for (const key of sim.keys()) {
      const s = sim.get(key);
      if (!s || s.dataProducao === undefined) continue;
      const base = baseline.get(key)?.dataProducao ?? '';
      if (s.dataProducao !== '' && s.dataProducao !== base) {
        const c = carradas.find((x) => carradaKeyDe(x) === key);
        if (c) carradasComProducao.add(c.carrada);
      }
    }
    let count = 0;
    for (const rota of carradasComProducao) if (!carradasComEntrega.has(rota)) count += 1;
    return count;
  }, [sim, baseline, carradas, pedidosEntrega]);

  const carregarHistorico = useCallback(async () => {
    setHistoricoCarregando(true);
    setHistoricoErro(null);
    const r = await listarSequenciamentoSnapshots(100);
    setHistoricoCarregando(false);
    if (r.error) {
      setHistoricoErro(r.error);
      setHistoricoLista([]);
      return;
    }
    setHistoricoLista(r.data);
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico, historicoVersao]);

  const resetarSimulacao = useCallback(() => {
    setSim(new Map());
    setOrdemManual(null);
    grade.limparFiltrosGrade();
  }, [grade]);

  const fecharVisualizacao = useCallback(() => {
    setMostrarHistorico(true);
    setSnapshotVisualizado(null);
    setCarradas([]);
    setLinhasSnapshot([]);
    setDetalheErro(null);
    setCarradaDetalhe(null);
    setCalendarioAberto(false);
    setConfirmacaoAberta(false);
    resetarSimulacao();
  }, [resetarSimulacao]);

  const abrirComPayload = useCallback(
    (meta: SnapshotVisualizado, payload: SequenciamentoCarradasPayloadV1) => {
      const { carradas: sorted, linhas } = aplicarPayload(payload);
      setSnapshotVisualizado(meta);
      setCarradas(sorted);
      setLinhasSnapshot(linhas);
      setMostrarHistorico(false);
      grade.limparFiltrosGrade();
      // Restaura simulação salva (snapshots v2)
      const simu = payload.simulacao;
      if (simu && Array.isArray(simu.itens)) {
        const m = new Map<string, SimEntry>();
        for (const it of simu.itens) {
          if (!it?.chave) continue;
          const entry: SimEntry = {};
          if (it.dataProducao != null) entry.dataProducao = it.dataProducao;
          if (it.dataEntrega != null) entry.dataEntrega = it.dataEntrega;
          m.set(it.chave, entry);
        }
        setSim(m);
        setOrdemManual(Array.isArray(simu.ordem) && simu.ordem.length > 0 ? simu.ordem : null);
      } else {
        setSim(new Map());
        setOrdemManual(null);
      }
    },
    [grade]
  );

  const abrirSnapshot = useCallback(
    async (id: number) => {
      const req = ++detalheReqRef.current;
      setDetalheErro(null);
      setDetalheCarregando(true);
      setFeedbackGravacao(null);
      setCarradaDetalhe(null);
      try {
        const r = await obterSequenciamentoSnapshot(id);
        if (req !== detalheReqRef.current) return;
        if (r.error) {
          setDetalheErro(r.error);
          return;
        }
        const data = r.data;
        if (!data?.payload) {
          setDetalheErro('Snapshot sem dados legíveis.');
          return;
        }
        abrirComPayload(
          {
            id: data.id,
            cod: data.cod,
            createdAt: data.createdAt,
            usuarioLogin: data.usuarioLogin,
            carradaCount: data.carradaCount,
            aoVivo: false,
          },
          data.payload
        );
      } catch (e) {
        if (req !== detalheReqRef.current) return;
        setDetalheErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (req === detalheReqRef.current) setDetalheCarregando(false);
      }
    },
    [abrirComPayload]
  );

  const handleConsultar = useCallback(async () => {
    const req = ++detalheReqRef.current;
    setConsultando(true);
    setDetalheErro(null);
    setFeedbackGravacao(null);
    setCarradaDetalhe(null);
    setDetalheCarregando(true);
    try {
      const r = await consultarSequenciamentoAoVivo();
      if (req !== detalheReqRef.current) return;
      if (r.error) {
        setDetalheErro(r.error);
        return;
      }
      const data = r.data;
      if (!data?.payload) {
        setDetalheErro('Consulta sem dados legíveis.');
        return;
      }
      abrirComPayload(
        {
          id: null,
          cod: 'Consulta ao vivo',
          createdAt: data.geradoEm,
          usuarioLogin: '—',
          carradaCount: data.carradaCount,
          aoVivo: true,
        },
        data.payload
      );
    } catch (e) {
      if (req !== detalheReqRef.current) return;
      setDetalheErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (req === detalheReqRef.current) {
        setDetalheCarregando(false);
        setConsultando(false);
      }
    }
  }, [abrirComPayload]);

  const montarSimulacaoPayload = useCallback((): SequenciamentoSimulacao | null => {
    const itens = [...sim.entries()].map(([chave, v]) => {
      const c = carradas.find((x) => carradaKeyDe(x) === chave);
      return {
        chave,
        cod: c?.cod ?? '',
        carrada: c?.carrada ?? '',
        dataProducao: v.dataProducao ?? null,
        dataEntrega: v.dataEntrega ?? null,
      };
    });
    const ordem = ordemManual ?? carradasFinais.map(carradaKeyDe);
    if (itens.length === 0 && !ordemManual) return null;
    return { ordem, itens };
  }, [sim, carradas, ordemManual, carradasFinais]);

  const handleGravar = useCallback(async () => {
    setGravando(true);
    setFeedbackGravacao(null);
    try {
      const simulacao = montarSimulacaoPayload();
      const r = await gravarSequenciamentoSnapshot(simulacao);
      if (!r.ok) {
        setFeedbackGravacao(r.error ?? 'Erro ao gravar snapshot.');
        return;
      }
      setFeedbackGravacao(`Snapshot ${r.cod} gravado com sucesso (${r.carradaCount ?? 0} carradas).`);
      setHistoricoVersao((v) => v + 1);
    } finally {
      setGravando(false);
    }
  }, [montarSimulacaoPayload]);

  const editarData = useCallback(
    (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      setSim((prev) => {
        const next = new Map(prev);
        const cur = { ...(next.get(key) ?? {}) } as SimEntry;
        cur[campo] = value;
        next.set(key, cur);
        return next;
      });
    },
    []
  );

  const handleDrop = useCallback(
    (targetKey: string) => {
      if (!dragKey || dragKey === targetKey) {
        setDragKey(null);
        return;
      }
      const keys = carradasFinais.map(carradaKeyDe);
      const from = keys.indexOf(dragKey);
      const to = keys.indexOf(targetKey);
      if (from < 0 || to < 0) {
        setDragKey(null);
        return;
      }
      const [moved] = keys.splice(from, 1);
      keys.splice(to, 0, moved!);
      setOrdemManual(keys);
      grade.setSortState(null);
      grade.setSortLevels([]);
      setDragKey(null);
    },
    [dragKey, carradasFinais, grade]
  );

  const handleConfirmarAplicar = useCallback(
    async (motivoPorId: Record<string, string>) => {
      setSalvandoConfirmacao(true);
      setErroConfirmacao(null);
      try {
        if (pedidosEntrega.length > 0) {
          const ajustes = pedidosEntrega.map((p) => ({
            id_pedido: p.idPedido,
            previsao_nova: p.previsaoNova,
            motivo: motivoPorId[p.idPedido] ?? '',
            previsao_atual: p.previsaoAnterior,
            rota: p.rota,
            apply_rota: true,
          }));
          await ajustarPrevisaoLote(ajustes);
        }
        if (itensProducao.length > 0) {
          await ajustarDataProducaoLote(itensProducao);
        }
        setConfirmacaoAberta(false);
        setFeedbackGravacao('Alterações aplicadas com sucesso nos pedidos.');
        resetarSimulacao();
        await handleConsultar();
      } catch (e) {
        setErroConfirmacao(e instanceof Error ? e.message : String(e));
      } finally {
        setSalvandoConfirmacao(false);
      }
    },
    [pedidosEntrega, itensProducao, resetarSimulacao, handleConsultar]
  );

  const renderTh = (colId: (typeof COL_IDS)[number]) => {
    const numerica = COL_NUMERICAS.has(colId);
    return (
      <th
        key={colId}
        className="sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2.5 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]"
      >
        <div className={`flex items-center gap-1 ${numerica ? 'justify-end' : 'justify-between'}`}>
          <span className="whitespace-normal break-words text-[11px] leading-tight sm:text-xs">
            {COL_LABELS[colId]}
          </span>
          <GradeFiltroCabecalhoBtn
            ativo={grade.colunaComFiltroAtivo(colId)}
            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          />
        </div>
      </th>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Sequenciamento carradas</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {mostrarHistorico ? (
              'Histórico de snapshots gravados do Gerenciador de Pedidos.'
            ) : snapshotVisualizado ? (
              snapshotVisualizado.aoVivo ? (
                <>
                  <span className="font-medium text-primary-600 dark:text-primary-400">Consulta ao vivo</span> ·{' '}
                  {formatDateTimeBr(snapshotVisualizado.createdAt)} · {snapshotVisualizado.carradaCount} carradas
                </>
              ) : (
                <>
                  <span className="font-medium">Snapshot {snapshotVisualizado.cod}</span> ·{' '}
                  {formatDateTimeBr(snapshotVisualizado.createdAt)} · {snapshotVisualizado.usuarioLogin} ·{' '}
                  {snapshotVisualizado.carradaCount} carradas
                </>
              )
            ) : (
              'Visualização do snapshot.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!mostrarHistorico && (
            <>
              <button type="button" onClick={fecharVisualizacao} className={BTN_SECONDARY}>
                ← Voltar ao histórico
              </button>
              <button
                type="button"
                onClick={() => setCalendarioAberto(true)}
                disabled={carradas.length === 0}
                className={BTN_SECONDARY}
              >
                Calendário de produção
              </button>
              {editavel && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setErroConfirmacao(null);
                      setConfirmacaoAberta(true);
                    }}
                    disabled={!temAlteracoes || gravando}
                    className={BTN_SECONDARY}
                  >
                    Confirmar alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGravar()}
                    disabled={gravando || consultando}
                    className={BTN_PRIMARY}
                  >
                    {gravando ? 'Gravando...' : 'Gravar'}
                  </button>
                </>
              )}
            </>
          )}
          {mostrarHistorico && (
            <button
              type="button"
              onClick={() => void handleConsultar()}
              disabled={consultando}
              className={BTN_PRIMARY}
            >
              {consultando ? 'Consultando...' : 'Consultar'}
            </button>
          )}
        </div>
      </div>

      {feedbackGravacao && (
        <p
          className={`text-sm shrink-0 ${feedbackGravacao.includes('sucesso') ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          role="status"
        >
          {feedbackGravacao}
        </p>
      )}

      {mostrarHistorico ? (
        <div className="relative flex-1 min-h-0 card-panel overflow-auto p-4 shadow-sm">
          {historicoCarregando && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando histórico...</p>
          )}
          {historicoErro && !historicoCarregando && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {historicoErro}
            </p>
          )}
          {!historicoCarregando && !historicoErro && historicoLista.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum snapshot gravado ainda. Use <span className="font-medium">Consultar</span> para
              visualizar ao vivo; após simular, use <span className="font-medium">Gravar</span> na tela de
              consulta para registrar.
            </p>
          )}
          {!historicoCarregando && historicoLista.length > 0 && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Cód</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Criado por</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">Data de criação</th>
                  <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 text-center">Carradas</th>
                </tr>
              </thead>
              <tbody>
                {historicoLista.map((h) => (
                  <tr
                    key={h.id}
                    tabIndex={0}
                    className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    title="Clique para ver este snapshot"
                    onClick={() => void abrirSnapshot(h.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void abrirSnapshot(h.id);
                      }
                    }}
                  >
                    <td className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200">{h.cod}</td>
                    <td className="py-2 px-2 text-slate-800 dark:text-slate-200">{h.usuarioLogin}</td>
                    <td className="py-2 px-2 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateTimeBr(h.createdAt)}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-800 dark:text-slate-200">
                      {h.carradaCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div ref={grade.tableScrollRef} className="relative flex-1 min-h-0 card-panel overflow-auto p-4 shadow-sm">
          {detalheCarregando && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>}
          {detalheErro && !detalheCarregando && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {detalheErro}
            </p>
          )}
          {!detalheCarregando && !detalheErro && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editavel
                    ? 'Simulação: edite Data de produção/entrega, arraste linhas para reordenar e clique numa carrada para ver detalhes. Cabeçalhos: use o funil para filtrar/classificar.'
                    : 'Snapshot congelado (somente leitura). Cabeçalhos: use o funil para filtrar/classificar.'}
                </p>
                {grade.temFiltrosOuOrdem || ordemManual ? (
                  <button
                    type="button"
                    onClick={() => {
                      grade.limparFiltrosGrade();
                      setOrdemManual(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Limpar filtros/ordem
                  </button>
                ) : null}
              </div>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr>
                    {editavel && (
                      <th className="sticky top-0 z-20 w-8 border border-primary-500/40 bg-primary-600 px-1 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.08)]" />
                    )}
                    {COL_IDS.map((colId) => renderTh(colId))}
                  </tr>
                </thead>
                <tbody>
                  {carradasFinais.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COL_IDS.length + (editavel ? 1 : 0)}
                        className="py-4 text-center text-slate-500 dark:text-slate-400"
                      >
                        Nenhuma carrada.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {carradasFinais.map((c) => {
                        const key = carradaKeyDe(c);
                        const alterada = carradaAlterada(sim, baseline, key);
                        return (
                          <tr
                            key={key}
                            tabIndex={0}
                            onDragOver={editavel ? (e) => e.preventDefault() : undefined}
                            onDrop={editavel ? () => handleDrop(key) : undefined}
                            className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                              alterada ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                            } ${dragKey === key ? 'opacity-50' : ''}`}
                          >
                            {editavel && (
                              <td
                                className="w-8 cursor-grab px-1 text-center text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500"
                                draggable
                                onDragStart={() => setDragKey(key)}
                                onDragEnd={() => setDragKey(null)}
                                title="Arraste para reordenar"
                                aria-label="Arraste para reordenar"
                              >
                                ⠿
                              </td>
                            )}
                            <td
                              className="cursor-pointer py-2 px-2 font-mono text-slate-800 dark:text-slate-200"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {c.cod}
                            </td>
                            <td
                              className="max-w-[280px] cursor-pointer truncate py-2 px-2 text-slate-800 dark:text-slate-200"
                              title={c.carrada}
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {c.carrada}
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="date"
                                className={DATE_INPUT_CLASS}
                                value={efProducao(key)}
                                disabled={!editavel}
                                onChange={(e) => editarData(key, 'dataProducao', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="date"
                                className={DATE_INPUT_CLASS}
                                value={efEntrega(key)}
                                min={hojeISO()}
                                disabled={!editavel}
                                onChange={(e) => editarData(key, 'dataEntrega', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td
                              className="cursor-pointer py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.saldoAFaturar)}
                            </td>
                            <td
                              className="cursor-pointer py-2 px-2 text-right tabular-nums"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(c.percentualEmDia ?? 0)}`}
                              >
                                {formatPercentual(c.percentualEmDia ?? 0)}
                              </span>
                            </td>
                            <td
                              className="cursor-pointer py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.adiantamento)}
                            </td>
                            <td
                              className="cursor-pointer py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200"
                              onClick={() => setCarradaDetalhe(c)}
                            >
                              {formatMoeda(c.valorAVistaAte10d)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className={SUBTOTAL_ROW_CLASS}>
                        <td
                          className="py-2 px-2 text-slate-800 dark:text-slate-100"
                          colSpan={(editavel ? 1 : 0) + 4}
                        >
                          Subtotal
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.saldoAFaturar)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(subtotal.percentualEmDia)}`}
                          >
                            {formatPercentual(subtotal.percentualEmDia)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.adiantamento)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {formatMoeda(subtotal.valorAVistaAte10d)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

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
            setOrdemManual(null);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            setOrdemManual(null);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          sortAscLabel={COL_NUMERICAS.has(grade.colunaFiltroAberta) ? 'Menor para Maior' : undefined}
          sortDescLabel={COL_NUMERICAS.has(grade.colunaFiltroAberta) ? 'Maior para Menor' : undefined}
          showNumericFilters={COL_NUMERICAS.has(grade.colunaFiltroAberta ?? '')}
        />
      )}

      {carradaDetalhe && (
        <SequenciamentoCarradasDetalheModal
          carrada={carradaDetalhe}
          linhas={linhasSnapshot}
          aoVivo={aoVivo}
          onClose={() => setCarradaDetalhe(null)}
        />
      )}

      {calendarioAberto && (
        <CalendarioProducaoModal
          linhas={linhasSnapshot}
          sim={sim}
          baseline={baseline}
          onClose={() => setCalendarioAberto(false)}
        />
      )}

      {confirmacaoAberta && (
        <ConfirmacaoSimulacaoModal
          pedidosEntrega={pedidosEntrega}
          qtdCarradasSomenteProducao={qtdCarradasSomenteProducao}
          salvando={salvandoConfirmacao}
          erro={erroConfirmacao}
          onConfirmar={handleConfirmarAplicar}
          onClose={() => setConfirmacaoAberta(false)}
        />
      )}
    </div>
  );
}
