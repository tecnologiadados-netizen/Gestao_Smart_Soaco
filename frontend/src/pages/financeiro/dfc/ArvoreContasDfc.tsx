import { useCallback, useEffect, useMemo, useState } from 'react';
import estruturaJson from './estruturaDfcArvore.json';
import { rotuloPeriodoCabecalho } from './dfcPeriodos';
import { EMPRESA_LABELS } from './dfcEmpresas';
import type { DfcSaldoBancarioContaGrade } from '../../../api/financeiro';
import {
  DFC_NOME_GERACAO_CAIXA,
  calcularCruzamentosFluxo,
  montarMapaIdsPorPathKey,
  montarRootsParaExibicao,
  somasGeracaoDeCaixaPorPeriodo,
  type CruzamentoFluxo,
} from './dfcCruzamentoFluxo';
import DfcDetalheLancamentosModal from './DfcDetalheLancamentosModal';
import {
  DFC_PRIORIDADE_CHIP,
  DFC_PRIORIDADE_LABEL_CURTO,
  type DfcPrioridade,
} from '../../../api/dfcPrioridade';
import { criarMatcherTextoLivre } from '../../../utils/textoLivreBusca';

export type DfcEstruturaNo = {
  pathKey: string;
  id: number | null;
  nome: string;
  tipo: string;
  macro: string;
  codigo: string;
  children: DfcEstruturaNo[];
};

export type ArvoreContasDfcProps = {
  periodos: string[];
  valoresPorConta: Record<number, Record<string, number>>;
  granularidade: 'dia' | 'mes';
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
  /** Contas bancárias Nomus selecionadas na faixa de filtros (vazio = todas). */
  contasBancariasSelecionadas?: string[];
  loading?: boolean;
  error?: string | null;
  /** Quando true, a grade usa a altura disponível (ex.: modo tela inteira). */
  telaCheia?: boolean;
  /** Reabre a faixa de filtros (modo tela cheia com filtros ocultos). */
  onMostrarFiltros?: () => void;
  /** Sai do modo tela cheia (exibido no cabeçalho da árvore). */
  onSairTelaCheia?: () => void;
  /** Filtra linhas por nome/código/id (substring, em tempo real). Vazio = sem filtro. */
  filtroPlanoContas?: string;
  /** Quando informado, mostra só ramos com id de conta analítica na lista (vazio = todas). */
  idsPlanoContasFiltro?: number[];
  /** Prioridades ativas como filtro da DFC (passadas adiante ao modal de detalhe). */
  prioridadesSelecionadas?: DfcPrioridade[];
  /** Mapa "idEmpresa#idContaFinanceiro" → prioridade (para selos visuais). */
  prioridadesContasMap?: Record<string, DfcPrioridade>;
  /** Mapa "idEmpresa#tipoRef#idRef" → prioridade (para selos no modal de detalhe). */
  prioridadesLancsMap?: Record<string, DfcPrioridade>;
  /**
   * Atualização cirúrgica do mapa de prioridade de lançamento (sem recarregar a DFC).
   * Passe `prioridade = null` para indicar remoção.
   */
  onPrioridadeLancAtualizada?: (
    idEmpresa: number,
    tipoRef: 'A' | 'L',
    idRef: number,
    prioridade: DfcPrioridade | null,
  ) => void;
  /** Disparado ao fechar o modal de detalhe (para recarregar a DFC se necessário). */
  onDetalheFechado?: () => void;
  /** Valores da linha «Projeção de Receitas» (saldo a faturar por Data Proj Venc). */
  projecaoReceitasPorPeriodo?: Record<string, number>;
  /** Abre modal com parcelas da projeção (período = coluna clicada; omitir = intervalo inteiro). */
  onAbrirProjecaoDetalhe?: (periodo: string | undefined, titulo: string) => void;
  /** Saldos bancários (LF) agregados por coluna — linha acima do Fluxo Operacional. */
  saldosIniciaisPorPeriodo?: Record<string, number>;
  /** Saldos bancários ao fim do período — linha após Outras movimentações. */
  saldosFinaisPorPeriodo?: Record<string, number>;
  /** Detalhe por conta bancária (expandir iniciais/finais). */
  saldosPorConta?: DfcSaldoBancarioContaGrade[];
  /** Falha ao carregar saldos LF (exibido na grade). */
  erroSaldosBancarios?: string | null;
};

export const DFC_NOME_PROJECAO_RECEITAS = 'Projeção de Receitas';
export const DFC_PROJECAO_RECEITAS_TOOLTIP_SO_ACO =
  'Projeção de Receitas (saldo a faturar Só Aço): incluída ao filtrar todas as empresas ou Só Aço. Fins de semana vão para a terça seguinte.';
export const DFC_NOME_SALDOS_INICIAIS = 'Saldos iniciais das contas bancárias';
export const DFC_NOME_SALDOS_FINAIS = 'Saldos finais';
export const DFC_CHAVE_SALDO_INICIAIS = '__dfc_saldo_iniciais__';
export const DFC_CHAVE_SALDO_FINAIS = '__dfc_saldo_finais__';

/** Larguras e `left` cumulativo das colunas fixas (px). Cód. integrado na coluna Conta. */
const STICKY_COLS = [
  { w: 40, l: 0 },    // chevron
  { w: 260, l: 40 },  // Conta (nome + código prefixado)
  { w: 110, l: 300 }, // Fluxo
] as const;
const STICKY_TOTAL_W = STICKY_COLS.reduce((s, c) => s + c.w, 0);

const MACRO_LABEL: Record<string, string> = {
  OPERACIONAL: 'Operacional',
  FINANCIAMENTOS: 'Financiamentos',
  INVESTIMENTOS: 'Investimentos',
  OUTRAS: 'Outras movimentações',
  GERACAO: 'Geração',
};

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function chipMacro(macro: string): string {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0';
  if (macro === 'OPERACIONAL') return `${base} bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100`;
  if (macro === 'INVESTIMENTOS') return `${base} bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100`;
  if (macro === 'FINANCIAMENTOS') return `${base} bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100`;
  if (macro === 'OUTRAS')
    return `${base} bg-amber-100 text-amber-950 dark:bg-amber-900/35 dark:text-amber-100`;
  if (macro === 'GERACAO')
    return `${base} bg-indigo-100 text-indigo-950 dark:bg-indigo-900/35 dark:text-indigo-100`;
  if (macro === 'SALDO')
    return `${base} bg-cyan-100 text-cyan-950 dark:bg-cyan-900/35 dark:text-cyan-100`;
  return `${base} bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100`;
}

function celulaValorSaldo(
  periodo: string,
  v: number,
  bg: string,
  titulo: string,
): JSX.Element {
  const corValor =
    v < 0
      ? 'text-red-600 dark:text-red-400 font-semibold'
      : v === 0
        ? 'text-slate-300 dark:text-slate-600'
        : 'text-slate-800 dark:text-slate-100 font-semibold';
  return (
    <td
      key={periodo}
      className={`py-2 px-2 text-right tabular-nums text-sm ${corValor} ${bg}`}
      title={titulo}
    >
      {v === 0 ? <span className="text-slate-300 dark:text-slate-600">—</span> : nf.format(v)}
    </td>
  );
}

function BlocoSaldoBancarioExpandivel({
  chaveExpansao,
  nomeGrupo,
  valoresTotais,
  contas,
  tipo,
  periodos,
  granularidade,
  rowIdxBase,
  aberto,
  onToggle,
  mostrarEmpresa,
  filtroAtivo,
}: {
  chaveExpansao: string;
  nomeGrupo: string;
  valoresTotais: Record<string, number>;
  contas: DfcSaldoBancarioContaGrade[];
  tipo: 'inicial' | 'final';
  periodos: string[];
  granularidade: 'dia' | 'mes';
  rowIdxBase: number;
  aberto: boolean;
  onToggle: (chave: string) => void;
  mostrarEmpresa: boolean;
  filtroAtivo: boolean;
}): JSX.Element {
  const temFilhos = contas.length > 0;
  const bgPai = rowIdxBase % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-800';
  const pRefTotal = tipo === 'final' ? periodos[periodos.length - 1] : periodos[0];
  const total = pRefTotal != null ? (valoresTotais[pRefTotal] ?? 0) : 0;

  return (
    <>
      <tr className={`border-t border-slate-300 dark:border-slate-600 ${bgPai}`}>
        <td
          className={`py-2 px-1 align-middle sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bgPai}`}
          style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
        >
          {temFilhos ? (
            <button
              type="button"
              disabled={filtroAtivo}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 transition disabled:opacity-40 disabled:pointer-events-none"
              aria-expanded={aberto}
              aria-label={aberto ? 'Recolher contas' : 'Expandir contas'}
              onClick={() => onToggle(chaveExpansao)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${aberto ? 'rotate-90' : ''}`}
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : (
            <span className="block h-8 w-8" aria-hidden />
          )}
        </td>
        <td
          className={`py-2 px-2 align-middle sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bgPai}`}
          style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
        >
          <span className="inline-flex items-baseline gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-snug">
            {nomeGrupo}
          </span>
        </td>
        <td
          className={`py-2 px-2 align-middle sticky z-20 border-r border-slate-300 dark:border-slate-500 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] ${bgPai}`}
          style={{ left: STICKY_COLS[2].l, width: STICKY_COLS[2].w, minWidth: STICKY_COLS[2].w }}
        >
          <span className={chipMacro('SALDO')}>Saldo bancário</span>
        </td>
        {periodos.map((p) =>
          celulaValorSaldo(
            p,
            valoresTotais[p] ?? 0,
            bgPai,
            `${nomeGrupo} · ${rotuloPeriodoCabecalho(p, granularidade)}`,
          ),
        )}
        <td
          className={`py-2 px-2 text-right tabular-nums text-sm font-semibold border-l border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/80 ${
            total < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {total === 0 ? <span className="text-slate-300 dark:text-slate-600">—</span> : nf.format(total)}
        </td>
      </tr>
      {aberto
        ? contas.map((c) => {
            const vals =
              tipo === 'inicial' ? c.saldosIniciaisPorPeriodo : c.saldosFinaisPorPeriodo;
            const bg = 'bg-slate-50 dark:bg-slate-900';
            const pRef = tipo === 'final' ? periodos[periodos.length - 1] : periodos[0];
            const totalConta = pRef != null ? (vals[pRef] ?? 0) : 0;
            const empLabel = EMPRESA_LABELS[c.idEmpresa] ?? `Empresa ${c.idEmpresa}`;
            return (
              <tr
                key={`${chaveExpansao}-${c.idContaBancaria}`}
                className={`border-t border-slate-100 dark:border-slate-700/50 ${bg}`}
              >
                <td
                  className={`py-2 px-1 sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bg}`}
                  style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
                >
                  <span className="block h-8 w-8" aria-hidden />
                </td>
                <td
                  className={`py-2 px-2 sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bg}`}
                  style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
                >
                  <span
                    className="text-sm text-slate-700 dark:text-slate-300 leading-snug block"
                    style={{ paddingLeft: 20 }}
                    title={mostrarEmpresa ? empLabel : c.nomeContaBancaria}
                  >
                    {c.nomeContaBancaria}
                    {mostrarEmpresa ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                        ({empLabel})
                      </span>
                    ) : null}
                  </span>
                </td>
                <td
                  className={`py-2 px-2 sticky z-20 border-r border-slate-300 dark:border-slate-500 ${bg}`}
                  style={{ left: STICKY_COLS[2].l, width: STICKY_COLS[2].w, minWidth: STICKY_COLS[2].w }}
                />
                {periodos.map((p) =>
                  celulaValorSaldo(
                    p,
                    vals[p] ?? 0,
                    bg,
                    `${c.nomeContaBancaria} · ${rotuloPeriodoCabecalho(p, granularidade)}`,
                  ),
                )}
                <td
                  className={`py-2 px-2 text-right tabular-nums text-sm border-l border-slate-200 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-700/50 ${
                    totalConta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {totalConta === 0 ? (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  ) : (
                    nf.format(totalConta)
                  )}
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

/** Raízes M0, M1, … e «Geração de Caixa» — fundo neutro, não azul de grupo. */
function isLinhaRaizFluxoDfc(node: DfcEstruturaNo): boolean {
  return node.nome === DFC_NOME_GERACAO_CAIXA || /^M\d+$/.test(node.pathKey);
}

function renderSelosPrioridadeConta(
  idContaFinanceiro: number,
  idEmpresas: number[],
  mapa: Record<string, DfcPrioridade>
): JSX.Element | null {
  const selos: Array<{ idEmpresa: number; prioridade: DfcPrioridade }> = [];
  for (const idEmpresa of idEmpresas) {
    const p = mapa[`${idEmpresa}#${idContaFinanceiro}`];
    if (p != null) selos.push({ idEmpresa, prioridade: p });
  }
  if (selos.length === 0) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
      {selos.map((s) => (
        <span
          key={`${s.idEmpresa}-${s.prioridade}`}
          title={`${EMPRESA_LABELS[s.idEmpresa] ?? `Empresa ${s.idEmpresa}`}: ${DFC_PRIORIDADE_LABEL_CURTO[s.prioridade]}`}
          className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded border px-1 text-[10px] font-bold ${DFC_PRIORIDADE_CHIP[s.prioridade]}`}
        >
          {s.prioridade}
        </span>
      ))}
    </span>
  );
}

function fundoListraNeutra(rowIdx: number): string {
  return rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900';
}

/**
 * Fundo da linha: tons sólidos (sem alpha) para as colunas sticky não misturarem com o scroll.
 * Raízes de fluxo (M0, M1…) = separador; sintéticas = cinza/primary suave; analíticas = branco alternado.
 */
function corFundoLinha(node: DfcEstruturaNo, rowIdx: number): string {
  if (isLinhaRaizFluxoDfc(node)) return 'bg-slate-200 dark:bg-slate-700 font-semibold';
  if (node.tipo === 'S') return 'bg-primary-50 dark:bg-slate-800';
  return rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900';
}

function isDescendantPath(desc: string, ancestor: string): boolean {
  return desc.startsWith(`${ancestor}/`);
}

function alternarExpansao(expanded: Set<string>, pathKey: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(pathKey)) {
    next.delete(pathKey);
    for (const k of [...next]) {
      if (k !== pathKey && isDescendantPath(k, pathKey)) next.delete(k);
    }
  } else {
    next.add(pathKey);
  }
  return next;
}

function coletarChavesComFilhos(nodes: DfcEstruturaNo[]): string[] {
  const out: string[] = [];
  function w(n: DfcEstruturaNo) {
    if (n.children?.length) {
      out.push(n.pathKey);
      n.children.forEach(w);
    }
  }
  nodes.forEach(w);
  return out;
}

/** pathKey de RECEITAS OPERACIONAIS (1.1) para expandir e exibir Projeção de Receitas. */
function pathKeyReceitasOperacionais(roots: DfcEstruturaNo[]): string | null {
  function walk(nodes: DfcEstruturaNo[]): string | null {
    for (const n of nodes) {
      if (n.id === 221 || n.nome === 'RECEITAS OPERACIONAIS') return n.pathKey;
      const hit = walk(n.children ?? []);
      if (hit) return hit;
    }
    return null;
  }
  return walk(roots);
}

function linhasVisiveis(roots: DfcEstruturaNo[], expanded: Set<string>): { node: DfcEstruturaNo; depth: number }[] {
  const out: { node: DfcEstruturaNo; depth: number }[] = [];
  function walk(n: DfcEstruturaNo, depth: number) {
    out.push({ node: n, depth });
    if (n.children?.length && expanded.has(n.pathKey)) {
      for (const c of n.children) walk(c, depth + 1);
    }
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

function linhasFiltradasPorTexto(
  roots: DfcEstruturaNo[],
  queryRaw: string
): { node: DfcEstruturaNo; depth: number }[] {
  const raw = queryRaw.trim();
  if (!raw) return [];
  const match = criarMatcherTextoLivre(raw);

  function noCasa(n: DfcEstruturaNo): boolean {
    if (match(n.nome)) return true;
    if (match(n.codigo || '')) return true;
    if (n.id != null && match(String(n.id))) return true;
    return false;
  }

  function subarvoreTemCasa(n: DfcEstruturaNo): boolean {
    if (noCasa(n)) return true;
    return (n.children ?? []).some(subarvoreTemCasa);
  }

  const out: { node: DfcEstruturaNo; depth: number }[] = [];
  function walk(n: DfcEstruturaNo, depth: number) {
    if (!subarvoreTemCasa(n)) return;
    out.push({ node: n, depth });
    for (const c of n.children ?? []) walk(c, depth + 1);
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

/** Ramos que contêm alguma conta analítica selecionada (ou descendente). */
function linhasFiltradasPorIds(
  roots: DfcEstruturaNo[],
  ids: Set<number>,
): { node: DfcEstruturaNo; depth: number }[] {
  function subarvoreTemId(n: DfcEstruturaNo): boolean {
    if (n.id != null && n.id > 0 && ids.has(n.id)) return true;
    return (n.children ?? []).some(subarvoreTemId);
  }
  const out: { node: DfcEstruturaNo; depth: number }[] = [];
  function walk(n: DfcEstruturaNo, depth: number) {
    if (!subarvoreTemId(n)) return;
    out.push({ node: n, depth });
    for (const c of n.children ?? []) walk(c, depth + 1);
  }
  roots.forEach((r) => walk(r, 0));
  return out;
}

function somaPeriodo(
  ids: number[],
  periodo: string,
  valoresPorConta: Record<number, Record<string, number>>
): number {
  let s = 0;
  for (const id of ids) {
    s += valoresPorConta[id]?.[periodo] ?? 0;
  }
  return s;
}

/** Pré-calcula totais por pathKey × período (folhas → sintéticos por rollup dos filhos). */
function montarSomasPorPathKey(
  roots: DfcEstruturaNo[],
  idsPorPathKey: Map<string, number[]>,
  periodos: string[],
  valoresPorConta: Record<number, Record<string, number>>,
  projecaoReceitasPorPeriodo: Record<string, number>,
  cruzamentosFluxo: CruzamentoFluxo[]
): Map<string, Record<string, number>> {
  const geracaoPorPeriodo = somasGeracaoDeCaixaPorPeriodo(periodos, cruzamentosFluxo);
  const out = new Map<string, Record<string, number>>();
  function visit(n: DfcEstruturaNo) {
    n.children?.forEach(visit);
    const porP: Record<string, number> = {};
    const filhos = n.children ?? [];
    if (n.nome === DFC_NOME_PROJECAO_RECEITAS) {
      for (const p of periodos) {
        porP[p] = projecaoReceitasPorPeriodo[p] ?? 0;
      }
    } else if (n.nome === DFC_NOME_GERACAO_CAIXA) {
      for (const p of periodos) {
        porP[p] = geracaoPorPeriodo[p] ?? 0;
      }
    } else if (filhos.length > 0) {
      for (const p of periodos) {
        porP[p] = filhos.reduce((s, ch) => s + (out.get(ch.pathKey)?.[p] ?? 0), 0);
      }
    } else {
      const ids = idsPorPathKey.get(n.pathKey) ?? [];
      for (const p of periodos) {
        porP[p] = somaPeriodo(ids, p, valoresPorConta);
      }
    }
    out.set(n.pathKey, porP);
  }
  roots.forEach(visit);
  return out;
}

function cruzamentoDoNo(node: DfcEstruturaNo, lista: CruzamentoFluxo[]): CruzamentoFluxo | null {
  for (const c of lista) {
    if (
      node.pathKey === c.raizPathKey ||
      node.pathKey === c.pathKeyEntradas ||
      node.pathKey === c.pathKeySaidas
    ) {
      return c;
    }
  }
  return null;
}

type DetalheLancamentosState = {
  ids: number[];
  periodo: string | undefined;
  titulo: string;
} | null;

export default function ArvoreContasDfc({
  periodos,
  valoresPorConta,
  granularidade,
  dataInicio,
  dataFim,
  idEmpresas = [1],
  contasBancariasSelecionadas = [],
  loading = false,
  error = null,
  telaCheia = false,
  onMostrarFiltros,
  onSairTelaCheia,
  filtroPlanoContas = '',
  idsPlanoContasFiltro = [],
  prioridadesSelecionadas = [],
  prioridadesContasMap = {},
  prioridadesLancsMap = {},
  onPrioridadeLancAtualizada,
  onDetalheFechado,
  projecaoReceitasPorPeriodo = {},
  onAbrirProjecaoDetalhe,
  saldosIniciaisPorPeriodo = {},
  saldosFinaisPorPeriodo = {},
  saldosPorConta = [],
  erroSaldosBancarios = null,
}: ArvoreContasDfcProps) {
  const rootsRaw = useMemo(
    () => (estruturaJson as unknown as { roots: DfcEstruturaNo[] }).roots,
    []
  );
  const roots = useMemo(() => montarRootsParaExibicao(rootsRaw), [rootsRaw]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [detalheAberto, setDetalheAberto] = useState<DetalheLancamentosState>(null);

  /** Exibe 1.1.3 Projeção de Receitas sem precisar expandir manualmente RECEITAS OPERACIONAIS. */
  useEffect(() => {
    if (periodos.length === 0) return;
    const pkRec = pathKeyReceitasOperacionais(roots);
    const op = roots.find((r) => r.macro === 'OPERACIONAL');
    const pkEntradas = op?.children?.find(
      (c) => c.nome === 'Entradas operacionais' || c.nome === 'Entradas',
    )?.pathKey;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (pkEntradas) next.add(pkEntradas);
      if (pkRec) next.add(pkRec);
      return next;
    });
  }, [roots, periodos.length]);

  const abrirDetalhe = useCallback((rawIds: number[], periodo: string | undefined, titulo: string) => {
    const uniq = [...new Set(rawIds.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    if (!uniq.length) return;
    setDetalheAberto({ ids: uniq, periodo, titulo });
  }, []);

  const fecharDetalhe = useCallback(() => {
    setDetalheAberto(null);
    onDetalheFechado?.();
  }, [onDetalheFechado]);

  const todasChavesComFilhos = useMemo(() => coletarChavesComFilhos(roots), [roots]);
  const idsPorPathKey = useMemo(() => montarMapaIdsPorPathKey(roots), [roots]);

  const cruzamentosFluxo = useMemo(
    () =>
      calcularCruzamentosFluxo({
        periodos,
        valoresPorConta,
        projecaoReceitasPorPeriodo,
      }),
    [periodos, valoresPorConta, projecaoReceitasPorPeriodo]
  );

  const somasPorPathKey = useMemo(
    () =>
      montarSomasPorPathKey(
        roots,
        idsPorPathKey,
        periodos,
        valoresPorConta,
        projecaoReceitasPorPeriodo,
        cruzamentosFluxo
      ),
    [roots, idsPorPathKey, periodos, valoresPorConta, projecaoReceitasPorPeriodo, cruzamentosFluxo]
  );

  const mostrarEmpresaSaldo = idEmpresas.length !== 1;

  const expandirTudo = useCallback(() => {
    const s = new Set(todasChavesComFilhos);
    if (saldosPorConta.length > 0) {
      s.add(DFC_CHAVE_SALDO_INICIAIS);
      s.add(DFC_CHAVE_SALDO_FINAIS);
    }
    setExpanded(s);
  }, [todasChavesComFilhos, saldosPorConta.length]);

  const recolherTudo = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const alternarSaldo = useCallback((chave: string) => {
    setExpanded((prev) => alternarExpansao(prev, chave));
  }, []);

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

  const temPivot = periodos.length > 0;

  return (
    <div
      className={`card-panel overflow-hidden ${
        telaCheia ? 'flex flex-col min-h-0 flex-1 h-full' : ''
      }`}
    >
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Estrutura DFC</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Intervalo do filtro por <span className="font-medium">data do lançamento</span> no Nomus (P e receitas R/LR:
            pagamento/recebimento em LF; LP: <span className="font-medium">dataLancamento</span>), bucket diário{' '}
            <span className="font-medium">YYYY-MM-DD</span> vindo do SQL. Regenerar árvore:{' '}
            <code className="text-[10px]">npm run build:dfc-estrutura</code>.
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
            title={filtroAtivo ? 'Indisponível enquanto o filtro do plano estiver ativo' : undefined}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={recolherTudo}
            disabled={filtroAtivo}
            title={filtroAtivo ? 'Indisponível enquanto o filtro do plano estiver ativo' : undefined}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition disabled:opacity-45 disabled:cursor-not-allowed"
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
      {erroSaldosBancarios ? (
        <div className="shrink-0 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border-b border-amber-200 dark:border-amber-800/50">
          Saldos bancários: {erroSaldosBancarios}
        </div>
      ) : null}
      {detalheAberto != null ? (
        <DfcDetalheLancamentosModal
          onClose={fecharDetalhe}
          ids={detalheAberto.ids}
          periodo={detalheAberto.periodo}
          titulo={detalheAberto.titulo}
          dataInicio={dataInicio}
          dataFim={dataFim}
          granularidade={granularidade}
          idEmpresas={idEmpresas}
          contasBancariasSelecionadas={contasBancariasSelecionadas}
          prioridadesSelecionadas={prioridadesSelecionadas}
          prioridadesContasMap={prioridadesContasMap}
          prioridadesLancsMap={prioridadesLancsMap}
          onPrioridadeLancAtualizada={onPrioridadeLancAtualizada}
        />
      ) : null}

      <div
        className={
          telaCheia
            ? 'flex-1 min-h-0 overflow-x-auto overflow-y-auto'
            : 'overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto'
        }
      >
        <table className="text-sm border-collapse" style={{ minWidth: temPivot ? STICKY_TOTAL_W + periodos.length * 96 + 120 : STICKY_TOTAL_W }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-slate-100 dark:bg-slate-700 text-left border-b-2 border-slate-200 dark:border-slate-600">
              <th
                className="py-2.5 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 sticky z-30 border-r border-slate-200 dark:border-slate-600 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] bg-slate-100 dark:bg-slate-700"
                style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
                aria-label="Expandir"
              />
              <th
                className="py-2.5 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide sticky z-30 border-r border-slate-200 dark:border-slate-600 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] bg-slate-100 dark:bg-slate-700"
                style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
              >
                Conta
              </th>
              <th
                className="py-2.5 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap sticky z-30 border-r border-slate-200 dark:border-slate-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] bg-slate-100 dark:bg-slate-700"
                style={{ left: STICKY_COLS[2].l, width: STICKY_COLS[2].w, minWidth: STICKY_COLS[2].w }}
              >
                Fluxo
              </th>
              {temPivot
                ? periodos.map((p) => (
                    <th
                      key={p}
                      className="py-2.5 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right whitespace-nowrap min-w-[88px]"
                      title={p}
                    >
                      {rotuloPeriodoCabecalho(p, granularidade)}
                    </th>
                  ))
                : null}
              {temPivot ? (
                <th className="py-2.5 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 text-right whitespace-nowrap min-w-[100px] bg-slate-200/60 dark:bg-slate-600/60">
                  Total
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {temPivot ? (
              <BlocoSaldoBancarioExpandivel
                chaveExpansao={DFC_CHAVE_SALDO_INICIAIS}
                nomeGrupo={DFC_NOME_SALDOS_INICIAIS}
                valoresTotais={saldosIniciaisPorPeriodo}
                contas={saldosPorConta}
                tipo="inicial"
                periodos={periodos}
                granularidade={granularidade}
                rowIdxBase={0}
                aberto={expanded.has(DFC_CHAVE_SALDO_INICIAIS)}
                onToggle={alternarSaldo}
                mostrarEmpresa={mostrarEmpresaSaldo}
                filtroAtivo={filtroAtivo}
              />
            ) : null}
            {visiveis.length === 0 && filtroAtivo ? (
              <tr>
                <td colSpan={temPivot ? 4 + periodos.length : 3} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma conta encontrada para «{filtroPlanoContas.trim()}».
                </td>
              </tr>
            ) : null}
            {visiveis.map(({ node, depth }, rowIdx) => {
              const pad = depth * 16;
              const temFilhos = (node.children?.length ?? 0) > 0;
              const aberto = filtroAtivo && temFilhos ? true : expanded.has(node.pathKey);
              const ids = idsPorPathKey.get(node.pathKey) ?? [];
              const bg = corFundoLinha(node, rowIdx);
              const synth = node.tipo === 'S';
              const isRaizFluxoDfc = isLinhaRaizFluxoDfc(node);
              const cruz = cruzamentoDoNo(node, cruzamentosFluxo);
              const isRaizFluxoFormula = cruz != null && node.pathKey === cruz.raizPathKey;
              const isResumoEntradasFluxo = cruz != null && node.pathKey === cruz.pathKeyEntradas;
              const isResumoSaidasFluxo = cruz != null && node.pathKey === cruz.pathKeySaidas;
              const isResumoFluxoFormula = isResumoEntradasFluxo || isResumoSaidasFluxo;
              const isProjecaoReceitas = node.nome === DFC_NOME_PROJECAO_RECEITAS;
              /** Qualquer nó sintético de "Saídas" em qualquer fluxo */
              const isSaidasNode =
                isResumoSaidasFluxo ||
                (node.tipo === 'S' && (node.nome === 'Saídas' || node.nome === 'Saídas operacionais'));
              const somasNo = somasPorPathKey.get(node.pathKey);
              return (
                <tr
                  key={node.pathKey}
                  className={`border-t ${isRaizFluxoDfc ? 'border-slate-300 dark:border-slate-600' : 'border-slate-100 dark:border-slate-700/60'} ${bg}`}
                >
                  <td
                    className={`py-2 px-1 align-middle sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bg}`}
                    style={{ left: STICKY_COLS[0].l, width: STICKY_COLS[0].w, minWidth: STICKY_COLS[0].w }}
                  >
                    {temFilhos ? (
                      <button
                        type="button"
                        disabled={filtroAtivo}
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 transition disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent"
                        aria-expanded={aberto}
                        aria-label={aberto ? 'Recolher' : 'Explodir'}
                        title={filtroAtivo ? 'Limpe o filtro do plano para expandir ou recolher nós' : undefined}
                        onClick={() => {
                          if (filtroAtivo) return;
                          setExpanded((prev) => alternarExpansao(prev, node.pathKey));
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform ${aberto ? 'rotate-90' : ''}`}
                          aria-hidden
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span className="block h-8 w-8" aria-hidden />
                    )}
                  </td>
                  <td
                    className={`py-2 px-2 align-middle sticky z-20 border-r border-slate-200 dark:border-slate-600 ${bg} ${
                      ids.length > 0 || (isProjecaoReceitas && onAbrirProjecaoDetalhe) ? 'cursor-pointer' : ''
                    }`}
                    style={{ left: STICKY_COLS[1].l, width: STICKY_COLS[1].w, minWidth: STICKY_COLS[1].w }}
                    title={
                      isProjecaoReceitas && onAbrirProjecaoDetalhe
                        ? 'Clique para ver pedidos/parcelas da projeção'
                        : isProjecaoReceitas
                          ? DFC_PROJECAO_RECEITAS_TOOLTIP_SO_ACO
                          : ids.length > 0
                            ? 'Clique para ver lançamentos no período filtrado'
                            : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isProjecaoReceitas && onAbrirProjecaoDetalhe) {
                        onAbrirProjecaoDetalhe(undefined, `${node.nome} · ${dataInicio} → ${dataFim}`);
                        return;
                      }
                      if (ids.length === 0) return;
                      abrirDetalhe(ids, undefined, `${node.nome} · ${dataInicio} → ${dataFim}`);
                    }}
                  >
                    <span
                      className={`inline-flex items-baseline gap-1.5 leading-snug ${
                        isRaizFluxoDfc
                          ? 'text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300'
                          : synth
                            ? 'text-sm font-semibold text-slate-800 dark:text-slate-100'
                            : 'text-sm text-slate-700 dark:text-slate-300'
                      } ${ids.length > 0 ? 'hover:underline decoration-slate-400/50' : ''}`}
                      style={{ paddingLeft: pad }}
                    >
                      {node.codigo && !isRaizFluxoDfc && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-normal shrink-0 tabular-nums">
                          {node.codigo}
                        </span>
                      )}
                      {node.nome}
                      {node.tipo === 'A' && node.id != null
                        ? renderSelosPrioridadeConta(node.id, idEmpresas, prioridadesContasMap)
                        : null}
                    </span>
                  </td>
                  <td
                    className={`py-2 px-2 align-middle sticky z-20 border-r border-slate-300 dark:border-slate-500 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] ${bg}`}
                    style={{ left: STICKY_COLS[2].l, width: STICKY_COLS[2].w, minWidth: STICKY_COLS[2].w }}
                  >
                    <span className={chipMacro(node.macro)}>{MACRO_LABEL[node.macro] ?? node.macro}</span>
                  </td>
                  {temPivot
                    ? periodos.map((p, i) => {
                        let v: number;
                        if (isRaizFluxoFormula && cruz) {
                          v = cruz.fluxoPorPeriodo[i] ?? 0;
                        } else if (isResumoEntradasFluxo && cruz) {
                          v = cruz.porPeriodoEntradas[i] ?? 0;
                        } else if (isResumoSaidasFluxo && cruz) {
                          v = cruz.porPeriodoSaidas[i] ?? 0;
                        } else {
                          v = somasNo?.[p] ?? 0;
                        }
                        const podeDrillLanc = ids.length > 0 && !isRaizFluxoFormula && !isProjecaoReceitas;
                        const podeDrillProj = isProjecaoReceitas && !!onAbrirProjecaoDetalhe;
                        const podeDrill = podeDrillLanc || podeDrillProj;
                        const alertaSaidas = isSaidasNode && granularidade === 'dia' && v > 150000;
                        const corValor = alertaSaidas
                          ? 'bg-red-600 text-white font-bold'
                          : v < 0
                            ? `text-red-600 dark:text-red-400 ${synth ? 'font-semibold' : ''} ${bg}`
                            : v === 0
                              ? `text-slate-300 dark:text-slate-600 ${bg}`
                              : `${synth ? 'text-slate-800 dark:text-slate-100 font-semibold' : 'text-slate-700 dark:text-slate-200'} ${bg}`;
                        return (
                          <td
                            key={p}
                            className={`py-2 px-2 text-right tabular-nums text-sm ${corValor} ${
                              podeDrill ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-110' : ''
                            }`}
                            title={
                              isRaizFluxoFormula
                                ? 'Resumo: entradas menos saídas deste fluxo'
                                : isResumoEntradasFluxo
                                  ? node.macro === 'OPERACIONAL'
                                    ? 'Fórmula: receitas operacionais − devoluções + receitas não operacionais'
                                    : 'Soma das entradas deste fluxo'
                                  : isResumoSaidasFluxo
                                    ? 'Soma das saídas deste fluxo'
                                    : isProjecaoReceitas
                                      ? onAbrirProjecaoDetalhe
                                        ? 'Clique para ver pedidos/parcelas desta projeção'
                                        : DFC_PROJECAO_RECEITAS_TOOLTIP_SO_ACO
                                      : 'Clique para ver lançamentos deste período'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (podeDrillProj) {
                                onAbrirProjecaoDetalhe!(
                                  p,
                                  `${DFC_NOME_PROJECAO_RECEITAS} · ${rotuloPeriodoCabecalho(p, granularidade)}`,
                                );
                                return;
                              }
                              if (!podeDrillLanc) return;
                              abrirDetalhe(
                                ids,
                                p,
                                `${rotuloPeriodoCabecalho(p, granularidade)} · ${p}`,
                              );
                            }}
                          >
                            {v === 0 ? <span className="text-slate-300 dark:text-slate-600">—</span> : nf.format(v)}
                          </td>
                        );
                      })
                    : null}
                  {temPivot ? (() => {
                    const totalSaidas =
                      isResumoSaidasFluxo && cruz
                        ? cruz.porPeriodoSaidas.reduce((a, b) => a + b, 0)
                        : isSaidasNode
                          ? periodos.reduce((s, p) => s + (somasNo?.[p] ?? 0), 0)
                          : null;
                    const alertaTotalSaidas =
                      isSaidasNode && granularidade === 'dia' && totalSaidas != null && totalSaidas > 150000;
                    const totalV =
                      isRaizFluxoFormula && cruz
                        ? cruz.fluxoTotal
                        : isResumoEntradasFluxo && cruz
                          ? cruz.porPeriodoEntradas.reduce((a, b) => a + b, 0)
                          : isResumoSaidasFluxo && cruz
                            ? cruz.porPeriodoSaidas.reduce((a, b) => a + b, 0)
                            : periodos.reduce((s, p) => s + (somasNo?.[p] ?? 0), 0);
                    const corTotal = alertaTotalSaidas
                      ? 'bg-red-600 text-white'
                      : totalV < 0
                        ? 'text-red-600 dark:text-red-400 bg-slate-100 dark:bg-slate-700/80'
                        : totalV === 0
                          ? 'text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-700/80'
                          : synth
                            ? 'text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-700/80'
                            : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/80';
                    return (
                    <td
                      className={`py-2 px-2 text-right tabular-nums text-sm font-semibold ${corTotal} ${
                        isRaizFluxoFormula
                          ? ''
                          : isProjecaoReceitas && onAbrirProjecaoDetalhe
                            ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-110'
                            : ids.length > 0
                              ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-110'
                              : ''
                      }`}
                      title={
                        isRaizFluxoFormula
                          ? 'Total do período: entradas menos saídas deste fluxo'
                          : isProjecaoReceitas && onAbrirProjecaoDetalhe
                            ? 'Clique para ver todos os pedidos da projeção no intervalo'
                            : isResumoFluxoFormula && cruz
                              ? isResumoEntradasFluxo
                                ? 'Total: entradas deste fluxo'
                                : 'Total: saídas deste fluxo'
                              : 'Clique para ver todos os lançamentos do período filtrado'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isProjecaoReceitas && onAbrirProjecaoDetalhe) {
                          onAbrirProjecaoDetalhe(undefined, `Total · ${node.nome} · ${dataInicio} → ${dataFim}`);
                          return;
                        }
                        if (isRaizOperacional || ids.length === 0) return;
                        abrirDetalhe(ids, undefined, `Total · ${dataInicio} → ${dataFim}`);
                      }}
                    >
                      {totalV === 0
                        ? <span className="text-slate-300 dark:text-slate-600">—</span>
                        : nf.format(totalV)}
                    </td>
                  );
                  })() : null}
                </tr>
              );
            })}
            {temPivot ? (
              <BlocoSaldoBancarioExpandivel
                chaveExpansao={DFC_CHAVE_SALDO_FINAIS}
                nomeGrupo={DFC_NOME_SALDOS_FINAIS}
                valoresTotais={saldosFinaisPorPeriodo}
                contas={saldosPorConta}
                tipo="final"
                periodos={periodos}
                granularidade={granularidade}
                rowIdxBase={1}
                aberto={expanded.has(DFC_CHAVE_SALDO_FINAIS)}
                onToggle={alternarSaldo}
                mostrarEmpresa={mostrarEmpresaSaldo}
                filtroAtivo={filtroAtivo}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
