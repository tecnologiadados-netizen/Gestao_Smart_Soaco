import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  obterHistoricoVendasAnalytics,
  obterHistoricoVendasDrill,
  type FiltrosHistoricoVendas,
  type HistoricoVendasAnalytics,
  type DrillDim,
  type SerieFatiaContexto,
  type SerieMes,
} from '../../api/historicoVendas';
import PainelComercialKpiCards, { type KpiKey } from '../../components/painel-comercial/PainelComercialKpiCards';
import PainelComercialEvolucaoChart from '../../components/painel-comercial/PainelComercialEvolucaoChart';
import type { MetricaPainel } from '../../components/painel-comercial/metricaPainel';
import PainelComercialBarRanking, {
  type RankingRow,
} from '../../components/painel-comercial/PainelComercialBarRanking';
import PainelComercialMixChart from '../../components/painel-comercial/PainelComercialMixChart';
import PainelComercialGanhadoresPerdedores from '../../components/painel-comercial/PainelComercialGanhadoresPerdedores';
import ModalPainelComercialDrill from '../../components/painel-comercial/ModalPainelComercialDrill';
import ModalHistoricoVendasEvolucao from '../../components/painel-comercial/ModalHistoricoVendasEvolucao';
import ModalHistoricoVendasPeriodo from '../../components/painel-comercial/ModalHistoricoVendasPeriodo';
import {
  formatMoeda,
  formatNumero,
  mesesEntreYmd,
  mesParaPeriodoYmd,
  PAINEL_COMERCIAL_MAX_MESES,
  PAINEL_PALETTE,
  periodoDisponivelPadraoYmd,
} from '../../components/painel-comercial/painelComercialUtils';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';

const MAX_MESES = PAINEL_COMERCIAL_MAX_MESES;

type ModalState =
  | null
  | {
      tipo: 'drill';
      titulo: string;
      subtitulo?: string;
      dim: DrillDim;
      where?: SerieFatiaContexto;
    }
  | {
      tipo: 'evolucao';
      titulo: string;
      subtitulo?: string;
      contexto?: SerieFatiaContexto;
    };

type DimFiltroKey = 'grupoProduto' | 'subgrupo1' | 'vendedor' | 'uf' | 'produto';

function filtroDefault(): FiltrosHistoricoVendas {
  return {
    ...periodoDisponivelPadraoYmd(),
    comparacaoBase: 'ano_anterior',
  };
}

function isCtrlClick(e: MouseEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

export default function HistoricoVendasPage() {
  const [periodoConfirmado, setPeriodoConfirmado] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosHistoricoVendas>(() => filtroDefault());
  const [draft, setDraft] = useState<FiltrosHistoricoVendas>(() => filtroDefault());
  const [analytics, setAnalytics] = useState<HistoricoVendasAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [metricaEvolucao, setMetricaEvolucao] = useState<MetricaPainel>('valor');
  const [metricaGrupos, setMetricaGrupos] = useState<MetricaPainel>('valor');
  const [metricaSubgrupo1, setMetricaSubgrupo1] = useState<MetricaPainel>('valor');

  const serieCacheRef = useRef(new Map<string, SerieMes[]>());
  const [modal, setModal] = useState<ModalState>(null);

  const carregar = useCallback(async (f: FiltrosHistoricoVendas) => {
    setLoading(true);
    setErro(null);
    try {
      const data = await obterHistoricoVendasAnalytics(f);
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
    if (!periodoConfirmado) return;
    void carregar(filtros);
  }, [carregar, filtros, periodoConfirmado]);

  const filtrosPendentes = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(filtros),
    [draft, filtros]
  );

  const periodoDraftErro = useMemo(() => {
    const meses = mesesEntreYmd(draft.dataIni, draft.dataFim);
    if (meses == null) return 'Datas inválidas.';
    if (meses > MAX_MESES) return `Período máximo permitido: ${MAX_MESES} meses.`;
    return null;
  }, [draft.dataIni, draft.dataFim]);

  const chipsAtivos = useMemo(() => {
    const chips: { key: DimFiltroKey; label: string; value: string }[] = [];
    if (filtros.grupoProduto) chips.push({ key: 'grupoProduto', label: 'Grupo', value: filtros.grupoProduto });
    if (filtros.subgrupo1) chips.push({ key: 'subgrupo1', label: 'Subgrupo 1', value: filtros.subgrupo1 });
    if (filtros.vendedor) chips.push({ key: 'vendedor', label: 'Vendedor', value: filtros.vendedor });
    if (filtros.uf) chips.push({ key: 'uf', label: 'UF', value: filtros.uf });
    if (filtros.produto) chips.push({ key: 'produto', label: 'Produto', value: filtros.produto });
    return chips;
  }, [filtros]);

  const confirmarPeriodoInicial = useCallback((f: FiltrosHistoricoVendas) => {
    serieCacheRef.current.clear();
    setDraft(f);
    setFiltros(f);
    setPeriodoConfirmado(true);
  }, []);

  const aplicarFiltros = useCallback(() => {
    if (periodoDraftErro) {
      setErro(periodoDraftErro);
      return;
    }
    serieCacheRef.current.clear();
    setFiltros({ ...draft });
  }, [draft, periodoDraftErro]);

  const atualizar = useCallback(() => {
    if (periodoDraftErro) {
      setErro(periodoDraftErro);
      return;
    }
    serieCacheRef.current.clear();
    setFiltros({ ...draft });
  }, [draft, periodoDraftErro]);

  const aplicarFatiaNoPainel = useCallback((patch: Partial<FiltrosHistoricoVendas>) => {
    serieCacheRef.current.clear();
    setDraft((d) => ({ ...d, ...patch }));
    setFiltros((f) => ({ ...f, ...patch }));
  }, []);

  const limparChip = useCallback((key: DimFiltroKey) => {
    serieCacheRef.current.clear();
    setDraft((d) => ({ ...d, [key]: undefined }));
    setFiltros((f) => ({ ...f, [key]: undefined }));
  }, []);

  const limparFatias = useCallback(() => {
    serieCacheRef.current.clear();
    const limpo: Partial<FiltrosHistoricoVendas> = {
      grupoProduto: undefined,
      subgrupo1: undefined,
      vendedor: undefined,
      uf: undefined,
      produto: undefined,
    };
    setDraft((d) => ({ ...d, ...limpo }));
    setFiltros((f) => ({ ...f, ...limpo }));
  }, []);

  const abrirEvolucao = useCallback((titulo: string, subtitulo: string | undefined, contexto?: SerieFatiaContexto) => {
    setModal({ tipo: 'evolucao', titulo, subtitulo, contexto });
  }, []);

  const abrirDrill = useCallback(
    (titulo: string, subtitulo: string | undefined, dim: DrillDim, where?: SerieFatiaContexto) => {
      setModal({ tipo: 'drill', titulo, subtitulo, dim, where });
    },
    []
  );

  const handleKpiClick = useCallback(
    (key: KpiKey) => {
      const k = analytics?.kpis;
      if (!k) return;
      if (key === 'concentracao') {
        abrirDrill('Concentração — grupos', `${formatMoeda(k.valor)} no período`, 'grupo');
        return;
      }
      abrirEvolucao(
        'Evolução do período',
        `${formatMoeda(k.valor)} · ${formatNumero(k.qtde)} un.`,
        undefined
      );
    },
    [abrirDrill, abrirEvolucao, analytics?.kpis]
  );

  const handleMesClick = useCallback(
    (mes: string, e: MouseEvent) => {
      if (isCtrlClick(e)) {
        e.preventDefault();
        const periodo = mesParaPeriodoYmd(mes);
        if (!periodo) return;
        aplicarFatiaNoPainel({ dataIni: periodo.dataIni, dataFim: periodo.dataFim });
        return;
      }
      abrirDrill(`Mês ${mes}`, 'Quebra por grupo de produto — clique para ver a evolução', 'grupo', { mes });
    },
    [abrirDrill, aplicarFatiaNoPainel]
  );

  const handleMixClick = useCallback(
    (grupoProduto: string, e: MouseEvent) => {
      if (isCtrlClick(e)) {
        e.preventDefault();
        aplicarFatiaNoPainel({ grupoProduto });
        return;
      }
      abrirEvolucao(`Grupo ${grupoProduto}`, 'Evolução mensal no período filtrado', { grupoProduto });
    },
    [abrirEvolucao, aplicarFatiaNoPainel]
  );

  const handleRankingClick = useCallback(
    (
      dim: DimFiltroKey,
      r: RankingRow,
      e: MouseEvent,
      abrir: () => void
    ) => {
      if (isCtrlClick(e)) {
        e.preventDefault();
        aplicarFatiaNoPainel({ [dim]: r.key });
        return;
      }
      abrir();
    },
    [aplicarFatiaNoPainel]
  );

  return (
    <div className="px-4 py-5 md:px-6">
      <ModalHistoricoVendasPeriodo
        open={!periodoConfirmado}
        initial={draft}
        onConfirm={confirmarPeriodoInicial}
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <KpiPainelVoltarLink painelId="historico-vendas" className="mb-1" />
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Histórico de Vendas</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Vendas Só Aço (abertas e encerradas; sem canceladas).
            {!periodoConfirmado ? ' Selecione o período para carregar.' : null}
          </p>
          {periodoConfirmado && chipsAtivos.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {chipsAtivos.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => limparChip(c.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  title="Remover filtro"
                >
                  <span className="text-slate-500 dark:text-slate-400">{c.label}:</span>
                  {c.value}
                  <span aria-hidden>×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={limparFatias}
                className="text-[11px] font-semibold text-primary-600 hover:underline dark:text-primary-400"
              >
                Limpar filtros
              </button>
            </div>
          )}
          {periodoConfirmado && filtrosPendentes && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar os indicadores.
            </p>
          )}
          {periodoConfirmado && periodoDraftErro && (
            <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">{periodoDraftErro}</p>
          )}
        </div>
        {periodoConfirmado && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                Início
                <input
                  value={draft.dataIni}
                  onChange={(e) => setDraft((d) => ({ ...d, dataIni: e.target.value }))}
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-300">
                Fim
                <input
                  value={draft.dataFim}
                  onChange={(e) => setDraft((d) => ({ ...d, dataFim: e.target.value }))}
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Comparação
              <select
                value={draft.comparacaoBase ?? 'ano_anterior'}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    comparacaoBase: e.target.value as FiltrosHistoricoVendas['comparacaoBase'],
                  }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ano_anterior">Mesmo período ano anterior</option>
                <option value="periodo_anterior">Período anterior</option>
              </select>
            </label>

            <button
              type="button"
              onClick={aplicarFiltros}
              disabled={!!periodoDraftErro}
              className="h-9 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={atualizar}
              disabled={loading || !!periodoDraftErro}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {erro}
        </div>
      )}

      {periodoConfirmado && (
        <>
          <PainelComercialKpiCards kpis={analytics?.kpis ?? null} loading={loading} onKpiClick={handleKpiClick} />

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <PainelComercialEvolucaoChart
              series={analytics?.serieMensal ?? []}
              loading={loading}
              onPointClick={handleMesClick}
              metrica={metricaEvolucao}
              onMetricaChange={setMetricaEvolucao}
              accentColor={PAINEL_PALETTE.barras[0]}
              subtitle="Clique para detalhar · Ctrl+clique restringe o período ao mês."
            />
            <PainelComercialMixChart
              data={analytics?.mixGrupos ?? []}
              loading={loading}
              onSliceClick={handleMixClick}
            />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <PainelComercialBarRanking
              title="Top grupos"
              accentColor={PAINEL_PALETTE.grupos}
              rows={(analytics?.topGrupos ?? []) as RankingRow[]}
              loading={loading}
              metrica={metricaGrupos}
              onMetricaChange={setMetricaGrupos}
              onRowClick={(r, e) =>
                handleRankingClick('grupoProduto', r, e, () =>
                  abrirEvolucao(`Grupo ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.qtde)} un.`, {
                    grupoProduto: r.key,
                  })
                )
              }
            />
            <PainelComercialBarRanking
              title="Top vendedores"
              accentColor={PAINEL_PALETTE.vendedores}
              rows={(analytics?.topVendedores ?? []) as RankingRow[]}
              loading={loading}
              onRowClick={(r, e) =>
                handleRankingClick('vendedor', r, e, () =>
                  abrirEvolucao(`Vendedor ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.qtde)} un.`, {
                    vendedor: r.key,
                  })
                )
              }
            />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <PainelComercialBarRanking
              title="Top UF"
              accentColor={PAINEL_PALETTE.uf}
              rows={(analytics?.topUfs ?? []) as RankingRow[]}
              loading={loading}
              onRowClick={(r, e) =>
                handleRankingClick('uf', r, e, () =>
                  abrirEvolucao(`UF ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.qtde)} un.`, {
                    uf: r.key,
                  })
                )
              }
            />
            <PainelComercialBarRanking
              title="Top subgrupo 1"
              accentColor={PAINEL_PALETTE.subgrupo}
              rows={(analytics?.topSubgrupo1 ?? []) as RankingRow[]}
              loading={loading}
              metrica={metricaSubgrupo1}
              onMetricaChange={setMetricaSubgrupo1}
              onRowClick={(r, e) =>
                handleRankingClick('subgrupo1', r, e, () =>
                  abrirEvolucao(`Subgrupo 1 ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.qtde)} un.`, {
                    subgrupo1: r.key,
                  })
                )
              }
            />
          </div>

          <div className="mt-3">
            <PainelComercialGanhadoresPerdedores
              ganhadores={analytics?.ganhadores ?? []}
              perdedores={analytics?.perdedores ?? []}
              loading={loading}
              onProdutoClick={(codigoProduto) =>
                abrirEvolucao(`Produto ${codigoProduto}`, 'Evolução mensal no período filtrado', { codigoProduto })
              }
            />
          </div>
          <ModalPainelComercialDrill
            open={modal?.tipo === 'drill'}
            modalId="historico-vendas-drill"
            titulo={modal?.tipo === 'drill' ? modal.titulo : ''}
            subtitulo={modal?.tipo === 'drill' ? modal.subtitulo : undefined}
            filtros={filtros}
            dim={modal?.tipo === 'drill' ? modal.dim : 'grupo'}
            where={modal?.tipo === 'drill' ? modal.where : undefined}
            onClose={() => setModal(null)}
            loadDrill={obterHistoricoVendasDrill}
            itemClickTitle="Clique para ver a evolução mensal"
            onItemClick={(item) => {
              const dim = modal?.tipo === 'drill' ? modal.dim : 'grupo';
              const baseWhere = modal?.tipo === 'drill' ? modal.where : undefined;
              const { mes: _mes, ...resto } = baseWhere ?? {};
              if (dim === 'grupo') {
                abrirEvolucao(`Grupo ${item.label}`, `${formatMoeda(item.valor)} · ${formatNumero(item.qtde)} un.`, {
                  ...resto,
                  grupoProduto: item.key,
                });
                return;
              }
              if (dim === 'subgrupo1') {
                abrirEvolucao(
                  `Subgrupo 1 ${item.label}`,
                  `${formatMoeda(item.valor)} · ${formatNumero(item.qtde)} un.`,
                  {
                    ...resto,
                    subgrupo1: item.key,
                  }
                );
                return;
              }
              abrirEvolucao(item.label, `${formatMoeda(item.valor)} · ${formatNumero(item.qtde)} un.`, {
                ...resto,
              });
            }}
          />

          <ModalHistoricoVendasEvolucao
            open={modal?.tipo === 'evolucao'}
            modalId="historico-vendas-evolucao"
            titulo={modal?.tipo === 'evolucao' ? modal.titulo : ''}
            subtitulo={modal?.tipo === 'evolucao' ? modal.subtitulo : undefined}
            filtros={filtros}
            contexto={modal?.tipo === 'evolucao' ? modal.contexto : undefined}
            onClose={() => setModal(null)}
            cacheRef={serieCacheRef}
          />
        </>
      )}
    </div>
  );
}
