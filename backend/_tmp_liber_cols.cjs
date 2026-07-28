require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const url = process.env.NOMUS_DB_URL;
  if (!url) {
    console.log("NOMUS_DB_URL nao existe");
    process.exit(1);
  }
  const conn = await mysql.createConnection(url);
  try {
    console.log("=== QUERY 1: pedidocompra / itempedidocompra ===");
    const [r1] = await conn.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pedidocompra','itempedidocompra')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    console.log(JSON.stringify(r1, null, 2));

    console.log("\n=== QUERY 2: colunas com liber ===");
    const [r2] = await conn.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(COLUMN_NAME) LIKE '%liber%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    console.log(JSON.stringify(r2, null, 2));

    const liberCols = r1.filter((c) => /liber/i.test(c.COLUMN_NAME));
    const liberOnPc = r2.filter(
      (c) => c.TABLE_NAME === "pedidocompra" || c.TABLE_NAME === "itempedidocompra"
    );
    const candidates = [
      ...new Map(
        [...liberCols, ...liberOnPc].map((c) => [`${c.TABLE_NAME}.${c.COLUMN_NAME}`, c])
      ).values(),
    ];

    const sampleCandidates = r2.filter((c) =>
      /data.*liber|liber.*data|dataHoraLiberacao|dataLiberacao/i.test(c.COLUMN_NAME)
    );

    console.log("\n=== Candidatas liberacao (sample) ===");
    console.log(JSON.stringify(sampleCandidates.length ? sampleCandidates : candidates, null, 2));

    const toSample = sampleCandidates.length ? sampleCandidates : candidates;
    for (const col of toSample) {
      const table = col.TABLE_NAME;
      let tableCols;
      if (table === "pedidocompra" || table === "itempedidocompra") {
        tableCols = r1.filter((c) => c.TABLE_NAME === table);
      } else {
        const [cols] = await conn.query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [table]
        );
        tableCols = cols;
      }

      const names = tableCols.map((c) => c.COLUMN_NAME);
      const idCol = names.find((n) => n.toLowerCase() === "id") || names.find((n) => /id$/i.test(n));
      const nomeCol = names.find((n) => n.toLowerCase() === "nome");
      const emissaoCol = names.find((n) => /dataemissao/i.test(n));
      const liberCol = col.COLUMN_NAME;

      const selectParts = [];
      if (idCol) selectParts.push("`" + idCol + "`");
      if (nomeCol) selectParts.push("`" + nomeCol + "`");
      if (emissaoCol) selectParts.push("`" + emissaoCol + "`");
      selectParts.push("`" + liberCol + "`");

      const sql =
        "SELECT " +
        selectParts.join(", ") +
        " FROM `" +
        table +
        "` WHERE `" +
        liberCol +
        "` IS NOT NULL LIMIT 3";
      console.log("\n=== SAMPLE: " + table + "." + liberCol + " ===");
      console.log("SQL: " + sql);
      try {
        const [rows] = await conn.query(sql);
        console.log(JSON.stringify(rows, null, 2));
      } catch (e) {
        console.log("Erro sample: " + e.message);
      }
    }

    if (!toSample.length) {
      console.log("\n=== SAMPLE: nenhuma coluna dataLiberacao/dataHoraLiberacao encontrada ===");
    }
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
