import { validarNotas } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import type {
  AvaliacaoMetadadosInput,
  SalvarAvaliacaoInput,
} from "@qualidade/types/avaliacao-fornecedor";

function isDataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const date = new Date(`${valor}T12:00:00`);
  return !Number.isNaN(date.getTime());
}

export function validarMetadados(
  metadados: AvaliacaoMetadadosInput
): string | null {
  if (!metadados.dataReferencia.trim()) {
    return "Informe a data de referência da avaliação.";
  }
  if (!isDataValida(metadados.dataReferencia)) {
    return "Data de referência inválida.";
  }
  if (!metadados.dataAvaliacao.trim()) {
    return "Informe a data da avaliação.";
  }
  if (!isDataValida(metadados.dataAvaliacao)) {
    return "Data da avaliação inválida.";
  }
  if (!metadados.numeroDocumento.trim()) {
    return "Informe o número do contrato ou documento.";
  }
  if (
    metadados.fornecedorAprovado === "" ||
    typeof metadados.fornecedorAprovado !== "boolean"
  ) {
    return "Informe se o fornecedor está aprovado (Sim ou Não).";
  }
  return null;
}

export function validarSalvarAvaliacao(input: SalvarAvaliacaoInput): string | null {
  const erroMetadados = validarMetadados({
    dataReferencia: input.dataReferencia,
    dataAvaliacao: input.dataAvaliacao,
    numeroDocumento: input.numeroDocumento,
    fornecedorAprovado: input.fornecedorAprovado,
    rncNumero: input.rncNumero,
  });
  if (erroMetadados) return erroMetadados;

  if (!validarNotas(input.notas)) {
    return "Classifique todos os critérios com estrelas (1 a 5).";
  }

  return null;
}
