import { useCallback, useEffect, useState } from 'react';
import {
  obterDashEntregasAnalytics,
  type AgingFaixaResumo,
  type ClienteAtrasadoResumo,
  type DashEntregasAnalytics,
  type DashEntregasDrillFiltro,
  type ObservacaoValorResumo,
  type TipoFLeadTimeResumo,
  type TipoFValorResumo,
} from '../api/pedidos';
import DashEntregasAgingChart from '../components/dash-entregas/DashEntregasAgingChart';
import DashEntregasConcentracaoCard from '../components/dash-entregas/DashEntregasConcentracaoCard';
import DashEntregasKpiCards, { type KpiDrillKey } from '../components/dash-entregas/DashEntregasKpiCards';
import DashEntregasRotasChart from '../components/dash-entregas/DashEntregasRotasChart';
import DashEntregasStatusChart from '../components/dash-entregas/DashEntregasStatusChart';
import DashEntregasTopClientesChart from '../components/dash-entregas/DashEntregasTopClientesChart';
import ModalDashEntregasAgingTipoF from '../components/dash-entregas/ModalDashEntregasAgingTipoF';
import ModalDashEntregasLeadTimeTipoF from '../components/dash-entregas/ModalDashEntregasLeadTimeTipoF';
import ModalDashEntregasDetalhe from '../components/dash-entregas/ModalDashEntregasDetalhe';
import { formatLeadTimeDias, formatMoedaDash, formatNumero, getTodayISO } from '../components/dash-entregas/dashEntregasUtils';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<DashEntregasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillFiltro, setDrillFiltro] = useState<DashEntregasDrillFiltro | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [agingFaixa, setAgingFaixa] = useState<AgingFaixaResumo | null>(null);
  const [agingTipoFModalAberto, setAgingTipoFModalAberto] = useState(false);
  const [leadTimeTipoFModalAberto, setLeadTimeTipoFModalAberto] = useState(false);

  const carregar = useCallback(async () => {
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
    void carregar();
  }, [carregar]);

  const abrirDrill = useCallback((filtro: DashEntregasDrillFiltro) => {
    setDrillFiltro(filtro);
    setModalAberto(true);
  }, []);

  const fecharDrill = useCallback(() => {
    setModalAberto(false);
    setDrillFiltro(null);
  }, []);

  const fecharAgingTipoF = useCallback(() => {
    setAgingTipoFModalAberto(false);
    setAgingFaixa(null);
  }, []);

  const fecharLeadTimeTipoF = useCallback(() => {
    setLeadTimeTipoFModalAberto(false);
  }, []);

  const handleKpiDrill = useCallback(
    (key: KpiDrillKey) => {
      const hoje = getTodayISO();
      switch (key) {
        case 'total':
          abrirDrill({
            titulo: 'Todos os pedidos em aberto',
            subtitulo: 'Saldo pendente total do gerenciador',
          });
          break;
        case 'atrasado':
          abrirDrill({
            titulo: 'Pedidos atrasados',
            subtitulo: 'Itens classificados como Atrasado',
            status: 'Atrasado',
          });
          break;
        case 'em_dia':
          abrirDrill({
            titulo: 'Pedidos em dia',
            subtitulo: 'Itens classificados como Em dia',
            status: 'Em dia',
          });
          break;
        case 'entrega_hoje':
          abrirDrill({
            titulo: 'Entrega hoje',
            subtitulo: `Previsão atualizada em ${hoje.split('-').reverse().join('/')}`,
            data_ini: hoje,
            data_fim: hoje,
          });
          break;
        case 'lead_time':
          setLeadTimeTipoFModalAberto(true);
          break;
      }
    },
    [abrirDrill]
  );

  const handleFaixaClick = useCallback((faixa: AgingFaixaResumo) => {
    setAgingFaixa(faixa);
    setAgingTipoFModalAberto(true);
  }, []);

  const handleAgingTipoFClick = useCallback(
    (faixa: AgingFaixaResumo, item: TipoFValorResumo) => {
      setAgingTipoFModalAberto(false);
      abrirDrill({
        titulo: `${faixa.label} — ${item.tipoF}`,
        subtitulo: `${formatMoedaDash(item.valor)} · ${item.quantidade} linhas`,
        faixa_atraso: faixa.faixa as DashEntregasDrillFiltro['faixa_atraso'],
        tipo_f: item.tipoF,
        status: faixa.faixa === 'em_dia' ? 'Em dia' : 'Atrasado',
        gradeLayout: 'aging',
      });
    },
    [abrirDrill]
  );

  const handleLeadTimeTipoFClick = useCallback(
    (item: TipoFLeadTimeResumo) => {
      setLeadTimeTipoFModalAberto(false);
      abrirDrill({
        titulo: `Lead time — ${item.tipoF}`,
        subtitulo: `Média de ${formatLeadTimeDias(item.leadTimeMedioDias)} · ${formatNumero(item.quantidade)} linhas`,
        tipo_f: item.tipoF,
        gradeLayout: 'lead_time',
      });
    },
    [abrirDrill]
  );

  const handleRotaClick = useCallback(
    (rota: ObservacaoValorResumo, tipo: 'total' | 'atrasado' | 'em_dia') => {
      const base = {
        observacoes: rota.observacao,
        subtitulo: rota.observacao,
      };
      if (tipo === 'atrasado') {
        abrirDrill({
          ...base,
          titulo: `Atrasados — ${rota.observacao}`,
          status: 'Atrasado',
        });
      } else if (tipo === 'em_dia') {
        abrirDrill({
          ...base,
          titulo: `Em dia — ${rota.observacao}`,
          status: 'Em dia',
        });
      } else {
        abrirDrill({
          ...base,
          titulo: `Rota: ${rota.observacao}`,
        });
      }
    },
    [abrirDrill]
  );

  const handleClienteClick = useCallback(
    (cliente: ClienteAtrasadoResumo) => {
      abrirDrill({
        titulo: `Cliente: ${cliente.cliente}`,
        subtitulo: `${formatMoedaDash(cliente.valorAtrasado)} atrasado · ${cliente.quantidade} itens`,
        cliente: cliente.cliente,
        status: 'Atrasado',
      });
    },
    [abrirDrill]
  );

  const resumo = analytics?.resumo ?? null;
  const leadTimeSubtitulo = resumo?.leadTimeMedioDias != null
    ? `Média geral de ${formatLeadTimeDias(resumo.leadTimeMedioDias)} até a previsão original`
    : 'Lead time médio por TipoF';
  const totalValorBase = resumo?.totalValorPendenteReal ?? 0;

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
        <DashEntregasKpiCards resumo={resumo} loading={loading} onDrill={handleKpiDrill} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Grupo de produto"
          subtitulo="Saldo pendente total por grupo"
          data={analytics?.concentracao?.porGrupoProduto ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) =>
            abrirDrill({
              titulo: `Grupo: ${item.label}`,
              subtitulo: `${formatMoedaDash(item.valor)} · ${formatNumero(item.quantidade)} itens`,
              grupo_produto: item.label,
            })
          }
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Setor de produção"
          subtitulo="Saldo pendente total por setor"
          data={analytics?.concentracao?.porSetorProducao ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) =>
            abrirDrill({
              titulo: `Setor de produção: ${item.label}`,
              subtitulo: `${formatMoedaDash(item.valor)} · ${formatNumero(item.quantidade)} itens`,
              setor_producao: item.label,
            })
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo1"
          subtitulo="Saldo pendente total por Subgrupo1"
          data={analytics?.concentracao?.porSubgrupo1 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) =>
            abrirDrill({
              titulo: `Subgrupo1: ${item.label}`,
              subtitulo: `${formatMoedaDash(item.valor)} · ${formatNumero(item.quantidade)} itens`,
              subgrupo1: item.label,
            })
          }
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo2"
          subtitulo="Saldo pendente total por Subgrupo2"
          data={analytics?.concentracao?.porSubgrupo2 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) =>
            abrirDrill({
              titulo: `Subgrupo2: ${item.label}`,
              subtitulo: `${formatMoedaDash(item.valor)} · ${formatNumero(item.quantidade)} itens`,
              subgrupo2: item.label,
            })
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasStatusChart
          resumo={resumo}
          loading={loading}
          onAtrasadoClick={() => handleKpiDrill('atrasado')}
          onEmDiaClick={() => handleKpiDrill('em_dia')}
        />
        <DashEntregasAgingChart
          data={analytics?.aging ?? []}
          loading={loading}
          onFaixaClick={handleFaixaClick}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashEntregasRotasChart
            data={analytics?.rotas ?? []}
            loading={loading}
            onRotaClick={handleRotaClick}
          />
        </div>
        <DashEntregasTopClientesChart
          data={analytics?.topClientesAtrasados ?? []}
          loading={loading}
          onClienteClick={handleClienteClick}
        />
      </section>

      <ModalDashEntregasAgingTipoF
        open={agingTipoFModalAberto}
        faixa={agingFaixa}
        onClose={fecharAgingTipoF}
        onTipoFClick={handleAgingTipoFClick}
      />
      <ModalDashEntregasLeadTimeTipoF
        open={leadTimeTipoFModalAberto}
        titulo="Lead time — média por TipoF"
        subtitulo={leadTimeSubtitulo}
        onClose={fecharLeadTimeTipoF}
        onTipoFClick={handleLeadTimeTipoFClick}
      />
      <ModalDashEntregasDetalhe open={modalAberto} filtro={drillFiltro} onClose={fecharDrill} />
    </div>
  );
}
