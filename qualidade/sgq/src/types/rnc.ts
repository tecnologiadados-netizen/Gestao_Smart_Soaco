export interface RncDados {
  codigoDocumento: string;
  /** Código do item no ERP (ex.: PA 10005, MP 6861). */
  codigoProduto: string;
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
  causa: string;
  dataFechamento: string;
  usuarioCriacao: string;
  prazoExecucao: string;
}

export type RncDadosInput = RncDados;

export function criarRncDadosVazio(codigoDocumento = ""): RncDados {
  return {
    codigoDocumento,
    codigoProduto: "",
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
    causa: "",
    dataFechamento: "",
    usuarioCriacao: "",
    prazoExecucao: "",
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
