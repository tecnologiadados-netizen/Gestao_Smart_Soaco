import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const xlsxPath =
  process.argv[2] ??
  path.join(
    process.env.USERPROFILE ?? "",
    "Downloads",
    "SAC_-_Relatório_geral_assistências.xlsx"
  );
const outPath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "mock-data",
  "rcc-historico-nomus.json"
);

function limpar(valor) {
  const v = String(valor ?? "").trim();
  if (!v || v === "-No Value-" || v === "NA") return "";
  return v;
}

function excelParaIso(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  if (typeof valor === "number" && valor > 10000) {
    const date = new Date(Math.round((valor - 25569) * 86400 * 1000));
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}T12:00:00.000Z`;
  }
  const texto = limpar(valor);
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}T12:00:00.000Z`;
}

function mapStatus(status) {
  const s = limpar(status).toLowerCase();
  if (s === "fechado") return "encerrado";
  if (s === "em andamento") return "em_tratamento";
  return "aberto";
}

function extrairNumeroErp(codigo) {
  const match = codigo.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function extrairCodigoProduto(produto) {
  const match = produto.match(/^([A-Z]{2,4}\s+[\dA-Za-z./]+)\s*-/i);
  return match ? match[1].trim().toUpperCase().replace(/\s+/g, " ") : "";
}

const wb = XLSX.readFile(xlsxPath);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const registros = [];

for (const row of rows) {
  const codigoDocumento = limpar(row["Código do documento"]);
  if (!codigoDocumento) continue;

  const produto = limpar(row["Produto_RCC"]);
  const dataRegistro = excelParaIso(row["Data de registro da reclamação"]);
  const dataFechamento = excelParaIso(row["Date de Data de fechamento"]);
  const status = mapStatus(row["Status atual"]);
  const numeroErp = extrairNumeroErp(codigoDocumento);

  const rcc = {
    codigoDocumento,
    codigoProduto: extrairCodigoProduto(produto),
    dataRegistroReclamacao: dataRegistro,
    cidade: limpar(row["Cidade"]),
    nomeClienteConsumidor: limpar(row["Nome cliente consumidor"]),
    produto,
    grupoProduto: limpar(row["Grupo de produto"]),
    dataEmissaoNf: excelParaIso(row["Date de Data da Emissão NF"]),
    produtoNossaFabricacao: limpar(row["Produto de nossa fabricação?"]),
    produtoDentroGarantia: limpar(row["Produto dentro da garantia?"]),
    quantidade: limpar(row["Quantidade1"]),
    descricaoReclamacao: limpar(row["Descrição da reclamação"]),
    analiseCausaQualidade: limpar(row["Análise de Causa (Qualidade)"]),
    comentario: limpar(row["Comentário"]),
    reclamacao1: limpar(row["Reclamação 1"]),
    reclamacao2: limpar(row["Reclamação 2"]),
    servicoRealizado: limpar(row["Serviço realizado"]),
    servicoRealizado1: limpar(row["Serviço realizado (1)"]),
    servicoRealizado2: limpar(row["Serviço realizado (2)"]),
    funcionarioSolicitado: limpar(row["Funcionário solicitado"]),
    dataFechamento,
    causaProblema: limpar(row["Causa do Problema"]),
    estado: limpar(row["Estado"]),
    usuarioCriacao: limpar(row["Usuário responsável pela criação do documento"]),
  };

  registros.push({
    id: `nomus-rcc-${String(numeroErp).padStart(5, "0")}`,
    tipo: "rcc",
    numero: codigoDocumento,
    codigoDocumento,
    origemNomus: true,
    status,
    responsavelId: "",
    rcc,
    createdAt: dataRegistro || new Date().toISOString(),
    updatedAt: dataFechamento || dataRegistro || new Date().toISOString(),
  });
}

registros.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(registros, null, 2), "utf8");

console.log(`Importados ${registros.length} RCCs -> ${outPath}`);
