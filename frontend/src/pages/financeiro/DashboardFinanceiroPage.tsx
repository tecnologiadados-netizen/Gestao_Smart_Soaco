import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDreDashboard,
  type DreDashboardPayload,
} from '../../api/financeiro';
import DashboardDespesasPrincipaisChart from './dashboard/DashboardDespesasPrincipaisChart';
import DashboardEmpresasChart from './dashboard/DashboardEmpresasChart';
import DashboardEvolucaoChart from './dashboard/DashboardEvolucaoChart';
import DashboardInsights from './dashboard/DashboardInsights';
import DashboardKpiCards from './dashboard/DashboardKpiCards';
import DashboardMargensChart from './dashboard/DashboardMargensChart';
import DashboardPessoalChart from './dashboard/DashboardPessoalChart';
import { DASHBOARD_UNIDADE_OPCOES } from './dashboard/dashboardEmpresas';

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function hojeLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inicioAnoLocalYmd(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodoMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  return { inicio: ymd(inicio), fim: hojeLocalYmd() };
}

function periodoMesAnterior(): { inicio: string; fim: string } {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth(), 0);
  return { inicio: ymd(inicio), fim: ymd(fim) };
}

function periodoUltimos12Meses(): { inicio: string; fim: string } {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
  return { inicio: ymd(inicio), fim: hojeLocalYmd() };
}

function payloadVazio(dataInicio: string, dataFim: string): DreDashboardPayload {
  return {
    unidade: { id: 'todas', label: 'Todas', idEmpresas: [] },
    dataInicio,
    dataFim,
    periodos: [],
    vazio: true,
    kpis: [],
    series: { evolucao12m: [], margens: [], pessoal: [], empresas: [] },
    waterfall: [],
    despesasPrincipais: { total: 0, fatias: [] },
    analise: {
      pontoEquilibrio: null,
      faturamentoMetaEbitda: null,
      faturamentoMetaLucro: null,
      metaEbitdaPct: 12,
      metaLucroPct: 3,
      premissas: { cpvPct: 0, custosFixos: 0, margemContribuicaoPct: 0, descricao: '' },
    },
    insights: [],
  };
}

export default function DashboardFinanceiroPage() {
  const [dataInicio, setDataInicio] = useState(inicioAnoLocalYmd);
  const [dataFim, setDataFim] = useState(hojeLocalYmd);
  const [unidade, setUnidade] = useState('todas');
  const [mostrarYoy, setMostrarYoy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DreDashboardPayload | null>(null);
  const [jaAplicou, setJaAplicou] = useState(false);
  const seqRef = useRef(0);

  const carregar = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setErro(null);
    setJaAplicou(true);
    try {
      const payload = await fetchDreDashboard({
        dataInicio,
        dataFim,
        unidade,
      });
      if (seq !== seqRef.current) return;
      if (payload.erro) setErro(payload.erro);
      setDados(payload);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setErro(e instanceof Error ? e.message : String(e));
      setDados(payloadVazio(dataInicio, dataFim));
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [dataInicio, dataFim, unidade]);

  useEffect(() => {
    void carregar();
    // carga inicial única
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarAtalho = (p: { inicio: string; fim: string }) => {
    setDataInicio(p.inicio);
    setDataFim(p.fim);
  };

  const vazio = !loading && jaAplicou && (dados?.vazio || !dados?.kpis?.length);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="card-panel shrink-0 overflow-visible">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Dashboard Financeiro
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              KPIs e análise a partir da DRE (somente leitura)
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 overflow-visible">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 overflow-visible">
            <div>
              <label className={FILTRO_LABEL_CLASS}>Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <div>
              <label className={FILTRO_LABEL_CLASS}>Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              />
            </div>
            <div>
              <label className={FILTRO_LABEL_CLASS}>Empresa / unidade</label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              >
                {DASHBOARD_UNIDADE_OPCOES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FILTRO_LABEL_CLASS}>Comparação no gráfico</label>
              <select
                value={mostrarYoy ? 'yoy' : 'mom'}
                onChange={(e) => setMostrarYoy(e.target.value === 'yoy')}
                className={FILTRO_INPUT_CLASS}
                disabled={loading}
              >
                <option value="mom">MoM (mês a mês)</option>
                <option value="yoy">YoY (ano anterior)</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
              <label className={FILTRO_LABEL_CLASS}>Atalhos</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  onClick={() => aplicarAtalho(periodoMesAtual())}
                  disabled={loading}
                >
                  Mês atual
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  onClick={() => aplicarAtalho(periodoMesAnterior())}
                  disabled={loading}
                >
                  Mês ant.
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  onClick={() => aplicarAtalho({ inicio: inicioAnoLocalYmd(), fim: hojeLocalYmd() })}
                  disabled={loading}
                >
                  YTD
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  onClick={() => aplicarAtalho(periodoUltimos12Meses())}
                  disabled={loading}
                >
                  12m
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading || dataFim < dataInicio}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Carregando…' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>

      {erro ? (
        <p className="text-sm text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-4 py-2">
          {erro}
        </p>
      ) : null}

      {loading ? (
        <DashboardKpiCards kpis={[]} loading />
      ) : vazio ? (
        <div className="card-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Sem dados DRE para o período/unidade selecionados. Ajuste os filtros e clique em{' '}
          <span className="font-semibold">Aplicar</span>.
        </div>
      ) : dados ? (
        <>
          <DashboardKpiCards kpis={dados.kpis} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <DashboardEvolucaoChart data={dados.series.evolucao12m} mostrarYoy={mostrarYoy} />
            <DashboardEmpresasChart data={dados.series.empresas} />
            <DashboardPessoalChart data={dados.series.pessoal} />
            <DashboardMargensChart data={dados.series.margens} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <DashboardDespesasPrincipaisChart data={dados.despesasPrincipais} />
            <DashboardInsights insights={dados.insights} />
          </div>
        </>
      ) : null}
    </div>
  );
}
