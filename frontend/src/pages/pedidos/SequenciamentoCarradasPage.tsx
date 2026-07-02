import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  consultarSequenciamentoAoVivo,
  gravarSequenciamentoSnapshot,
  listarSequenciamentoSnapshots,
  obterSequenciamentoSnapshot,
  type SequenciamentoCarradaAgregada,
  type SequenciamentoCarradasPayloadV1,
  type SequenciamentoSnapshotListItem,
} from '../../api/sequenciamentoCarradas';
import SequenciamentoCarradasDetalheModal from '../../components/sequenciamento-carradas/SequenciamentoCarradasDetalheModal';
import {
  formatDateTimeBr,
  formatMoeda,
  formatPercentual,
  classPercentualEmDia,
  ordenarCarradas,
  ordenarCarradasComSortLevels,
  toggleCarradaSortLevel,
  subtotalCarradas,
  SUBTOTAL_ROW_CLASS,
  type CarradaSortKey,
  type CarradaSortLevel,
} from '../../components/sequenciamento-carradas/sequenciamentoCarradasUtils';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

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
  const [sortLevels, setSortLevels] = useState<CarradaSortLevel[]>([]);

  const detalheReqRef = useRef(0);

  const carradasOrdenadas = useMemo(
    () => ordenarCarradasComSortLevels(carradas, sortLevels),
    [carradas, sortLevels]
  );

  const subtotal = useMemo(() => subtotalCarradas(carradasOrdenadas), [carradasOrdenadas]);

  const handleHeaderSort = useCallback((key: CarradaSortKey, multi: boolean) => {
    setSortLevels((prev) => toggleCarradaSortLevel(prev, key, multi));
  }, []);

  const sortIndicator = (key: CarradaSortKey) => {
    const index = sortLevels.findIndex((l) => l.id === key);
    if (index < 0) return '';
    const level = sortLevels[index]!;
    const arrow = level.dir === 'asc' ? ' ↑' : ' ↓';
    const priority = sortLevels.length > 1 ? ` ${index + 1}` : '';
    return `${arrow}${priority}`;
  };

  const thSortTitle = 'Clique para ordenar. Ctrl+clique para acumular níveis de ordenação.';

  const thSortClass =
    'py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800/80';

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

  const fecharVisualizacao = useCallback(() => {
    setMostrarHistorico(true);
    setSnapshotVisualizado(null);
    setCarradas([]);
    setLinhasSnapshot([]);
    setDetalheErro(null);
    setCarradaDetalhe(null);
  }, []);

  const abrirComPayload = useCallback(
    (meta: SnapshotVisualizado, payload: SequenciamentoCarradasPayloadV1) => {
      const { carradas: sorted, linhas } = aplicarPayload(payload);
      setSnapshotVisualizado(meta);
      setCarradas(sorted);
      setLinhasSnapshot(linhas);
      setMostrarHistorico(false);
    },
    []
  );

  const abrirSnapshot = useCallback(async (id: number) => {
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
  }, [abrirComPayload]);

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

  const handleGravar = useCallback(async () => {
    setGravando(true);
    setFeedbackGravacao(null);
    try {
      const r = await gravarSequenciamentoSnapshot();
      if (!r.ok) {
        setFeedbackGravacao(r.error ?? 'Erro ao gravar snapshot.');
        return;
      }
      setFeedbackGravacao(`Snapshot ${r.cod} gravado com sucesso (${r.carradaCount ?? 0} carradas).`);
      setHistoricoVersao((v) => v + 1);
    } finally {
      setGravando(false);
    }
  }, []);

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
            <button type="button" onClick={fecharVisualizacao} className={BTN_SECONDARY}>
              ← Voltar ao histórico
            </button>
          )}
          {mostrarHistorico && (
            <>
              <button
                type="button"
                onClick={() => void handleConsultar()}
                disabled={consultando || gravando}
                className={BTN_SECONDARY}
              >
                {consultando ? 'Consultando...' : 'Consultar'}
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
              Nenhum snapshot gravado ainda. Use <span className="font-medium">Gravar</span> para registrar o estado atual do Gerenciador ou{' '}
              <span className="font-medium">Consultar</span> para visualizar ao vivo sem gravar.
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
        <div className="relative flex-1 min-h-0 card-panel overflow-auto p-4 shadow-sm">
          {detalheCarregando && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
          )}
          {detalheErro && !detalheCarregando && (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {detalheErro}
            </p>
          )}
          {!detalheCarregando && !detalheErro && (
            <>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                {snapshotVisualizado?.aoVivo
                  ? 'Dados ao vivo do Gerenciador (não gravados). Clique em uma carrada para ver pedidos, itens e produtos vinculados.'
                  : 'Dados congelados no momento do gravar. Clique em uma carrada para ver pedidos, itens e produtos vinculados.'}{' '}
                Cabeçalhos: clique para ordenar; Ctrl+clique para acumular níveis.
              </p>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                    <th
                      className={thSortClass}
                      onClick={(e) => handleHeaderSort('cod', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      Cód{sortIndicator('cod')}
                    </th>
                    <th
                      className={thSortClass}
                      onClick={(e) => handleHeaderSort('carrada', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      Carrada{sortIndicator('carrada')}
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={(e) => handleHeaderSort('saldoAFaturar', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      Saldo a faturar{sortIndicator('saldoAFaturar')}
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={(e) => handleHeaderSort('percentualEmDia', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      % Em dia{sortIndicator('percentualEmDia')}
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={(e) => handleHeaderSort('adiantamento', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      Adiantamento{sortIndicator('adiantamento')}
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={(e) => handleHeaderSort('valorAVistaAte10d', e.ctrlKey || e.metaKey)}
                      title={thSortTitle}
                    >
                      Valor adiantamento + até 10d{sortIndicator('valorAVistaAte10d')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {carradasOrdenadas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma carrada.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {carradasOrdenadas.map((c) => (
                        <tr
                          key={`${c.cod}-${c.carrada}`}
                          tabIndex={0}
                          className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                          title="Clique para ver detalhes da carrada"
                          onClick={() => setCarradaDetalhe(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setCarradaDetalhe(c);
                            }
                          }}
                        >
                          <td className="py-2 px-2 font-mono text-slate-800 dark:text-slate-200">{c.cod}</td>
                          <td className="py-2 px-2 text-slate-800 dark:text-slate-200 max-w-[280px] truncate" title={c.carrada}>
                            {c.carrada}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200">
                            {formatMoeda(c.saldoAFaturar)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classPercentualEmDia(c.percentualEmDia ?? 0)}`}
                            >
                              {formatPercentual(c.percentualEmDia ?? 0)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200">
                            {formatMoeda(c.adiantamento)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-slate-800 dark:text-slate-200">
                            {formatMoeda(c.valorAVistaAte10d)}
                          </td>
                        </tr>
                      ))}
                      <tr className={SUBTOTAL_ROW_CLASS}>
                        <td className="py-2 px-2 text-slate-800 dark:text-slate-100" colSpan={2}>
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

      {carradaDetalhe && (
        <SequenciamentoCarradasDetalheModal
          carrada={carradaDetalhe}
          linhas={linhasSnapshot}
          aoVivo={snapshotVisualizado?.aoVivo ?? false}
          onClose={() => setCarradaDetalhe(null)}
        />
      )}
    </div>
  );
}
