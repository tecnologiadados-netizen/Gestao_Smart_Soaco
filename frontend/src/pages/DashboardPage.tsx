import { useCallback, useEffect, useState } from 'react';
import { obterDashEntregasAnalytics, type DashEntregasAnalytics } from '../api/pedidos';
import DashEntregasAgingChart from '../components/dash-entregas/DashEntregasAgingChart';
import DashEntregasConcentracaoCard from '../components/dash-entregas/DashEntregasConcentracaoCard';
import DashEntregasKpiCards from '../components/dash-entregas/DashEntregasKpiCards';
import DashEntregasRotasChart from '../components/dash-entregas/DashEntregasRotasChart';
import DashEntregasStatusChart from '../components/dash-entregas/DashEntregasStatusChart';
import DashEntregasTopClientesChart from '../components/dash-entregas/DashEntregasTopClientesChart';

/**
 * Painel temporariamente indisponível para TODOS os usuários.
 * Quando true: não busca API, não coloca números reais no DOM e cobre com overlay opaco.
 */
const PAINEL_EM_CONSTRUCAO = true;

function PainelEmConstrucaoOverlay() {
  const noop = () => {};
  // Esqueleto sem dados reais — só atmosfera borrada atrás do aviso.
  const placeholder = (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Painel Pedidos em aberto — análise de saldo pendente
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Visão baseada em pedidos de venda com saldo a faturar pendente.
          </p>
        </div>
      </header>
      <section>
        <DashEntregasKpiCards resumo={null} loading onDrill={noop} />
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Grupo de produto"
          subtitulo="Saldo pendente total por grupo"
          data={[]}
          totalValorBase={0}
          loading
          onItemClick={noop}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Setor de produção"
          subtitulo="Saldo pendente total por setor"
          data={[]}
          totalValorBase={0}
          loading
          onItemClick={noop}
        />
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasStatusChart
          resumo={null}
          loading
          onAtrasadoClick={noop}
          onEmDiaClick={noop}
        />
        <DashEntregasAgingChart data={[]} loading onFaixaClick={noop} />
      </section>
    </div>
  );

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-xl">
      <div
        className="pointer-events-none select-none opacity-50"
        aria-hidden
        style={{ filter: 'blur(28px)', transform: 'scale(1.04)' }}
      >
        {placeholder}
      </div>
      {/* Camada extra: obscurece qualquer resíduo legível do blur */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-slate-950/55 dark:bg-slate-950/65"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 backdrop-blur-xl"
        role="status"
        aria-live="polite"
      >
        <div className="mx-4 max-w-md rounded-2xl border border-slate-200/80 bg-white px-8 py-10 text-center shadow-2xl dark:border-slate-600 dark:bg-slate-800">
          <p className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Em construção
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Este painel está temporariamente indisponível. Em breve voltará com melhorias.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<DashEntregasAnalytics | null>(null);
  const [loading, setLoading] = useState(!PAINEL_EM_CONSTRUCAO);

  const carregar = useCallback(async () => {
    if (PAINEL_EM_CONSTRUCAO) return;
    setLoading(true);
    try {
      const data = await obterDashEntregasAnalytics();
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (PAINEL_EM_CONSTRUCAO) {
      setAnalytics(null);
      setLoading(false);
      return;
    }
    void carregar();
  }, [carregar]);

  if (PAINEL_EM_CONSTRUCAO) {
    return <PainelEmConstrucaoOverlay />;
  }

  const resumo = analytics?.resumo ?? null;
  const totalValorBase = resumo?.totalValorPendenteReal ?? 0;
  const noop = () => {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Painel Pedidos em aberto — análise de saldo pendente
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Visão baseada em pedidos de venda com saldo a faturar pendente. Não contempla requisições.
            Todos os indicadores são clicáveis para consultar a origem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      <section>
        <DashEntregasKpiCards resumo={resumo} loading={loading} onDrill={noop} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Grupo de produto"
          subtitulo="Saldo pendente total por grupo"
          data={analytics?.concentracao?.porGrupoProduto ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={noop}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Setor de produção"
          subtitulo="Saldo pendente total por setor"
          data={analytics?.concentracao?.porSetorProducao ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={noop}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo1"
          subtitulo="Saldo pendente total por Subgrupo1"
          data={analytics?.concentracao?.porSubgrupo1 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={noop}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo2"
          subtitulo="Saldo pendente total por Subgrupo2"
          data={analytics?.concentracao?.porSubgrupo2 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={noop}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasStatusChart
          resumo={resumo}
          loading={loading}
          onAtrasadoClick={noop}
          onEmDiaClick={noop}
        />
        <DashEntregasAgingChart data={analytics?.aging ?? []} loading={loading} onFaixaClick={noop} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashEntregasRotasChart data={analytics?.rotas ?? []} loading={loading} onRotaClick={noop} />
        </div>
        <DashEntregasTopClientesChart
          data={analytics?.topClientesAtrasados ?? []}
          loading={loading}
          onClienteClick={noop}
        />
      </section>
    </div>
  );
}
