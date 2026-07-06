import type { RccDados } from "@qualidade/types/rcc";

export interface ValidacaoRccResult {
  valido: boolean;
  erros: Partial<Record<keyof RccDados, string>>;
}

export function validarRcc(rcc: RccDados): ValidacaoRccResult {
  const erros: Partial<Record<keyof RccDados, string>> = {};

  if (!rcc.dataRegistroReclamacao.trim()) {
    erros.dataRegistroReclamacao = "Informe a data de registro da reclamação.";
  }
  if (!rcc.nomeClienteConsumidor.trim()) {
    erros.nomeClienteConsumidor = "Informe o nome do cliente.";
  }
  if (!rcc.produto.trim()) {
    erros.produto = "Informe o produto.";
  }
  if (!rcc.descricaoReclamacao.trim()) {
    erros.descricaoReclamacao = "Descreva a reclamação.";
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
  };
}

export function inferirStatusRcc(
  rcc: RccDados
): "aberto" | "em_tratamento" | "encerrado" {
  if (rcc.dataFechamento.trim()) return "encerrado";
  if (
    rcc.servicoRealizado.trim() ||
    rcc.servicoRealizado1.trim() ||
    rcc.causaProblema.trim()
  ) {
    return "em_tratamento";
  }
  return "aberto";
}
