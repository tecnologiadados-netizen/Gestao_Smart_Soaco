import type {
  Document,
  DocumentExternoRegistro,
  DocumentPermissoes,
  DocumentoAnexoArquivo,
  DocumentoRegistroOcorrencia,
  PermissaoAcessoDocumento,
  RetencaoUnidade,
} from "@qualidade/types/document";

export const REGISTRO_INTERNO_SIGLA = "RE";

export interface RegistroInternoFormValues {
  titulo: string;
  processoId: string;
  responsavelId: string;
  localizacao: string;
  permissaoAcesso: PermissaoAcessoDocumento | "";
  retencaoValor: string;
  retencaoUnidade: RetencaoUnidade;
  protecao: string;
  recuperacao: string;
  observacao: string;
  modeloNome: string;
  modeloDataUrl: string;
  modeloStoragePath?: string;
}

export interface RegistroOcorrenciaArquivo extends DocumentoRegistroOcorrencia {
  dataUrl: string;
}

export function defaultRegistroInternoValues(
  responsavelId = ""
): RegistroInternoFormValues {
  return {
    titulo: "",
    processoId: "",
    responsavelId,
    localizacao: "",
    permissaoAcesso: "todos",
    retencaoValor: "",
    retencaoUnidade: "anos",
    protecao: "",
    recuperacao: "",
    observacao: "",
    modeloNome: "",
    modeloDataUrl: "",
  };
}

export function registroInternoValuesFromDocument(
  doc: Document,
  versaoAtual?: {
    arquivoNome?: string;
    arquivoDataUrl?: string;
    arquivoStoragePath?: string;
  },
  fallbackResponsavelId = ""
): RegistroInternoFormValues {
  const reg = doc.externoRegistro;
  const modelo = modeloDoRegistro(doc, versaoAtual);
  const prazo = parsePrazoRetencao(
    reg?.retencao,
    reg?.retencaoValor,
    reg?.retencaoUnidade
  );
  return {
    titulo: doc.titulo ?? "",
    processoId: doc.setorId ?? "",
    responsavelId: fallbackResponsavelId,
    localizacao: doc.localizacao ?? "",
    permissaoAcesso: reg?.permissaoAcesso ?? "todos",
    retencaoValor: prazo.valor,
    retencaoUnidade: prazo.unidade,
    protecao: reg?.protecao ?? "",
    recuperacao: reg?.recuperacao ?? "",
    observacao: reg?.observacao ?? "",
    modeloNome: modelo?.nome ?? "",
    modeloDataUrl: modelo?.dataUrl ?? "",
    modeloStoragePath: modelo?.storagePath,
  };
}

export function buildRegistroInternoMeta(
  values: RegistroInternoFormValues,
  ocorrencias?: DocumentoRegistroOcorrencia[]
): DocumentExternoRegistro {
  return {
    unidadeTodos: true,
    distribuicaoEletronica: true,
    distribuicaoFisica: false,
    avisarAntesAtivo: false,
    avisarAntesDias: 30,
    observacao: values.observacao.trim() || undefined,
    protecao: values.protecao.trim() || undefined,
    recuperacao: values.recuperacao.trim() || undefined,
    associarDocumentos: false,
    documentosAssociadosIds: [],
    permissaoAcesso: (values.permissaoAcesso ||
      "todos") as PermissaoAcessoDocumento,
    ...buildRetencaoMeta(values.retencaoValor, values.retencaoUnidade),
    modelo: values.modeloNome.trim()
      ? {
          nome: values.modeloNome.trim(),
          dataUrl: "",
          ...(values.modeloStoragePath
            ? { storagePath: values.modeloStoragePath }
            : {}),
        }
      : undefined,
    ocorrencias: ocorrencias?.length ? ocorrencias : undefined,
  };
}

export function formatarPrazoRetencao(
  valor: number,
  unidade: RetencaoUnidade
): string {
  if (!Number.isFinite(valor) || valor < 1) return "";
  const n = Math.floor(valor);
  if (unidade === "meses") return n === 1 ? "1 mês" : `${n} meses`;
  return n === 1 ? "1 ano" : `${n} anos`;
}

export function parsePrazoRetencao(
  texto?: string,
  valor?: number,
  unidade?: RetencaoUnidade
): { valor: string; unidade: RetencaoUnidade } {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= 1 &&
    (unidade === "meses" || unidade === "anos")
  ) {
    return { valor: String(Math.floor(valor)), unidade };
  }
  const raw = (texto ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const match = raw.match(/^(\d+)\s*(anos?|ano|meses|mês|mes)$/i);
  if (match) {
    const n = match[1];
    const u = match[2].startsWith("ano") ? "anos" : "meses";
    return { valor: n, unidade: u };
  }
  return { valor: "", unidade: "anos" };
}

function buildRetencaoMeta(
  valorRaw: string,
  unidade: RetencaoUnidade
): Pick<
  DocumentExternoRegistro,
  "retencao" | "retencaoValor" | "retencaoUnidade"
> {
  const valor = Number.parseInt(valorRaw.trim(), 10);
  if (!Number.isFinite(valor) || valor < 1) {
    return {};
  }
  return {
    retencao: formatarPrazoRetencao(valor, unidade),
    retencaoValor: valor,
    retencaoUnidade: unidade,
  };
}

export function labelPrazoRetencaoDocumento(
  reg: DocumentExternoRegistro | undefined
): string {
  if (!reg) return "—";
  if (
    typeof reg.retencaoValor === "number" &&
    (reg.retencaoUnidade === "meses" || reg.retencaoUnidade === "anos")
  ) {
    return formatarPrazoRetencao(reg.retencaoValor, reg.retencaoUnidade) || "—";
  }
  return reg.retencao?.trim() || "—";
}

export function modeloDoRegistro(
  doc: Document,
  versao?: {
    arquivoNome?: string;
    arquivoDataUrl?: string;
    arquivoStoragePath?: string;
  }
): DocumentoAnexoArquivo | null {
  const meta = doc.externoRegistro?.modelo;
  const nome = meta?.nome?.trim() || "";
  if (!nome || !meta) return null;
  return {
    nome,
    dataUrl: versao?.arquivoDataUrl ?? "",
    ...(meta.storagePath || versao?.arquivoStoragePath
      ? { storagePath: meta.storagePath ?? versao?.arquivoStoragePath }
      : {}),
  };
}

export function buildPermissoesFromRegistroInterno(
  values: RegistroInternoFormValues
): DocumentPermissoes {
  const consultarTodos = values.permissaoAcesso === "todos";
  return {
    avisoPublicacaoEmailIds: [],
    baixarArquivoIds: [],
    imprimirArquivoIds: [],
    copiasDistribuidasIds: [],
    consultarTodos,
    consultarIds:
      values.permissaoAcesso === "responsavel" && values.responsavelId
        ? [values.responsavelId]
        : [],
  };
}

function arquivoTemConteudo(arquivo: {
  dataUrl?: string;
  storagePath?: string;
}) {
  return Boolean(arquivo.dataUrl?.trim() || arquivo.storagePath?.trim());
}

export function mergeRegistroOcorrencias(
  ocorrencias: DocumentoRegistroOcorrencia[] | undefined,
  anexos: DocumentoAnexoArquivo[] | undefined
): RegistroOcorrenciaArquivo[] {
  const files = anexos ?? [];
  const used = new Set<number>();

  const filesOcorrencia = files.filter((a) => Boolean(a.ocorrenciaId));
  if ((!ocorrencias || ocorrencias.length === 0) && filesOcorrencia.length > 0) {
    return filesOcorrencia
      .filter((a) => a.nome?.trim() && arquivoTemConteudo(a))
      .map((a, i) => ({
        id: a.ocorrenciaId ?? `legado-${i}-${a.nome}`,
        nome: a.nome,
        dataOcorrencia: "",
        criadoEm: "",
        dataUrl: a.dataUrl ?? "",
        storagePath: a.storagePath,
      }));
  }

  function pickFile(ocorrencia: DocumentoRegistroOcorrencia, index: number) {
    const byId = files.findIndex(
      (a, idx) => !used.has(idx) && a.ocorrenciaId === ocorrencia.id
    );
    if (byId >= 0) return byId;
    const byPath = files.findIndex(
      (a, idx) =>
        !used.has(idx) &&
        Boolean(a.storagePath?.trim()) &&
        a.storagePath === ocorrencia.storagePath
    );
    if (byPath >= 0) return byPath;
    const byNome = files.findIndex(
      (a, idx) => !used.has(idx) && a.nome === ocorrencia.nome
    );
    if (byNome >= 0) return byNome;
    if (!used.has(index) && files[index]) return index;
    return -1;
  }

  return (ocorrencias ?? []).map((ocorrencia, index) => {
    const fileIdx = pickFile(ocorrencia, index);
    const file = fileIdx >= 0 ? files[fileIdx] : undefined;
    if (fileIdx >= 0) used.add(fileIdx);
    return {
      ...ocorrencia,
      dataUrl: file?.dataUrl ?? "",
      storagePath: ocorrencia.storagePath ?? file?.storagePath,
    };
  });
}

export function sortOcorrenciasMaisRecente(
  ocorrencias: RegistroOcorrenciaArquivo[]
): RegistroOcorrenciaArquivo[] {
  return [...ocorrencias].sort((a, b) => {
    const byDate = b.dataOcorrencia.localeCompare(a.dataOcorrencia);
    if (byDate !== 0) return byDate;
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}

export function ocorrenciaTemArquivo(ocorrencia: RegistroOcorrenciaArquivo) {
  return Boolean(ocorrencia.nome?.trim() && arquivoTemConteudo(ocorrencia));
}
