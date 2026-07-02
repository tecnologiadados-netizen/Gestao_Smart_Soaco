import type {
  LinhaProgramacaoProducao,
  OrdemNomusOpcao,
  OrdemProducaoNomusSelecionada,
} from '../components/programacao-producao/types';
import { somaQtdeProduzir } from '../components/programacao-producao/programacaoProducaoCalculos';

export function ordensProducaoNomusDaLinha(linha: LinhaProgramacaoProducao): OrdemProducaoNomusSelecionada[] {
  if (linha.ordens_producao_nomus?.length) return linha.ordens_producao_nomus;
  const leg = linha.ordem_producao_nomus?.trim();
  if (leg) return [{ ordem: leg, saldo: 0 }];
  return [];
}

export function normalizarOrdensProducaoLinha(linha: LinhaProgramacaoProducao): LinhaProgramacaoProducao {
  const ordens = ordensProducaoNomusDaLinha(linha);
  if (!ordens.length && !linha.ordem_producao_nomus) return linha;
  return {
    ...linha,
    ordens_producao_nomus: ordens,
    ordem_producao_nomus: ordens.length === 1 ? ordens[0]!.ordem : ordens.map((o) => o.ordem).join(', ') || null,
  };
}

export function somaSaldoOpsSelecionadas(ops: OrdemProducaoNomusSelecionada[]): number {
  return ops.reduce((s, o) => s + (Number.isFinite(o.saldo) ? o.saldo : 0), 0);
}

export function textoResumoOpsNomus(linha: LinhaProgramacaoProducao): string {
  const ops = ordensProducaoNomusDaLinha(linha);
  if (!ops.length) return '—';
  const soma = somaSaldoOpsSelecionadas(ops);
  const lista = ops.map((o) => o.ordem).join(', ');
  return `${lista} (${formatSaldo(soma)})`;
}

function formatSaldo(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function limiteQtdeProduzirLinha(linha: LinhaProgramacaoProducao): number {
  return somaQtdeProduzir(linha.qtde_produzir);
}

export function opJaSelecionada(ops: OrdemProducaoNomusSelecionada[], ordem: string): boolean {
  return ops.some((o) => o.ordem === ordem);
}

/** Pode marcar a OP sem ultrapassar o limite de qtde produzir (quando > 0). */
export function podeIncluirOp(
  ops: OrdemProducaoNomusSelecionada[],
  op: OrdemNomusOpcao,
  qtdeMax: number
): boolean {
  if (opJaSelecionada(ops, op.ordem)) return true;
  if (qtdeMax <= 0) return true;
  const soma = somaSaldoOpsSelecionadas(ops);
  return soma + op.saldo <= qtdeMax + 1e-9;
}

export function validarOrdensProducaoLinha(linha: LinhaProgramacaoProducao): string | null {
  const ops = ordensProducaoNomusDaLinha(linha);
  if (!ops.length) return null;
  const limite = limiteQtdeProduzirLinha(linha);
  const soma = somaSaldoOpsSelecionadas(ops);
  if (limite > 0 && soma > limite + 1e-9) {
    return `${linha.cod_componente}: soma das OPs (${formatSaldo(soma)}) excede Qtde produzir (${formatSaldo(limite)}).`;
  }
  const vistos = new Set<string>();
  for (const o of ops) {
    if (vistos.has(o.ordem)) {
      return `${linha.cod_componente}: OP ${o.ordem} repetida.`;
    }
    vistos.add(o.ordem);
  }
  return null;
}

export function validarOrdensProducaoNasLinhas(linhas: LinhaProgramacaoProducao[]): string | null {
  for (const l of linhas) {
    const err = validarOrdensProducaoLinha(l);
    if (err) return err;
  }
  return null;
}
