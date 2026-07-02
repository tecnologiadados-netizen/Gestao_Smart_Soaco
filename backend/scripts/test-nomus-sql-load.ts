import 'dotenv/config';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { invalidarCacheNomus, carregarLinhasNomusFinanceiro } from '../src/data/dfcNomusRepository.js';
import { formatSqlDateYmd as formatYmd } from '../src/data/dfcDateUtils.js';

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), '../src/data/sql/dfcNomusFinanceiro.sql');
const blocos = readFileSync(sqlPath, 'utf8').split(/\r?\n\s*UNION\s+ALL\s*\r?\n/i);
console.log('blocos SQL no arquivo:', blocos.length);
if (blocos.length !== 2) {
  console.error('ERRO: esperados 2 blocos UNION ALL');
  process.exit(1);
}

invalidarCacheNomus();
console.log('carregando Nomus...');
const r = await carregarLinhasNomusFinanceiro(true);
console.log('linhas', r.rows.length, r.erro ?? 'ok');
const orfaosLr = r.rows.filter((x) => x.tipoRef === 'L' && x.tipoConta.toUpperCase() === 'LR');
console.log('órfãos LF (bloco 2) total:', orfaosLr.length);
const amostra = orfaosLr.filter((x) => formatYmd(x.dataBaixa) === '2026-01-02');
console.log('órfãos LR em 2026-01-02:', amostra.length);
if (amostra[0]) console.log('amostra', amostra[0]);
