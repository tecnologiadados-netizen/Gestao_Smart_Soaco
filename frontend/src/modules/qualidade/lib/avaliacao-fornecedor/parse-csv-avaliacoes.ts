import type { CriterioId } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { calcularMediaNotas } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import type { AvaliacaoFornecedor } from "@qualidade/types/avaliacao-fornecedor";

export interface LinhaCsvAeps {
  codigoDocumento: string;
  dataReferencia: string;
  dataAvaliacao: string;
  responsavel: string;
  empresa: string;
  numeroDocumento: string;
  notaCompromisso: number;
  notaQualidade: number;
  notaDocumento: number;
  notaRecursos: number;
  rncNumero?: string;
}

const AVALIADOR_IDS: Record<string, string> = {
  "barbara quelly": "user-barbara-quelly",
  "bárbara quelly": "user-barbara-quelly",
  "fernanda soares": "user-fernanda-soares",
};

function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

function normalizarChave(valor: string): string {
  return normalizarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseDataBr(valor: string): string | null {
  const texto = valor.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

export function parseDataAvaliacaoCsv(valor: string): string | null {
  const texto = valor.trim();
  const br = parseDataBr(texto);
  if (br) return br;

  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

function parseNota(valor: string): number | null {
  const nota = Number(valor.trim());
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return null;
  return nota;
}

function parseLinhaCsv(linha: string): LinhaCsvAeps | null {
  const partes = linha.split(";");
  if (partes.length < 12) return null;

  const [
    codigoDocumento,
    dataReferencia,
    dataAvaliacao,
    responsavel,
    empresa,
    numeroDocumento,
    notaCompromisso,
    notaQualidade,
    notaDocumento,
    notaRecursos,
    ,
    rncNumero,
  ] = partes;

  if (!codigoDocumento?.trim() || !empresa?.trim()) return null;

  const compromisso = parseNota(notaCompromisso);
  const qualidade = parseNota(notaQualidade);
  const documento = parseNota(notaDocumento);
  const recursos = parseNota(notaRecursos);

  if (
    compromisso == null ||
    qualidade == null ||
    documento == null ||
    recursos == null
  ) {
    return null;
  }

  const rnc = rncNumero?.trim();
  const rncLimpo =
    rnc && rnc !== "-No Value-" && rnc !== "-" ? rnc : undefined;

  return {
    codigoDocumento: normalizarTexto(codigoDocumento),
    dataReferencia: dataReferencia.trim(),
    dataAvaliacao: dataAvaliacao.trim(),
    responsavel: normalizarTexto(responsavel),
    empresa: normalizarTexto(empresa),
    numeroDocumento: normalizarTexto(numeroDocumento),
    notaCompromisso: compromisso,
    notaQualidade: qualidade,
    notaDocumento: documento,
    notaRecursos: recursos,
    rncNumero: rncLimpo,
  };
}

export function parseCsvAeps(conteudo: string): LinhaCsvAeps[] {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim());
  const resultado: LinhaCsvAeps[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = parseLinhaCsv(linhas[i]);
    if (linha) resultado.push(linha);
  }

  return resultado;
}

function resolverAvaliadorId(responsavel: string): string {
  return AVALIADOR_IDS[normalizarChave(responsavel)] ?? "user-importacao-erp";
}

function notaMediaCamposExtras(
  compromisso: number,
  qualidade: number,
  documento: number,
  recursos: number
): number {
  const media = (compromisso + qualidade + documento + recursos) / 4;
  return Math.min(5, Math.max(1, Math.round(media)));
}

export function linhaCsvParaAvaliacao(linha: LinhaCsvAeps): AvaliacaoFornecedor | null {
  const dataReferencia = parseDataBr(linha.dataReferencia);
  const dataAvaliacao = parseDataAvaliacaoCsv(linha.dataAvaliacao);

  if (!dataReferencia || !dataAvaliacao) return null;

  const mediaExtra = notaMediaCamposExtras(
    linha.notaCompromisso,
    linha.notaQualidade,
    linha.notaDocumento,
    linha.notaRecursos
  );

  const notas = {
    qualidade: linha.notaQualidade,
    prazo: mediaExtra,
    atendimento: mediaExtra,
    preco: mediaExtra,
    documentacao: linha.notaDocumento,
    recursos: linha.notaRecursos,
  } satisfies Record<CriterioId, number>;

  const fornecedorNome = linha.empresa;
  const fornecedorId = fornecedorNome;

  return {
    id: `import-${linha.codigoDocumento}`,
    fornecedorId,
    fornecedorNome,
    avaliadorId: resolverAvaliadorId(linha.responsavel),
    dataReferencia,
    dataAvaliacao,
    numeroDocumento: linha.numeroDocumento,
    fornecedorAprovado: calcularMediaNotas(notas) >= 3,
    rncNumero: linha.rncNumero,
    notas,
    media: calcularMediaNotas(notas),
    observacoes: `Importado do ERP (${linha.codigoDocumento}). Responsável: ${linha.responsavel}.`,
  };
}

export function csvAepsParaAvaliacoes(conteudo: string): AvaliacaoFornecedor[] {
  const linhas = parseCsvAeps(conteudo);
  const avaliacoes: AvaliacaoFornecedor[] = [];
  const ids = new Set<string>();

  for (const linha of linhas) {
    const avaliacao = linhaCsvParaAvaliacao(linha);
    if (!avaliacao || ids.has(avaliacao.id)) continue;
    ids.add(avaliacao.id);
    avaliacoes.push(avaliacao);
  }

  return avaliacoes.sort((a, b) =>
    (b.dataAvaliacao ?? "").localeCompare(a.dataAvaliacao ?? "")
  );
}
