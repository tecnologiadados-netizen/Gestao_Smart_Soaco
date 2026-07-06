import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const historicoPath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "mock-data",
  "rnc-historico-nomus.json"
);
const outPath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "mock-data",
  "produtos-catalogo-rnc.json"
);

const historico = JSON.parse(fs.readFileSync(historicoPath, "utf8"));

/** @type {Map<string, { codigo: string; descricao: string; grupoProduto: string; tipoProduto: string }>} */
const mapa = new Map();

const regexCodigo = /^([A-Z]{2,4}\s+[\dA-Za-z./]+)\s*-\s*(.+)$/i;

for (const registro of historico) {
  const produto = registro.rnc?.produto?.trim();
  const grupo = registro.rnc?.grupoProduto?.trim() ?? "";
  const tipo = registro.rnc?.tipoProduto?.trim() ?? "";
  if (!produto) continue;

  const match = produto.match(regexCodigo);
  if (!match) continue;

  const codigo = match[1].trim().toUpperCase().replace(/\s+/g, " ");
  const descricao = match[2].trim();
  const chave = codigo;

  if (!mapa.has(chave)) {
    mapa.set(chave, { codigo, descricao, grupoProduto: grupo, tipoProduto: tipo });
    continue;
  }

  const existente = mapa.get(chave);
  if (!existente.grupoProduto && grupo) existente.grupoProduto = grupo;
  if (!existente.tipoProduto && tipo) existente.tipoProduto = tipo;
}

const catalogo = [...mapa.values()].sort((a, b) =>
  a.codigo.localeCompare(b.codigo, "pt-BR")
);

fs.writeFileSync(outPath, JSON.stringify(catalogo, null, 2), "utf8");
console.log(`Catálogo: ${catalogo.length} produtos -> ${outPath}`);
