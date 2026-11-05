import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, Percent, Receipt, Wallet } from 'lucide-react';
import {
  obterPortaPalletsAuditoriaMensal,
  obterPortaPalletsDetalhe,
  obterPortaPalletsMensal,
  obterPortaPalletsOpcoes,
  type DetalhePortaPallets,
  type IndicadorPortaPallets,
  type MesPortaPallets,
  type OpcoesPortaPallets,
  type PortaPalletsMensal,
  type RecortePortaPallets,
} from '../../api/portaPalletsComercial';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { exportarAuditoriaMensalXlsx } from './exportAuditoriaMensalXlsx';
import ModalPortaPalletsDetalhe from './ModalPortaPalletsDetalhe';
import ModalPortaPalletsEvolucaoMes from './ModalPortaPalletsEvolucaoMes';
import PortaPalletsComercialAjudaModal, { ComoLerBtn } from './PortaPalletsComercialAjudaModal';
import PortaPalletsFunil from './PortaPalletsFunil';
import PortaPalletsEvolucaoBarras, {
  LARGURA_MES_FECHAMENTO,
  type MetricaEvolucao,
  type RotuloEvolucao,
} from './PortaPalletsEvolucaoBarras';
import PortaPalletsAnoAnoBarras, { LARGURA_MES_ANO_ANO } from './PortaPalletsAnoAnoBarras';
import AjudaPedidosCardFunil from './AjudaPedidosCardFunil';
import { formatData, formatDias, formatTaxa, labelMes } from './portaPalletsComercialFormat';
import FiltroArvoreFamilia from './FiltroArvoreFamilia';
import SeletorPeriodoDias from './SeletorPeriodoDias';

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

type FiltrosPainel = {
  empresas: string;
  vendedores: string;
  subgrupos: string;
  ufs: string;
  cidades: string;
  familias: string;
};

const FILTROS_INICIAIS: FiltrosPainel = {
  empresas: '1',
  vendedores: '',
  subgrupos: '',
  ufs: '',
  cidades: '',
  familias: '',
};

function filtrosQuery(f: FiltrosPainel): Pick<RecortePortaPallets, 'empresas' | 'vendedores' | 'subgrupos' | 'ufs' | 'cidades' | 'familias'> {
  return {
    empresas: f.empresas.trim() ? f.empresas : 'todas',
    vendedores: f.vendedores || undefined,
    subgrupos: f.subgrupos || undefined,
    ufs: f.ufs || undefined,
    cidades: f.cidades || undefined,
    familias: f.familias || undefined,
  };
}

function chaveFiltros(f: FiltrosPainel): string {
  const q = filtrosQuery(f);
  return [q.empresas, q.vendedores ?? '', q.subgrupos ?? '', q.ufs ?? '', q.cidades ?? '', q.familias ?? ''].join('§');
}

function soPresentes(valor: string, lista: string[], separador = '|'): string {
  const validos = new Set(lista);
  return valor
    .split(separador)
    .map((s) => s.trim())
    .filter((nome) => validos.has(nome))
    .join(separador);
}

function codigosFamilia(nos: OpcoesPortaPallets['familias']): Set<string> {
  const codigos = new Set<string>();
  const walk = (no: OpcoesPortaPallets['familias'][number]) => {
    codigos.add(no.classificacao);
    no.filhos.forEach(walk);
  };
  nos.forEach(walk);
  return codigos;
}

function encaixarFiltros(f: FiltrosPainel, data: OpcoesPortaPallets): FiltrosPainel {
  const empresas = soPresentes(
    f.empresas,
    data.empresas.map((e) => String(e.id)),
    ','
  );
  const vendedores = soPresentes(
    f.vendedores,
    data.vendedores.map((v) => v.nome)
  );
  const subgrupos = soPresentes(f.subgrupos, data.subgrupos);
  const ufs = soPresentes(
    f.ufs,
    data.ufs.map((u) => u.nome)
  );
  const cidades = soPresentes(
    f.cidades,
    data.cidades.map((c) => c.nome)
  );
  const familias =
    !f.familias.trim() || f.familias.trim() === 'nenhuma'
      ? f.familias
      : soPresentes(f.familias, [...codigosFamilia(data.familias)]);
  if (
    empresas === f.empresas &&
    vendedores === f.vendedores &&
    subgrupos === f.subgrupos &&
    ufs === f.ufs &&
    cidades === f.cidades &&
    familias === f.familias
  ) {
    return f;
  }
  return { ...f, empresas, vendedores, subgrupos, ufs, cidades, familias };
}
const DATA_MIN = '2018-01-01';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

type Tone = 'emerald' | 'violet' | 'amber' | 'cyan';
const TONE: Record<Tone, { card: string; icon: string }> = {
  emerald: {
    card: 'border-[#00A859]/30 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(0,168,89,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f3fbf7)] shadow-[0_12px_32px_rgba(0,168,89,0.08)] dark:border-[#00A859]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(0,168,89,0.34),transparent_58%),linear-gradient(180deg,#0c2418,#0c1214)] dark:shadow-[0_0_36px_rgba(0,168,89,0.16)]',
    icon: 'bg-[#00A859]/15 text-[#00A859] ring-[#00A859]/35 shadow-[0_0_16px_rgba(0,168,89,0.35)] dark:text-[#7ddea8]',
  },
  violet: {
    card: 'border-[#1E22AA]/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(30,34,170,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f4f5fb)] shadow-[0_12px_32px_rgba(30,34,170,0.08)] dark:border-[#2B36C1]/40 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(30,34,170,0.48),transparent_58%),linear-gradient(180deg,#101433,#0c1018)] dark:shadow-[0_0_36px_rgba(30,34,170,0.22)]',
    icon: 'bg-[#1E22AA]/12 text-[#1E22AA] ring-[#1E22AA]/30 shadow-[0_0_16px_rgba(30,34,170,0.28)] dark:text-[#C5C9EF]',
  },
  amber: {
    card: 'border-[#FFAD00]/40 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,173,0,0.22),transparent_55%),linear-gradient(180deg,#ffffff,#fffaf0)] shadow-[0_12px_32px_rgba(255,173,0,0.1)] dark:border-[#FFAD00]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(255,173,0,0.32),transparent_58%),linear-gradient(180deg,#2a220c,#120e0c)] dark:shadow-[0_0_36px_rgba(255,173,0,0.14)]',
    icon: 'bg-[#FFAD00]/15 text-[#C48400] ring-[#FFAD00]/40 shadow-[0_0_16px_rgba(255,173,0,0.35)] dark:text-[#FBB03B]',
  },
  cyan: {
    card: 'border-[#041E42]/20 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(4,30,66,0.12),transparent_55%),linear-gradient(180deg,#ffffff,#f3f6fa)] shadow-[0_12px_32px_rgba(4,30,66,0.08)] dark:border-[#041E42]/80 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(4,30,66,0.95),transparent_62%),linear-gradient(180deg,#0a2244,#0c1218)] dark:shadow-[0_0_36px_rgba(4,30,66,0.45)]',
    icon: 'bg-[#041E42]/10 text-[#041E42] ring-[#041E42]/25 shadow-[0_0_16px_rgba(4,30,66,0.2)] dark:text-[#C5C9EF]',
  },
};

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
type ModalAlvo = {
  mes?: string;
  desde?: string;
  ate?: string;
  indicador: IndicadorPortaPallets;
  titulo: string;
  subtitulo: string;
};

type ModalMesAlvo = { mes: MesPortaPallets; desde: string; ate: string; titulo: string };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hoje(): string {
  return iso(new Date());
}

/** Dia 1º do mês de n meses atrás (contando o atual). */
function inicioMesHa(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  const v = iso(d);
  return v < DATA_MIN ? DATA_MIN : v;
}

function recortePadrao(): { desde: string; ate: string } {
  return { desde: inicioMesHa(12), ate: hoje() };
}

export default function PortaPalletsComercialPage() {
  const padrao = recortePadrao();
  const [ajuda, setAjuda] = useState(false);
  const [draftDesde, setDraftDesde] = useState(padrao.desde);
  const [draftAte, setDraftAte] = useState(padrao.ate);
  const [desde, setDesde] = useState(padrao.desde);
  const [ate, setAte] = useState(padrao.ate);
  const [draftFiltros, setDraftFiltros] = useState<FiltrosPainel>(FILTROS_INICIAIS);
  const [filtros, setFiltros] = useState<FiltrosPainel>(FILTROS_INICIAIS);
  const [opcoes, setOpcoes] = useState<OpcoesPortaPallets | null>(null);
  const [dados, setDados] = useState<PortaPalletsMensal | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<MetricaEvolucao>('valor');
  const [rotulo, setRotulo] = useState<RotuloEvolucao>('pedido');
  const [visaoGrafico, setVisaoGrafico] = useState<'funil' | 'anoAno'>('funil');
  const graficoScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = graficoScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [dados, visaoGrafico]);
  const [modal, setModal] = useState<ModalAlvo | null>(null);
  const [detalhe, setDetalhe] = useState<DetalhePortaPallets | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<string, DetalhePortaPallets>());
  const detalheReqRef = useRef(0);

  const [exportandoAuditoria, setExportandoAuditoria] = useState(false);
  const [erroAuditoria, setErroAuditoria] = useState<string | null>(null);

  const carregar = useCallback(async (ini: string, fim: string, f: FiltrosPainel, refresh = false) => {
    setLoading(true);
    setErro(null);
    try {
      setDados(await obterPortaPalletsMensal({ desde: ini, ate: fim, refresh, ...filtrosQuery(f) }));
    } catch (e) {
      setDados(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(desde, ate, filtros, false);
  }, [carregar, desde, ate, filtros]);

  const contexto = chaveFiltros(filtros);
  useEffect(() => {
    let ativo = true;
    void obterPortaPalletsOpcoes({ desde, ate, ...filtrosQuery(filtros) })
      .then((data) => {
        if (!ativo) return;
        setOpcoes(data);
        setDraftFiltros((f) => encaixarFiltros(f, data));
        setFiltros((f) => encaixarFiltros(f, data));
      })
      .catch(() => {
        if (ativo) setOpcoes(null);
      });
    return () => {
      ativo = false;
    };
    // Recarrega as listas quando o período ou qualquer filtro aplicado muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, ate, contexto]);

  const cidadesVisiveis = useMemo(() => {
    const ufs = draftFiltros.ufs.split('|').map((s) => s.trim()).filter(Boolean);
    const lista = opcoes?.cidades ?? [];
    const filtradas = ufs.length ? lista.filter((c) => ufs.includes(c.uf)) : lista;
    const soma = new Map<string, number>();
    for (const c of filtradas) soma.set(c.nome, (soma.get(c.nome) ?? 0) + c.valor);
    return [...soma.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [draftFiltros.ufs, opcoes]);

  const filtrosParaAplicar = (f: FiltrosPainel): FiltrosPainel => {
    const ufs = f.ufs.split('|').map((s) => s.trim()).filter(Boolean);
    if (!ufs.length || !opcoes) return f;
    const validas = new Set(opcoes.cidades.filter((c) => ufs.includes(c.uf)).map((c) => c.nome));
    const cidades = f.cidades
      .split('|')
      .map((s) => s.trim())
      .filter((c) => validas.has(c))
      .join('|');
    return { ...f, cidades };
  };

  const empresasRotulo = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const e of opcoes?.empresas ?? []) mapa[String(e.id)] = e.nome;
    if (!mapa['1']) mapa['1'] = 'Só Aço';
    return mapa;
  }, [opcoes]);

  const aplicar = useCallback((ini: string, fim: string, f: FiltrosPainel) => {
    detalheCacheRef.current.clear();
    setDraftDesde(ini);
    setDraftAte(fim);
    setDraftFiltros(f);
    setDesde(ini);
    setAte(fim);
    setFiltros(f);
  }, []);

  const atualizar = useCallback(() => {
    detalheCacheRef.current.clear();
    void carregar(desde, ate, filtros, true);
    void obterPortaPalletsOpcoes({ desde, ate, refresh: true, ...filtrosQuery(filtros) })
      .then((data) => {
        setOpcoes(data);
        setDraftFiltros((f) => encaixarFiltros(f, data));
        setFiltros((f) => encaixarFiltros(f, data));
      })
      .catch(() => setOpcoes(null));
  }, [ate, carregar, desde, filtros]);

  const buscarDetalhe = useCallback(
    (indicador: IndicadorPortaPallets, recorte: { mes?: string; desde: string; ate: string }) => {
      const chave = `${chaveFiltros(filtros)}|${indicador}|${recorte.mes ?? ''}|${recorte.desde}|${recorte.ate}`;
      const cached = detalheCacheRef.current.get(chave);
      if (cached) return Promise.resolve(cached);
      return obterPortaPalletsDetalhe(indicador, { ...recorte, ...filtrosQuery(filtros) }).then((data) => {
        detalheCacheRef.current.set(chave, data);
        return data;
      });
    },
    [filtros]
  );

  const abrir = useCallback((alvo: ModalAlvo) => {
    setModal(alvo);
    setDetalheErro(null);
    const chave = `${chaveFiltros(filtros)}|${alvo.indicador}|${alvo.mes ?? ''}|${alvo.desde ?? desde}|${alvo.ate ?? ate}`;
    const cached = detalheCacheRef.current.get(chave);
    if (cached) {
      setDetalhe(cached);
      setDetalheLoading(false);
      return;
    }
    setDetalhe(null);
    setDetalheLoading(true);
    const req = ++detalheReqRef.current;
    void buscarDetalhe(alvo.indicador, {
      mes: alvo.mes,
      desde: alvo.desde ?? desde,
      ate: alvo.ate ?? ate,
    })
      .then((data) => {
        if (detalheReqRef.current !== req) return;
        setDetalhe(data);
      })
      .catch((e: unknown) => {
        if (detalheReqRef.current !== req) return;
        setDetalheErro(e instanceof Error ? e.message : 'Erro ao carregar o detalhe.');
      })
      .finally(() => {
        if (detalheReqRef.current === req) setDetalheLoading(false);
      });
  }, [ate, buscarDetalhe, desde, filtros]);

  const [modalMes, setModalMes] = useState<ModalMesAlvo | null>(null);
  const abrirMes = useCallback(
    (m: MesPortaPallets, recorte?: { desde: string; ate: string }, sufixo = '') => {
      setModalMes({
        mes: m,
        desde: recorte?.desde ?? desde,
        ate: recorte?.ate ?? ate,
        titulo: `Propostas x fechamento · ${labelMes(m.mes)}${sufixo}`,
      });
    },
    [ate, desde]
  );
  const buscarMes = useCallback(
    (indicador: IndicadorPortaPallets) =>
      modalMes
        ? buscarDetalhe(indicador, { mes: modalMes.mes.mes, desde: modalMes.desde, ate: modalMes.ate })
        : Promise.reject(new Error('Nenhum mês selecionado.')),
    [buscarDetalhe, modalMes]
  );
  const fecharMes = useCallback(() => setModalMes(null), []);

  const totais = dados?.totais;
  const mesesTabela = useMemo(() => [...(dados?.meses ?? [])].sort((a, b) => b.mes.localeCompare(a.mes)), [dados]);

  const exportarAuditoria = useCallback(async () => {
    setExportandoAuditoria(true);
    setErroAuditoria(null);
    try {
      await exportarAuditoriaMensalXlsx(await obterPortaPalletsAuditoriaMensal({ desde, ate, ...filtrosQuery(filtros) }));
    } catch (e) {
      setErroAuditoria(e instanceof Error ? e.message : 'Erro ao exportar a auditoria mensal.');
    } finally {
      setExportandoAuditoria(false);
    }
  }, [ate, desde, filtros]);

  const abrirPeriodo = (indicador: IndicadorPortaPallets, titulo: string, subtitulo: string) => {
    abrir({ indicador, desde, ate, titulo: `${titulo} · ${formatData(desde)} a ${formatData(ate)}`, subtitulo });
  };

  const k = totais;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col px-3 py-4 md:px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-72 dark:block">
        <div className="absolute left-[8%] top-0 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-[12%] top-8 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando indicadores de porta-pallets…" mode="viewport" />

      <div className="relative mx-auto w-full max-w-[1920px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <KpiPainelVoltarLink painelId="porta-pallets-comercial" />
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Indicadores de porta-pallets
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Venda da família 95 (Porta palete) e ramificações — não é faturamento. Clique no número para ver a origem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler os indicadores de porta-pallets" />
            <button type="button" className={btnSecondary} onClick={atualizar}>
              Atualizar
            </button>
          </div>
        </header>

        <div className={`space-y-3 px-4 py-3 ${panelSurface}`}>
          <div className="flex flex-wrap items-end gap-3">
            <SeletorPeriodoDias
              desde={draftDesde}
              ate={draftAte}
              min={DATA_MIN}
              max={hoje()}
              onChange={(ini, fim) => {
                setDraftDesde(ini);
                setDraftAte(fim);
              }}
            />
            <button type="button" className={btnSecondary} onClick={() => aplicar(inicioMesHa(12), hoje(), filtrosParaAplicar(draftFiltros))}>
              12 meses
            </button>
            <button type="button" className={btnSecondary} onClick={() => aplicar(DATA_MIN, hoje(), filtrosParaAplicar(draftFiltros))}>
              Desde 2018
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={loading || !draftDesde || !draftAte || draftAte < draftDesde}
              onClick={() => aplicar(draftDesde, draftAte, filtrosParaAplicar(draftFiltros))}
            >
              Filtrar
            </button>
          </div>
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <MultiSelectWithSearch
              label="Empresa"
              placeholder="Todas"
              options={(opcoes?.empresas ?? [{ id: 1, nome: 'Só Aço', valor: 0 }]).map((e) => String(e.id))}
              labelByValue={empresasRotulo}
              metricByValue={
                opcoes ? Object.fromEntries(opcoes.empresas.map((e) => [String(e.id), e.valor])) : undefined
              }
              formatMetric={(n) => formatMoeda(n)}
              value={draftFiltros.empresas}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, empresas: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="empresas"
              fillContainer
              minWidth="0"
              dropdownMinWidthPx={520}
              optionsLoading={!opcoes}
              dropdownPortal
              dropdownZIndex={220}
            />
            <MultiSelectWithSearch
              label="Vendedor / representante"
              placeholder="Todos"
              options={(opcoes?.vendedores ?? []).map((v) => v.nome)}
              metricByValue={Object.fromEntries((opcoes?.vendedores ?? []).map((v) => [v.nome, v.valor]))}
              formatMetric={(n) => formatMoeda(n)}
              value={draftFiltros.vendedores}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, vendedores: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="vendedores"
              valueSeparator="|"
              fillContainer
              minWidth="0"
              dropdownMinWidthPx={460}
              optionsLoading={!opcoes}
              dropdownPortal
              dropdownZIndex={220}
            />
            <MultiSelectWithSearch
              label="Subgrupo 1"
              placeholder="Todos"
              options={opcoes?.subgrupos ?? []}
              value={draftFiltros.subgrupos}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, subgrupos: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="subgrupos"
              valueSeparator="|"
              fillContainer
              minWidth="0"
              optionsLoading={!opcoes}
              dropdownPortal
              dropdownZIndex={220}
            />
            <MultiSelectWithSearch
              label="UF"
              placeholder="Todas"
              options={(opcoes?.ufs ?? []).map((u) => u.nome)}
              metricByValue={Object.fromEntries((opcoes?.ufs ?? []).map((u) => [u.nome, u.valor]))}
              formatMetric={(n) => formatMoeda(n)}
              value={draftFiltros.ufs}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, ufs: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="UFs"
              valueSeparator="|"
              fillContainer
              minWidth="0"
              dropdownMinWidthPx={320}
              optionsLoading={!opcoes}
              dropdownPortal
              dropdownZIndex={220}
            />
            <MultiSelectWithSearch
              label="Cidade"
              placeholder="Todas"
              options={cidadesVisiveis.map((c) => c.nome)}
              metricByValue={Object.fromEntries(cidadesVisiveis.map((c) => [c.nome, c.valor]))}
              formatMetric={(n) => formatMoeda(n)}
              value={draftFiltros.cidades}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, cidades: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              optionLabel="cidades"
              valueSeparator="|"
              fillContainer
              minWidth="0"
              dropdownMinWidthPx={420}
              optionsLoading={!opcoes}
              dropdownPortal
              dropdownZIndex={220}
            />
            <FiltroArvoreFamilia
              nos={opcoes?.familias ?? []}
              value={draftFiltros.familias}
              onChange={(v) => setDraftFiltros((f) => ({ ...f, familias: v }))}
              labelClass={FILTRO_LABEL_CLASS}
              inputClass={FILTRO_INPUT_CLASS}
              carregando={!opcoes}
            />
          </div>
          {(chaveFiltros(draftFiltros) !== chaveFiltros(filtros) || draftDesde !== desde || draftAte !== ate) && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar.
            </p>
          )}
        </div>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {erro}
          </p>
        )}

        {k && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                tone="emerald"
                titulo="Valor vendido"
                valor={formatMoeda(k.valorVendido, true)}
                detalhe={`${formatNumero(k.qtdPedidos)} pedidos emitidos no recorte`}
                icone={<Wallet className="h-4 w-4" strokeWidth={2.2} />}                ajuda={dados?.funil ? <AjudaPedidosCardFunil conciliacao={dados.funil.conciliacao} /> : undefined}
                onClick={() => abrirPeriodo('pedidos', 'Valor vendido', formatMoeda(k.valorVendido))}
              />
              <KpiCard
                tone="violet"
                titulo="Ticket médio"
                valor={k.ticketMedio == null ? '—' : formatMoeda(k.ticketMedio)}
                icone={<Receipt className="h-4 w-4" strokeWidth={2.2} />}                onClick={() =>
                  abrirPeriodo('pedidos', 'Ticket médio', k.ticketMedio == null ? '—' : formatMoeda(k.ticketMedio))
                }
              />
              <KpiCard
                tone="cyan"
                titulo="Conversão"
                valor={formatTaxa(k.taxaConversao)}
                icone={<Percent className="h-4 w-4" strokeWidth={2.2} />}                onClick={() => abrirPeriodo('conversao', 'Conversão', formatTaxa(k.taxaConversao))}
              />
            </div>

            {dados?.funil ? (
              <div className={`p-4 ${panelSurface}`}>
                <PortaPalletsFunil funil={dados.funil} onAbrir={abrirPeriodo} />
              </div>
            ) : null}

            <div className={`flex flex-col p-4 ${panelSurface}`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[16rem] flex-1">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {visaoGrafico === 'anoAno' ? 'Evolução mensal — YoY (ano x ano)' : 'Evolução mensal — propostas x fechamento'}
                  </h2>
                  {visaoGrafico === 'anoAno' ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 whitespace-nowrap text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-3.5 rounded-sm bg-slate-400/30" />
                        Proposto
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2 rounded-sm bg-[#94A3B8]" />
                        Virou pedido · ano anterior
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#7FB0EE]">
                        <span className="h-2.5 w-2 rounded-sm bg-[#5C92D6] shadow-[0_0_8px_#5C92D6]" />
                        Virou pedido · período atual
                      </span>
                      <span>
                        <span className="text-emerald-400">▲</span> melhora · <span className="text-rose-400">▼</span> piora
                      </span>
                    </div>
                  ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setRotulo('proposto')}
                      aria-pressed={rotulo === 'proposto'}
                      title="Mostrar no rótulo o valor proposto"
                      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition ${
                        rotulo === 'proposto'
                          ? 'bg-white/10 font-semibold text-slate-100 ring-1 ring-slate-400/40'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className="h-2.5 w-3.5 rounded-sm bg-slate-400/40" />
                      Proposto
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotulo('pedido')}
                      aria-pressed={rotulo === 'pedido'}
                      title="Mostrar no rótulo o valor que virou pedido"
                      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition ${
                        rotulo === 'pedido'
                          ? 'bg-[#5C92D6]/15 font-semibold text-[#7FB0EE] ring-1 ring-[#5C92D6]/40'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className="h-2.5 w-2 rounded-sm bg-[#5C92D6] shadow-[0_0_8px_#5C92D6]" />
                      Virou pedido
                    </button>
                  </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[11px]">
                  <MiniToggle
                    opcoes={[
                      { id: 'funil', label: 'Fechamento' },
                      { id: 'anoAno', label: 'YoY' },
                    ]}
                    ativo={visaoGrafico}
                    onChange={setVisaoGrafico}
                  />
                  <span className="h-3 w-px bg-slate-300 dark:bg-white/10" />
                  <MiniToggle
                    opcoes={[
                      { id: 'valor', label: 'R$' },
                      { id: 'qtde', label: 'Qtd' },
                    ]}
                    ativo={metrica}
                    onChange={setMetrica}
                  />
                </div>
              </div>
              <div ref={graficoScrollRef} className="w-full overflow-x-auto overflow-y-hidden pb-1">
                <div
                  className="h-80"
                  style={{
                    minWidth:
                      (dados?.meses.length ?? 0) *
                      (visaoGrafico === 'anoAno' ? LARGURA_MES_ANO_ANO : LARGURA_MES_FECHAMENTO),
                  }}
                >
                {visaoGrafico === 'anoAno' ? (
                  <PortaPalletsAnoAnoBarras
                    meses={dados?.meses ?? []}
                    mesesAnoAnterior={dados?.anoAnterior?.meses ?? null}
                    metrica={metrica}
                    onBarra={(m, anterior) => {
                      const ant = dados?.anoAnterior;
                      if (anterior && ant) abrirMes(m, { desde: ant.desde, ate: ant.ate }, ' (ano anterior)');
                      else abrirMes(m);
                    }}
                  />
                ) : (
                  <PortaPalletsEvolucaoBarras
                    meses={dados?.meses ?? []}
                    metrica={metrica}
                    rotulo={rotulo}
                    onMes={(m) => abrirMes(m)}
                  />
                )}
                </div>
              </div>
            </div>

            <div className={`overflow-hidden ${panelSurface}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Auditoria mensal</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-500">Clique em qualquer número para auditar a origem.</p>
                  <button
                    type="button"
                    disabled={exportandoAuditoria || mesesTabela.length === 0}
                    onClick={() => void exportarAuditoria()}
                    title="Uma linha por proposta, pedido gerado e cliente de cada mês do período filtrado"
                    className={btnSecondary}
                  >
                    <Download className="h-4 w-4" />
                    {exportandoAuditoria ? 'Exportando…' : 'Exportar Excel'}
                  </button>
                </div>
              </div>
              {erroAuditoria && (
                <p className="px-4 pb-2 text-xs text-rose-700 dark:text-rose-300">{erroAuditoria}</p>
              )}
              <div className="max-h-[30rem] overflow-auto border-t border-slate-200 dark:border-white/[0.06]">
                <TabelaMensal meses={mesesTabela} totais={k} onAbrir={abrir} />
              </div>
            </div>
          </div>
        )}

      </div>

      <ModalPortaPalletsDetalhe
        aberto={modal != null}
        titulo={modal?.titulo ?? ''}
        subtitulo={modal?.subtitulo ?? ''}
        loading={detalheLoading}
        erro={detalheErro}
        detalhe={detalhe}
        onClose={() => setModal(null)}
      />
      {modalMes ? (
        <ModalPortaPalletsEvolucaoMes
          key={`${modalMes.mes.mes}|${modalMes.desde}|${modalMes.ate}`}
          mes={modalMes.mes}
          titulo={modalMes.titulo}
          abaInicial={rotulo === 'proposto' ? 'propostas' : 'pedidos'}
          buscar={buscarMes}
          onClose={fecharMes}
        />
      ) : null}
      <PortaPalletsComercialAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />
    </div>
  );
}

function KpiCard({
  tone,
  titulo,
  valor,
  detalhe,
  icone,
  ajuda,
  onClick,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  ajuda?: ReactNode;
  onClick?: () => void;
}) {
  const tom = TONE[tone];
  return (
    <article
      title={onClick ? 'Clique para ver a origem' : undefined}
      className={`relative rounded-2xl border px-4 py-3 text-left ${tom.card} ${
        onClick
          ? 'cursor-pointer transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
          : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-1 text-xl font-semibold leading-tight tracking-tight tabular-nums text-slate-900 dark:text-white">
            {valor}
          </p>
          {detalhe ? <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{detalhe}</p> : null}        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ajuda}
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${tom.icon}`}>{icone}</span>
        </div>
      </div>
    </article>
  );
}

function MiniToggle<T extends string>({
  opcoes,
  ativo,
  onChange,
}: {
  opcoes: Array<{ id: T; label: string }>;
  ativo: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={ativo === o.id}
          className={`rounded-full px-2 py-0.5 font-medium transition ${
            ativo === o.id
              ? 'bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TabelaMensal({
  meses,
  totais,
  onAbrir,
}: {
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  onAbrir: (alvo: ModalAlvo) => void;
}) {
  const grupos: Array<{ titulo: string; colunas: number; cor: string }> = [
    { titulo: 'Propostas', colunas: 2, cor: 'border-slate-400/60 text-slate-300' },
    { titulo: 'Pedidos gerados', colunas: 3, cor: 'border-[#5C92D6] text-[#7FB0EE]' },
    { titulo: 'Clientes', colunas: 2, cor: 'border-emerald-400/70 text-emerald-300' },
    { titulo: 'Conversão', colunas: 2, cor: 'border-amber-400/70 text-amber-300' },
  ];
  const sub = 'px-3 pb-2 pt-1 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400';
  const inicioGrupo = 'border-l border-slate-200 dark:border-white/[0.06]';

  return (
    <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-[#12141c]/95">
        <tr>
          <th rowSpan={2} className="sticky left-0 z-20 bg-white/95 px-4 py-2 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-[#12141c]/95 dark:text-slate-400">
            Mês
          </th>
          {grupos.map((g) => (
            <th
              key={g.titulo}
              colSpan={g.colunas}
              className={`${inicioGrupo} px-3 pt-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em]`}
            >
              <span className={`inline-block border-b-2 pb-1 ${g.cor}`}>{g.titulo}</span>
            </th>
          ))}
        </tr>
        <tr className="shadow-[0_1px_0_rgba(148,163,184,0.18)]">
          <th className={`${sub} ${inicioGrupo}`}>Qtd.</th>
          <th className={sub}>Valor</th>
          <th className={`${sub} ${inicioGrupo}`}>Qtd.</th>
          <th className={sub}>Valor vendido</th>
          <th className={sub}>Ticket médio</th>
          <th className={`${sub} ${inicioGrupo}`}>Com pedido</th>
          <th className={sub}>1ª compra</th>
          <th className={`${sub} ${inicioGrupo}`}>Taxa</th>
          <th className={sub}>Tempo médio</th>
        </tr>
      </thead>
      <tbody>
        {meses.map((mes) => {
          const vazio = mes.qtdPropostas === 0 && mes.qtdPedidosGerados === 0;
          const [nomeMes, ano] = labelMes(mes.mes).split('/');
          return (
            <tr
              key={mes.mes}
              className={`group transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] ${vazio ? 'opacity-40' : ''}`}
            >
              <th className="sticky left-0 border-b border-slate-100 bg-white px-4 py-2 text-left font-normal group-hover:bg-slate-50 dark:border-white/[0.04] dark:bg-[#141724] dark:group-hover:bg-[#191c29]">
                <span className="font-semibold capitalize text-slate-900 dark:text-white">{nomeMes}</span>
                <span className="text-slate-400">/{ano}</span>
              </th>
              <Num mes={mes} indicador="propostas" texto={formatNumero(mes.qtdPropostas)} onAbrir={onAbrir} inicio />
              <Num
                mes={mes}
                indicador="propostas"
                texto={formatMoeda(mes.valorPropostas)}
                onAbrir={onAbrir}
                tom="suave"
                clicavel={false}
              />
              <Num mes={mes} indicador="pedidos_gerados" texto={formatNumero(mes.qtdPedidosGerados)} onAbrir={onAbrir} inicio />
              <Num
                mes={mes}
                indicador="pedidos_gerados"
                texto={formatMoeda(mes.valorPedidosGerados)}
                onAbrir={onAbrir}
                tom="destaque"
                clicavel={false}
              />
              <Num
                mes={mes}
                indicador="pedidos_gerados"
                texto={ticketGerado(mes.valorPedidosGerados, mes.qtdPedidosGerados)}
                onAbrir={onAbrir}
                tom="suave"
                clicavel={false}
              />
              <Num mes={mes} indicador="clientes" texto={formatNumero(mes.qtdClientes)} onAbrir={onAbrir} inicio />
              <Num mes={mes} indicador="primeira" texto={formatNumero(mes.qtdPrimeiraCompra)} onAbrir={onAbrir} />
              <Num mes={mes} indicador="conversao" texto={formatTaxa(mes.taxaConversao)} onAbrir={onAbrir} inicio barra={mes.taxaConversao} />
              <Num mes={mes} indicador="tempo" texto={formatDias(mes.tempoMedioDias)} onAbrir={onAbrir} tom="suave" />
            </tr>
          );
        })}
      </tbody>
      <tfoot className="sticky bottom-0 z-10">
        <tr className="bg-slate-100 font-semibold text-slate-900 dark:bg-[#1a1e2e] dark:text-white">
          <th className="sticky left-0 border-t border-slate-300 bg-slate-100 px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.14em] dark:border-white/10 dark:bg-[#1a1e2e]">
            Total do recorte
          </th>
          <TotalCel valor={formatNumero(totais.qtdPropostas)} inicio />
          <TotalCel valor={formatMoeda(totais.valorPropostas)} />
          <TotalCel valor={formatNumero(totais.qtdPedidosGerados)} inicio />
          <TotalCel valor={formatMoeda(totais.valorPedidosGerados)} destaque />
          <TotalCel valor={ticketGerado(totais.valorPedidosGerados, totais.qtdPedidosGerados)} />
          <TotalCel valor={formatNumero(totais.qtdClientes)} inicio />
          <TotalCel valor={formatNumero(totais.qtdPrimeiraCompra)} />
          <TotalCel valor={formatTaxa(totais.taxaConversao)} inicio />
          <TotalCel valor={formatDias(totais.tempoMedioDias)} />
        </tr>
      </tfoot>
    </table>
  );
}

function ticketGerado(valor: number, qtd: number): string {
  return qtd > 0 ? formatMoeda(valor / qtd) : '—';
}

function TotalCel({ valor, inicio, destaque }: { valor: string; inicio?: boolean; destaque?: boolean }) {
  return (
    <td
      className={`border-t border-slate-300 px-3 py-2.5 text-right tabular-nums dark:border-white/10 ${
        inicio ? 'border-l border-l-slate-200 dark:border-l-white/[0.06]' : ''
      } ${destaque ? 'text-[#7FB0EE]' : ''}`}
    >
      {valor}
    </td>
  );
}

function Num({
  mes,
  indicador,
  texto,
  onAbrir,
  inicio,
  tom = 'normal',
  barra,
  clicavel = true,
}: {
  mes: MesPortaPallets;
  indicador: IndicadorPortaPallets;
  texto: string;
  onAbrir: (alvo: ModalAlvo) => void;
  clicavel?: boolean;
  /** Primeira coluna de um grupo: ganha a divisória à esquerda. */
  inicio?: boolean;
  tom?: 'normal' | 'suave' | 'destaque';
  /** Taxa de 0 a 1 para a barrinha de progresso abaixo do valor. */
  barra?: number | null;
}) {
  const titulos: Record<IndicadorPortaPallets, string> = {
    propostas: 'Propostas',
    pedidos: 'Pedidos',
    clientes: 'Clientes',
    primeira: 'Primeira compra',
    conversao: 'Conversão',
    tempo: 'Tempo médio',
    pedidos_gerados: 'Pedidos gerados',
    clientes_com_pedido: 'Leads que fecharam negócio',
    clientes_total: 'Leads ao todo',
    clientes_novos: 'Leads novos',
    novos_com_pedido: 'Leads novos que fecharam',
  };
  const vazio = texto === '—' || texto === '0' || texto === 'R$ 0,00';
  const cor = vazio
    ? 'text-slate-400 dark:text-slate-600'
    : tom === 'destaque'
      ? 'font-semibold text-slate-900 dark:text-[#9CC3F5]'
      : tom === 'suave'
        ? 'text-slate-500 dark:text-slate-400'
        : 'text-slate-800 dark:text-slate-100';
  return (
    <td
      className={`border-b border-slate-100 px-1.5 py-1 text-right dark:border-white/[0.04] ${
        inicio ? 'border-l border-l-slate-200 dark:border-l-white/[0.06]' : ''
      }`}
    >
      {!clicavel ? (
        <span className={`block w-full px-2 py-1 text-right tabular-nums ${cor}`}>{texto}</span>
      ) : (
      <button
        type="button"
        title="Clique para auditar a origem"
        className={`w-full rounded-md px-2 py-1 text-right tabular-nums transition hover:bg-[#5C92D6]/10 hover:text-[#5C92D6] dark:hover:text-[#9CC3F5] ${cor}`}
        onClick={() =>
          onAbrir({
            mes: mes.mes,
            indicador,
            titulo: `${titulos[indicador]} · ${labelMes(mes.mes)}`,
            subtitulo: texto,
          })
        }
      >
        {texto}
        {barra != null && !vazio ? (
          <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.07]">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
              style={{ width: `${Math.max(4, Math.min(100, barra * 100))}%` }}
            />
          </span>
        ) : null}
      </button>
      )}
    </td>
  );
}
