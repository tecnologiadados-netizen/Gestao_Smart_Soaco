import type { DfcContribuicaoLinha } from '../../../api/financeiro';
import type { DfcPrioridade } from '../../../api/dfcPrioridade';
import { DFC_PRIORIDADES } from '../../../api/dfcPrioridade';
import { linhaMatchesEmpresasDfc } from './dfcEmpresas';

export type FiltrosDfcCliente = {
  idEmpresas: number[];
  contasBancarias: string[];
  prioridades: DfcPrioridade[];
  idsPlanoContas: number[];
};

export function periodoFromDataBucket(
  dataBucket: string,
  granularidade: 'dia' | 'mes',
): string {
  return granularidade === 'mes' ? dataBucket.slice(0, 7) : dataBucket;
}

function prioridadeEfetivaCliente(
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

function passaPrioridadeCliente(
  c: DfcContribuicaoLinha,
  prioridadesSelecionadas: DfcPrioridade[],
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): boolean {
  if (prioridadesSelecionadas.length === 0) return true;
  const efetiva = prioridadeEfetivaCliente(c, prioridadesContasMap, prioridadesLancsMap);
  if (efetiva == null) return false;
  return prioridadesSelecionadas.includes(efetiva);
}

function passaEmpresa(c: DfcContribuicaoLinha, idEmpresas: number[]): boolean {
  return linhaMatchesEmpresasDfc(
    { idEmpresa: c.idEmpresa, empresa: c.empresa },
    idEmpresas,
  );
}

function passaContaBancaria(c: DfcContribuicaoLinha, contas: string[]): boolean {
  if (contas.length === 0) return true;
  const nome = c.contaBancaria?.trim();
  if (!nome) return false;
  return contas.includes(nome);
}

function passaPlanoContas(c: DfcContribuicaoLinha, idsPlano: number[]): boolean {
  if (idsPlano.length === 0) return true;
  return idsPlano.includes(c.idContaFinanceiro);
}

export function filtrarContribuicoes(
  contribuicoes: DfcContribuicaoLinha[],
  filtros: FiltrosDfcCliente,
  prioridadesContasMap: Record<string, DfcPrioridade>,
  prioridadesLancsMap: Record<string, DfcPrioridade>,
): DfcContribuicaoLinha[] {
  return contribuicoes.filter(
    (c) =>
      passaEmpresa(c, filtros.idEmpresas) &&
      passaContaBancaria(c, filtros.contasBancarias) &&
      passaPlanoContas(c, filtros.idsPlanoContas) &&
      passaPrioridadeCliente(c, filtros.prioridades, prioridadesContasMap, prioridadesLancsMap),
  );
}

export function agregarContribuicoesParaGrade(
  contribuicoes: DfcContribuicaoLinha[],
  granularidade: 'dia' | 'mes',
): Record<number, Record<string, number>> {
  const m: Record<number, Record<string, number>> = {};
  for (const c of contribuicoes) {
    const periodo = periodoFromDataBucket(c.dataBucket, granularidade);
    if (!m[c.idContaFinanceiro]) m[c.idContaFinanceiro] = {};
    m[c.idContaFinanceiro][periodo] = (m[c.idContaFinanceiro][periodo] ?? 0) + c.valor;
  }
  return m;
}

export function opcoesPrioridadeFiltro(): { id: string; label: string }[] {
  return DFC_PRIORIDADES.map((p) => ({ id: String(p), label: String(p) }));
}
