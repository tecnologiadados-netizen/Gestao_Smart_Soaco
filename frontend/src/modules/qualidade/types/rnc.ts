import type { RegistroAnexo } from "@qualidade/types/registro-anexo";
import { normalizarRegistroAnexos } from "@qualidade/types/registro-anexo";

export type RncAcaoStatus = "cancelada" | "concluida" | "reprogramada";

export interface RncAcaoApartada {
  id: string;
  acao: string;
  responsavel: string;
  prazoExecucao: string;
  status: RncAcaoStatus | "";
}

export interface RncDados {
  codigoDocumento: string;
  /** Código do item no ERP (ex.: PA 10005, MP 6861). */
  codigoProduto: string;
  loteSerie: string;
  numeroOrdemProducao: string;
  dataOcorrencia: string;
  tipoAcao: string;
  tipoOcorrencia: string;
  setorOcorrencia: string;
  grupoProduto: string;
  produto: string;
  tipoProduto: string;
  descricaoOcorrencia: string;
  setorDeteccao: string;
  responsavel: string;
  acaoImediata: string;
  descricaoAcaoImediata: string;
  responsavelAcaoImediata: string;
  notaFiscal: string;
  analiseProblema: string;
  quantidade: string;
  resolucaoNaoConformidade: string;
  registrarPlanoAcao: boolean;
  /** Cinco porquês do plano de ação (1° a 5°). */
  porques: string[];
  causa: string;
  dataFechamento: string;
  usuarioCriacao: string;
  prazoExecucao: string;
  inserirAcoesApartadas: boolean;
  acoesApartadas: RncAcaoApartada[];
  /** @deprecated Mantido para registros antigos — use acoesApartadas */
  acaoCorretiva2: string;
  responsavelAcao2: string;
  prazoAcao2: string;
  acaoCorretiva3: string;
  responsavelAcao3: string;
  prazoAcao3: string;
  analiseEficaz: string;
  anexos: RegistroAnexo[];
}

export type RncDadosInput = RncDados;

export function criarRncAcaoApartadaVazia(): RncAcaoApartada {
  return {
    id: `acao-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    acao: "",
    responsavel: "",
    prazoExecucao: "",
    status: "",
  };
}

export function criarPorquesVazios(): string[] {
  return ["", "", "", "", ""];
}

function normalizarListaPorques(porques: unknown): string[] {
  if (!Array.isArray(porques)) return criarPorquesVazios();
  return [...porques.map((item) => String(item ?? "").trim()), "", "", "", "", ""].slice(
    0,
    5
  );
}

function normalizarAcoesApartadas(
  merged: RncDados
): Pick<RncDados, "inserirAcoesApartadas" | "acoesApartadas"> {
  if (Array.isArray(merged.acoesApartadas) && merged.acoesApartadas.length > 0) {
    return {
      inserirAcoesApartadas: Boolean(merged.inserirAcoesApartadas),
      acoesApartadas: merged.acoesApartadas.map((item, index) => ({
        id: item.id || `acao-legado-${index}`,
        acao: item.acao ?? "",
        responsavel: item.responsavel ?? "",
        prazoExecucao: item.prazoExecucao ?? "",
        status: item.status ?? "",
      })),
    };
  }

  const acoesLegadas: RncAcaoApartada[] = [];
  if (
    merged.acaoCorretiva2.trim() ||
    merged.responsavelAcao2.trim() ||
    merged.prazoAcao2.trim()
  ) {
    acoesLegadas.push({
      id: "acao-legado-1",
      acao: merged.acaoCorretiva2,
      responsavel: merged.responsavelAcao2,
      prazoExecucao: merged.prazoAcao2,
      status: "",
    });
  }
  if (
    merged.acaoCorretiva3.trim() ||
    merged.responsavelAcao3.trim() ||
    merged.prazoAcao3.trim()
  ) {
    acoesLegadas.push({
      id: "acao-legado-2",
      acao: merged.acaoCorretiva3,
      responsavel: merged.responsavelAcao3,
      prazoExecucao: merged.prazoAcao3,
      status: "",
    });
  }

  if (acoesLegadas.length > 0) {
    return {
      inserirAcoesApartadas: true,
      acoesApartadas: acoesLegadas,
    };
  }

  return {
    inserirAcoesApartadas: Boolean(merged.inserirAcoesApartadas),
    acoesApartadas: [],
  };
}

function normalizarPlanoAcao(
  merged: RncDados
): Pick<RncDados, "registrarPlanoAcao" | "porques"> {
  const porquesInformados = normalizarListaPorques(merged.porques);
  if (porquesInformados.some((item) => item.trim())) {
    return {
      registrarPlanoAcao: Boolean(merged.registrarPlanoAcao),
      porques: porquesInformados,
    };
  }

  const linhas = merged.causa
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length >= 2) {
    return {
      registrarPlanoAcao: true,
      porques: normalizarListaPorques(linhas),
    };
  }

  return {
    registrarPlanoAcao: Boolean(merged.registrarPlanoAcao),
    porques: criarPorquesVazios(),
  };
}

/** Converte registros antigos (ação 2/3 fixas) para a tabela dinâmica. */
export function normalizarRncDados(dados: Partial<RncDados> & Record<string, unknown>): RncDados {
  const merged = { ...criarRncDadosVazio(), ...dados } as RncDados;
  return {
    ...merged,
    ...normalizarAcoesApartadas(merged),
    ...normalizarPlanoAcao(merged),
    anexos: normalizarRegistroAnexos(merged.anexos),
  };
}

export function sincronizarAcoesApartadasLegado(dados: RncDados): RncDados {
  const acoes = dados.inserirAcoesApartadas ? dados.acoesApartadas : [];
  return {
    ...dados,
    acaoCorretiva2: acoes[0]?.acao ?? "",
    responsavelAcao2: acoes[0]?.responsavel ?? "",
    prazoAcao2: acoes[0]?.prazoExecucao ?? "",
    acaoCorretiva3: acoes[1]?.acao ?? "",
    responsavelAcao3: acoes[1]?.responsavel ?? "",
    prazoAcao3: acoes[1]?.prazoExecucao ?? "",
  };
}

export function criarRncDadosVazio(codigoDocumento = ""): RncDados {
  return {
    codigoDocumento,
    codigoProduto: "",
    loteSerie: "",
    numeroOrdemProducao: "",
    dataOcorrencia: "",
    tipoAcao: "",
    tipoOcorrencia: "",
    setorOcorrencia: "",
    grupoProduto: "",
    produto: "",
    tipoProduto: "",
    descricaoOcorrencia: "",
    setorDeteccao: "",
    responsavel: "",
    acaoImediata: "",
    descricaoAcaoImediata: "",
    responsavelAcaoImediata: "",
    notaFiscal: "",
    analiseProblema: "",
    quantidade: "",
    resolucaoNaoConformidade: "",
    registrarPlanoAcao: false,
    porques: criarPorquesVazios(),
    causa: "",
    dataFechamento: "",
    usuarioCriacao: "",
    prazoExecucao: "",
    inserirAcoesApartadas: false,
    acoesApartadas: [],
    acaoCorretiva2: "",
    responsavelAcao2: "",
    prazoAcao2: "",
    acaoCorretiva3: "",
    responsavelAcao3: "",
    prazoAcao3: "",
    analiseEficaz: "",
    anexos: [],
  };
}

export function isoParaInputDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function inputDateParaIso(date: string): string {
  if (!date) return "";
  return `${date}T12:00:00.000Z`;
}
