import { useCallback, useEffect, useMemo, useState } from 'react';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import {
  obterRfvClientesAnalytics,
  type FiltrosRfvClientes,
  type RfvClientesAnalytics,
} from '../../api/rfvClientes';
import RfvKpiCards from '../../components/painel-comercial/RfvKpiCards';
import RfvDistribuicaoChart from '../../components/painel-comercial/RfvDistribuicaoChart';
import RfvTreemapMatrix from '../../components/painel-comercial/RfvTreemapMatrix';
import RfvSegmentosTable from '../../components/painel-comercial/RfvSegmentosTable';
import RfvClientesTable from '../../components/painel-comercial/RfvClientesTable';
import {
  filtrarClientesPorSelecao,
  toggleSelecao,
  type RfvSelecao,
} from '../../components/painel-comercial/rfvSelecao';
import {
  formatMoeda,
  formatNumero,
  formatYmdBr,
  mesesEntreYmd,
  PAINEL_COMERCIAL_MAX_MESES,
  periodoDisponivelPadraoYmd,
} from '../../components/painel-comercial/painelComercialUtils';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import RfvClientesAjudaModal, { ComoLerBtn } from './RfvClientesAjudaModal';

const MAX_MESES = PAINEL_COMERCIAL_MAX_MESES;

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function filtroDefault(): FiltrosRfvClientes {
  return periodoDisponivelPadraoYmd();
}

function csvOrUndef(v: string): string | undefined {
  const s = v.trim();
  return s ? s : undefined;
}

export default function RfvClientesPage() {
  const [filtros, setFiltros] = useState<FiltrosRfvClientes>(() => filtroDefault());
  const [draft, setDraft] = useState<FiltrosRfvClientes>(() => filtroDefault());
  const [analytics, setAnalytics] = useState<RfvClientesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<RfvSelecao>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);

  const carregar = useCallback(async (f: FiltrosRfvClientes) => {
    setLoading(true);
    setErro(null);
    try {
      const data = await obterRfvClientesAnalytics(f);
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
    setSelecao(null);
    setFiltros({ ...draft });
  }, [draft, periodoDraftErro]);

  const atualizar = useCallback(() => {
    if (periodoDraftErro) {
      setErro(periodoDraftErro);
      return;
    }
    setSelecao(null);
    setFiltros({ ...draft });
  }, [draft, periodoDraftErro]);

  const opcoes = analytics?.opcoes ?? {
    municipios: [],
    ufs: [],
    vendedores: [],
    regioes: [],
    gruposProduto: [],
  };

  const headerResumo = useMemo(() => {
    const r = analytics?.resumo;
    const f = analytics?.filtros;
    const pd = analytics?.periodoDados;
    if (!r || !f?.dataIni || !f?.dataFim) return 'Sem dados.';
    let txt = `Período ${formatYmdBr(f.dataIni)} a ${formatYmdBr(f.dataFim)} · ${formatMoeda(r.faturamentoPeriodo)} · ${formatNumero(r.totalClientes)} clientes`;
    if (pd && (pd.dataIni !== f.dataIni || pd.dataFim !== f.dataFim)) {
      txt += ` · emissões de ${formatYmdBr(pd.dataIni)} a ${formatYmdBr(pd.dataFim)}`;
    }
    return txt;
  }, [analytics]);

  const clientesFiltrados = useMemo(() => {
    const base = analytics?.clientes ?? [];
    return filtrarClientesPorSelecao(base, selecao);
  }, [analytics?.clientes, selecao]);

  const handleSelectSegmento = useCallback((segmentoId: string) => {
    setSelecao((atual) => toggleSelecao(atual, { tipo: 'segmento', segmentoId }));
  }, []);

  const handleSelectScore = useCallback((dim: 'r' | 'f' | 'v', score: number) => {
    setSelecao((atual) => toggleSelecao(atual, { tipo: 'score', dim, score }));
  }, []);

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <KpiPainelVoltarLink painelId="classificacao-rfv" className="mb-1" />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Classificação de Clientes — RFV
            </h1>
            <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler este painel" />
          </div>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Vendas Só Aço (abertas e encerradas; sem canceladas). {headerResumo}</p>
          {filtrosPendentes && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar.
            </p>
          )}
          {periodoDraftErro && (
            <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">{periodoDraftErro}</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className={FILTRO_LABEL_CLASS}>
              Início
              <input
                value={draft.dataIni}
                onChange={(e) => setDraft((d) => ({ ...d, dataIni: e.target.value }))}
                type="date"
                className={FILTRO_INPUT_CLASS}
              />
            </label>
            <label className={FILTRO_LABEL_CLASS}>
              Fim
              <input
                value={draft.dataFim}
                onChange={(e) => setDraft((d) => ({ ...d, dataFim: e.target.value }))}
                type="date"
                className={FILTRO_INPUT_CLASS}
              />
            </label>
          </div>
          <MultiSelectWithSearch
            label="Município"
            placeholder="Todos"
            options={opcoes.municipios}
            value={draft.municipio ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, municipio: csvOrUndef(v) }))}
            labelClass={FILTRO_LABEL_CLASS}
            inputClass={FILTRO_INPUT_CLASS}
            optionLabel="municípios"
            minWidth="140px"
            optionsLoading={loading && !analytics}
          />
          <MultiSelectWithSearch
            label="UF"
            placeholder="Todas"
            options={opcoes.ufs}
            value={draft.uf ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, uf: csvOrUndef(v) }))}
            labelClass={FILTRO_LABEL_CLASS}
            inputClass={FILTRO_INPUT_CLASS}
            optionLabel="UFs"
            minWidth="100px"
            optionsLoading={loading && !analytics}
          />
          <MultiSelectWithSearch
            label="Vendedor"
            placeholder="Todos"
            options={opcoes.vendedores}
            value={draft.vendedor ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, vendedor: csvOrUndef(v) }))}
            labelClass={FILTRO_LABEL_CLASS}
            inputClass={FILTRO_INPUT_CLASS}
            optionLabel="vendedores"
            minWidth="140px"
            optionsLoading={loading && !analytics}
          />
          <MultiSelectWithSearch
            label="Região"
            placeholder="Todas"
            options={opcoes.regioes}
            value={draft.regiao ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, regiao: csvOrUndef(v) }))}
            labelClass={FILTRO_LABEL_CLASS}
            inputClass={FILTRO_INPUT_CLASS}
            optionLabel="regiões"
            minWidth="120px"
            optionsLoading={loading && !analytics}
          />
          <MultiSelectWithSearch
            label="Grupo"
            placeholder="Todos"
            options={opcoes.gruposProduto}
            value={draft.grupoProduto ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, grupoProduto: csvOrUndef(v) }))}
            labelClass={FILTRO_LABEL_CLASS}
            inputClass={FILTRO_INPUT_CLASS}
            optionLabel="grupos"
            minWidth="120px"
            optionsLoading={loading && !analytics}
          />
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
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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

      <div className="flex flex-col gap-3 xl:flex-row">
        <RfvKpiCards resumo={analytics?.resumo ?? null} loading={loading} />
        <RfvDistribuicaoChart
          distribuicao={analytics?.distribuicao ?? null}
          selecao={selecao}
          loading={loading}
          onSelectScore={handleSelectScore}
        />
      </div>

      <div className="mt-3 grid min-h-[520px] items-stretch gap-3 xl:min-h-[580px] xl:grid-cols-12">
        <div className="flex min-h-[480px] xl:col-span-5">
          <RfvTreemapMatrix
            segmentos={analytics?.segmentos ?? []}
            selecao={selecao}
            loading={loading}
            onSelectSegmento={handleSelectSegmento}
          />
        </div>
        <div className="flex min-w-0 xl:col-span-7">
          <RfvSegmentosTable
            segmentos={analytics?.segmentos ?? []}
            selecao={selecao}
            loading={loading}
            onSelectSegmento={handleSelectSegmento}
          />
        </div>
      </div>

      <div className="mt-3">
        <RfvClientesTable
          clientes={clientesFiltrados}
          selecao={selecao}
          loading={loading}
          onLimparSelecao={() => setSelecao(null)}
        />
      </div>

      <RfvClientesAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
    </div>
  );
}
