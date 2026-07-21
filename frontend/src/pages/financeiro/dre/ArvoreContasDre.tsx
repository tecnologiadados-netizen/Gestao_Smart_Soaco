import { Fragment, useCallback, useMemo, useState } from 'react';
import estruturaJson from './estruturaDreArvore.json';
import { rotuloPeriodoCabecalho } from '../dfc/dfcPeriodos';
import DfcDetalheLancamentosModal from '../dfc/DfcDetalheLancamentosModal';
import DreReceitaVendasDetalheModal from './DreReceitaVendasDetalheModal';
import DreDevolucoesDetalheModal from './DreDevolucoesDetalheModal';
import { contextoDetalheReceitaVendas, type DreReceitaDetalheContexto } from './dreReceitaDetalheUtils';
import { montarValoresCpvSoAcoPorPathKey, type DreCpvSoAcoLinha } from './dreCpvSoAcoMap';
import { montarValoresDescontosIncondicionaisPorPathKey } from './dreDescontosIncondicionaisMap';
import { montarValoresDevolucoesPorPathKey } from './dreDevolucoesMap';
import { montarValoresCpvMoveisDiretoPorPathKey } from './dreCpvMoveisMap';
import { montarValoresReceitaMoveisDiretoPorPathKey } from './dreReceitaMoveisMap';
import { montarValoresReceitaVendasPorPathKey, type DreReceitaVendasLinha } from './dreReceitaVendasMap';
import {
  mesclarValoresNomusPorPathKey,
  montarValoresReceitaIndiretaPorPathKey,
  type DreReceitaIndiretaBrutoLinha,
  type DreReceitaIndiretaLiquidoLinha,
} from './dreReceitaIndiretaMap';
import { montarValoresSaidasSoAcoPorPathKey, type DreSaidasSoAcoLinha } from './dreSaidasSoAcoMap';
import {
  aplicarRateioSimplesNacionalNasSaidas,
  CODIGO_SIMPLES_NACIONAL,
  montarRateioSimplesPorPeriodo,
} from './dreSimplesNacionalRateio';
import { aplicarRateioNasSaidas, CODIGO_PRO_LABORE, ehContaRateioFilha, pathKeyPaiRateioFilha } from './dreRateioSaidas';
import type { DreRateioConfig, DreRateioProLaborePct, DreRateioRegra } from './dreRateioEmpresas';
import { mapearFilhosParaEmpresas } from './dreRateioEmpresaFilhos';
import { regrasRateioParaConta } from './dreRateioEmpresasDisplay';
import { aplicarMkpNasSomas, montarMapaIdsPorPathKey, montarSomasDrePorPathKey } from './dreSomarValores';
import { formatarVariacaoMkp, variacaoMkpPorGrupo } from './dreMkpVariacoes';
import {
  calcularAnaliseHorizontal,
  calcularAnaliseVertical,
  corAnaliseHorizontal,
  formatarAnalisePct,
} from './dreAnalises';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';
import type { DreCpvMoveisDiretoLinha, DreDevolucoesLinha, DreReceitaMoveisDiretoLinha } from '../../../api/financeiro';
import {
  coletarIdsContaParaNo,
  coletarPathKeysSaidasParaNo,
  mapaIdsPorPathKeyFromRecord,
  noPermiteDetalheSaidas,
} from './dreDetalhePlano';
import { isProvisaoCalculadaDre } from './dreProvisoesFolha';
import { DFC_EMPRESAS_TODAS, DFC_ID_EMPRESA_ACO, DFC_ID_EMPRESA_MOVEIS } from '../dfc/dfcEmpresas';

export type DreEstruturaNo = {
  pathKey: string;
  id: number | null;
  nome: string;
  tipo: string;
  macro: string;
  codigo: string;
  sinal?: number;
  calcId?: string;
  children: DreEstruturaNo[];
};

export type ArvoreContasDreProps = {
  periodos: string[];
  valoresPorConta: Record<number, Record<string, number>>;
  granularidade: 'dia' | 'mes';
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
  loading?: boolean;
  error?: string | null;
  telaCheia?: boolean;
  /** Reabre a faixa de filtros (modo tela cheia com filtros ocultos). */
  onMostrarFiltros?: () => void;
  /** Sai do modo tela cheia (exibido no cabeçalho da árvore). */
  onSairTelaCheia?: () => void;
  filtroPlanoContas?: string;
  idsPlanoContasFiltro?: number[];
  /** Aplica markup (variação %) no Faturamento Indireto Líquido (MKP). */
  mkpAtivo?: boolean;
  /** Agregado Nomus — receita de vendas de produtos (Só Aço / faturamento direto). */
  receitaVendasLinhas?: DreReceitaVendasLinha[];
  /** 1.4.1 Faturamento Direto Só Móveis (data emissão NF, valorTotal). */
  receitaMoveisDiretoLinhas?: DreReceitaMoveisDiretoLinha[];
  /** Faturamento indireto bruto (1.2) e líquido MKP por grupo (1.3.x). */
  receitaIndiretaBruto?: DreReceitaIndiretaBrutoLinha[];
  receitaIndiretaLiquido?: DreReceitaIndiretaLiquidoLinha[];
  /** Dados Nomus carregados — habilita drill-down na receita de vendas. */
  receitaNomusCarregada?: boolean;
  idEmpresaSaida?: number;
  /** Saídas SOACO (contas a pagar por competência). */
  saidasLinhas?: DreSaidasSoAcoLinha[];
  /** Saídas Ref+RN integrais — base do rateio Simples (4.14) independente do filtro de empresa. */
  saidasLinhasRateioBase?: DreSaidasSoAcoLinha[];
  /** Saídas de TODAS as empresas — pool do rateio por plano de contas (ex.: Pró-labore). */
  saidasLinhasRateioPlanoContasBase?: DreSaidasSoAcoLinha[];
  /** Simples direto filial 6 Shop9 por período — não entra no pool de rateio 4.14. */
  simplesNacionalFilial6PorPeriodo?: Record<string, number>;
  /** Receita Bruta 1.5 / 1.6.x e CMV 6.3 / 6.4.x (Shop9). */
  receitaRefrigeracaoLinhas?: DreSaidasSoAcoLinha[];
  /** Bases 1.5 + 1.6.2 completas para rateio do Simples (independente do filtro de empresa). */
  receitaRefrigeracaoLinhasRateioBase?: DreSaidasSoAcoLinha[];
  /** Configuração do modal Rateio (origem + percentuais por empresa). */
  rateioConfig?: DreRateioConfig | null;
  /** Totais por período dos fornecedores (todas as empresas), por id da regra de rateio. */
  rateioFornecedorTotaisPorRegraId?: Record<string, Record<string, number>>;
  /** Totais dos mesmos fornecedores restritos ao filtro de empresa da faixa. */
  rateioFornecedorTotaisFiltroPorRegraId?: Record<string, Record<string, number>>;
  /** CPV Só Aço — direto; 6.1.2 com MKP; 6.2.2 margem MKP (bruto − líquido). */
  cpvSoAcoDiretoLinhas?: DreCpvSoAcoLinha[];
  cpvSoAcoIndiretoLinhas?: DreCpvSoAcoLinha[];
  cpvIndiretoSemMkpLinhas?: DreCpvSoAcoLinha[];
  /** 6.2.1 CPV Direto Só Móveis (Nomus + Shop9). */
  cpvMoveisDiretoLinhas?: DreCpvMoveisDiretoLinha[];
  /** 2.1.1.1 / 2.1.1.2 Devoluções Só Aço / Só Móveis (Nomus). */
  devolucoesLinhas?: DreDevolucoesLinha[];
  /** Mapa pathKey → ids Nomus (contafinanceiro) para drill-down de saídas. */
  idsPorPathKeySaidas?: Record<string, number[]>;
  /** Mapa pathKey → ids Shop9 (Ordem_Plano_Contas3) para drill-down por competência. */
  idsPorPathKeyShop9?: Record<string, number[]>;
  /** Catálogo Shop9 por pathKey — drill-down rateio (relacao PC, sem recorte de filtro). */
  shop9OrdensCatalogoPorPathKey?: Record<string, number[]>;
};

const STICKY_COLS = [
  { w: 40, l: 0 },
  { w: 320, l: 40 },
] as const;
const STICKY_TOTAL_W = STICKY_COLS.reduce((s, c) => s + c.w, 0);
const COL_W_VALOR = 88;
const COL_W_AH = 56;
const COL_W_AV = 56;
const COL_W_TOTAL = 108;
const COL_W_MEDIA = 108;
const COL_W_MKP = 72;
const COLS_POR_PERIODO = COL_W_VALOR + COL_W_AV + COL_W_AH;

const TH_AV =
  'py-2 px-1.5 text-[10px] font-semibold text-white text-right whitespace-nowrap bg-indigo-600 border-l border-indigo-500/50';
const TH_AH =
  'py-2 px-1.5 text-[10px] font-semibold text-white text-right whitespace-nowrap bg-indigo-600 border-l border-indigo-500/50';
const TD_AV =
  'py-2 px-1.5 text-right tabular-nums text-[11px] font-medium text-black dark:text-black bg-indigo-50/90 dark:bg-indigo-950/70 border-l border-indigo-100 dark:border-indigo-900/50';
const TD_AH =
  'py-2 px-1.5 text-right tabular-nums text-[11px] font-medium bg-indigo-50/90 dark:bg-indigo-950/70 border-l border-indigo-100 dark:border-indigo-900/50';

/** Quantidade de meses no intervalo (para média mensal; em visão diária usa meses distintos). */
function contarMesesPeriodo(periodos: string[], granularidade: 'dia' | 'mes'): number {
  if (periodos.length === 0) return 0;
  if (granularidade === 'mes') return periodos.length;
  return new Set(periodos.map((p) => p.slice(0, 7))).size;
}

function encontrarPathKeyPorCodigo(nodes: DreEstruturaNo[], codigo: string): string | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n.pathKey;
    const achado = encontrarPathKeyPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

function encontrarNoPorPathKey(nodes: DreEstruturaNo[], pathKey: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.pathKey === pathKey) return n;
    const achado = encontrarNoPorPathKey(n.children ?? [], pathKey);
    if (achado) return achado;
  }
  return null;
}

type DetalheRateioOpts = {
  comRateioSimples?: boolean;
  rateioEmpresasRegras?: DreRateioRegra[];
  rateioEmpresaRecorte?: number;
  rateioPercentuaisPlanoContas?: DreRateioProLaborePct;
  valorEsperadoGrade?: number;
  /** Busca Nomus em todas as empresas (lançamentos de origem podem estar em outra filial). */
  buscaTodasEmpresas?: boolean;
  /** pathKeys DRE da conta clicada (para ordens Shop9 do catálogo no rateio). */
  pathKeysConta?: string[];
};

function separarIdsDetalheNomusShop9(
  uniq: number[],
  shop9IdSet: Set<number>,
  shop9OrdensCatalogoPorPathKey: Record<string, number[]>,
  opts: DetalheRateioOpts,
): { idsNomus: number[]; idsShop9: number[] } {
  const catalogOrdens =
    opts.buscaTodasEmpresas && opts.pathKeysConta?.length
      ? [
          ...new Set(
            opts.pathKeysConta.flatMap((pk) => shop9OrdensCatalogoPorPathKey[pk] ?? []),
          ),
        ].filter((n) => Number.isFinite(n) && n > 0)
      : [];
  const catalogSet = new Set(catalogOrdens);

  if (opts.buscaTodasEmpresas && catalogOrdens.length > 0) {
    const idsShop9 = [
      ...new Set([
        ...uniq.filter((id) => shop9IdSet.has(id) || catalogSet.has(id)),
        ...catalogOrdens,
      ]),
    ]
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    const idsShop9Set = new Set(idsShop9);
    const idsNomus = uniq.filter((id) => !idsShop9Set.has(id));
    return { idsNomus, idsShop9 };
  }

  const idsShop9 = uniq.filter((id) => shop9IdSet.has(id));
  const idsNomus = uniq.filter((id) => !shop9IdSet.has(id));
  return { idsNomus, idsShop9 };
}

function resolverContextoRateioDetalhe(
  node: DreEstruturaNo,
  config: DreRateioConfig | null | undefined,
  rootsOrig: DreEstruturaNo[],
): Omit<DetalheRateioOpts, 'comRateioSimples'> {
  if (ehContaRateioFilha(node.codigo, config, rootsOrig)) {
    const pkPai = pathKeyPaiRateioFilha(node.codigo, config, rootsOrig);
    if (pkPai) {
      const noPai = encontrarNoPorPathKey(rootsOrig, pkPai);
      const map = mapearFilhosParaEmpresas(noPai?.children ?? []);
      let idEmp: number | undefined;
      if (map) {
        for (const [id, filho] of map.entries()) {
          if (filho.codigo === node.codigo) {
            idEmp = id;
            break;
          }
        }
      }
      const regra = config?.regras.find(
        (r) => r.origem.tipo === 'plano_contas' && r.origem.pathKey === pkPai,
      );
      if (regra && idEmp != null) {
        return {
          rateioPercentuaisPlanoContas: regra.percentuais,
          rateioEmpresaRecorte: idEmp,
        };
      }
    }
  }
  return {};
}

function offsetsStickyDireita(larguras: number[]): number[] {
  let right = 0;
  const offsets = new Array<number>(larguras.length);
  for (let i = larguras.length - 1; i >= 0; i--) {
    offsets[i] = right;
    right += larguras[i];
  }
  return offsets;
}

const TH_STICKY_DIREITA =
  'sticky z-20 border-l border-slate-300 dark:border-slate-500 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)]';
const TD_STICKY_DIREITA = 'sticky z-10 border-l border-slate-200 dark:border-slate-600';

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function alternarExpansao(expanded: Set<string>, pathKey: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(pathKey)) {
    next.delete(pathKey);
    for (const k of [...next]) {
      if (k !== pathKey && k.startsWith(`${pathKey}/`)) next.delete(k);
    }
  } else {
    next.add(pathKey);
  }
  return next;
}

function coletarChavesComFilhos(nodes: DreEstruturaNo[]): string[] {
  const out: string[] = [];
  function w(n: DreEstruturaNo) {
    if (n.children?.length) {
      out.push(n.pathKey);
      n.children.forEach(w);
    }
  }
  nodes.forEach(w);
  return out;
}

function linhasVisiveis(roots: DreEstruturaNo[], expanded: Set<string>): { node: DreEstruturaNo; depth: number }[] {
  const out: { node: DreEstruturaNo; depth: number }[] = [];
  function walk(n: DreEstruturaNo, depth: number) {
    out.push({ node: n, depth });
    if (n.children?.length && expanded.has(n.pathKey)) {
      for (const c of n.children) walk(c, depth + 1);
    }
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

function linhasFiltradasPorTexto(roots: DreEstruturaNo[], queryRaw: string) {
  const raw = queryRaw.trim();
  if (!raw) return [];
  const match = criarMatcherTextoLivre(raw);
  function noCasa(n: DreEstruturaNo): boolean {
    if (match(n.nome)) return true;
    if (match(n.codigo || '')) return true;
    if (n.id != null && match(String(n.id))) return true;
    return false;
  }
  function subarvoreTemCasa(n: DreEstruturaNo): boolean {
    if (noCasa(n)) return true;
    return (n.children ?? []).some(subarvoreTemCasa);
  }
  const out: { node: DreEstruturaNo; depth: number }[] = [];
  function walk(n: DreEstruturaNo, depth: number) {
    if (!subarvoreTemCasa(n)) return;
    out.push({ node: n, depth });
    for (const c of n.children ?? []) walk(c, depth + 1);
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

function linhasFiltradasPorIds(roots: DreEstruturaNo[], ids: Set<number>) {
  function subarvoreTemId(n: DreEstruturaNo): boolean {
    if (n.id != null && n.id > 0 && ids.has(n.id)) return true;
    return (n.children ?? []).some(subarvoreTemId);
  }
  const out: { node: DreEstruturaNo; depth: number }[] = [];
  function walk(n: DreEstruturaNo, depth: number) {
    if (!subarvoreTemId(n)) return;
    out.push({ node: n, depth });
    for (const c of n.children ?? []) walk(c, depth + 1);
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

function corFundoLinha(node: DreEstruturaNo, rowIdx: number): string {
  if (node.tipo === 'T') return 'row-total-brand';
  if (node.tipo === 'S' && !node.codigo.includes('.')) return 'bg-soaco-navy/10 dark:bg-soaco-navy/35';
  if (node.tipo === 'S') return 'bg-primary-50/80 dark:bg-soaco-graphite/80';
  return rowIdx % 2 === 0 ? 'bg-white dark:bg-soaco-graphite/60' : 'bg-slate-50/60 dark:bg-soaco-graphite/40';
}

/** Fundo opaco nas colunas fixas — evita sobreposição ao rolar a grade. */
function stickyBgLinha(node: DreEstruturaNo, rowIdx: number): string {
  if (node.tipo === 'T') return 'bg-indigo-50 dark:bg-indigo-950';
  if (node.tipo === 'S' && !node.codigo.includes('.')) return 'bg-slate-200 dark:bg-slate-700';
  if (node.tipo === 'S') return 'bg-primary-100 dark:bg-slate-700';
  return rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800';
}

type DetalheState = {
  idsNomus: number[];
  idsShop9: number[];
  periodo: string | undefined;
  titulo: string;
  comRateioSimples?: boolean;
  rateioEmpresasRegras?: DreRateioRegra[];
  rateioEmpresaRecorte?: number;
  rateioPercentuaisPlanoContas?: DreRateioProLaborePct;
  valorEsperadoGrade?: number;
  buscaTodasEmpresas?: boolean;
} | null;
type DetalheReceitaState = {
  contexto: DreReceitaDetalheContexto;
  periodo: string | undefined;
  titulo: string;
  valorGrade: number;
} | null;
type DetalheDevolucaoState = {
  idEmpresa: number;
  periodo: string | undefined;
  titulo: string;
  valorGrade: number;
} | null;

/** 2.1.1.1 → Só Aço (1); 2.1.1.2 → Só Móveis (2). Demais devoluções são Shop9. */
const DEVOLUCAO_NOMUS_EMPRESA_POR_CODIGO: Record<string, number> = {
  '2.1.1.1': 1,
  '2.1.1.2': 2,
};

function empresaDevolucaoNomus(node: DreEstruturaNo): number | null {
  if (node.tipo !== 'A') return null;
  return DEVOLUCAO_NOMUS_EMPRESA_POR_CODIGO[node.codigo] ?? null;
}

export default function ArvoreContasDre({
  periodos,
  valoresPorConta,
  granularidade,
  dataInicio,
  dataFim,
  idEmpresas = DFC_EMPRESAS_TODAS,
  loading = false,
  error = null,
  telaCheia = false,
  onMostrarFiltros,
  onSairTelaCheia,
  filtroPlanoContas = '',
  idsPlanoContasFiltro = [],
  mkpAtivo = false,
  receitaVendasLinhas = [],
  receitaMoveisDiretoLinhas = [],
  receitaIndiretaBruto = [],
  receitaIndiretaLiquido = [],
  receitaNomusCarregada = false,
  idEmpresaSaida = 1,
  saidasLinhas = [],
  saidasLinhasRateioBase = [],
  saidasLinhasRateioPlanoContasBase = [],
  simplesNacionalFilial6PorPeriodo = {},
  receitaRefrigeracaoLinhas = [],
  receitaRefrigeracaoLinhasRateioBase = [],
  rateioConfig = null,
  rateioFornecedorTotaisPorRegraId,
  rateioFornecedorTotaisFiltroPorRegraId,
  cpvSoAcoDiretoLinhas = [],
  cpvSoAcoIndiretoLinhas = [],
  cpvIndiretoSemMkpLinhas = [],
  cpvMoveisDiretoLinhas = [],
  devolucoesLinhas = [],
  idsPorPathKeySaidas = {},
  idsPorPathKeyShop9 = {},
  shop9OrdensCatalogoPorPathKey = {},
}: ArvoreContasDreProps) {
  const roots = useMemo(
    () => (estruturaJson as unknown as { roots: DreEstruturaNo[] }).roots,
    [],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [detalheAberto, setDetalheAberto] = useState<DetalheState>(null);
  const [detalheReceita, setDetalheReceita] = useState<DetalheReceitaState>(null);
  const [detalheDevolucao, setDetalheDevolucao] = useState<DetalheDevolucaoState>(null);

  const todasChavesComFilhos = useMemo(() => coletarChavesComFilhos(roots), [roots]);
  const idsPorPathKey = useMemo(() => montarMapaIdsPorPathKey(roots), [roots]);
  const idsSaidasPorPathKey = useMemo(
    () => mapaIdsPorPathKeyFromRecord(idsPorPathKeySaidas),
    [idsPorPathKeySaidas],
  );
  const shop9IdSet = useMemo(() => {
    const s = new Set<number>();
    for (const ids of Object.values(idsPorPathKeyShop9)) {
      for (const id of ids) {
        if (Number.isFinite(id) && id > 0) s.add(id);
      }
    }
    return s;
  }, [idsPorPathKeyShop9]);

  const valoresReceitaPorPathKey = useMemo(() => {
    const direto = receitaVendasLinhas.length
      ? montarValoresReceitaVendasPorPathKey(roots, receitaVendasLinhas, periodos, granularidade)
      : undefined;
    const indireto =
      receitaIndiretaBruto.length || receitaIndiretaLiquido.length
        ? montarValoresReceitaIndiretaPorPathKey(
            roots,
            receitaIndiretaBruto,
            receitaIndiretaLiquido,
            periodos,
            granularidade,
          )
        : undefined;
    const moveisDireto = receitaMoveisDiretoLinhas.length
      ? montarValoresReceitaMoveisDiretoPorPathKey(roots, receitaMoveisDiretoLinhas, periodos, granularidade)
      : undefined;
    return mesclarValoresNomusPorPathKey(direto, indireto, moveisDireto);
  }, [
    roots,
    receitaVendasLinhas,
    receitaMoveisDiretoLinhas,
    receitaIndiretaBruto,
    receitaIndiretaLiquido,
    periodos,
    granularidade,
  ]);

  const valoresSaidasBasePorPathKey = useMemo(
    () => montarValoresSaidasSoAcoPorPathKey(roots, saidasLinhas, periodos),
    [roots, saidasLinhas, periodos],
  );

  const linhasSaidasFonteSimples =
    saidasLinhasRateioBase.length > 0 ? saidasLinhasRateioBase : saidasLinhas;

  const valoresSaidasFonteSimplesPorPathKey = useMemo(
    () => montarValoresSaidasSoAcoPorPathKey(roots, linhasSaidasFonteSimples, periodos),
    [roots, linhasSaidasFonteSimples, periodos],
  );

  const valoresRefrigeracaoPorPathKey = useMemo(
    () =>
      receitaRefrigeracaoLinhas.length
        ? montarValoresSaidasSoAcoPorPathKey(roots, receitaRefrigeracaoLinhas, periodos)
        : undefined,
    [roots, receitaRefrigeracaoLinhas, periodos],
  );

  const linhasRefrigeracaoRateioBase =
    receitaRefrigeracaoLinhasRateioBase.length > 0
      ? receitaRefrigeracaoLinhasRateioBase
      : receitaRefrigeracaoLinhas;

  const valoresRefrigeracaoRateioBasePorPathKey = useMemo(
    () =>
      linhasRefrigeracaoRateioBase.length
        ? montarValoresSaidasSoAcoPorPathKey(roots, linhasRefrigeracaoRateioBase, periodos)
        : undefined,
    [roots, linhasRefrigeracaoRateioBase, periodos],
  );

  const mapasReceitaBaseRateioSimples = useMemo(
    () =>
      [valoresReceitaPorPathKey, valoresRefrigeracaoRateioBasePorPathKey].filter(
        (m): m is Map<string, Record<string, number>> => m != null && m.size > 0,
      ),
    [valoresReceitaPorPathKey, valoresRefrigeracaoRateioBasePorPathKey],
  );

  const valoresSaidasRateioPlanoContasBasePorPathKey = useMemo(
    () =>
      saidasLinhasRateioPlanoContasBase.length > 0
        ? montarValoresSaidasSoAcoPorPathKey(roots, saidasLinhasRateioPlanoContasBase, periodos)
        : undefined,
    [roots, saidasLinhasRateioPlanoContasBase, periodos],
  );

  const valoresSaidasPorPathKey = useMemo(() => {
    const comSimples = aplicarRateioSimplesNacionalNasSaidas(
      valoresSaidasBasePorPathKey,
      roots,
      periodos,
      mapasReceitaBaseRateioSimples,
      idEmpresas,
      valoresSaidasFonteSimplesPorPathKey,
      simplesNacionalFilial6PorPeriodo,
    );
    return aplicarRateioNasSaidas(
      comSimples,
      roots,
      periodos,
      rateioConfig,
      idEmpresas,
      rateioFornecedorTotaisPorRegraId,
      rateioFornecedorTotaisFiltroPorRegraId,
      valoresSaidasRateioPlanoContasBasePorPathKey,
    );
  }, [
    valoresSaidasBasePorPathKey,
    valoresSaidasFonteSimplesPorPathKey,
    simplesNacionalFilial6PorPeriodo,
    mapasReceitaBaseRateioSimples,
    roots,
    periodos,
    idEmpresas,
    rateioConfig,
    rateioFornecedorTotaisPorRegraId,
    rateioFornecedorTotaisFiltroPorRegraId,
    valoresSaidasRateioPlanoContasBasePorPathKey,
  ]);

  const rateioSimplesPorPeriodo = useMemo(() => {
    return montarRateioSimplesPorPeriodo(roots, periodos, mapasReceitaBaseRateioSimples);
  }, [roots, periodos, mapasReceitaBaseRateioSimples]);

  const valoresCpvSoAcoPorPathKey = useMemo(
    () =>
      cpvSoAcoDiretoLinhas.length ||
      cpvSoAcoIndiretoLinhas.length ||
      cpvIndiretoSemMkpLinhas.length
        ? montarValoresCpvSoAcoPorPathKey(
            roots,
            cpvSoAcoDiretoLinhas,
            cpvSoAcoIndiretoLinhas,
            cpvIndiretoSemMkpLinhas,
            periodos,
            granularidade,
          )
        : undefined,
    [
      roots,
      cpvSoAcoDiretoLinhas,
      cpvSoAcoIndiretoLinhas,
      cpvIndiretoSemMkpLinhas,
      periodos,
      granularidade,
    ],
  );

  const valoresCpvMoveisDiretoPorPathKey = useMemo(
    () =>
      cpvMoveisDiretoLinhas.length
        ? montarValoresCpvMoveisDiretoPorPathKey(roots, cpvMoveisDiretoLinhas, periodos, granularidade)
        : undefined,
    [roots, cpvMoveisDiretoLinhas, periodos, granularidade],
  );

  const valoresDevolucoesPorPathKey = useMemo(
    () =>
      devolucoesLinhas.length
        ? montarValoresDevolucoesPorPathKey(roots, devolucoesLinhas, periodos, granularidade)
        : undefined,
    [roots, devolucoesLinhas, periodos, granularidade],
  );

  const valoresDescontosIncondicionaisPorPathKey = useMemo(
    () =>
      receitaVendasLinhas.length || receitaMoveisDiretoLinhas.length
        ? montarValoresDescontosIncondicionaisPorPathKey(
            roots,
            receitaVendasLinhas,
            receitaMoveisDiretoLinhas,
            periodos,
            granularidade,
          )
        : undefined,
    [roots, receitaVendasLinhas, receitaMoveisDiretoLinhas, periodos, granularidade],
  );

  const valoresExternosPorPathKey = useMemo(
    () =>
      mesclarValoresNomusPorPathKey(
        valoresReceitaPorPathKey,
        valoresSaidasPorPathKey,
        valoresRefrigeracaoPorPathKey,
        valoresCpvSoAcoPorPathKey,
        valoresCpvMoveisDiretoPorPathKey,
        valoresDevolucoesPorPathKey,
        valoresDescontosIncondicionaisPorPathKey,
      ),
    [
      valoresReceitaPorPathKey,
      valoresSaidasPorPathKey,
      valoresRefrigeracaoPorPathKey,
      valoresCpvSoAcoPorPathKey,
      valoresCpvMoveisDiretoPorPathKey,
      valoresDevolucoesPorPathKey,
      valoresDescontosIncondicionaisPorPathKey,
    ],
  );

  const somasPorPathKey = useMemo(() => {
    const somas = montarSomasDrePorPathKey(
      roots,
      idsPorPathKey,
      periodos,
      valoresPorConta,
      valoresExternosPorPathKey,
      {
        incluirAco: idEmpresas.includes(DFC_ID_EMPRESA_ACO),
        incluirMoveis: idEmpresas.includes(DFC_ID_EMPRESA_MOVEIS),
      },
    );
    if (mkpAtivo) aplicarMkpNasSomas(roots, somas, periodos);
    return somas;
  }, [roots, idsPorPathKey, periodos, valoresPorConta, valoresExternosPorPathKey, mkpAtivo, idEmpresas]);

  const receitaBrutaPorPeriodo = useMemo(() => {
    const rb = roots.find((r) => r.codigo === '1');
    if (!rb) return {} as Record<string, number>;
    return somasPorPathKey.get(rb.pathKey) ?? {};
  }, [roots, somasPorPathKey]);

  const receitaBrutaTotal = useMemo(
    () => periodos.reduce((s, p) => s + (receitaBrutaPorPeriodo[p] ?? 0), 0),
    [periodos, receitaBrutaPorPeriodo],
  );

  const nMesesPeriodo = useMemo(
    () => contarMesesPeriodo(periodos, granularidade),
    [periodos, granularidade],
  );

  const temPivot = periodos.length > 0;

  const colunasFim = useMemo(() => {
    const defs: { key: string; w: number; show: boolean }[] = [
      { key: 'total', w: COL_W_TOTAL, show: temPivot },
      { key: 'totalAv', w: COL_W_AV, show: temPivot },
      { key: 'media', w: COL_W_MEDIA, show: temPivot },
      { key: 'mediaAv', w: COL_W_AV, show: temPivot },
      { key: 'mkp', w: COL_W_MKP, show: mkpAtivo },
    ];
    return defs.filter((c) => c.show);
  }, [temPivot, mkpAtivo]);

  const stickyRightPorKey = useMemo(() => {
    const offsets = offsetsStickyDireita(colunasFim.map((c) => c.w));
    const map = new Map<string, { right: number; w: number }>();
    colunasFim.forEach((c, i) => map.set(c.key, { right: offsets[i], w: c.w }));
    return map;
  }, [colunasFim]);

  const larguraColunasFim = colunasFim.reduce((s, c) => s + c.w, 0);

  const expandirTudo = useCallback(() => {
    setExpanded(new Set(todasChavesComFilhos));
  }, [todasChavesComFilhos]);

  const recolherTudo = useCallback(() => setExpanded(new Set()), []);

  const idsPlanoSet = useMemo(
    () => new Set(idsPlanoContasFiltro.filter((n) => Number.isFinite(n) && n > 0)),
    [idsPlanoContasFiltro],
  );
  const filtroIdsAtivo = idsPlanoSet.size > 0;
  const filtroTextoAtivo = filtroPlanoContas.trim().length > 0;
  const filtroAtivo = filtroIdsAtivo || filtroTextoAtivo;

  const visiveis = useMemo(() => {
    if (filtroIdsAtivo) return linhasFiltradasPorIds(roots, idsPlanoSet);
    if (filtroTextoAtivo) return linhasFiltradasPorTexto(roots, filtroPlanoContas);
    return linhasVisiveis(roots, expanded);
  }, [roots, expanded, filtroPlanoContas, filtroIdsAtivo, filtroTextoAtivo, idsPlanoSet]);

  const abrirDetalhe = useCallback(
    (
      rawIds: number[],
      periodo: string | undefined,
      titulo: string,
      opts: DetalheRateioOpts = {},
    ) => {
      const uniq = [...new Set(rawIds.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
      if (!uniq.length && !(opts.buscaTodasEmpresas && opts.pathKeysConta?.length)) return;
      const { idsNomus, idsShop9 } = separarIdsDetalheNomusShop9(
        uniq,
        shop9IdSet,
        shop9OrdensCatalogoPorPathKey,
        opts,
      );
      if (!idsNomus.length && !idsShop9.length) return;
      setDetalheAberto({
        idsNomus,
        idsShop9,
        periodo,
        titulo,
        comRateioSimples: opts.comRateioSimples,
        rateioEmpresasRegras: opts.rateioEmpresasRegras,
        rateioEmpresaRecorte: opts.rateioEmpresaRecorte,
        rateioPercentuaisPlanoContas: opts.rateioPercentuaisPlanoContas,
        valorEsperadoGrade: opts.valorEsperadoGrade,
        buscaTodasEmpresas: opts.buscaTodasEmpresas,
      });
    },
    [shop9IdSet, shop9OrdensCatalogoPorPathKey],
  );

  const abrirDetalheReceita = useCallback(
    (
      node: DreEstruturaNo,
      periodo: string | undefined,
      titulo: string,
      valorGrade: number,
    ) => {
      const ctx = contextoDetalheReceitaVendas(node);
      if (!ctx || !receitaNomusCarregada) return;
      setDetalheReceita({ contexto: ctx, periodo, titulo, valorGrade });
    },
    [receitaNomusCarregada],
  );

  const abrirDetalheDevolucao = useCallback(
    (
      node: DreEstruturaNo,
      periodo: string | undefined,
      titulo: string,
      valorGrade: number,
    ) => {
      const idEmpresa = empresaDevolucaoNomus(node);
      if (idEmpresa == null) return;
      setDetalheDevolucao({ idEmpresa, periodo, titulo, valorGrade });
    },
    [],
  );

  const resolverIdsDetalhe = useCallback(
    (node: DreEstruturaNo): number[] => {
      const mapped = coletarIdsContaParaNo(node, idsSaidasPorPathKey);
      if (mapped.length > 0) return mapped;
      if (node.codigo === CODIGO_SIMPLES_NACIONAL) {
        const pkPai = encontrarPathKeyPorCodigo(roots, CODIGO_SIMPLES_NACIONAL);
        if (pkPai) {
          const idsPai = idsSaidasPorPathKey.get(pkPai) ?? [];
          if (idsPai.length) return idsPai;
        }
      }
      if (ehContaRateioFilha(node.codigo, rateioConfig, roots)) {
        const pkPai = pathKeyPaiRateioFilha(node.codigo, rateioConfig, roots);
        if (pkPai) {
          const idsPai = idsSaidasPorPathKey.get(pkPai) ?? [];
          if (idsPai.length) return idsPai;
        }
      }
      const legacy = idsPorPathKey.get(node.pathKey) ?? (node.id != null && node.id > 0 ? [node.id] : []);
      return legacy;
    },
    [idsPorPathKey, idsSaidasPorPathKey, roots, rateioConfig],
  );

  return (
    <div
      className={`card-panel overflow-hidden ${
        telaCheia ? 'flex flex-col min-h-0 flex-1 h-full' : ''
      }`}
    >
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-black dark:text-black">Estrutura DRE</h3>
          <p className="text-xs text-black/70 dark:text-black/70 mt-0.5">
            Plano de contas do resultado.
            {receitaNomusCarregada || Object.keys(idsPorPathKeySaidas).length > 0 ? (
              <span className="ml-1">· clique nos valores para ver o detalhe</span>
            ) : null}
            {temPivot ? (
              <span className="ml-1">· AV e AH após cada período (AH vs. mês anterior)</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {loading ? (
            <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">Carregando…</span>
          ) : null}
          {onMostrarFiltros ? (
            <button
              type="button"
              onClick={onMostrarFiltros}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition"
            >
              Filtros
            </button>
          ) : null}
          {onSairTelaCheia ? (
            <button
              type="button"
              onClick={onSairTelaCheia}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition"
            >
              Sair da tela cheia
            </button>
          ) : null}
          <button
            type="button"
            onClick={expandirTudo}
            disabled={filtroAtivo}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition disabled:opacity-45"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={recolherTudo}
            disabled={filtroAtivo}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition disabled:opacity-45"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border-b border-amber-200 dark:border-amber-800/50">
          {error}
        </div>
      ) : null}

      {detalheAberto ? (
        <DfcDetalheLancamentosModal
          onClose={() => setDetalheAberto(null)}
          ids={detalheAberto.idsNomus}
          idsShop9={detalheAberto.idsShop9}
          periodo={detalheAberto.periodo}
          titulo={detalheAberto.titulo}
          dataInicio={dataInicio}
          dataFim={dataFim}
          granularidade={granularidade}
          idEmpresas={idEmpresas}
          idEmpresasBusca={detalheAberto.buscaTodasEmpresas ? DFC_EMPRESAS_TODAS : undefined}
          rateioSimplesPorPeriodo={
            detalheAberto.comRateioSimples ? rateioSimplesPorPeriodo : undefined
          }
          idEmpresasRateioSimples={
            detalheAberto.comRateioSimples ? idEmpresas : undefined
          }
          rateioEmpresasRegras={detalheAberto.rateioEmpresasRegras}
          rateioEmpresaRecorte={detalheAberto.rateioEmpresaRecorte}
          rateioPercentuaisPlanoContas={detalheAberto.rateioPercentuaisPlanoContas}
          valorEsperadoGrade={detalheAberto.valorEsperadoGrade}
          rotuloColunaDataBaixa="Data Competência"
          filtroPorCompetencia
        />
      ) : null}

      {detalheReceita ? (
        <DreReceitaVendasDetalheModal
          onClose={() => setDetalheReceita(null)}
          titulo={detalheReceita.titulo}
          contexto={detalheReceita.contexto}
          periodo={detalheReceita.periodo}
          dataInicio={dataInicio}
          dataFim={dataFim}
          granularidade={granularidade}
          idEmpresaSaida={idEmpresaSaida}
          valorEsperadoGrade={detalheReceita.valorGrade}
        />
      ) : null}

      {detalheDevolucao ? (
        <DreDevolucoesDetalheModal
          onClose={() => setDetalheDevolucao(null)}
          titulo={detalheDevolucao.titulo}
          idEmpresa={detalheDevolucao.idEmpresa}
          periodo={detalheDevolucao.periodo}
          dataInicio={dataInicio}
          dataFim={dataFim}
          granularidade={granularidade}
          valorEsperadoGrade={detalheDevolucao.valorGrade}
        />
      ) : null}

      <div
        className={
          telaCheia
            ? 'flex-1 min-h-0 overflow-x-auto overflow-y-auto'
            : 'overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto'
        }
      >
        <table
          className="text-sm border-collapse"
          style={{
            minWidth: temPivot
              ? STICKY_TOTAL_W + periodos.length * COLS_POR_PERIODO + larguraColunasFim
              : STICKY_TOTAL_W + larguraColunasFim,
          }}
        >
          <thead className="sticky top-0 z-30">
            <tr className="table-head-brand text-left border-b-2 border-accent-500/40">
              <th
                className="py-2.5 px-2 sticky z-30 border-r border-white/20 bg-soaco-navy text-white"
                style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
                aria-label="Expandir"
              />
              <th
                className="py-2.5 px-3 text-xs font-semibold text-white uppercase tracking-wide sticky z-30 border-r border-white/20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] bg-soaco-navy"
                style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
              >
                Conta
              </th>
              {temPivot
                ? periodos.map((p) => (
                    <Fragment key={p}>
                      <th
                        className="py-2.5 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right whitespace-nowrap border-l border-slate-200 dark:border-slate-600"
                        style={{ minWidth: COL_W_VALOR }}
                      >
                        {rotuloPeriodoCabecalho(p, granularidade)}
                      </th>
                      <th className={TH_AV} style={{ minWidth: COL_W_AV }} title="Análise vertical (% sobre Receita Bruta do período)">
                        AV
                      </th>
                      <th className={TH_AH} style={{ minWidth: COL_W_AH }} title="Análise horizontal (% vs. período anterior)">
                        AH
                      </th>
                    </Fragment>
                  ))
                : null}
              {temPivot && stickyRightPorKey.has('total') ? (
                <th
                  className={`py-2.5 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap bg-slate-200/80 dark:bg-slate-600/70 ${TH_STICKY_DIREITA}`}
                  style={{
                    minWidth: COL_W_TOTAL,
                    right: stickyRightPorKey.get('total')!.right,
                  }}
                >
                  Total
                </th>
              ) : null}
              {temPivot && stickyRightPorKey.has('totalAv') ? (
                <th
                  className={`${TH_AV} ${TH_STICKY_DIREITA}`}
                  style={{
                    minWidth: COL_W_AV,
                    right: stickyRightPorKey.get('totalAv')!.right,
                  }}
                  title="Análise vertical do total (% sobre Receita Bruta do período)"
                >
                  AV
                </th>
              ) : null}
              {temPivot && stickyRightPorKey.has('media') ? (
                <th
                  className={`py-2.5 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap bg-slate-200/80 dark:bg-slate-600/70 ${TH_STICKY_DIREITA}`}
                  style={{
                    minWidth: COL_W_MEDIA,
                    right: stickyRightPorKey.get('media')!.right,
                  }}
                  title="Média mensal do período selecionado"
                >
                  Média
                </th>
              ) : null}
              {temPivot && stickyRightPorKey.has('mediaAv') ? (
                <th
                  className={`${TH_AV} ${TH_STICKY_DIREITA}`}
                  style={{
                    minWidth: COL_W_AV,
                    right: stickyRightPorKey.get('mediaAv')!.right,
                  }}
                  title="Análise vertical da média mensal (% sobre Receita Bruta média)"
                >
                  AV
                </th>
              ) : null}
              {mkpAtivo && stickyRightPorKey.has('mkp') ? (
                <th
                  className={`py-2.5 px-2 text-xs font-semibold text-white text-right whitespace-nowrap bg-primary-600 ${TH_STICKY_DIREITA}`}
                  style={{
                    minWidth: COL_W_MKP,
                    right: stickyRightPorKey.get('mkp')!.right,
                  }}
                >
                  MKP
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && filtroAtivo ? (
              <tr>
                <td
                  colSpan={
                    temPivot
                      ? 2 + periodos.length * 3 + colunasFim.length
                      : 2
                  }
                  className="py-8 px-4 text-center text-sm text-slate-500"
                >
                  Nenhuma conta encontrada.
                </td>
              </tr>
            ) : null}
            {visiveis.map(({ node, depth }, rowIdx) => {
              const pad = depth * 16;
              const temFilhos = (node.children?.length ?? 0) > 0;
              const aberto = filtroAtivo && temFilhos ? true : expanded.has(node.pathKey);
              const ids = resolverIdsDetalhe(node);
              const bg = corFundoLinha(node, rowIdx);
              const stickyBg = stickyBgLinha(node, rowIdx);
              const isTotal = node.tipo === 'T';
              const isSynth = node.tipo === 'S';
              const somasNo = somasPorPathKey.get(node.pathKey);
              const totalGeral = periodos.reduce((s, p) => s + (somasNo?.[p] ?? 0), 0);
              const avTotal = calcularAnaliseVertical(totalGeral, receitaBrutaTotal);
              const mediaMensal = nMesesPeriodo > 0 ? totalGeral / nMesesPeriodo : 0;
              const receitaBrutaMedia = nMesesPeriodo > 0 ? receitaBrutaTotal / nMesesPeriodo : 0;
              const avMedia = calcularAnaliseVertical(mediaMensal, receitaBrutaMedia);
              const ctxReceita = contextoDetalheReceitaVendas(node);
              const provisaoCalculada = isProvisaoCalculadaDre(node.codigo);
              const podeDetalheReceita = receitaNomusCarregada && ctxReceita != null && !isTotal;
              const podeDetalhePlano = ids.length > 0 && !isTotal && noPermiteDetalheSaidas(node);
              const podeDetalheDevolucao =
                empresaDevolucaoNomus(node) != null && devolucoesLinhas.length > 0 && !isTotal;
              const detalheComRateioSimples = node.codigo === CODIGO_SIMPLES_NACIONAL;
              const ctxRateioDetalhe = resolverContextoRateioDetalhe(node, rateioConfig, roots);
              const regrasFf = regrasRateioParaConta(rateioConfig, node.pathKey);
              const temRateioFornecedor = regrasFf.some(
                (r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0,
              );
              const optsDetalhePlano = (valorGrade?: number): DetalheRateioOpts => ({
                comRateioSimples: detalheComRateioSimples,
                ...ctxRateioDetalhe,
                rateioEmpresasRegras: regrasFf.length > 0 ? regrasFf : undefined,
                buscaTodasEmpresas:
                  Boolean(ctxRateioDetalhe.rateioPercentuaisPlanoContas) || temRateioFornecedor,
                pathKeysConta: coletarPathKeysSaidasParaNo(node),
                valorEsperadoGrade: valorGrade,
              });
              const mkpPct = mkpAtivo ? variacaoMkpPorGrupo(node.nome) : null;
              const exibirMkpPct = mkpPct != null && node.codigo.startsWith('1.3.');

              return (
                <tr key={node.pathKey} className={`relative isolate border-t border-slate-100 dark:border-slate-700/50 ${bg}`}>
                  <td
                    className={`py-2 px-1 align-middle sticky z-[25] border-r border-slate-200 dark:border-slate-600 ${stickyBg}`}
                    style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
                  >
                    {temFilhos ? (
                      <button
                        type="button"
                        disabled={filtroAtivo}
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/80 transition disabled:opacity-40"
                        aria-expanded={aberto}
                        onClick={() => setExpanded((prev) => alternarExpansao(prev, node.pathKey))}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform ${aberto ? 'rotate-90' : ''}`}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span className="block h-8 w-8" aria-hidden />
                    )}
                  </td>
                  <td
                    className={`py-2 px-2 align-middle sticky z-[25] border-r border-slate-300 dark:border-slate-500 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] ${stickyBg}`}
                    style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 overflow-hidden" style={{ paddingLeft: pad }}>
                      <span
                        className={`text-sm leading-snug text-black dark:text-black ${
                          isTotal ? 'font-bold' : isSynth ? 'font-semibold' : ''
                        }`}
                      >
                        {node.codigo ? (
                          <span className="text-black/70 dark:text-black/70 font-mono text-xs mr-1.5">{node.codigo}</span>
                        ) : null}
                        {node.nome}
                      </span>
                      {provisaoCalculada ? (
                        <span
                          className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                          title="Valor calculado sobre a linha de salários da folha"
                        >
                          Calc.
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {temPivot
                    ? periodos.map((p, idxPeriodo) => {
                        const v = somasNo?.[p] ?? 0;
                        const rbPeriodo = receitaBrutaPorPeriodo[p] ?? 0;
                        const valorAnterior =
                          idxPeriodo > 0 ? (somasNo?.[periodos[idxPeriodo - 1]!] ?? 0) : null;
                        const av = calcularAnaliseVertical(v, rbPeriodo);
                        const ah =
                          valorAnterior != null
                            ? calcularAnaliseHorizontal(v, valorAnterior)
                            : null;
                        const cor =
                          v < 0 ? 'text-red-700 dark:text-red-700' : v > 0 ? 'text-black dark:text-black' : 'text-black/40 dark:text-black/40';
                        const tituloCel = `${node.nome} · ${rotuloPeriodoCabecalho(p, granularidade)}`;
                        const clicavelReceita = podeDetalheReceita;
                        const clicavelPlano = podeDetalhePlano;
                        const clicavelDevolucao = podeDetalheDevolucao;
                        const clicavel = clicavelReceita || clicavelPlano || clicavelDevolucao;
                        return (
                          <Fragment key={p}>
                            <td
                              className={`py-2 px-2 text-right tabular-nums text-sm border-l border-slate-100 dark:border-slate-700/50 ${cor} ${isTotal ? 'font-bold' : ''} ${
                                clicavel ? 'cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-600/50 underline decoration-dotted decoration-black/30' : ''
                              }`}
                              style={{ minWidth: COL_W_VALOR }}
                              title={
                                clicavelReceita
                                  ? `${rotuloPeriodoCabecalho(p, granularidade)} — clique para detalhe Nomus`
                                  : clicavelDevolucao
                                    ? `${rotuloPeriodoCabecalho(p, granularidade)} — clique para detalhe das devoluções`
                                    : clicavelPlano
                                      ? `${rotuloPeriodoCabecalho(p, granularidade)} — clique para ver lançamentos`
                                      : rotuloPeriodoCabecalho(p, granularidade)
                              }
                              onClick={
                                clicavelReceita
                                  ? () => abrirDetalheReceita(node, p, tituloCel, v)
                                  : clicavelDevolucao
                                    ? () => abrirDetalheDevolucao(node, p, tituloCel, v)
                                    : clicavelPlano
                                      ? () => abrirDetalhe(ids, p, tituloCel, optsDetalhePlano(v))
                                      : undefined
                              }
                              onKeyDown={
                                clicavel
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        if (clicavelReceita) abrirDetalheReceita(node, p, tituloCel, v);
                                        else if (clicavelDevolucao) abrirDetalheDevolucao(node, p, tituloCel, v);
                                        else abrirDetalhe(ids, p, tituloCel, optsDetalhePlano(v));
                                      }
                                    }
                                  : undefined
                              }
                              role={clicavel ? 'button' : undefined}
                              tabIndex={clicavel ? 0 : undefined}
                            >
                              {v === 0 ? '—' : nf.format(v)}
                            </td>
                            <td className={`${TD_AV} ${isTotal ? 'font-bold' : ''}`} style={{ minWidth: COL_W_AV }}>
                              {formatarAnalisePct(av)}
                            </td>
                            <td
                              className={`${TD_AH} ${isTotal ? 'font-bold' : ''} ${corAnaliseHorizontal(ah)}`}
                              style={{ minWidth: COL_W_AH }}
                            >
                              {formatarAnalisePct(ah)}
                            </td>
                          </Fragment>
                        );
                      })
                    : null}
                  {temPivot && stickyRightPorKey.has('total') ? (
                    <td
                      className={`py-2 px-2 text-right tabular-nums text-sm font-semibold bg-slate-100/95 dark:bg-slate-700/95 ${TD_STICKY_DIREITA} ${
                        totalGeral < 0 ? 'text-red-700 dark:text-red-700' : totalGeral > 0 ? 'text-black dark:text-black' : 'text-black/40 dark:text-black/40'
                      } ${isTotal ? 'font-bold' : ''} ${
                        podeDetalheReceita || podeDetalhePlano || podeDetalheDevolucao
                          ? 'cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-600/50 underline decoration-dotted decoration-black/30'
                          : ''
                      }`}
                      style={{
                        minWidth: COL_W_TOTAL,
                        right: stickyRightPorKey.get('total')!.right,
                      }}
                      title={
                        podeDetalheReceita
                          ? 'Total do período — clique para detalhe Nomus'
                          : podeDetalheDevolucao
                            ? 'Total do período — clique para detalhe das devoluções'
                            : podeDetalhePlano
                              ? 'Total do período — clique para ver lançamentos'
                              : undefined
                      }
                      onClick={
                        podeDetalheReceita
                          ? () =>
                              abrirDetalheReceita(
                                node,
                                undefined,
                                `Total · ${node.nome} · ${dataInicio} → ${dataFim}`,
                                totalGeral,
                              )
                          : podeDetalheDevolucao
                            ? () =>
                                abrirDetalheDevolucao(
                                  node,
                                  undefined,
                                  `Total · ${node.nome} · ${dataInicio} → ${dataFim}`,
                                  totalGeral,
                                )
                            : podeDetalhePlano
                              ? () => abrirDetalhe(ids, undefined, `Total · ${node.nome}`, optsDetalhePlano(totalGeral))
                              : undefined
                      }
                      onKeyDown={
                        podeDetalheReceita || podeDetalhePlano || podeDetalheDevolucao
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (podeDetalheReceita) {
                                  abrirDetalheReceita(
                                    node,
                                    undefined,
                                    `Total · ${node.nome} · ${dataInicio} → ${dataFim}`,
                                    totalGeral,
                                  );
                                } else if (podeDetalheDevolucao) {
                                  abrirDetalheDevolucao(
                                    node,
                                    undefined,
                                    `Total · ${node.nome} · ${dataInicio} → ${dataFim}`,
                                    totalGeral,
                                  );
                                } else {
                                  abrirDetalhe(ids, undefined, `Total · ${node.nome}`, optsDetalhePlano(totalGeral));
                                }
                              }
                            }
                          : undefined
                      }
                      role={podeDetalheReceita || podeDetalhePlano || podeDetalheDevolucao ? 'button' : undefined}
                      tabIndex={podeDetalheReceita || podeDetalhePlano || podeDetalheDevolucao ? 0 : undefined}
                    >
                      {totalGeral === 0 ? '—' : nf.format(totalGeral)}
                    </td>
                  ) : null}
                  {temPivot && stickyRightPorKey.has('totalAv') ? (
                    <td
                      className={`${TD_AV} ${TD_STICKY_DIREITA} ${isTotal ? 'font-bold' : ''}`}
                      style={{
                        minWidth: COL_W_AV,
                        right: stickyRightPorKey.get('totalAv')!.right,
                      }}
                      title="Análise vertical do total (% sobre Receita Bruta do período)"
                    >
                      {formatarAnalisePct(avTotal)}
                    </td>
                  ) : null}
                  {temPivot && stickyRightPorKey.has('media') ? (
                    <td
                      className={`py-2 px-2 text-right tabular-nums text-sm font-semibold bg-slate-100/95 dark:bg-slate-700/95 ${TD_STICKY_DIREITA} ${
                        mediaMensal < 0
                          ? 'text-red-700 dark:text-red-700'
                          : mediaMensal > 0
                            ? 'text-black dark:text-black'
                            : 'text-black/40 dark:text-black/40'
                      } ${isTotal ? 'font-bold' : ''}`}
                      style={{
                        minWidth: COL_W_MEDIA,
                        right: stickyRightPorKey.get('media')!.right,
                      }}
                      title={
                        nMesesPeriodo > 0
                          ? `Média mensal (${nMesesPeriodo} ${nMesesPeriodo === 1 ? 'mês' : 'meses'})`
                          : 'Média mensal do período'
                      }
                    >
                      {mediaMensal === 0 ? '—' : nf.format(mediaMensal)}
                    </td>
                  ) : null}
                  {temPivot && stickyRightPorKey.has('mediaAv') ? (
                    <td
                      className={`${TD_AV} ${TD_STICKY_DIREITA} ${isTotal ? 'font-bold' : ''}`}
                      style={{
                        minWidth: COL_W_AV,
                        right: stickyRightPorKey.get('mediaAv')!.right,
                      }}
                      title="Análise vertical da média mensal (% sobre Receita Bruta média)"
                    >
                      {formatarAnalisePct(avMedia)}
                    </td>
                  ) : null}
                  {mkpAtivo && stickyRightPorKey.has('mkp') ? (
                    <td
                      className={`py-2 px-2 text-right tabular-nums text-xs bg-primary-600/95 text-white ${TD_STICKY_DIREITA} ${
                        exibirMkpPct ? 'font-medium' : 'text-white/70'
                      }`}
                      style={{
                        minWidth: COL_W_MKP,
                        right: stickyRightPorKey.get('mkp')!.right,
                      }}
                    >
                      {exibirMkpPct ? formatarVariacaoMkp(mkpPct) : '—'}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
