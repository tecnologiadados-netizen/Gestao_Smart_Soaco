import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

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

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 15000,
});

const baseFrom = `
  FROM dw_saldoestoque se
  JOIN setorestoque st
    ON se.codigoSetorEstoque = st.id
   AND se.codigoEmpresa = st.idEmpresa
  WHERE se.ativoProduto = 'Sim'
    AND st.ativo = 1
    AND st.idEmpresa = 1
    AND st.consideraComoSaldoDisponivel = 1
`;

const [count] = await conn.query(
  `SELECT COUNT(DISTINCT se.codigoProduto) AS total ${baseFrom}`
);
console.log("distinct products:", count[0].total);

const [search] = await conn.query(
  `SELECT DISTINCT se.codigoProduto, se.descricaoProduto, se.grupoProduto, se.tipoProduto
   ${baseFrom}
   AND (se.codigoProduto LIKE ? OR se.descricaoProduto LIKE ? OR se.grupoProduto LIKE ?)
   ORDER BY se.codigoProduto ASC
   LIMIT 5`,
  ["%10005%", "%10005%", "%10005%"]
);
console.log("search PA 10005:", JSON.stringify(search, null, 2));

await conn.end();
