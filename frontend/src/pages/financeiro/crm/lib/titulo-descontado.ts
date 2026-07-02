import { isTituloDescontado } from "./formatters";
import type { ContaFinanceira, Recebimento } from "./types";

/** Comentário exclusivamente "TITULO DESCONTADO" (agendamento ou lançamento). */
export function isRecebimentoTituloDescontado(
  recebimento: Pick<
    Recebimento,
    "comentariosAgendamento" | "comentariosLancamento"
  >,
): boolean {
  return (
    isTituloDescontado(recebimento.comentariosLancamento) ||
    isTituloDescontado(recebimento.comentariosAgendamento)
  );
}

export function isContaTituloDescontado(
  conta: Pick<
    ContaFinanceira,
    "comentariosAgendamento" | "comentariosLancamento"
  >,
): boolean {
  return (
    isTituloDescontado(conta.comentariosLancamento) ||
    isTituloDescontado(conta.comentariosAgendamento)
  );
}

export function filtrarRecebimentosSemTituloDescontado(
  recebimentos: Recebimento[],
): Recebimento[] {
  return recebimentos.filter((item) => !isRecebimentoTituloDescontado(item));
}

export function mesclarContasComTitulosDescontado(
  contas: ContaFinanceira[],
  titulosDescontado: ContaFinanceira[],
): ContaFinanceira[] {
  if (titulosDescontado.length === 0) return contas;

  const codigos = new Set(contas.map((conta) => conta.codigo));
  const extras = titulosDescontado.filter((conta) => !codigos.has(conta.codigo));

  if (extras.length === 0) return contas;

  return [...contas, ...extras].sort((a, b) => {
    const vencA = a.dataVencimento ?? "";
    const vencB = b.dataVencimento ?? "";
    if (vencA !== vencB) return vencA.localeCompare(vencB);
    return a.codigo - b.codigo;
  });
}

export function filtrarTitulosDescontadoPorSituacao(
  titulos: ContaFinanceira[],
  situacao: "total" | "atraso" | "emDia",
): ContaFinanceira[] {
  if (situacao === "total") return titulos;
  if (situacao === "atraso") {
    return titulos.filter((conta) => conta.diasAtraso > 0);
  }
  return titulos.filter(
    (conta) => conta.diasAtraso <= 0 || !conta.dataVencimento,
  );
}
