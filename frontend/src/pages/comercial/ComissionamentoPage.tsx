import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  EQUIPE_LABEL,
  obterComissionamentoAnalytics,
  type ComissionamentoAnalytics,
  type DetalheComissionamentoContexto,
  type EquipeComissionamento,
  type FiltrosComissionamento,
} from '../../api/comissionamento';
import ComissionamentoParetoClientes from '../../components/comissionamento/ComissionamentoParetoClientes';
import ModalClassificarEquipesComissionamento from '../../components/comissionamento/ModalClassificarEquipesComissionamento';
import ModalClientesInativosComissionamento from '../../components/comissionamento/ModalClientesInativosComissionamento';
import ModalComissionamentoDetalhe from '../../components/comissionamento/ModalComissionamentoDetalhe';
import ModalComparativoVendedores from '../../components/comissionamento/ModalComparativoVendedores';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import PainelComercialBarRanking from '../../components/painel-comercial/PainelComercialBarRanking';
import PainelComercialEvolucaoChart from '../../components/painel-comercial/PainelComercialEvolucaoChart';
import PainelComercialMixChart from '../../components/painel-comercial/PainelComercialMixChart';
import {
  classVar,
  formatMoeda,
  formatNumero,
  formatPct,
  formatYmdBr,
  hojeYmd,
  labelMesCurto,
  mesesAtrasYmd,
} from '../../components/painel-comercial/painelComercialUtils';

const FILTRO_LABEL = 'mb-1 block text-xs text-slate-500';
const FILTRO_INPUT =
  'rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

function csvOrUndef(v: string): string | undefined {
  const s = v.trim();
  return s || undefined;
}

function appendCsv(atual: string | undefined, valor: string): string {
  const parts = (atual ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.includes(valor)) parts.push(valor);
  return parts.join(',');
}

function filtroDefault(): FiltrosComissionamento {
  return {
    dataIni: mesesAtrasYmd(12),
    dataFim: hojeYmd(),
    comparacaoBase: 'ano_anterior',
  };
}

function equipeCodigoFromLabel(label: string): string {
  const found = (Object.entries(EQUIPE_LABEL) as Array<[EquipeComissionamento, string]>).find(
    ([, v]) => v === label
  );
  return found?.[0] ?? label;
}

function KpiHeroCard({
  titulo,
  valor,
  sub,
  varPct,
  onClick,
  title,
  accent,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  varPct?: number | null;
  onClick?: () => void;
  title?: string;
  accent: string;
}) {
  const cls = `card-panel border-l-4 ${accent} p-4 text-left transition hover:shadow-soaco-lg${
    onClick ? ' hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
  }`;
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{titulo}</p>
        {varPct != null && (
          <span className={`text-xs font-semibold tabular-nums ${classVar(varPct)}`}>{formatPct(varPct)}</span>
        )}
      </div>
      <p className="card-kpi-value mt-3 tracking-tight">{valor}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${cls} w-full`} onClick={onClick} title={title}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function KpiMetricaCompacta({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div>
      <p className="card-kpi-label">{titulo}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-soaco-navy dark:text-soaco-white">{valor}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

function KpiGrupoPanel({
  titulo,
  gridClass,
  children,
}: {
  titulo: string;
  gridClass: string;
  children: ReactNode;
}) {
  return (
    <div className="card-panel p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-soaco-navy dark:text-soaco-white">
        {titulo}
      </h2>
      <div className={`grid gap-x-4 gap-y-3 ${gridClass}`}>{children}</div>
    </div>
  );
}

type ModalDetalheState = {
  titulo: string;
  subtitulo?: string;
  contexto?: DetalheComissionamentoContexto;
};

export default function ComissionamentoPage() {
  const [filtros, setFiltros] = useState<FiltrosComissionamento>(() => filtroDefault());
  const [draft, setDraft] = useState<FiltrosComissionamento>(() => filtroDefault());
  const [analytics, setAnalytics] = useState<ComissionamentoAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<'individual' | 'equipe'>('individual');
  const [modalEquipes, setModalEquipes] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState<ModalDetalheState | null>(null);
  const [modalComparativo, setModalComparativo] = useState(false);
  const [modalInativos, setModalInativos] = useState(false);
  const [vendedoresComparar, setVendedoresComparar] = useState<string[]>([]);

  const carregar = useCallback(async (f: FiltrosComissionamento) => {
    setLoading(true);
    setErro(null);
    try {
      const data = await obterComissionamentoAnalytics(f);
      setAnalytics(data);
      if (data?.erro) setErro(data.erro);
    } catch (e) {
      setAnalytics(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(filtros);
  }, [carregar, filtros]);

  const filtrosPendentes = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(filtros),
    [draft, filtros]
  );

  const aplicar = () => setFiltros({ ...draft });
  const limpar = () => {
    const d = filtroDefault();
    setDraft(d);
    setFiltros(d);
    setVendedoresComparar([]);
  };

  const abrirDetalhe = useCallback((titulo: string, contexto?: DetalheComissionamentoContexto, subtitulo?: string) => {
    setModalDetalhe({ titulo, subtitulo, contexto });
  }, []);

  const handleCtrlFiltro = useCallback((patch: Partial<FiltrosComissionamento>) => {
    const merge = (base: FiltrosComissionamento): FiltrosComissionamento => {
      const next = { ...base };
      for (const [k, v] of Object.entries(patch) as Array<
        [keyof FiltrosComissionamento, string | undefined]
      >) {
        if (v == null || v === '') continue;
        if (k === 'dataIni' || k === 'dataFim' || k === 'comparacaoBase') {
          (next as Record<string, unknown>)[k] = v;
          continue;
        }
        (next as Record<string, unknown>)[k] = appendCsv(
          typeof next[k] === 'string' ? (next[k] as string) : undefined,
          v
        );
      }
      return next;
    };
    setDraft((d) => merge(d));
    setFiltros((f) => merge(f));
  }, []);

  const toggleCompararVendedor = useCallback((nome: string) => {
    setVendedoresComparar((prev) =>
      prev.includes(nome) ? prev.filter((x) => x !== nome) : [...prev, nome].slice(0, 8)
    );
  }, []);

  const onMesClick = useCallback(
    (mes: string, e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const [y, m] = mes.split('-').map(Number);
        if (!y || !m) return;
        const last = new Date(y, m, 0).getDate();
        const ini = `${mes}-01`;
        const fim = `${mes}-${String(last).padStart(2, '0')}`;
        handleCtrlFiltro({ dataIni: ini, dataFim: fim });
        return;
      }
      abrirDetalhe(`Vendas · ${labelMesCurto(mes)}`, { mes }, 'Itens do mês selecionado');
    },
    [abrirDetalhe, handleCtrlFiltro]
  );

  const onRankingClick = useCallback(
    (row: { key: string; label: string }, e: MouseEvent) => {
      if (visao === 'equipe') {
        if (e.ctrlKey || e.metaKey) {
          handleCtrlFiltro({ equipe: row.key });
          return;
        }
        abrirDetalhe(`Vendas · ${row.label}`, { equipe: row.key }, 'Itens da equipe');
        return;
      }
      if (e.shiftKey) {
        toggleCompararVendedor(row.key);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        handleCtrlFiltro({ vendedor: row.key });
        return;
      }
      abrirDetalhe(`Vendas · ${row.label}`, { vendedor: row.key }, 'Itens do vendedor/representante');
    },
    [abrirDetalhe, handleCtrlFiltro, toggleCompararVendedor, visao]
  );

  const onMixClick = useCallback(
    (grupoProduto: string, e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        handleCtrlFiltro({ grupoProduto });
        return;
      }
      abrirDetalhe(`Vendas · ${grupoProduto}`, { grupoProduto }, 'Itens do grupo de produto');
    },
    [abrirDetalhe, handleCtrlFiltro]
  );

  const onStatusClick = useCallback(
    (row: { key: string; label: string }, e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        handleCtrlFiltro({ status: row.key });
        return;
      }
      abrirDetalhe(`Vendas · status ${row.label}`, { status: row.key }, 'Itens com este status');
    },
    [abrirDetalhe, handleCtrlFiltro]
  );

  const onHeatClick = useCallback(
    (equipeLabel: string, mes: string) => {
      const equipe = equipeCodigoFromLabel(equipeLabel);
      abrirDetalhe(
        `Vendas · ${equipeLabel} · ${labelMesCurto(mes)}`,
        { equipe, mes },
        'Itens da equipe no mês'
      );
    },
    [abrirDetalhe]
  );

  const k = analytics?.kpis;
  const serieChart = useMemo(
    () =>
      (analytics?.serieMensal ?? []).map((s) => ({
        mes: s.mes,
        valor: s.valor,
        qtde: s.qtde,
        pedidos: s.pedidos,
      })),
    [analytics?.serieMensal]
  );

  const rankingAtual =
    visao === 'equipe'
      ? (analytics?.rankingEquipes ?? []).map((r) => ({
          key: r.key,
          label: r.label,
          valor: r.valor,
          qtde: r.qtde,
          pedidos: r.pedidos,
        }))
      : (analytics?.rankingVendedores ?? []).map((r) => ({
          key: r.key,
          label: r.label,
          valor: r.valor,
          qtde: r.qtde,
          pedidos: r.pedidos,
        }));

  const mixGrupos = (analytics?.mixGrupos ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    valor: r.valor,
    qtde: r.qtde,
    pedidos: r.pedidos,
  }));

  const mixGruposData = useMemo(() => {
    const total = mixGrupos.reduce((s, x) => s + x.valor, 0);
    return mixGrupos.map((g) => ({
      grupoProduto: g.label,
      valor: g.valor,
      pct: total > 0 ? (g.valor / total) * 100 : 0,
    }));
  }, [mixGrupos]);

  const mesesHeat = useMemo(() => {
    const set = new Set((analytics?.heatmapEquipeMes ?? []).map((h) => h.mes));
    return [...set].sort();
  }, [analytics?.heatmapEquipeMes]);

  const equipesHeat = useMemo(() => {
    const set = new Set((analytics?.heatmapEquipeMes ?? []).map((h) => h.equipe));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [analytics?.heatmapEquipeMes]);

  const heatMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of analytics?.heatmapEquipeMes ?? []) {
      m.set(`${h.equipe}|${h.mes}`, h.valor);
    }
    return m;
  }, [analytics?.heatmapEquipeMes]);

  const maxHeat = useMemo(() => Math.max(1, ...[...heatMap.values()]), [heatMap]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <KpiPainelVoltarLink painelId="analise-comissionamento" />
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
            Análise de Comissionamento
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Vendas por vendedor/representante e equipe · clique nos gráficos para detalhar pedidos,
            clientes e produtos
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
        <div className="flex flex-col">
          <label className={FILTRO_LABEL}>De</label>
          <input
            type="date"
            value={draft.dataIni}
            onChange={(e) => setDraft((d) => ({ ...d, dataIni: e.target.value.slice(0, 10) }))}
            className={FILTRO_INPUT}
          />
        </div>
        <div className="flex flex-col">
          <label className={FILTRO_LABEL}>Até</label>
          <input
            type="date"
            value={draft.dataFim}
            onChange={(e) => setDraft((d) => ({ ...d, dataFim: e.target.value.slice(0, 10) }))}
            className={FILTRO_INPUT}
          />
        </div>
        <div className="flex flex-col">
          <label className={FILTRO_LABEL}>Comparativo</label>
          <select
            value={draft.comparacaoBase ?? 'ano_anterior'}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                comparacaoBase: e.target.value as FiltrosComissionamento['comparacaoBase'],
              }))
            }
            className={FILTRO_INPUT}
          >
            <option value="ano_anterior">Mesmo mês ano anterior</option>
            <option value="periodo_anterior">Período anterior</option>
          </select>
        </div>
        <MultiSelectWithSearch
          label="Equipe"
          placeholder="Todas"
          options={analytics?.opcoes.equipes ?? ['televendas', 'vendedores', 'representantes', 'sem_equipe']}
          value={draft.equipe ?? ''}
          onChange={(v) => setDraft((d) => ({ ...d, equipe: csvOrUndef(v) }))}
          labelClass={FILTRO_LABEL}
          inputClass={FILTRO_INPUT}
          optionLabel="equipes"
          labelByValue={EQUIPE_LABEL as Record<string, string>}
          minWidth="140px"
          optionsLoading={loading && !analytics}
        />
        <MultiSelectWithSearch
          label="Vendedor"
          placeholder="Todos"
          options={analytics?.opcoes.vendedores ?? []}
          value={draft.vendedor ?? ''}
          onChange={(v) => setDraft((d) => ({ ...d, vendedor: csvOrUndef(v) }))}
          labelClass={FILTRO_LABEL}
          inputClass={FILTRO_INPUT}
          optionLabel="vendedores"
          minWidth="160px"
          optionsLoading={loading && !analytics}
        />
        <MultiSelectWithSearch
          label="Grupo produto"
          placeholder="Todos"
          options={analytics?.opcoes.grupos ?? []}
          value={draft.grupoProduto ?? ''}
          onChange={(v) => setDraft((d) => ({ ...d, grupoProduto: csvOrUndef(v) }))}
          labelClass={FILTRO_LABEL}
          inputClass={FILTRO_INPUT}
          optionLabel="grupos"
          minWidth="150px"
          optionsLoading={loading && !analytics}
        />
        <MultiSelectWithSearch
          label="Status"
          placeholder="Todos"
          options={analytics?.opcoes.status ?? []}
          value={draft.status ?? ''}
          onChange={(v) => setDraft((d) => ({ ...d, status: csvOrUndef(v) }))}
          labelClass={FILTRO_LABEL}
          inputClass={FILTRO_INPUT}
          optionLabel="status"
          minWidth="140px"
          optionsLoading={loading && !analytics}
        />
        <button
          type="button"
          onClick={aplicar}
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Filtrar{filtrosPendentes ? ' *' : ''}
        </button>
        <button
          type="button"
          onClick={limpar}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => setModalEquipes(true)}
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-100"
        >
          Classificar equipes
        </button>
        <button
          type="button"
          onClick={() => setModalComparativo(true)}
          className="rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-900 hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-100"
          title="Compare vendedores (Shift+clique no ranking para pré-marcar)"
        >
          Comparar vendedores
          {vendedoresComparar.length > 0 ? ` (${vendedoresComparar.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setModalInativos(true)}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100"
          title="Clientes sem compra há mais de 90 dias (desde 01/01/2025)"
        >
          Inativos +90 dias
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-100">
          {erro}
        </div>
      )}

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Período aplicado: {formatYmdBr(filtros.dataIni)} — {formatYmdBr(filtros.dataFim)}
        {loading ? ' · Carregando…' : ''}
        {!loading && k?.coberturaCustoPct != null
          ? ` · Custo em ${k.coberturaCustoPct}% dos itens`
          : ''}
      </div>

      {loading && !analytics ? (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-panel h-[110px] animate-pulse p-4">
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-4 h-7 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-panel h-[120px] animate-pulse p-4">
                <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiHeroCard
              titulo="Venda"
              valor={formatMoeda(k?.valor ?? 0)}
              sub={`Base ${formatMoeda(k?.valorBase ?? 0)}`}
              varPct={k?.valorVarPct}
              accent="border-l-primary-600"
              onClick={() =>
                abrirDetalhe('Vendas do período', undefined, 'Todos os itens no filtro aplicado')
              }
              title="Clique para ver pedidos, clientes e produtos"
            />
            <KpiHeroCard
              titulo="Margem"
              valor={formatMoeda(k?.margem ?? 0)}
              sub={`Base ${formatMoeda(k?.margemBase ?? 0)}`}
              varPct={k?.margemVarPct}
              accent="border-l-emerald-600"
              onClick={() =>
                abrirDetalhe('Vendas do período · margem', undefined, 'Custo DRE sem markup por item')
              }
              title="Clique para detalhar venda, custo e margem"
            />
            <KpiHeroCard
              titulo="Margem %"
              valor={k?.margemPct != null ? `${k.margemPct}%` : '—'}
              sub="Sobre itens com custo"
              accent="border-l-sky-600"
            />
            <KpiHeroCard
              titulo="Pedidos"
              valor={formatNumero(k?.pedidos ?? 0)}
              sub="Período selecionado"
              accent="border-l-violet-600"
              onClick={() => abrirDetalhe('Vendas do período', undefined, 'Detalhe por pedido/item')}
              title="Clique para detalhar"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <KpiGrupoPanel titulo="Vendas & ticket" gridClass="grid-cols-2 sm:grid-cols-3 xl:grid-cols-2">
              <KpiMetricaCompacta titulo="Ticket médio / pedido" valor={formatMoeda(k?.ticketMedio ?? 0)} />
              <KpiMetricaCompacta titulo="Ticket médio / cliente" valor={formatMoeda(k?.ticketMedioCliente ?? 0)} />
              <KpiMetricaCompacta titulo="Itens / pedido" valor={formatNumero(k?.itensPorPedido ?? 0)} />
              <KpiMetricaCompacta titulo="Valor / item" valor={formatMoeda(k?.valorPorItem ?? 0)} />
              <KpiMetricaCompacta
                titulo="Desconto médio"
                valor={k?.descontoMedioPct != null ? `${k.descontoMedioPct}%` : '—'}
              />
            </KpiGrupoPanel>

            <KpiGrupoPanel titulo="Clientes" gridClass="grid-cols-2">
              <KpiMetricaCompacta
                titulo="Positivação"
                valor={formatNumero(k?.positivacao ?? 0)}
                sub="Clientes com venda"
              />
              <KpiMetricaCompacta titulo="Clientes novos" valor={formatNumero(k?.clientesNovos ?? 0)} />
              <KpiMetricaCompacta
                titulo="Clientes recorrentes"
                valor={formatNumero(k?.clientesRecorrentes ?? 0)}
              />
              <KpiMetricaCompacta
                titulo="Pareto top 20% vend."
                valor={k?.concentracaoTop20Pct != null ? `${k.concentracaoTop20Pct}%` : '—'}
                sub="Concentração da venda"
              />
            </KpiGrupoPanel>

            <KpiGrupoPanel titulo="Produto & custo" gridClass="grid-cols-1 sm:grid-cols-2">
              <KpiMetricaCompacta
                titulo="Cobertura grupos"
                valor={k?.coberturaPct != null ? `${k.coberturaPct}%` : '—'}
                sub="Grupos com venda"
              />
              <KpiMetricaCompacta
                titulo="Custo (DRE)"
                valor={formatMoeda(k?.custo ?? 0)}
                sub={
                  k?.coberturaCustoPct != null
                    ? `Cobertura ${k.coberturaCustoPct}% · sem MKP`
                    : 'BOM + custo médio · sem MKP'
                }
              />
            </KpiGrupoPanel>
          </div>
        </section>
      )}

      <ComissionamentoParetoClientes
        rows={analytics?.paretoClientes ?? []}
        loading={loading}
        onBarClick={(row) =>
          abrirDetalhe(`Cliente · ${row.label}`, { cliente: row.key }, 'Vendas do cliente')
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Evolução mensal</h2>
          <span className="text-xs text-slate-500">
            Passe o mouse para resumo · clique para detalhar · Ctrl+clique filtra o mês
          </span>
        </div>
        <PainelComercialEvolucaoChart
          series={serieChart}
          loading={loading}
          onPointClick={onMesClick}
        />
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
              <tr>
                <th className="px-2 py-1.5 text-left">Mês</th>
                <th className="px-2 py-1.5 text-right">Venda</th>
                <th className="px-2 py-1.5 text-right">Ano ant.</th>
                <th className="px-2 py-1.5 text-right">Var. YoY</th>
                <th className="px-2 py-1.5 text-right">Var. MoM</th>
                <th className="px-2 py-1.5 text-right">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(analytics?.serieMensal ?? []).map((s) => (
                <tr
                  key={s.mes}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  onClick={(e) => onMesClick(s.mes, e)}
                  title="Clique para detalhar as vendas do mês"
                >
                  <td className="px-2 py-1.5">{labelMesCurto(s.mes)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(s.valor)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {s.valorAnoAnterior != null ? formatMoeda(s.valorAnoAnterior) : '—'}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${classVar(s.varYoyPct)}`}>
                    {formatPct(s.varYoyPct)}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${classVar(s.varMomPct)}`}>
                    {formatPct(s.varMomPct)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(s.pedidos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Visão:</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
          <button
            type="button"
            onClick={() => setVisao('individual')}
            className={`px-3 py-1.5 text-xs font-semibold ${
              visao === 'individual'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setVisao('equipe')}
            className={`px-3 py-1.5 text-xs font-semibold ${
              visao === 'equipe'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Por equipe
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            {visao === 'equipe' ? 'Share por equipe' : 'Ranking vendedores'}
          </h2>
          <PainelComercialBarRanking
            rows={rankingAtual}
            loading={loading}
            title={visao === 'equipe' ? 'Equipes' : 'Vendedores / representantes'}
            onRowClick={onRankingClick}
            subtitle={
              visao === 'equipe'
                ? 'Passe o mouse para resumo · clique para detalhar · Ctrl+clique para filtrar.'
                : 'Shift+clique marca para comparar · Ctrl+clique filtra · clique detalha.'
            }
          />
          {visao === 'individual' && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-slate-600 dark:text-slate-300">
              {(analytics?.rankingVendedores ?? []).slice(0, 12).map((e) => (
                <li key={e.key} className="flex justify-between gap-2">
                  <span className="truncate" title={e.label}>
                    {e.label}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoeda(e.valor)}
                    {e.margemPct != null ? ` · margem ${e.margemPct}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {visao === 'equipe' && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {(analytics?.rankingEquipes ?? []).map((e) => (
                <li key={e.key} className="flex justify-between gap-2">
                  <span>{e.label}</span>
                  <span className="tabular-nums">
                    {formatMoeda(e.valor)} ({e.sharePct ?? 0}%)
                    {e.margemPct != null ? ` · margem ${e.margemPct}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Mix por grupo de produto</h2>
          <PainelComercialMixChart
            data={mixGruposData}
            loading={loading}
            onSliceClick={onMixClick}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Margem por produto
            </h2>
            <p className="text-xs text-slate-500">
              Top produtos por margem (R$) · custo DRE sem MKP · clique para detalhar
            </p>
          </div>
        </div>
        {(analytics?.rankingProdutosMargem ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {loading ? 'Carregando…' : 'Sem produtos com custo no filtro atual.'}
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                <tr>
                  <th className="px-2 py-1.5 text-left">Produto</th>
                  <th className="px-2 py-1.5 text-right">Venda</th>
                  <th className="px-2 py-1.5 text-right">Custo</th>
                  <th className="px-2 py-1.5 text-right">Margem</th>
                  <th className="px-2 py-1.5 text-right">Margem %</th>
                  <th className="px-2 py-1.5 text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(analytics?.rankingProdutosMargem ?? []).map((p) => (
                  <tr
                    key={p.key}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    onClick={() =>
                      abrirDetalhe(`Produto · ${p.label}`, { produto: p.key }, 'Itens do produto')
                    }
                    title="Clique para detalhar"
                  >
                    <td className="max-w-[18rem] truncate px-2 py-1.5" title={p.label}>
                      {p.label}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(p.valor)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatMoeda(p.custo ?? 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoeda(p.margem ?? 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {p.margemPct != null ? `${p.margemPct}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(p.pedidos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Mix de status</h2>
          <PainelComercialBarRanking
            rows={(analytics?.mixStatus ?? []).map((s) => ({
              key: s.key,
              label: s.label,
              valor: s.valor,
              qtde: s.qtde,
              pedidos: s.pedidos,
            }))}
            loading={loading}
            title="Status do item"
            onRowClick={onStatusClick}
            subtitle="Clique para ver as vendas deste status."
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Heatmap equipe × mês</h2>
          {mesesHeat.length === 0 ? (
            <p className="text-sm text-slate-500">Sem dados.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr>
                    <th className="px-1 py-1 text-left">Equipe</th>
                    {mesesHeat.map((m) => (
                      <th key={m} className="px-1 py-1 text-right whitespace-nowrap">
                        {labelMesCurto(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {equipesHeat.map((eq) => (
                    <tr key={eq}>
                      <td className="px-1 py-1 font-medium whitespace-nowrap">{eq}</td>
                      {mesesHeat.map((m) => {
                        const v = heatMap.get(`${eq}|${m}`) ?? 0;
                        const alpha = Math.min(0.85, v / maxHeat);
                        return (
                          <td
                            key={m}
                            className={`px-1 py-1 text-right tabular-nums ${v > 0 ? 'cursor-pointer hover:ring-1 hover:ring-primary-400' : ''}`}
                            style={{
                              backgroundColor: v > 0 ? `rgba(37, 99, 235, ${0.12 + alpha * 0.55})` : undefined,
                            }}
                            title={
                              v > 0
                                ? `${eq} · ${labelMesCurto(m)}\n${formatMoeda(v)}\nClique para detalhar`
                                : undefined
                            }
                            onClick={v > 0 ? () => onHeatClick(eq, m) : undefined}
                          >
                            {v > 0 ? formatMoeda(v, true) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ModalClassificarEquipesComissionamento
        aberto={modalEquipes}
        onClose={() => setModalEquipes(false)}
        filtros={filtros}
        onSalvo={() => void carregar(filtros)}
      />
      <ModalComissionamentoDetalhe
        aberto={modalDetalhe != null}
        titulo={modalDetalhe?.titulo ?? ''}
        subtitulo={modalDetalhe?.subtitulo}
        filtros={filtros}
        contexto={modalDetalhe?.contexto}
        onClose={() => setModalDetalhe(null)}
      />
      <ModalComparativoVendedores
        aberto={modalComparativo}
        onClose={() => setModalComparativo(false)}
        filtros={filtros}
        opcoesVendedores={analytics?.opcoes.vendedores ?? []}
        preselecionados={
          vendedoresComparar.length > 0
            ? vendedoresComparar
            : (filtros.vendedor ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        }
      />
      <ModalClientesInativosComissionamento
        aberto={modalInativos}
        onClose={() => setModalInativos(false)}
        filtros={filtros}
      />
    </div>
  );
}
