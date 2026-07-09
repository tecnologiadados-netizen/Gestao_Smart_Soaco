import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1].trim()] ??= match[2].trim();
  }
}

loadEnv();

process.env.NODE_ENV = "development";

const { getProdutos, getCatalogoSource } = await import(
  "../src/lib/registros/get-produtos.ts"
);

console.log("source:", getCatalogoSource());

const exato = await getProdutos({ codigo: "PA 0608", limit: 1 });
console.log("exato:", exato);

const busca = await getProdutos({ q: "10005", limit: 3 });
console.log("busca:", busca);
