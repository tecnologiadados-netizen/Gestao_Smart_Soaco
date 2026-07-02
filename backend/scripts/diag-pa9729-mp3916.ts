/**
 * Diagnóstico PA 9729 x MP 3916 (id 6364).
 */
import 'dotenv/config';
import { getNomusPool, isNomusEnabled } from '../src/config/nomusDb.js';
import { buildEmpenhoRessupDetalheSql } from '../src/data/sqlRegistroColetaPrecos.js';

const ID_MP = 6364;
const COD_PA = '9729';

async function main(): Promise<void> {
  if (!isNomusEnabled()) process.exit(0);
  const pool = getNomusPool();
  if (!pool) process.exit(1);

  const sql = buildEmpenhoRessupDetalheSql(true);
  const [rows] = (await pool.query(sql, [ID_MP])) as [Record<string, unknown>[], unknown];
  const paRows = (rows ?? []).filter((r) => String(r.codigoPa ?? '').includes(COD_PA));
  console.log('Detalhe empenho PA 9729:', paRows);

  const [paIdRow] = (await pool.query(`Select id, nome From produto Where nome Like ?`, [`%${COD_PA}%`])) as [
    Record<string, unknown>[],
    unknown,
  ];
  console.log('Produto PA:', paIdRow);

  const idPa = Number(paIdRow?.[0]?.id ?? 0);
  if (idPa > 0) {
    const [openRows] = (await pool.query(
      `Select pd.nome As pedido, Sum(If((ip.status In (5, 4, 6)), 0, (If((ip.qtde >= ip.qtdeAtendida),
        (ip.qtde - ip.qtdeAtendida), 0)))) As openQty
      From itempedido ip
      Left Join pedido pd On pd.id = ip.idPedido
      Where ip.status In (2, 3) And ip.idProduto = ? And pd.nome Like ?
      Group By pd.nome`,
      [idPa, '%49187%']
    )) as [Record<string, unknown>[], unknown];
    console.log('Open PA 9729 PD 49187:', openRows);
  }
}

main().catch(console.error);
