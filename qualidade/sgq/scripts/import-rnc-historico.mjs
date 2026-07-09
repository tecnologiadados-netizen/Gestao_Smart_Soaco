import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath =
  process.argv[2] ??
  path.join(
    process.env.USERPROFILE ?? "",
    "Downloads",
    "RNC_-_Relatório_geral_de_RNC´s (1).csv"
  );
const outPath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "mock-data",
  "rnc-historico-nomus.json"
);

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ";" && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function limpar(valor) {
  const v = (valor ?? "").trim();
  if (!v || v === "-No Value-" || v === "NA") return "";
  return v;
}

function parseDataBr(valor) {
  const v = limpar(valor);
  if (!v) return "";
  const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}T12:00:00.000Z`;
}

function mapStatus(statusRnc) {
  const s = limpar(statusRnc).toLowerCase();
  if (s === "fechado") return "encerrado";
  if (s === "em andamento") return "em_tratamento";
  return "aberto";
}

function extrairNumeroErp(codigo) {
  const match = codigo.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);

const registros = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < 22) continue;

  const codigoDocumento = limpar(cols[0]);
  if (!codigoDocumento) continue;

  const dataOcorrencia = parseDataBr(cols[1]);
  const dataFechamento = parseDataBr(cols[19]);
  const status = mapStatus(cols[21]);
  const numeroErp = extrairNumeroErp(codigoDocumento);

  const rnc = {
    codigoDocumento,
    dataOcorrencia,
    tipoAcao: limpar(cols[2]),
    tipoOcorrencia: limpar(cols[3]),
    setorOcorrencia: limpar(cols[4]),
    grupoProduto: limpar(cols[5]),
    produto: limpar(cols[6]),
    tipoProduto: limpar(cols[7]),
    descricaoOcorrencia: limpar(cols[8]),
    setorDeteccao: limpar(cols[9]),
    responsavel: limpar(cols[10]),
    acaoImediata: limpar(cols[11]),
    descricaoAcaoImediata: limpar(cols[12]),
    responsavelAcaoImediata: limpar(cols[13]),
    notaFiscal: limpar(cols[14]),
    analiseProblema: limpar(cols[15]),
    quantidade: limpar(cols[16]),
    resolucaoNaoConformidade: limpar(cols[17]),
    causa: limpar(cols[18]),
    dataFechamento,
    usuarioCriacao: limpar(cols[20]),
    prazoExecucao: limpar(cols[22] ?? cols[21]),
  };

  registros.push({
    id: `nomus-rnc-${String(numeroErp).padStart(5, "0")}`,
    tipo: "rnc",
    numero: codigoDocumento,
    codigoDocumento,
    origemNomus: true,
    status,
    responsavelId: "",
    rnc,
    createdAt: dataOcorrencia || new Date().toISOString(),
    updatedAt: dataFechamento || dataOcorrencia || new Date().toISOString(),
  });
}

registros.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(registros, null, 2), "utf8");

console.log(`Importados ${registros.length} RNCs -> ${outPath}`);
