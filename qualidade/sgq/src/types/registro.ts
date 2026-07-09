import type { RncDados } from "@/types/rnc";
import type { RccDados } from "@/types/rcc";

export type RegistroTipo = "rnc" | "rcc";

export type RegistroStatus = "aberto" | "em_tratamento" | "encerrado";

export interface Registro {
  id: string;
  tipo: RegistroTipo;
  numero: string;
  codigoDocumento: string;
  origemNomus?: boolean;
  status: RegistroStatus;
  responsavelId: string;
  createdAt: string;
  updatedAt: string;
  rnc?: RncDados;
  rcc?: RccDados;
}

export interface CriarRegistroRncInput {
  tipo: "rnc";
  responsavelId: string;
  rnc: RncDados;
  status?: RegistroStatus;
}

export interface CriarRegistroRccInput {
  tipo: "rcc";
  responsavelId: string;
  rcc: RccDados;
  status?: RegistroStatus;
}

export type CriarRegistroInput = CriarRegistroRncInput | CriarRegistroRccInput;

export interface AtualizarRegistroRncInput {
  id: string;
  rnc: RncDados;
  status?: RegistroStatus;
}

export function getRegistroResponsavelNome(registro: Registro): string {
  if (registro.tipo === "rnc" && registro.rnc?.responsavel) {
    return registro.rnc.responsavel;
  }
  if (registro.tipo === "rcc" && registro.rcc?.usuarioCriacao) {
    return registro.rcc.usuarioCriacao;
  }
  return "";
}

export function getRegistroCodigoDocumento(registro: Registro): string {
  return registro.codigoDocumento || registro.numero;
}

export function getRegistroDataOcorrencia(registro: Registro): string {
  if (registro.tipo === "rnc") {
    return registro.rnc?.dataOcorrencia ?? registro.createdAt;
  }
  if (registro.tipo === "rcc") {
    return registro.rcc?.dataRegistroReclamacao ?? registro.createdAt;
  }
  return registro.createdAt;
}

export function getRegistroProduto(registro: Registro): string {
  if (registro.tipo === "rnc") return registro.rnc?.produto ?? "";
  if (registro.tipo === "rcc") return registro.rcc?.produto ?? "";
  return "";
}

export function getRegistroInfoPrincipal(registro: Registro): string {
  if (registro.tipo === "rnc") return registro.rnc?.setorOcorrencia ?? "";
  if (registro.tipo === "rcc") {
    return registro.rcc?.nomeClienteConsumidor ?? "";
  }
  return "";
}

export function getRegistroDetalheSecundario(registro: Registro): string {
  if (registro.tipo === "rnc") return registro.rnc?.tipoOcorrencia ?? "";
  if (registro.tipo === "rcc") return registro.rcc?.reclamacao1 ?? "";
  return "";
}

export function getRegistroDataFechamento(registro: Registro): string {
  if (registro.tipo === "rnc") return registro.rnc?.dataFechamento ?? "";
  if (registro.tipo === "rcc") return registro.rcc?.dataFechamento ?? "";
  return "";
}
