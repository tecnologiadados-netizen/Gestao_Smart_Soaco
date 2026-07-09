import type { RncDados } from "@qualidade/types/rnc";

export interface ValidacaoRncResult {
  valido: boolean;
  erros: Partial<Record<keyof RncDados, string>>;
}

export function validarRnc(rnc: RncDados): ValidacaoRncResult {
  const erros: Partial<Record<keyof RncDados, string>> = {};

  if (!rnc.dataOcorrencia.trim()) {
    erros.dataOcorrencia = "Informe a data da ocorrência.";
  }
  if (!rnc.tipoAcao.trim()) {
    erros.tipoAcao = "Selecione o tipo de ação.";
  }
  if (!rnc.tipoOcorrencia.trim()) {
    erros.tipoOcorrencia = "Informe o tipo de ocorrência.";
  }
  if (!rnc.descricaoOcorrencia.trim()) {
    erros.descricaoOcorrencia = "Descreva a ocorrência.";
  }
  if (!rnc.responsavel.trim()) {
    erros.responsavel = "Informe o responsável.";
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
  };
}

export function inferirStatusRnc(rnc: RncDados): "aberto" | "em_tratamento" | "encerrado" {
  if (rnc.dataFechamento.trim()) return "encerrado";
  if (rnc.resolucaoNaoConformidade.trim() || rnc.causa.trim()) {
    return "em_tratamento";
  }
  return "aberto";
}
