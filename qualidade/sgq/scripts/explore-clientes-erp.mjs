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

const nome = process.argv[2] ?? "YAGO";

const [cols] = await conn.query(`SHOW COLUMNS FROM pessoa`);
console.log(
  "pessoa cols:",
  cols.map((c) => c.Field).filter((f) => /nome|cliente|ativo|uf|municipio|cpf|cnpj/i.test(f))
);

const [sample] = await conn.query(
  `SELECT p.id, p.nome, p.nomeRazaoSocial, p.uf, p.ativo, p.cliente, p.fornecedor,
          m.nome AS municipio
   FROM pessoa p
   LEFT JOIN municipio m ON m.id = p.idMunicipio
   WHERE p.nome LIKE ?
   LIMIT 5`,
  [`%${nome}%`]
);
console.log("pessoa sample:", JSON.stringify(sample, null, 2));

const [fin] = await conn.query(
  `SELECT DISTINCT
      pes.nome AS nome,
      pes.nomeRazaoSocial AS razaoSocial,
      pes.uf AS estado,
      cid.nome AS municipio
   FROM agendamentofinanceiro af
   INNER JOIN pessoa pes ON pes.id = af.idPessoa
   LEFT JOIN municipio cid ON cid.id = pes.idMunicipio
   WHERE pes.nome LIKE ?
     AND af.idEmpresa = 1
   LIMIT 5`,
  [`%${nome}%`]
);
console.log("financeiro sample:", JSON.stringify(fin, null, 2));

await conn.end();
