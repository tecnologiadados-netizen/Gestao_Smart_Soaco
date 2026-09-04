/**
 * Agregação da visão resumida da DFC (Saldo, A receber, A pagar, Sem Priorização, Saldo final).
 */

import type { DfcContribuicaoLinha } from '../../../api/financeiro';
import type { DfcPrioridade } from '../../../api/dfcPrioridade';
import estruturaJson from './estruturaDfcArvore.json';
import {
  calcularCruzamentosFluxo,
  montarMapaIdsPorPathKey,
  montarRootsParaExibicao,
  type CruzamentoFluxo,
  type DfcEstruturaNo,
} from './dfcCruzamentoFluxo';
import { periodoFromDataBucket } from './dfcFiltrarContribuicoes';
import { type ColunaResumoDfc } from './dfcAgruparPeriodos';

export type LinhaResumoDfc = 'saldo' | 'aReceber' | 'aPagar' | 'semPriorizacao' | 'saldoFinal';

export type CelulaResumoDfc = {
  linha: LinhaResumoDfc;
  valor: number | null;
  destaqueAmarelo?: boolean;
};

export type ColunaResumoComputada = ColunaResumoDfc & {
  celulas: Record<LinhaResumoDfc, CelulaResumoDfc>;
};

const MACROS_FLUXO = new Set(['OPERACIONAL', 'FINANCIAMENTOS', 'INVESTIMENTOS']);

export const LIMIAR_DESTAQUE_APAGAR = 100_000;

export function listarIdsContasSaidasDfc(): number[] {
  return [...idsSaidas()];
}

function prioridadeEfetiva(
  c: DfcContribuicaoLinha,
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): DfcPrioridade | null {
  const kl = `${c.idEmpresa}#${c.tipoRef}#${c.codigoConta}`;
  if (prioridadesLancsMap[kl] != null) return prioridadesLancsMap[kl];
  const kc = `${c.idEmpresa}#${c.idContaFinanceiro}`;
  if (prioridadesContasMap[kc] != null) return prioridadesContasMap[kc];
  return null;
}

function coletarIdsSaidas(): Set<number> {
  const rootsRaw = (estruturaJson as { roots: DfcEstruturaNo[] }).roots;
  const roots = montarRootsParaExibicao(rootsRaw).filter((r) => MACROS_FLUXO.has(r.macro));
  const idsPorPathKey = montarMapaIdsPorPathKey(roots);
  const ids = new Set<number>();
  for (const root of roots) {
    const nSaidas = root.children?.find(
      (c) => c.nome === 'Saídas' || c.nome === 'Saídas operacionais',
    );
    if (!nSaidas) continue;
    for (const id of idsPorPathKey.get(nSaidas.pathKey) ?? []) ids.add(id);
  }
  return ids;
}

let cacheIdsSaidas: Set<number> | null = null;

function idsSaidas(): Set<number> {
  if (!cacheIdsSaidas) cacheIdsSaidas = coletarIdsSaidas();
  return cacheIdsSaidas;
}

function somaMapaPeriodos(map: Record<string, number>, periodos: string[]): number {
  let s = 0;
  for (const p of periodos) s += map[p] ?? 0;
  return s;
}

function entradasPorPeriodo(cruzamentos: CruzamentoFluxo[], periodos: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i];
    out[p] = cruzamentos.reduce((s, c) => s + (c.porPeriodoEntradas[i] ?? 0), 0);
  }
  return out;
}

function saidasPorPeriodo(cruzamentos: CruzamentoFluxo[], periodos: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i];
    out[p] = cruzamentos.reduce((s, c) => s + (c.porPeriodoSaidas[i] ?? 0), 0);
  }
  return out;
}

function ehProjetado(c: DfcContribuicaoLinha): boolean {
  return c.situacao !== 'Realizado';
}

function agregarSaidasComPrioridade(
  contribuicoes: DfcContribuicaoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): Record<string, number> {
  const saidasIds = idsSaidas();
  const comPrioridade: Record<string, number> = {};
  for (const p of periodos) comPrioridade[p] = 0;

  for (const c of contribuicoes) {
    if (!ehProjetado(c)) continue;
    if (!saidasIds.has(c.idContaFinanceiro)) continue;
    const periodo = periodoFromDataBucket(c.dataBucket, granularidade);
    if (!(periodo in comPrioridade)) continue;
    const eff = prioridadeEfetiva(c, prioridadesContasMap, prioridadesLancsMap);
    if (eff != null) comPrioridade[periodo] += c.valor;
  }

  return comPrioridade;
}

function agregarSaidasSemPriorizacao(
  contribuicoes: DfcContribuicaoLinha[],
  periodos: string[],
  granularidade: 'dia' | 'mes',
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): Record<string, number> {
  const saidasIds = idsSaidas();
  const semPrioridade: Record<string, number> = {};
  for (const p of periodos) semPrioridade[p] = 0;

  for (const c of contribuicoes) {
    if (!ehProjetado(c)) continue;
    if (!saidasIds.has(c.idContaFinanceiro)) continue;
    const periodo = periodoFromDataBucket(c.dataBucket, granularidade);
    if (!(periodo in semPrioridade)) continue;
    const eff = prioridadeEfetiva(c, prioridadesContasMap, prioridadesLancsMap);
    if (eff == null) semPrioridade[periodo] += c.valor;
  }

  return semPrioridade;
}

export function montarResumoDfc(params: {
  periodos: string[];
  granularidade: 'dia' | 'mes';
  colunas: ColunaResumoDfc[];
  valoresPorConta: Record<number, Record<string, number>>;
  projecaoReceitasPorPeriodo?: Record<string, number>;
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
  /** Contribuições com cenários aplicados (A receber / A pagar). */
  contribuicoesFiltradas: DfcContribuicaoLinha[];
  /** Contribuições sem filtro de cenários (linha Sem Priorização). */
  contribuicoesSemPriorizacao: DfcContribuicaoLinha[];
  prioridadesContasMap: Record<string, DfcPrioridade>;
  prioridadesLancsMap: Record<string, DfcPrioridade>;
}): ColunaResumoComputada[] {
  const {
    periodos,
    granularidade,
    colunas,
    valoresPorConta,
    projecaoReceitasPorPeriodo = {},
    saldosIniciaisPorPeriodo,
    saldosFinaisPorPeriodo,
    contribuicoesFiltradas,
    contribuicoesSemPriorizacao,
    prioridadesContasMap,
    prioridadesLancsMap,
  } = params;

  const cruzamentos = calcularCruzamentosFluxo({
    periodos,
    valoresPorConta,
    projecaoReceitasPorPeriodo,
  });
  const entradas = entradasPorPeriodo(cruzamentos, periodos);
  const saidasTotal = saidasPorPeriodo(cruzamentos, periodos);
  const comPrioridade = agregarSaidasComPrioridade(
    contribuicoesFiltradas,
    periodos,
    granularidade,
    prioridadesContasMap,
    prioridadesLancsMap,
  );
  const semPrioridade = agregarSaidasSemPriorizacao(
    contribuicoesSemPriorizacao,
    periodos,
    granularidade,
    prioridadesContasMap,
    prioridadesLancsMap,
  );

  return colunas.map((col) => {
    const ps = col.periodos;
    const primeiro = ps[0];
    const ultimo = ps[ps.length - 1];

    const saldo = saldosIniciaisPorPeriodo[primeiro] ?? null;
    const aReceber = somaMapaPeriodos(entradas, ps);
    const aPagarPriorizado = somaMapaPeriodos(comPrioridade, ps);
    const semPriorizacaoVal = somaMapaPeriodos(semPrioridade, ps);
    const saidasAgregadas = somaMapaPeriodos(saidasTotal, ps);

    const aPagar =
      aPagarPriorizado + semPriorizacaoVal > 0
        ? aPagarPriorizado
        : saidasAgregadas - semPriorizacaoVal;

    let saldoFinal = saldosFinaisPorPeriodo[ultimo] ?? null;
    if (saldoFinal == null && saldo != null) {
      saldoFinal = saldo + aReceber - aPagar - semPriorizacaoVal;
    }

    const temSemPriorizacao = Math.abs(semPriorizacaoVal) > 0.005;
    const valorAPagar = aPagar ? -Math.abs(aPagar) : null;
    const destaqueAPagar =
      valorAPagar != null && Math.abs(valorAPagar) >= LIMIAR_DESTAQUE_APAGAR;

    return {
      ...col,
      celulas: {
        saldo: { linha: 'saldo', valor: saldo },
        aReceber: { linha: 'aReceber', valor: aReceber || null },
        aPagar: {
          linha: 'aPagar',
          valor: valorAPagar,
          destaqueAmarelo: destaqueAPagar,
        },
        semPriorizacao: {
          linha: 'semPriorizacao',
          valor: temSemPriorizacao ? -Math.abs(semPriorizacaoVal) : null,
          destaqueAmarelo: false,
        },
        saldoFinal: { linha: 'saldoFinal', valor: saldoFinal },
      },
    };
  });
}

export const ROTULOS_LINHA_RESUMO: Record<LinhaResumoDfc, string> = {
  saldo: 'Saldo',
  aReceber: 'A receber',
  aPagar: 'A pagar',
  semPriorizacao: 'Sem Priorização',
  saldoFinal: 'Saldo final',
};

export const ORDEM_LINHAS_RESUMO: LinhaResumoDfc[] = [
  'saldo',
  'aReceber',
  'aPagar',
  'semPriorizacao',
  'saldoFinal',
];
