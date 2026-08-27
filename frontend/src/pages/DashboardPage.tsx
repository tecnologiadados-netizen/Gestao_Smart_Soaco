import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  obterDashEntregasAnalytics,
  type AgingFaixaResumo,
  type ConcentracaoResumo,
  type DashEntregasAnalytics,
  type DashEntregasDrillFiltro,
  type DashEntregasFaixaAtraso,
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
import ModalDashEntregasDetalhe from '../components/dash-entregas/ModalDashEntregasDetalhe';
import ModalDashEntregasLeadTimeTipoF from '../components/dash-entregas/ModalDashEntregasLeadTimeTipoF';
import ModalFiltrosDashEntregas, {
  countFiltrosDashAtivos,
  defaultFiltrosDashEntregas,
  filtrosDashToApi,
  type FiltrosDashEntregasState,
} from '../components/dash-entregas/ModalFiltrosDashEntregas';
import { formatMoedaDash } from '../components/dash-entregas/dashEntregasUtils';
import KpiPainelVoltarLink from '../components/kpis/KpiPainelVoltarLink';

function hojeYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'detalhe'; filtro: DashEntregasDrillFiltro }
  | { kind: 'agingTipoF'; faixa: AgingFaixaResumo }
  | { kind: 'leadTimeTipoF' };

function mergeDrill(
  base: ReturnType<typeof filtrosDashToApi>,
  extra: {
    titulo: string;
    subtitulo?: string;
    gradeLayout?: DashEntregasDrillFiltro['gradeLayout'];
    status?: 'Atrasado' | 'Em dia';
    observacoes?: string;
    cliente?: string;
    tipo_f?: string;
    grupo_produto?: string;
    subgrupo1?: string;
    subgrupo2?: string;
    setor_producao?: string;
    uf?: string;
    vendedor?: string;
    municipio_entrega?: string;
    metodo?: string;
    tipo_pedido?: string;
    requisicao_loja?: string;
    data_ini?: string;
    data_fim?: string;
    faixa_atraso?: DashEntregasFaixaAtraso;
  }
): DashEntregasDrillFiltro {
  return {
    titulo: extra.titulo,
    subtitulo: extra.subtitulo,
    gradeLayout: extra.gradeLayout,
    observacoes: extra.observacoes ?? base.observacoes,
    cliente: extra.cliente ?? base.cliente,
    tipo_f: extra.tipo_f ?? base.tipo_f,
    grupo_produto: extra.grupo_produto ?? base.grupo_produto,
    subgrupo1: extra.subgrupo1 ?? base.subgrupo1,
    subgrupo2: extra.subgrupo2 ?? base.subgrupo2,
    setor_producao: extra.setor_producao ?? base.setor_producao,
    uf: extra.uf ?? base.uf,
    vendedor: extra.vendedor ?? base.vendedor,
    municipio_entrega: extra.municipio_entrega ?? base.municipio_entrega,
    metodo: extra.metodo ?? base.metodo,
    tipo_pedido: extra.tipo_pedido ?? base.tipo_pedido,
    requisicao_loja: extra.requisicao_loja ?? base.requisicao_loja,
    data_ini: extra.data_ini ?? base.data_ini,
    data_fim: extra.data_fim ?? base.data_fim,
    status: extra.status,
    faixa_atraso: extra.faixa_atraso,
  };
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<DashEntregasAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosDashEntregasState>(
    defaultFiltrosDashEntregas
  );
  const [modalFiltrosAberto, setModalFiltrosAberto] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const filtrosApi = useMemo(() => filtrosDashToApi(filtrosAplicados), [filtrosAplicados]);
  const qtdFiltros = countFiltrosDashAtivos(filtrosAplicados);

  const carregar = useCallback(async (f = filtrosApi) => {
    setLoading(true);
    try {
      const data = await obterDashEntregasAnalytics(f);
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [filtrosApi]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirDetalhe = useCallback((filtro: DashEntregasDrillFiltro) => {
    setModal({ kind: 'detalhe', filtro });
  }, []);

  const fecharModais = useCallback(() => setModal({ kind: 'none' }), []);

  const handleKpiDrill = useCallback(
    (key: KpiDrillKey) => {
      const hoje = hojeYmd();
      if (key === 'lead_time') {
        setModal({ kind: 'leadTimeTipoF' });
        return;
      }
      if (key === 'total') {
        abrirDetalhe(
          mergeDrill(filtrosApi, {
            titulo: 'Saldo pendente total',
            subtitulo: 'Todos os pedidos do recorte atual',
            gradeLayout: 'full',
          })
        );
        return;
      }
      if (key === 'atrasado') {
        abrirDetalhe(
          mergeDrill(filtrosApi, {
            titulo: 'Saldo atrasado',
            status: 'Atrasado',
            gradeLayout: 'full',
          })
        );
        return;
      }
      if (key === 'em_dia') {
        abrirDetalhe(
          mergeDrill(filtrosApi, {
            titulo: 'Saldo em dia',
            status: 'Em dia',
            gradeLayout: 'full',
          })
        );
        return;
      }
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo: 'Entrega hoje',
          data_ini: hoje,
          data_fim: hoje,
          gradeLayout: 'full',
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleConcentracao = useCallback(
    (
      dim: 'grupo_produto' | 'subgrupo1' | 'subgrupo2' | 'setor_producao' | 'uf' | 'vendedor',
      item: ConcentracaoResumo,
      tituloBase: string
    ) => {
      if (!item.label || item.label === 'Outros') return;
      const dimFiltro = { [dim]: item.label } as Pick<
        DashEntregasDrillFiltro,
        'grupo_produto' | 'subgrupo1' | 'subgrupo2' | 'setor_producao' | 'uf' | 'vendedor'
      >;
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo: `${tituloBase}: ${item.label}`,
          subtitulo: `${formatMoedaDash(item.valor)} · ${item.quantidade} linhas`,
          gradeLayout: 'full',
          ...dimFiltro,
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleStatusAtrasado = useCallback(() => {
    abrirDetalhe(
      mergeDrill(filtrosApi, {
        titulo: 'Saldo atrasado',
        status: 'Atrasado',
        gradeLayout: 'full',
      })
    );
  }, [abrirDetalhe, filtrosApi]);

  const handleStatusEmDia = useCallback(() => {
    abrirDetalhe(
      mergeDrill(filtrosApi, {
        titulo: 'Saldo em dia',
        status: 'Em dia',
        gradeLayout: 'full',
      })
    );
  }, [abrirDetalhe, filtrosApi]);

  const handleFaixaClick = useCallback((faixa: AgingFaixaResumo) => {
    setModal({ kind: 'agingTipoF', faixa });
  }, []);

  const handleAgingTipoF = useCallback(
    (faixa: AgingFaixaResumo, item: TipoFValorResumo) => {
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo: `${faixa.label} — ${item.tipoF}`,
          subtitulo: formatMoedaDash(item.valor),
          tipo_f: item.tipoF,
          faixa_atraso: faixa.faixa as DashEntregasFaixaAtraso,
          gradeLayout: 'aging',
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleLeadTimeTipoF = useCallback(
    (item: TipoFLeadTimeResumo) => {
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo: `Lead time — ${item.tipoF}`,
          subtitulo: `${item.leadTimeMedioDias} dias · ${item.quantidade} linhas`,
          tipo_f: item.tipoF,
          gradeLayout: 'lead_time',
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleRotaClick = useCallback(
    (rota: ObservacaoValorResumo, tipo: 'total' | 'atrasado' | 'em_dia') => {
      const status =
        tipo === 'atrasado' ? 'Atrasado' : tipo === 'em_dia' ? 'Em dia' : undefined;
      const titulo =
        tipo === 'atrasado'
          ? `Rota atrasada: ${rota.observacao}`
          : tipo === 'em_dia'
            ? `Rota em dia: ${rota.observacao}`
            : `Rota: ${rota.observacao}`;
      const valor =
        tipo === 'atrasado'
          ? rota.valorAtrasado
          : tipo === 'em_dia'
            ? rota.valorEmDia
            : rota.valorTotal;
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo,
          subtitulo: formatMoedaDash(valor),
          observacoes: rota.observacao,
          status,
          gradeLayout: 'full',
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleClienteClick = useCallback(
    (cliente: { cliente: string }) => {
      abrirDetalhe(
        mergeDrill(filtrosApi, {
          titulo: `Cliente atrasado: ${cliente.cliente}`,
          cliente: cliente.cliente,
          status: 'Atrasado',
          gradeLayout: 'full',
        })
      );
    },
    [abrirDetalhe, filtrosApi]
  );

  const handleAplicarFiltros = useCallback((f: FiltrosDashEntregasState) => {
    setFiltrosAplicados(f);
    setModalFiltrosAberto(false);
    setModal({ kind: 'none' });
  }, []);

  const resumo = analytics?.resumo ?? null;
  const totalValorBase = resumo?.totalValorPendenteReal ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <KpiPainelVoltarLink painelId="pedidos-em-aberto" className="mb-1" />
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Painel Pedidos em aberto — análise de saldo pendente
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalFiltrosAberto(true)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Filtros{qtdFiltros > 0 ? ` (${qtdFiltros})` : ''}
          </button>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
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
          onItemClick={(item) => handleConcentracao('grupo_produto', item, 'Grupo')}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Setor de produção"
          subtitulo="Saldo pendente total por setor"
          data={analytics?.concentracao?.porSetorProducao ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) => handleConcentracao('setor_producao', item, 'Setor')}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo1"
          subtitulo="Saldo pendente total por Subgrupo1"
          data={analytics?.concentracao?.porSubgrupo1 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) => handleConcentracao('subgrupo1', item, 'Subgrupo1')}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Subgrupo2"
          subtitulo="Saldo pendente total por Subgrupo2"
          data={analytics?.concentracao?.porSubgrupo2 ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) => handleConcentracao('subgrupo2', item, 'Subgrupo2')}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasConcentracaoCard
          titulo="Concentração por UF"
          subtitulo="Saldo pendente total por UF"
          data={analytics?.concentracao?.porUf ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) => handleConcentracao('uf', item, 'UF')}
        />
        <DashEntregasConcentracaoCard
          titulo="Concentração por Vendedor/Representante"
          subtitulo="Saldo pendente total por vendedor"
          data={analytics?.concentracao?.porVendedor ?? []}
          totalValorBase={totalValorBase}
          loading={loading}
          onItemClick={(item) => handleConcentracao('vendedor', item, 'Vendedor')}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashEntregasStatusChart
          resumo={resumo}
          loading={loading}
          onAtrasadoClick={handleStatusAtrasado}
          onEmDiaClick={handleStatusEmDia}
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

      <ModalFiltrosDashEntregas
        open={modalFiltrosAberto}
        filtros={filtrosAplicados}
        onClose={() => setModalFiltrosAberto(false)}
        onAplicar={handleAplicarFiltros}
      />

      <ModalDashEntregasDetalhe
        open={modal.kind === 'detalhe'}
        filtro={modal.kind === 'detalhe' ? modal.filtro : null}
        onClose={fecharModais}
      />

      <ModalDashEntregasAgingTipoF
        open={modal.kind === 'agingTipoF'}
        faixa={modal.kind === 'agingTipoF' ? modal.faixa : null}
        filtrosGlobais={filtrosApi}
        onClose={fecharModais}
        onTipoFClick={handleAgingTipoF}
      />

      <ModalDashEntregasLeadTimeTipoF
        open={modal.kind === 'leadTimeTipoF'}
        titulo="Lead time médio por TipoF"
        subtitulo="Dias até a previsão original"
        filtrosGlobais={filtrosApi}
        onClose={fecharModais}
        onTipoFClick={handleLeadTimeTipoF}
      />
    </div>
  );
}
