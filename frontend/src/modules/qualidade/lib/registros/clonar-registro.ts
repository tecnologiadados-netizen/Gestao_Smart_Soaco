import { randomUUID } from "@/utils/randomUUID";
import type { CriarRegistroInput, Registro } from "@qualidade/types/registro";
import type { RegistroAnexo } from "@qualidade/types/registro-anexo";
import {
  normalizarRccDados,
  type RccDados,
  type RccLinhaReclamacao,
  type RccLinhaServico,
} from "@qualidade/types/rcc";
import {
  normalizarRncDados,
  sincronizarAcoesApartadasLegado,
  type RncAcaoApartada,
  type RncDados,
  type RncItemProduto,
} from "@qualidade/types/rnc";

function novoId(prefixo: string): string {
  return `${prefixo}-${randomUUID()}`;
}

function clonarAnexos(anexos: RegistroAnexo[] | undefined): RegistroAnexo[] {
  if (!Array.isArray(anexos) || anexos.length === 0) return [];
  return anexos.map((anexo) => ({
    ...anexo,
    id: novoId("anexo"),
  }));
}

function clonarItensProduto(itens: RncItemProduto[] | undefined): RncItemProduto[] {
  if (!Array.isArray(itens)) return [];
  return itens.map((item) => ({
    ...item,
    id: novoId("item"),
  }));
}

function clonarAcoesApartadas(
  acoes: RncAcaoApartada[] | undefined
): RncAcaoApartada[] {
  if (!Array.isArray(acoes)) return [];
  return acoes.map((acao) => ({
    ...acao,
    id: novoId("acao"),
  }));
}

function clonarLinhasReclamacao(
  linhas: RccLinhaReclamacao[] | undefined
): RccLinhaReclamacao[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.map((linha) => ({
    ...linha,
    id: novoId("rec"),
  }));
}

function clonarLinhasServico(
  linhas: RccLinhaServico[] | undefined
): RccLinhaServico[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.map((linha) => ({
    ...linha,
    id: novoId("srv"),
  }));
}

function prepararRncParaClone(
  origem: RncDados,
  usuarioCriacao: string
): RncDados {
  const base = normalizarRncDados({
    ...origem,
    codigoDocumento: "",
    usuarioCriacao,
    statusRnc: "em_andamento",
    dataFechamento: "",
    itensProduto: clonarItensProduto(origem.itensProduto),
    acoesApartadas: clonarAcoesApartadas(origem.acoesApartadas),
    anexos: clonarAnexos(origem.anexos),
  });

  return sincronizarAcoesApartadasLegado(base);
}

function prepararRccParaClone(
  origem: RccDados,
  usuarioCriacao: string
): RccDados {
  return normalizarRccDados({
    ...origem,
    codigoDocumento: "",
    usuarioCriacao,
    // Novo documento: reabre o fluxo sem herdar fechamento do original.
    rccFinalizada: "Não",
    dataFechamento: "",
    problemaSolucionado: "",
    clienteCorrecaoAlertada: null,
    itensProduto: clonarItensProduto(origem.itensProduto),
    linhasReclamacao: clonarLinhasReclamacao(origem.linhasReclamacao),
    linhasServico: clonarLinhasServico(origem.linhasServico),
    anexos: clonarAnexos(origem.anexos),
  });
}

/**
 * Monta o input de criação a partir de um RCC/RNC existente.
 * Gera código novo via `criarRegistro`; reabre o documento (sem fechamento).
 */
export function montarInputCloneRegistro(
  origem: Registro,
  opcoes: { responsavelId: string; usuarioCriacao: string }
): CriarRegistroInput {
  if (origem.tipo === "rnc") {
    if (!origem.rnc) {
      throw new Error("Registro RNC sem dados para clonar.");
    }
    return {
      tipo: "rnc",
      responsavelId: opcoes.responsavelId,
      rnc: prepararRncParaClone(origem.rnc, opcoes.usuarioCriacao),
    };
  }

  if (!origem.rcc) {
    throw new Error("Registro RCC sem dados para clonar.");
  }

  return {
    tipo: "rcc",
    responsavelId: opcoes.responsavelId,
    rcc: prepararRccParaClone(origem.rcc, opcoes.usuarioCriacao),
  };
}
