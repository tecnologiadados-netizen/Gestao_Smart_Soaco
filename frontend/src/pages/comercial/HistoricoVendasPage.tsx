import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import PainelComercialBarRanking from '../../components/painel-comercial/PainelComercialBarRanking';
import PainelComercialMixChart from '../../components/painel-comercial/PainelComercialMixChart';
import PainelComercialGanhadoresPerdedores from '../../components/painel-comercial/PainelComercialGanhadoresPerdedores';
import ModalPainelComercialDrill from '../../components/painel-comercial/ModalPainelComercialDrill';
import ModalHistoricoVendasEvolucao from '../../components/painel-comercial/ModalHistoricoVendasEvolucao';
import {
  formatMoeda,
  formatNumero,
  hojeYmd,
  formatYmdBr,
  inicioMesesFechadosMaisCorrenteYmd,
  mesesEntreYmd,
} from '../../components/painel-comercial/painelComercialUtils';

const MAX_MESES = 48;

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

function filtroDefault(): FiltrosHistoricoVendas {
  return {
    dataIni: inicioMesesFechadosMaisCorrenteYmd(3),
    dataFim: hojeYmd(),
    comparacaoBase: 'ano_anterior',
  };
}

export default function HistoricoVendasPage() {
  const [filtros, setFiltros] = useState<FiltrosHistoricoVendas>(() => filtroDefault());
  const [draft, setDraft] = useState<FiltrosHistoricoVendas>(() => filtroDefault());
  const [analytics, setAnalytics] = useState<HistoricoVendasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
    void carregar(filtros);
  }, [carregar, filtros]);

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

  const headerResumo = useMemo(() => {
    const k = analytics?.kpis;
    const f = analytics?.filtros;
    if (!k || !f?.dataIni || !f?.dataFim) return 'Sem dados.';
    return `Período ${formatYmdBr(f.dataIni)} a ${formatYmdBr(f.dataFim)} · ${formatMoeda(k.valor)} · ${formatNumero(k.pedidos)} PDs · ${formatNumero(k.qtde)} un.`;
  }, [analytics]);

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
        `${formatMoeda(k.valor)} · ${formatNumero(k.pedidos)} PDs · ${formatNumero(k.qtde)} un.`,
        undefined
      );
    },
    [abrirDrill, abrirEvolucao, analytics?.kpis]
  );

  const handleMesClick = useCallback(
    (mes: string) => {
      abrirDrill(`Mês ${mes}`, 'Quebra por grupo de produto — clique para ver a evolução', 'grupo', { mes });
    },
    [abrirDrill]
  );

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Histórico de Vendas</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Vendas Só Aço (abertas e encerradas; sem canceladas). {headerResumo}
          </p>
          {filtrosPendentes && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar os indicadores.
            </p>
          )}
          {periodoDraftErro && (
            <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">{periodoDraftErro}</p>
          )}
        </div>
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
              onChange={(e) => setDraft((d) => ({ ...d, comparacaoBase: e.target.value as FiltrosHistoricoVendas['comparacaoBase'] }))}
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
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {erro}
        </div>
      )}

      <PainelComercialKpiCards kpis={analytics?.kpis ?? null} loading={loading} onKpiClick={handleKpiClick} />

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PainelComercialEvolucaoChart series={analytics?.serieMensal ?? []} loading={loading} onPointClick={handleMesClick} />
        <PainelComercialMixChart
          data={analytics?.mixGrupos ?? []}
          loading={loading}
          onSliceClick={(grupoProduto) =>
            abrirEvolucao(`Grupo ${grupoProduto}`, 'Evolução mensal no período filtrado', { grupoProduto })
          }
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PainelComercialBarRanking
          title="Top grupos"
          subtitle="Clique para ver a evolução mensal."
          rows={(analytics?.topGrupos ?? []) as any}
          loading={loading}
          onRowClick={(r) =>
            abrirEvolucao(`Grupo ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.pedidos)} PDs`, {
              grupoProduto: r.key,
            })
          }
        />
        <PainelComercialBarRanking
          title="Top vendedores"
          subtitle="Clique para ver a evolução mensal."
          rows={(analytics?.topVendedores ?? []) as any}
          loading={loading}
          onRowClick={(r) =>
            abrirEvolucao(`Vendedor ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.pedidos)} PDs`, {
              vendedor: r.key,
            })
          }
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PainelComercialBarRanking
          title="Top regiões"
          subtitle="Clique para ver a evolução mensal."
          rows={(analytics?.topRegioes ?? []) as any}
          loading={loading}
          onRowClick={(r) =>
            abrirEvolucao(`Região ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.pedidos)} PDs`, {
              regiao: r.key,
            })
          }
        />
        <PainelComercialBarRanking
          title="Top subgrupo 1"
          subtitle="Clique para ver a evolução mensal."
          rows={(analytics?.topSubgrupo1 ?? []) as any}
          loading={loading}
          onRowClick={(r) =>
            abrirEvolucao(`Subgrupo 1 ${r.label}`, `${formatMoeda(r.valor)} · ${formatNumero(r.pedidos)} PDs`, {
              subgrupo1: r.key,
            })
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
          // Evolução no período filtrado da página (não restringe ao mês do drill intermediário).
          const { mes: _mes, ...resto } = baseWhere ?? {};
          if (dim === 'grupo') {
            abrirEvolucao(`Grupo ${item.label}`, `${formatMoeda(item.valor)} · ${formatNumero(item.pedidos)} PDs`, {
              ...resto,
              grupoProduto: item.key,
            });
            return;
          }
          if (dim === 'subgrupo1') {
            abrirEvolucao(`Subgrupo 1 ${item.label}`, `${formatMoeda(item.valor)} · ${formatNumero(item.pedidos)} PDs`, {
              ...resto,
              subgrupo1: item.key,
            });
            return;
          }
          abrirEvolucao(item.label, `${formatMoeda(item.valor)} · ${formatNumero(item.pedidos)} PDs`, {
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
    </div>
  );
}
