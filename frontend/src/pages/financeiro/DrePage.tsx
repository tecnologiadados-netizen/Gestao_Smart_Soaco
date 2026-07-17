import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutFoco } from '../../contexts/LayoutFocoContext';
import ArvoreContasDre from './dre/ArvoreContasDre';
import DreMkpModal from './dre/DreMkpModal';
import DreAjudaModal from './dre/DreAjudaModal';
import DreRateioEmpresasModal from './dre/DreRateioEmpresasModal';
import DreRelacaoPcModal from './dre/DreRelacaoPcModal';
import DfcCarregandoModal from './dfc/DfcCarregandoModal';
import { DFC_EMPRESA_OPCOES, DFC_EMPRESAS_TODAS, DFC_ID_EMPRESA_ACO, DFC_ID_EMPRESA_MOVEIS, DFC_ID_EMPRESA_REFRIGERACAO, DFC_ID_EMPRESA_RN_MARQUES } from './dfc/dfcEmpresas';
import { listarOpcoesPlanoContasDre } from './dre/drePlanoContasOpcoes';
import { listarPeriodosDfc } from './dfc/dfcPeriodos';
import {
  carregarRateioConfig,
  configRateioRicaParaMigrar,
  parseRateioConfigFromApi,
  regrasFornecedor,
  salvarRateioConfig,
  type DreRateioConfig,
} from './dre/dreRateioEmpresas';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import {
  fetchDreReceitaIndiretaProdutos,
  fetchDreReceitaMoveisDireto,
  fetchDreReceitaRefrigeracaoShop9,
  fetchDreReceitaVendasProdutos,
  fetchDreCpvSoAco,
  fetchDreCpvMoveisDireto,
  fetchDreDevolucoes,
  fetchDreSaidasSoAco,
  fetchDreRateioFornecedorTotais,
  fetchDreRateioConfig,
  salvarDreRateioConfigApi,
  type DreCpvMoveisDiretoLinha,
  type DreCpvSoAcoLinhaApi,
  type DreDevolucoesLinha,
  type DreReceitaIndiretaBrutoLinha,
  type DreReceitaIndiretaLiquidoLinha,
  type DreReceitaMoveisDiretoLinha,
  type DreReceitaVendasProdutoLinha,
  type DreSaidasSoAcoLinhaApi,
} from '../../api/financeiro';
const OPCOES_PLANO_CONTAS = listarOpcoesPlanoContasDre();
const OPCOES_EMPRESA_IDS = DFC_EMPRESA_OPCOES.map((o) => String(o.id));
const LABEL_EMPRESA: Record<string, string> = Object.fromEntries(
  DFC_EMPRESA_OPCOES.map((o) => [String(o.id), o.label]),
);
const OPCOES_PLANO_IDS = OPCOES_PLANO_CONTAS.map((o) => o.id);
const LABEL_PLANO: Record<string, string> = Object.fromEntries(
  OPCOES_PLANO_CONTAS.map((o) => [o.id, o.label]),
);

const FILTRO_INPUT_CLASS =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const FILTRO_LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function parseMultiCsv(value: string): string[] {
  if (!value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function hojeLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inicioAnoLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function diffDaysInclusiveYmd(a: string, b: string): number | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const da = parse(a);
  const db = parse(b);
  if (!da || !db || db < da) return null;
  return Math.floor((db.getTime() - da.getTime()) / 86400000) + 1;
}

export default function DrePage() {
  const dreShellRef = useRef<HTMLDivElement>(null);
  const { modoFoco, alternarModoFoco, sairModoFoco } = useLayoutFoco();

  useEffect(() => () => sairModoFoco(), [sairModoFoco]);

  const [dataInicio, setDataInicio] = useState(inicioAnoLocalYmd);
  const [dataFim, setDataFim] = useState(hojeLocalYmd);
  const [granularidade, setGranularidade] = useState<'dia' | 'mes'>('mes');
  const [periodos, setPeriodos] = useState<string[]>(() => listarPeriodosDfc(inicioAnoLocalYmd(), hojeLocalYmd(), 'mes'));
  const [aplicadoGranularidade, setAplicadoGranularidade] = useState<'dia' | 'mes'>('mes');
  const [saidasLinhas, setSaidasLinhas] = useState<DreSaidasSoAcoLinhaApi[]>([]);
  /** Saídas Ref+RN integrais — total do Simples (4.14) para rateio quando filtro recorta uma empresa. */
  const [saidasLinhasRateioBase, setSaidasLinhasRateioBase] = useState<DreSaidasSoAcoLinhaApi[]>([]);
  /** Saídas de todas as empresas — pool do rateio por plano de contas (Pró-labore). */
  const [saidasLinhasRateioPlanoContasBase, setSaidasLinhasRateioPlanoContasBase] = useState<
    DreSaidasSoAcoLinhaApi[]
  >([]);
  /** Simples direto filial 6 (RN Marques) por período — somado ao rateio RN na linha 4.14. */
  const [simplesNacionalFilial6PorPeriodo, setSimplesNacionalFilial6PorPeriodo] = useState<
    Record<string, number>
  >({});
  const [erroSaidas, setErroSaidas] = useState<string | null>(null);
  const [receitaVendasLinhas, setReceitaVendasLinhas] = useState<DreReceitaVendasProdutoLinha[]>([]);
  const [receitaMoveisDiretoLinhas, setReceitaMoveisDiretoLinhas] = useState<DreReceitaMoveisDiretoLinha[]>([]);
  const [receitaIndiretaBruto, setReceitaIndiretaBruto] = useState<DreReceitaIndiretaBrutoLinha[]>([]);
  const [receitaIndiretaLiquido, setReceitaIndiretaLiquido] = useState<DreReceitaIndiretaLiquidoLinha[]>([]);
  const [erroReceitaVendas, setErroReceitaVendas] = useState<string | null>(null);
  const [erroReceitaMoveisDireto, setErroReceitaMoveisDireto] = useState<string | null>(null);
  const [erroReceitaIndireta, setErroReceitaIndireta] = useState<string | null>(null);
  const [receitaRefrigeracaoLinhas, setReceitaRefrigeracaoLinhas] = useState<
    { pathKey: string; periodo: string; valor: number }[]
  >([]);
  /** Bases 1.5 + 1.6.2 sempre completas — percentual do Simples independe do filtro de empresa. */
  const [receitaRefrigeracaoLinhasRateioBase, setReceitaRefrigeracaoLinhasRateioBase] = useState<
    { pathKey: string; periodo: string; valor: number }[]
  >([]);
  const [erroReceitaRefrigeracao, setErroReceitaRefrigeracao] = useState<string | null>(null);
  const [cpvSoAcoDiretoLinhas, setCpvSoAcoDiretoLinhas] = useState<DreCpvSoAcoLinhaApi[]>([]);
  const [cpvSoAcoIndiretoLinhas, setCpvSoAcoIndiretoLinhas] = useState<DreCpvSoAcoLinhaApi[]>([]);
  const [cpvIndiretoSemMkpLinhas, setCpvIndiretoSemMkpLinhas] = useState<DreCpvSoAcoLinhaApi[]>([]);
  const [cpvMoveisDiretoLinhas, setCpvMoveisDiretoLinhas] = useState<DreCpvMoveisDiretoLinha[]>([]);
  const [devolucoesLinhas, setDevolucoesLinhas] = useState<DreDevolucoesLinha[]>([]);
  const [erroCpvSoAco, setErroCpvSoAco] = useState<string | null>(null);
  const [erroCpvMoveisDireto, setErroCpvMoveisDireto] = useState<string | null>(null);
  const [erroDevolucoes, setErroDevolucoes] = useState<string | null>(null);
  const [receitaCarregada, setReceitaCarregada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtrosEmpresaCsv, setFiltrosEmpresaCsv] = useState('');
  const [filtrosPlanoCsv, setFiltrosPlanoCsv] = useState('');
  const [filtroPlanoTexto, setFiltroPlanoTexto] = useState('');
  const [faixaFiltrosVisivel, setFaixaFiltrosVisivel] = useState(true);

  useEffect(() => {
    if (modoFoco) setFaixaFiltrosVisivel(false);
  }, [modoFoco]);

  const [mkpAtivo, setMkpAtivo] = useState(false);
  const [modalMkpAberto, setModalMkpAberto] = useState(false);
  const [modalAjudaAberto, setModalAjudaAberto] = useState(false);
  const [rateioConfig, setRateioConfig] = useState<DreRateioConfig>(() => carregarRateioConfig());
  const [rateioFornecedorTotaisPorRegraId, setRateioFornecedorTotaisPorRegraId] = useState<
    Record<string, Record<string, number>>
  >({});
  const [rateioFornecedorTotaisFiltroPorRegraId, setRateioFornecedorTotaisFiltroPorRegraId] =
    useState<Record<string, Record<string, number>>>({});
  const [modalRateioAberto, setModalRateioAberto] = useState(false);
  const [modalRelacaoPcAberto, setModalRelacaoPcAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const remoto = await fetchDreRateioConfig();
      if (cancelado) return;
      if (!remoto.erro && remoto.regras.length > 0) {
        const parsed = parseRateioConfigFromApi(remoto.regras);
        if (parsed) {
          setRateioConfig(parsed);
          salvarRateioConfig(parsed);
          return;
        }
      }
      const local = carregarRateioConfig();
      if (remoto.vazio && !remoto.erro && configRateioRicaParaMigrar(local)) {
        const migrou = await salvarDreRateioConfigApi(
          {
            regras: local.regras.map((r) => ({
              id: r.id,
              origem: r.origem,
              percentuais: r.percentuais,
            })),
          },
          { somenteSeVazio: true },
        );
        if (cancelado) return;
        if (migrou.gravado && migrou.regras.length > 0) {
          const parsed = parseRateioConfigFromApi(migrou.regras);
          if (parsed) {
            setRateioConfig(parsed);
            salvarRateioConfig(parsed);
          }
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const carregarSeqRef = useRef(0);
  const rateioConfigRef = useRef(rateioConfig);
  rateioConfigRef.current = rateioConfig;
  const filtrosAplicarRef = useRef({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas: [...DFC_EMPRESAS_TODAS] as number[],
  });
  const [aplicadoIdEmpresas, setAplicadoIdEmpresas] = useState<number[]>([...DFC_EMPRESAS_TODAS]);
  const [idsPorPathKeySaidas, setIdsPorPathKeySaidas] = useState<Record<string, number[]>>({});
  const [idsPorPathKeyShop9, setIdsPorPathKeyShop9] = useState<Record<string, number[]>>({});
  const [shop9OrdensCatalogoPorPathKey, setShop9OrdensCatalogoPorPathKey] = useState<
    Record<string, number[]>
  >({});

  const filtrosEmpresaIds = useMemo(() => parseMultiCsv(filtrosEmpresaCsv), [filtrosEmpresaCsv]);

  const idEmpresasEfetivas = useMemo(
    () =>
      filtrosEmpresaIds.length > 0
        ? filtrosEmpresaIds.map((s) => Number(s)).filter((n) => Number.isFinite(n))
        : [...DFC_EMPRESAS_TODAS],
    [filtrosEmpresaIds],
  );

  filtrosAplicarRef.current = {
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas: idEmpresasEfetivas,
  };

  const diasNoIntervalo = useMemo(() => diffDaysInclusiveYmd(dataInicio, dataFim), [dataInicio, dataFim]);
  const bloqueioDiario = granularidade === 'dia' && diasNoIntervalo != null && diasNoIntervalo > 120;

  const carregar = useCallback(async () => {
    const f = filtrosAplicarRef.current;
    const dias = diffDaysInclusiveYmd(f.dataInicio, f.dataFim);
    const bloqueio = f.granularidade === 'dia' && dias != null && dias > 120;
    if (bloqueio) {
      setError('No modo diário o intervalo máximo é 120 dias. Reduza o período ou use visão mensal.');
      return;
    }

    const seq = ++carregarSeqRef.current;
    setLoading(true);
    setReceitaCarregada(false);
    setError(null);
    const per = listarPeriodosDfc(f.dataInicio, f.dataFim, f.granularidade);
    setPeriodos(per);
    setAplicadoGranularidade(f.granularidade);

    try {
      const incluirReceitaNomus = f.idEmpresas.includes(DFC_ID_EMPRESA_ACO);
      const incluirReceitaMoveisDireto = f.idEmpresas.includes(DFC_ID_EMPRESA_MOVEIS);
      const incluirReceitaIndiretaNomus = incluirReceitaNomus || incluirReceitaMoveisDireto;
      const idEmpresaSaidaIndireta = incluirReceitaNomus
        ? DFC_ID_EMPRESA_ACO
        : DFC_ID_EMPRESA_MOVEIS;
      const incluirCpvNomus = incluirReceitaNomus || incluirReceitaMoveisDireto;
      const incluirShop9ReceitaFilial1 =
        f.idEmpresas.includes(DFC_ID_EMPRESA_REFRIGERACAO) ||
        f.idEmpresas.includes(DFC_ID_EMPRESA_RN_MARQUES);
      const incluirAmbasShop9NoFiltro =
        f.idEmpresas.includes(DFC_ID_EMPRESA_REFRIGERACAO) &&
        f.idEmpresas.includes(DFC_ID_EMPRESA_RN_MARQUES);
      const idsEmpresasRateioSimples: number[] = [
        DFC_ID_EMPRESA_REFRIGERACAO,
        DFC_ID_EMPRESA_RN_MARQUES,
      ];
      const idEmpresasDevolucoes = f.idEmpresas.filter(
        (id) => id === DFC_ID_EMPRESA_ACO || id === DFC_ID_EMPRESA_MOVEIS,
      );
      const incluirDevolucoes = idEmpresasDevolucoes.length > 0;
      const incluirSaidasRateioSimples =
        f.idEmpresas.includes(DFC_ID_EMPRESA_REFRIGERACAO) ||
        f.idEmpresas.includes(DFC_ID_EMPRESA_RN_MARQUES);
      const rateioCfg = rateioConfigRef.current;
      const regrasFf = regrasFornecedor(rateioCfg);
      const temRateioPlanoContas = (rateioCfg.regras ?? []).some(
        (r) => r.origem.tipo === 'plano_contas',
      );
      const filtroRecortaEmpresa = f.idEmpresas.length > 0 && f.idEmpresas.length < DFC_EMPRESAS_TODAS.length;
      const precisaPoolRateioPlanoContas = temRateioPlanoContas && filtroRecortaEmpresa;
      const [saidasRes, saidasRateioRes, saidasPoolPlanoContasRes, receitaRes, indiretaRes, moveisDiretoRes, refrigeracaoRes, refrigeracaoRateioRes, cpvRes, cpvMoveisRes, devolucoesRes, ...rateioFornecResList] = await Promise.all([
        fetchDreSaidasSoAco({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          granularidade: f.granularidade,
          idEmpresas: f.idEmpresas,
        }),
        incluirSaidasRateioSimples && !incluirAmbasShop9NoFiltro
          ? fetchDreSaidasSoAco({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              granularidade: f.granularidade,
              idEmpresas: idsEmpresasRateioSimples,
            })
          : Promise.resolve({ linhas: [] as DreSaidasSoAcoLinhaApi[], erro: undefined }),
        precisaPoolRateioPlanoContas
          ? fetchDreSaidasSoAco({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              granularidade: f.granularidade,
              idEmpresas: [...DFC_EMPRESAS_TODAS],
            })
          : Promise.resolve({ linhas: [] as DreSaidasSoAcoLinhaApi[], erro: undefined }),
        incluirReceitaNomus
          ? fetchDreReceitaVendasProdutos({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresaSaida: DFC_ID_EMPRESA_ACO,
            })
          : Promise.resolve({ linhas: [] as DreReceitaVendasProdutoLinha[], erro: undefined }),
        incluirReceitaIndiretaNomus
          ? fetchDreReceitaIndiretaProdutos({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresaSaida: idEmpresaSaidaIndireta,
            })
          : Promise.resolve({
              bruto: [] as DreReceitaIndiretaBrutoLinha[],
              liquido: [] as DreReceitaIndiretaLiquidoLinha[],
              erro: undefined,
            }),
        incluirReceitaMoveisDireto
          ? fetchDreReceitaMoveisDireto({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresaSaida: DFC_ID_EMPRESA_MOVEIS,
            })
          : Promise.resolve({ linhas: [] as DreReceitaMoveisDiretoLinha[], erro: undefined }),
        incluirShop9ReceitaFilial1
          ? fetchDreReceitaRefrigeracaoShop9({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              granularidade: f.granularidade,
              idEmpresas: f.idEmpresas,
            })
          : Promise.resolve({ linhas: [] as DreSaidasSoAcoLinhaApi[], erro: undefined }),
        incluirShop9ReceitaFilial1 && !incluirAmbasShop9NoFiltro
          ? fetchDreReceitaRefrigeracaoShop9({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              granularidade: f.granularidade,
              idEmpresas: idsEmpresasRateioSimples,
            })
          : Promise.resolve({ linhas: [] as DreSaidasSoAcoLinhaApi[], erro: undefined }),
        incluirCpvNomus
          ? fetchDreCpvSoAco({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresaSaida: DFC_ID_EMPRESA_ACO,
            })
          : Promise.resolve({
              direto: [] as DreCpvSoAcoLinhaApi[],
              indireto: [] as DreCpvSoAcoLinhaApi[],
              indiretoSemMkp: [] as DreCpvSoAcoLinhaApi[],
              erro: undefined,
            }),
        incluirReceitaMoveisDireto
          ? fetchDreCpvMoveisDireto({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresaSaida: DFC_ID_EMPRESA_MOVEIS,
            })
          : Promise.resolve({ linhas: [] as DreCpvMoveisDiretoLinha[], erro: undefined, aviso: undefined }),
        incluirDevolucoes
          ? fetchDreDevolucoes({
              dataInicio: f.dataInicio,
              dataFim: f.dataFim,
              idEmpresas: idEmpresasDevolucoes,
            })
          : Promise.resolve({ linhas: [] as DreDevolucoesLinha[], erro: undefined }),
        ...regrasFf.flatMap((regra) => [
          fetchDreRateioFornecedorTotais({
            dataInicio: f.dataInicio,
            dataFim: f.dataFim,
            granularidade: f.granularidade,
            pathKey: regra.origem.tipo === 'fornecedores' ? regra.origem.pathKeyConta : '',
            nomesFornecedor: regra.origem.tipo === 'fornecedores' ? regra.origem.nomes : [],
            idEmpresas: [...DFC_EMPRESAS_TODAS],
            poolRateio: true,
          }),
          fetchDreRateioFornecedorTotais({
            dataInicio: f.dataInicio,
            dataFim: f.dataFim,
            granularidade: f.granularidade,
            pathKey: regra.origem.tipo === 'fornecedores' ? regra.origem.pathKeyConta : '',
            nomesFornecedor: regra.origem.tipo === 'fornecedores' ? regra.origem.nomes : [],
            idEmpresas: f.idEmpresas,
            poolRateio: false,
          }),
        ]),
      ]);
      if (seq !== carregarSeqRef.current) return;
      setAplicadoIdEmpresas(f.idEmpresas);
      setIdsPorPathKeySaidas(saidasRes.idsPorPathKey ?? {});
      setIdsPorPathKeyShop9(saidasRes.idsPorPathKeyShop9 ?? {});
      setShop9OrdensCatalogoPorPathKey(saidasRes.shop9OrdensCatalogoPorPathKey ?? {});
      setSaidasLinhas(saidasRes.linhas ?? []);
      setSaidasLinhasRateioPlanoContasBase(
        precisaPoolRateioPlanoContas ? (saidasPoolPlanoContasRes.linhas ?? []) : (saidasRes.linhas ?? []),
      );
      setSaidasLinhasRateioBase(
        incluirSaidasRateioSimples
          ? incluirAmbasShop9NoFiltro
            ? (saidasRes.linhas ?? [])
            : (saidasRateioRes.linhas ?? [])
          : [],
      );
      setSimplesNacionalFilial6PorPeriodo(
        incluirSaidasRateioSimples
          ? incluirAmbasShop9NoFiltro
            ? (saidasRes.simplesNacionalFilial6PorPeriodo ?? {})
            : (saidasRateioRes.simplesNacionalFilial6PorPeriodo ?? {})
          : {},
      );
      setErroSaidas(saidasRes.erro ?? null);
      if (saidasRes.erro && (saidasRes.linhas?.length ?? 0) === 0) {
        setError(saidasRes.erro);
      } else {
        setError(null);
      }
      setReceitaVendasLinhas(receitaRes.linhas ?? []);
      setErroReceitaVendas(incluirReceitaNomus ? (receitaRes.erro ?? null) : null);
      setReceitaMoveisDiretoLinhas(moveisDiretoRes.linhas ?? []);
      setErroReceitaMoveisDireto(incluirReceitaMoveisDireto ? (moveisDiretoRes.erro ?? null) : null);
      setReceitaIndiretaBruto(indiretaRes.bruto ?? []);
      setReceitaIndiretaLiquido(indiretaRes.liquido ?? []);
      setErroReceitaIndireta(incluirReceitaIndiretaNomus ? (indiretaRes.erro ?? null) : null);
      setReceitaRefrigeracaoLinhas(refrigeracaoRes.linhas ?? []);
      setReceitaRefrigeracaoLinhasRateioBase(
        incluirShop9ReceitaFilial1
          ? incluirAmbasShop9NoFiltro
            ? (refrigeracaoRes.linhas ?? [])
            : (refrigeracaoRateioRes.linhas ?? [])
          : [],
      );
      setErroReceitaRefrigeracao(incluirShop9ReceitaFilial1 ? (refrigeracaoRes.erro ?? null) : null);
      // 6.1.1 / 6.1.2 só com Só Aço; 6.2.2 (margem MKP) só com Só Móveis — evita vazamento entre seções no filtro.
      setCpvSoAcoDiretoLinhas(incluirReceitaNomus ? (cpvRes.direto ?? []) : []);
      setCpvSoAcoIndiretoLinhas(incluirReceitaNomus ? (cpvRes.indireto ?? []) : []);
      setCpvIndiretoSemMkpLinhas(incluirReceitaMoveisDireto ? (cpvRes.indiretoSemMkp ?? []) : []);
      setErroCpvSoAco(incluirCpvNomus ? (cpvRes.erro ?? null) : null);
      setCpvMoveisDiretoLinhas(incluirReceitaMoveisDireto ? (cpvMoveisRes.linhas ?? []) : []);
      setErroCpvMoveisDireto(incluirReceitaMoveisDireto ? (cpvMoveisRes.erro ?? null) : null);
      setDevolucoesLinhas(incluirDevolucoes ? (devolucoesRes.linhas ?? []) : []);
      setErroDevolucoes(incluirDevolucoes ? (devolucoesRes.erro ?? null) : null);
      const totaisPorRegra: Record<string, Record<string, number>> = {};
      const totaisFiltroPorRegra: Record<string, Record<string, number>> = {};
      regrasFf.forEach((regra, i) => {
        const resTodas = rateioFornecResList[i * 2] as
          | { totaisPorPeriodo?: Record<string, number> }
          | undefined;
        const resFiltro = rateioFornecResList[i * 2 + 1] as
          | { totaisPorPeriodo?: Record<string, number> }
          | undefined;
        totaisPorRegra[regra.id] = resTodas?.totaisPorPeriodo ?? {};
        totaisFiltroPorRegra[regra.id] = resFiltro?.totaisPorPeriodo ?? {};
      });
      setRateioFornecedorTotaisPorRegraId(totaisPorRegra);
      setRateioFornecedorTotaisFiltroPorRegraId(totaisFiltroPorRegra);
      setReceitaCarregada(true);
    } catch (e) {
      if (seq !== carregarSeqRef.current) return;
      setSaidasLinhas([]);
      setSaidasLinhasRateioBase([]);
      setSaidasLinhasRateioPlanoContasBase([]);
      setSimplesNacionalFilial6PorPeriodo({});
      setReceitaVendasLinhas([]);
      setReceitaMoveisDiretoLinhas([]);
      setReceitaIndiretaBruto([]);
      setReceitaIndiretaLiquido([]);
      setReceitaRefrigeracaoLinhas([]);
      setCpvSoAcoDiretoLinhas([]);
      setCpvSoAcoIndiretoLinhas([]);
      setCpvIndiretoSemMkpLinhas([]);
      setCpvMoveisDiretoLinhas([]);
      setDevolucoesLinhas([]);
      setRateioFornecedorTotaisPorRegraId({});
      setRateioFornecedorTotaisFiltroPorRegraId({});
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === carregarSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrosPlanoContas = useMemo(() => parseMultiCsv(filtrosPlanoCsv), [filtrosPlanoCsv]);

  const idsPlanoContasFiltro = useMemo(
    () => filtrosPlanoContas.map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0),
    [filtrosPlanoContas],
  );

  const idEmpresaSaidaNomus = aplicadoIdEmpresas.includes(DFC_ID_EMPRESA_ACO)
    ? DFC_ID_EMPRESA_ACO
    : aplicadoIdEmpresas[0] ?? DFC_ID_EMPRESA_ACO;

  const receitaNomusAtiva =
    receitaCarregada &&
    ((aplicadoIdEmpresas.includes(DFC_ID_EMPRESA_ACO) && !erroReceitaVendas && !erroReceitaIndireta) ||
      (aplicadoIdEmpresas.includes(DFC_ID_EMPRESA_MOVEIS) &&
        !erroReceitaMoveisDireto &&
        !erroReceitaIndireta));

  const filtrosDesabilitados = loading;

  const focoMaximo = modoFoco && !faixaFiltrosVisivel;
  const mostrarPainelFiltros = !modoFoco || faixaFiltrosVisivel;

  return (
    <div
      ref={dreShellRef}
      className={`flex flex-col gap-3 min-h-0 ${modoFoco ? 'flex-1' : ''}`}
    >
      {!modoFoco ? (
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">DRE</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Demonstração do Resultado do Exercício
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalAjudaAberto(true)}
              title="Como ler a DRE — o que cada bloco significa"
              className="inline-flex items-center gap-1.5 self-center px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              Como ler
            </button>
          </div>
          <button
            type="button"
            onClick={alternarModoFoco}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Tela cheia
          </button>
        </div>
      ) : null}

      {mostrarPainelFiltros ? (
      <div
        className={`shrink-0 card-panel relative overflow-visible ${
          faixaFiltrosVisivel ? 'z-40' : 'z-10'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/80">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Filtros</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalAjudaAberto(true)}
              title="Como ler a DRE — o que cada bloco significa"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              Como ler
            </button>
            <button
              type="button"
              onClick={() => setFaixaFiltrosVisivel((v) => !v)}
              aria-expanded={faixaFiltrosVisivel}
              aria-label={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
              title={faixaFiltrosVisivel ? 'Ocultar filtros' : 'Mostrar filtros'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <svg
                className={`h-4 w-4 transition-transform ${faixaFiltrosVisivel ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            {modoFoco ? (
              <button
                type="button"
                onClick={alternarModoFoco}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition"
              >
                Sair da tela cheia
              </button>
            ) : null}
          </div>
        </div>

        {faixaFiltrosVisivel ? (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 overflow-visible">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 overflow-visible">
              <div>
                <label className={FILTRO_LABEL_CLASS}>Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={FILTRO_INPUT_CLASS}
                  disabled={filtrosDesabilitados}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL_CLASS}>Data fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={FILTRO_INPUT_CLASS}
                  disabled={filtrosDesabilitados}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL_CLASS}>Visão</label>
                <select
                  value={granularidade}
                  onChange={(e) => setGranularidade(e.target.value as 'dia' | 'mes')}
                  className={FILTRO_INPUT_CLASS}
                  disabled={filtrosDesabilitados}
                >
                  <option value="mes">Mensal</option>
                  <option value="dia">Diária</option>
                </select>
              </div>
              <div>
                <label className={FILTRO_LABEL_CLASS}>Busca na árvore</label>
                <input
                  type="search"
                  value={filtroPlanoTexto}
                  onChange={(e) => setFiltroPlanoTexto(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  className={FILTRO_INPUT_CLASS}
                />
              </div>
              <MultiSelectWithSearch
                label="Empresa"
                placeholder="Todas"
                options={OPCOES_EMPRESA_IDS}
                value={filtrosEmpresaCsv}
                onChange={setFiltrosEmpresaCsv}
                labelClass={FILTRO_LABEL_CLASS}
                inputClass={FILTRO_INPUT_CLASS}
                labelByValue={LABEL_EMPRESA}
                minWidth="140px"
                optionLabel="empresas"
                disabled={filtrosDesabilitados}
                dropdownZIndex={250}
              />
              <MultiSelectWithSearch
                label="Plano de contas (mapeado)"
                placeholder="Todas"
                options={OPCOES_PLANO_IDS}
                value={filtrosPlanoCsv}
                onChange={setFiltrosPlanoCsv}
                labelClass={FILTRO_LABEL_CLASS}
                inputClass={FILTRO_INPUT_CLASS}
                labelByValue={LABEL_PLANO}
                minWidth="180px"
                optionLabel="contas"
                disabled={filtrosDesabilitados}
                dropdownZIndex={250}
                dropdownMaxWidth="420px"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setModalMkpAberto(true)}
                title="Markup por grupo de produto (Faturamento Indireto Líquido)"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition shadow-sm ${
                  mkpAtivo
                    ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-100'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                  />
                </svg>
                MKP
                {mkpAtivo ? (
                  <span className="rounded-md bg-primary-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800 dark:text-primary-200">
                    ativo
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setModalRateioAberto(true)}
                title="Rateio percentual entre empresas (plano de contas ou fornecedores)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Rateio
              </button>
              <button
                type="button"
                onClick={() => setModalRelacaoPcAberto(true)}
                title="Relação Shop9 × DRE — identificar/complementar vínculo Shop9 por linha de saída"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.193 2.121a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L7.5 8.25"
                  />
                </svg>
                Relação PC
              </button>
              <button
                type="button"
                onClick={() => void carregar()}
                disabled={bloqueioDiario}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? 'Carregando…' : 'Aplicar'}
              </button>
            </div>
            {bloqueioDiario ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Intervalo maior que 120 dias no modo diário — use visão mensal.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      ) : null}

      <DfcCarregandoModal aberto={loading} />

      <DreMkpModal
        aberto={modalMkpAberto}
        onClose={() => setModalMkpAberto(false)}
        mkpAtivo={mkpAtivo}
        onMkpAtivoChange={setMkpAtivo}
      />

      <DreAjudaModal aberto={modalAjudaAberto} onClose={() => setModalAjudaAberto(false)} />

      <DreRateioEmpresasModal
        aberto={modalRateioAberto}
        config={rateioConfig}
        onClose={() => setModalRateioAberto(false)}
        onSalvar={(cfg) => {
          setRateioConfig(cfg);
          salvarRateioConfig(cfg);
          void salvarDreRateioConfigApi({
            regras: cfg.regras.map((r) => ({
              id: r.id,
              origem: r.origem,
              percentuais: r.percentuais,
            })),
          });
        }}
      />

      <DreRelacaoPcModal
        aberto={modalRelacaoPcAberto}
        onClose={() => setModalRelacaoPcAberto(false)}
        onSalvo={() => void carregar()}
      />

      {!loading && error ? (
        <p className="text-sm text-red-700 dark:text-red-300 shrink-0 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-4 py-2">
          {error}
        </p>
      ) : null}

      {erroReceitaVendas ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          Receita de vendas (Nomus): {erroReceitaVendas}
        </p>
      ) : null}

      {erroReceitaMoveisDireto ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          Faturamento direto Só Móveis (Nomus): {erroReceitaMoveisDireto}
        </p>
      ) : null}

      {erroReceitaIndireta ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          Faturamento indireto (Nomus): {erroReceitaIndireta}
        </p>
      ) : null}

      {erroReceitaRefrigeracao ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          Receita/CMV Shop9 (Só Refrigeração / R N Marques): {erroReceitaRefrigeracao}
        </p>
      ) : null}

      {erroCpvSoAco ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          CPV Só Aço (Nomus): {erroCpvSoAco}
        </p>
      ) : null}

      {erroCpvMoveisDireto ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          CPV direto Só Móveis (Nomus/Shop9): {erroCpvMoveisDireto}
        </p>
      ) : null}

      {erroDevolucoes ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
          Devoluções (Nomus): {erroDevolucoes}
        </p>
      ) : null}

      {!loading && !error && saidasLinhas.length === 0 && !receitaCarregada ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          Clique em <span className="font-semibold">Aplicar</span> para carregar a DRE.
        </p>
      ) : null}

      {erroSaidas && !error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 shrink-0 rounded-lg border border-amber-200 px-4 py-2">
          Saídas SOACO: {erroSaidas}
        </p>
      ) : null}

      <div className={modoFoco ? 'flex-1 min-h-0 flex flex-col' : ''}>
      <ArvoreContasDre
        periodos={periodos}
        valoresPorConta={{}}
        saidasLinhas={saidasLinhas}
        saidasLinhasRateioBase={saidasLinhasRateioBase}
        saidasLinhasRateioPlanoContasBase={saidasLinhasRateioPlanoContasBase}
        simplesNacionalFilial6PorPeriodo={simplesNacionalFilial6PorPeriodo}
        granularidade={aplicadoGranularidade}
        dataInicio={dataInicio}
        dataFim={dataFim}
        idEmpresas={aplicadoIdEmpresas}
        loading={loading}
        error={error}
        telaCheia={modoFoco}
        onMostrarFiltros={focoMaximo ? () => setFaixaFiltrosVisivel(true) : undefined}
        onSairTelaCheia={focoMaximo ? alternarModoFoco : undefined}
        filtroPlanoContas={filtroPlanoTexto}
        idsPlanoContasFiltro={idsPlanoContasFiltro}
        mkpAtivo={mkpAtivo}
        receitaVendasLinhas={receitaVendasLinhas}
        receitaMoveisDiretoLinhas={receitaMoveisDiretoLinhas}
        receitaIndiretaBruto={receitaIndiretaBruto}
        receitaIndiretaLiquido={receitaIndiretaLiquido}
        receitaNomusCarregada={receitaNomusAtiva}
        idEmpresaSaida={idEmpresaSaidaNomus}
        idsPorPathKeySaidas={idsPorPathKeySaidas}
        idsPorPathKeyShop9={idsPorPathKeyShop9}
        shop9OrdensCatalogoPorPathKey={shop9OrdensCatalogoPorPathKey}
        receitaRefrigeracaoLinhas={receitaRefrigeracaoLinhas}
        receitaRefrigeracaoLinhasRateioBase={receitaRefrigeracaoLinhasRateioBase}
        rateioConfig={rateioConfig}
        rateioFornecedorTotaisPorRegraId={rateioFornecedorTotaisPorRegraId}
        rateioFornecedorTotaisFiltroPorRegraId={rateioFornecedorTotaisFiltroPorRegraId}
        cpvSoAcoDiretoLinhas={cpvSoAcoDiretoLinhas}
        cpvSoAcoIndiretoLinhas={cpvSoAcoIndiretoLinhas}
        cpvIndiretoSemMkpLinhas={cpvIndiretoSemMkpLinhas}
        cpvMoveisDiretoLinhas={cpvMoveisDiretoLinhas}
        devolucoesLinhas={devolucoesLinhas}
      />
      </div>
    </div>
  );
}
