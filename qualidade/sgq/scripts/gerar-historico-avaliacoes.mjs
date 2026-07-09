import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Compila via ts-node alternativo: reimplementação mínima inline para o script
import { parse } from "node:path";

const csvPath =
  process.argv[2] ??
  path.resolve(
    process.env.USERPROFILE ?? "",
    "Downloads/AEPS_-_Avaliação_de_Empresas_Prestadoras_de_Serviço.csv"
  );

const outPath = path.join(
  root,
  "src/lib/mock-data/avaliacoes-fornecedor-historico.json"
);

function normalizarTexto(valor) {
  return valor.trim().replace(/\s+/g, " ");
}

function normalizarChave(valor) {
  return normalizarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseDataBr(valor) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

function parseDataAvaliacaoCsv(valor) {
  const br = parseDataBr(valor);
  if (br) return br;
  const data = new Date(valor.trim());
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

function parseNota(valor) {
  const nota = Number(String(valor).trim());
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return null;
  return nota;
}

const AVALIADOR_IDS = {
  "barbara quelly": "user-barbara-quelly",
  "fernanda soares": "user-fernanda-soares",
};

function calcularMediaNotas(notas) {
  const valores = Object.values(notas);
  const soma = valores.reduce((t, n) => t + n, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

function notaMediaCamposExtras(c, q, d, r) {
  const media = (c + q + d + r) / 4;
  return Math.min(5, Math.max(1, Math.round(media)));
}

function linhaCsvParaAvaliacao(partes) {
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

  const compromisso = parseNota(notaCompromisso);
  const qualidade = parseNota(notaQualidade);
  const documento = parseNota(notaDocumento);
  const recursos = parseNota(notaRecursos);
  const ref = parseDataBr(dataReferencia);
  const av = parseDataAvaliacaoCsv(dataAvaliacao);

  if (
    !codigoDocumento?.trim() ||
    !empresa?.trim() ||
    compromisso == null ||
    qualidade == null ||
    documento == null ||
    recursos == null ||
    !ref ||
    !av
  ) {
    return null;
  }

  const mediaExtra = notaMediaCamposExtras(
    compromisso,
    qualidade,
    documento,
    recursos
  );

  const notas = {
    qualidade,
    compromisso,
    prazo: mediaExtra,
    atendimento: mediaExtra,
    preco: mediaExtra,
    documentacao: documento,
    recursos,
  };

  const rnc = rncNumero?.trim();
  const rncLimpo =
    rnc && rnc !== "-No Value-" && rnc !== "-" ? normalizarTexto(rnc) : undefined;

  const resp = normalizarTexto(responsavel);
  const codigo = normalizarTexto(codigoDocumento);
  const fornecedorNome = normalizarTexto(empresa);

  return {
    id: `import-${codigo}`,
    fornecedorId: fornecedorNome,
    fornecedorNome,
    avaliadorId:
      AVALIADOR_IDS[normalizarChave(resp)] ?? "user-importacao-erp",
    dataReferencia: ref,
    dataAvaliacao: av,
    numeroDocumento: normalizarTexto(numeroDocumento),
    fornecedorAprovado: calcularMediaNotas(notas) >= 3,
    rncNumero: rncLimpo,
    notas,
    media: calcularMediaNotas(notas),
    observacoes: `Importado do ERP (${codigo}). Responsável: ${resp}.`,
  };
}

const conteudo = fs.readFileSync(csvPath, "utf8");
const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim());
const avaliacoes = [];
const ids = new Set();

for (let i = 1; i < linhas.length; i++) {
  const av = linhaCsvParaAvaliacao(linhas[i].split(";"));
  if (!av || ids.has(av.id)) continue;
  ids.add(av.id);
  avaliacoes.push(av);
}

avaliacoes.sort((a, b) => b.dataAvaliacao.localeCompare(a.dataAvaliacao));

fs.writeFileSync(outPath, JSON.stringify(avaliacoes), "utf8");
console.log(`Importadas ${avaliacoes.length} avaliações -> ${outPath}`);
