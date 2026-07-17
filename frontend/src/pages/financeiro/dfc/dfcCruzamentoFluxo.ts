/**
 * Cruzamento Entradas × Saídas por macrofluxo (Operacional, Financiamentos, Investimentos).
 * Usado na grade DFC e nos cards de KPI (recebimentos / pagamentos).
 */

export const DFC_NOME_GERACAO_CAIXA = 'Geração de Caixa';

import estruturaJson from './estruturaDfcArvore.json';
import { classificacaoExcluidaDaArvoreDfc } from './mapeamentoFluxoDfc';

export type DfcEstruturaNo = {
  pathKey: string;
  id: number | null;
  nome: string;
  tipo: string;
  macro: string;
  codigo: string;
  children: DfcEstruturaNo[];
};

export type CruzamentoFluxo = {
  raizPathKey: string;
  macro: string;
  pathKeyEntradas: string;
  pathKeySaidas: string;
  porPeriodoEntradas: number[];
  porPeriodoSaidas: number[];
  fluxoPorPeriodo: number[];
  fluxoTotal: number;
  totalEntradas: number;
  totalSaidas: number;
};

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

function coletarIdsAnaliticos(node: DfcEstruturaNo): number[] {
  if (node.tipo === 'A' && node.id != null) return [node.id];
  return (node.children ?? []).flatMap(coletarIdsAnaliticos);
}

export function montarMapaIdsPorPathKey(roots: DfcEstruturaNo[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  function visit(n: DfcEstruturaNo) {
    map.set(n.pathKey, coletarIdsAnaliticos(n));
    n.children?.forEach(visit);
  }
  roots.forEach(visit);
  return map;
}

function assignPathKeysRecursive(node: DfcEstruturaNo, base: string): void {
  node.pathKey = base;
  node.children?.forEach((ch, i) => assignPathKeysRecursive(ch, `${base}/${i}`));
}

/** Remove nós cuja classificação está em CLASSIFICACOES_EXCLUIDAS_ARVORE_DFC. */
function podarNosExcluidosDaArvore(nodes: DfcEstruturaNo[]): DfcEstruturaNo[] {
  const out: DfcEstruturaNo[] = [];
  for (const n of nodes) {
    if (n.codigo?.trim() && classificacaoExcluidaDaArvoreDfc(n.codigo)) continue;
    const children = n.children?.length ? podarNosExcluidosDaArvore(n.children) : [];
    out.push({ ...n, children });
  }
  return out;
}

/** Mesma transformação da grade (Entradas operacionais / Saídas operacionais). */
export function montarRootsParaExibicao(roots: DfcEstruturaNo[]): DfcEstruturaNo[] {
  const cloned = podarNosExcluidosDaArvore(
    JSON.parse(JSON.stringify(roots)) as DfcEstruturaNo[],
  );
  const opIdx = cloned.findIndex((r) => r.macro === 'OPERACIONAL');
  if (opIdx >= 0) {
    const op = cloned[opIdx];
    const children = op.children ?? [];
    const nEntradas = children.find((c) => c.nome === 'Entradas');
    const nSaidas = children.find((c) => c.nome === 'Saídas');
    if (nEntradas && nSaidas) {
      nEntradas.nome = 'Entradas operacionais';
      nSaidas.nome = 'Saídas operacionais';
    } else {
      const nRec = children.find((c) => c.nome === 'Receitas Operacionais');
      const nDev = children.find((c) => c.nome === 'Devoluções');
      const nNao = children.find((c) => c.nome === 'Receitas Não Operacionais');
      if (nRec && nDev && nNao) {
        const exc = new Set([nRec.pathKey, nDev.pathKey, nNao.pathKey]);
        const saidaChildren = children.filter((c) => !exc.has(c.pathKey));
        op.children = [
          {
            id: null,
            nome: 'Entradas operacionais',
            tipo: 'S',
            macro: 'OPERACIONAL',
            codigo: '',
            pathKey: '',
            children: [
              JSON.parse(JSON.stringify(nRec)) as DfcEstruturaNo,
              JSON.parse(JSON.stringify(nDev)) as DfcEstruturaNo,
              JSON.parse(JSON.stringify(nNao)) as DfcEstruturaNo,
            ],
          },
          {
            id: null,
            nome: 'Saídas operacionais',
            tipo: 'S',
            macro: 'OPERACIONAL',
            codigo: '',
            pathKey: '',
            children: saidaChildren.map((c) => JSON.parse(JSON.stringify(c)) as DfcEstruturaNo),
          },
        ];
      }
    }
  }

  const invIdx = cloned.findIndex((r) => r.macro === 'INVESTIMENTOS');
  const insertAt = invIdx >= 0 ? invIdx + 1 : cloned.length;
  const geracao: DfcEstruturaNo = {
    id: null,
    nome: 'Geração de Caixa',
    tipo: 'S',
    macro: 'GERACAO',
    codigo: '',
    pathKey: '',
    children: [],
  };
  cloned.splice(insertAt, 0, geracao);

  cloned.forEach((r, i) => assignPathKeysRecursive(r, `M${i}`));
  return cloned;
}

function buildCruzamentoEntradasSaidas(
  root: DfcEstruturaNo,
  periodos: string[],
  idsPorPathKey: Map<string, number[]>,
  valoresPorConta: Record<number, Record<string, number>>,
  extrasEntradasPorPeriodo?: Record<string, number>
): CruzamentoFluxo | null {
  const nEntradas = root.children?.find(
    (c) => c.nome === 'Entradas' || c.nome === 'Entradas operacionais'
  );
  const nSaidas = root.children?.find((c) => c.nome === 'Saídas' || c.nome === 'Saídas operacionais');
  if (!nEntradas || !nSaidas) return null;

  const idsEntradas = idsPorPathKey.get(nEntradas.pathKey) ?? [];
  const idsSaidas = idsPorPathKey.get(nSaidas.pathKey) ?? [];

  const porPeriodoEntradas = periodos.map(
    (p) => somaPeriodo(idsEntradas, p, valoresPorConta) + (extrasEntradasPorPeriodo?.[p] ?? 0)
  );
  const porPeriodoSaidas = periodos.map((p) => somaPeriodo(idsSaidas, p, valoresPorConta));
  const fluxoPorPeriodo = periodos.map((_, i) => porPeriodoEntradas[i] - porPeriodoSaidas[i]);
  const totalEntradas = porPeriodoEntradas.reduce((a, b) => a + b, 0);
  const totalSaidas = porPeriodoSaidas.reduce((a, b) => a + b, 0);

  return {
    raizPathKey: root.pathKey,
    macro: root.macro,
    pathKeyEntradas: nEntradas.pathKey,
    pathKeySaidas: nSaidas.pathKey,
    porPeriodoEntradas,
    porPeriodoSaidas,
    fluxoPorPeriodo,
    fluxoTotal: fluxoPorPeriodo.reduce((a, b) => a + b, 0),
    totalEntradas,
    totalSaidas,
  };
}

const MACROS_TRES_FLUXOS = new Set(['OPERACIONAL', 'FINANCIAMENTOS', 'INVESTIMENTOS']);

export function calcularCruzamentosFluxo(params: {
  periodos: string[];
  valoresPorConta: Record<number, Record<string, number>>;
  projecaoReceitasPorPeriodo?: Record<string, number>;
}): CruzamentoFluxo[] {
  const { periodos, valoresPorConta, projecaoReceitasPorPeriodo = {} } = params;
  if (periodos.length === 0) return [];

  const rootsRaw = (estruturaJson as { roots: DfcEstruturaNo[] }).roots;
  const roots = montarRootsParaExibicao(rootsRaw).filter((r) => r.nome !== 'Geração de Caixa');
  const idsPorPathKey = montarMapaIdsPorPathKey(roots);
  const idsPorPathKeyRaw = montarMapaIdsPorPathKey(rootsRaw);
  const lista: CruzamentoFluxo[] = [];

  const op = roots.find((r) => r.macro === 'OPERACIONAL');
  if (op) {
    const nEntradas = op.children?.find(
      (c) => c.nome === 'Entradas operacionais' || c.nome === 'Entradas'
    );
    const nSaidas = op.children?.find((c) => c.nome === 'Saídas operacionais' || c.nome === 'Saídas');
    if (nEntradas && nSaidas) {
      const nDed = nEntradas.children?.find((c) => c.id === 377);
      const idsEntradasTotal = idsPorPathKey.get(nEntradas.pathKey) ?? [];
      const idsDeducoes = nDed ? (idsPorPathKey.get(nDed.pathKey) ?? []) : [];
      const dedSet = new Set(idsDeducoes);
      const idsEntradasLiquidas = idsEntradasTotal.filter((id) => !dedSet.has(id));

      const porPeriodoEntradas = periodos.map(
        (p) =>
          somaPeriodo(idsEntradasLiquidas, p, valoresPorConta) -
          somaPeriodo(idsDeducoes, p, valoresPorConta) +
          (projecaoReceitasPorPeriodo[p] ?? 0)
      );
      const porPeriodoSaidas = periodos.map((p) =>
        somaPeriodo(idsPorPathKey.get(nSaidas.pathKey) ?? [], p, valoresPorConta)
      );
      const fluxoPorPeriodo = periodos.map((_, i) => porPeriodoEntradas[i] - porPeriodoSaidas[i]);
      const totalEntradas = porPeriodoEntradas.reduce((a, b) => a + b, 0);
      const totalSaidas = porPeriodoSaidas.reduce((a, b) => a + b, 0);
      lista.push({
        raizPathKey: op.pathKey,
        macro: 'OPERACIONAL',
        pathKeyEntradas: nEntradas.pathKey,
        pathKeySaidas: nSaidas.pathKey,
        porPeriodoEntradas,
        porPeriodoSaidas,
        fluxoPorPeriodo,
        fluxoTotal: fluxoPorPeriodo.reduce((a, b) => a + b, 0),
        totalEntradas,
        totalSaidas,
      });
    } else {
      const opRaw = rootsRaw.find((r) => r.macro === 'OPERACIONAL');
      if (opRaw) {
        const nRec = opRaw.children?.find((c) => c.nome === 'Receitas Operacionais');
        const nDev = opRaw.children?.find((c) => c.nome === 'Devoluções');
        const nNao = opRaw.children?.find((c) => c.nome === 'Receitas Não Operacionais');
        if (nRec && nDev && nNao) {
          const porPeriodoEntradas = periodos.map(
            (p) =>
              somaPeriodo(idsPorPathKeyRaw.get(nRec.pathKey) ?? [], p, valoresPorConta) -
              somaPeriodo(idsPorPathKeyRaw.get(nDev.pathKey) ?? [], p, valoresPorConta) +
              somaPeriodo(idsPorPathKeyRaw.get(nNao.pathKey) ?? [], p, valoresPorConta)
          );
          const exc = new Set([nRec.pathKey, nDev.pathKey, nNao.pathKey]);
          const porPeriodoSaidas = periodos.map((p) =>
            (opRaw.children ?? [])
              .filter((c) => !exc.has(c.pathKey))
              .reduce(
                (acc, ch) => acc + somaPeriodo(idsPorPathKeyRaw.get(ch.pathKey) ?? [], p, valoresPorConta),
                0
              )
          );
          const fluxoPorPeriodo = periodos.map((_, i) => porPeriodoEntradas[i] - porPeriodoSaidas[i]);
          const totalEntradas = porPeriodoEntradas.reduce((a, b) => a + b, 0);
          const totalSaidas = porPeriodoSaidas.reduce((a, b) => a + b, 0);
          lista.push({
            raizPathKey: op.pathKey,
            macro: 'OPERACIONAL',
            pathKeyEntradas: op.children?.[0]?.pathKey ?? `${op.pathKey}/0`,
            pathKeySaidas: op.children?.[1]?.pathKey ?? `${op.pathKey}/1`,
            porPeriodoEntradas,
            porPeriodoSaidas,
            fluxoPorPeriodo,
            fluxoTotal: fluxoPorPeriodo.reduce((a, b) => a + b, 0),
            totalEntradas,
            totalSaidas,
          });
        }
      }
    }
  }

  for (const root of roots) {
    if (root.macro !== 'FINANCIAMENTOS' && root.macro !== 'INVESTIMENTOS') continue;
    const c = buildCruzamentoEntradasSaidas(root, periodos, idsPorPathKey, valoresPorConta);
    if (c) lista.push(c);
  }

  return lista;
}

/** Totais de entradas/saídas dos três fluxos (cards Recebimentos / Pagamentos). */
export function totaisEntradasSaidasTresFluxos(cruzamentos: CruzamentoFluxo[]): {
  recebimentos: number;
  pagamentos: number;
} {
  let recebimentos = 0;
  let pagamentos = 0;
  for (const c of cruzamentos) {
    if (!MACROS_TRES_FLUXOS.has(c.macro)) continue;
    recebimentos += c.totalEntradas;
    pagamentos += c.totalSaidas;
  }
  return { recebimentos, pagamentos };
}

/** Soma do fluxo líquido (entradas − saídas) dos três macrofluxos por período. */
export function somasGeracaoDeCaixaPorPeriodo(
  periodos: string[],
  cruzamentos: CruzamentoFluxo[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i];
    out[p] = cruzamentos
      .filter((c) => MACROS_TRES_FLUXOS.has(c.macro))
      .reduce((s, c) => s + (c.fluxoPorPeriodo[i] ?? 0), 0);
  }
  return out;
}
