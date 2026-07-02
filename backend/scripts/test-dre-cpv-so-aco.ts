import 'dotenv/config';
import { queryDreCpvSoAco } from '../src/data/dreCpvSoAcoRepository.js';

async function main() {
  const r = await queryDreCpvSoAco({ dataInicio: '2026-01-01', dataFim: '2026-01-31' });
  console.log('erro:', r.erro ?? '(nenhum)');
  console.log('direto:', r.direto.length, 'indireto:', r.indireto.length);
  if (r.direto[0]) console.log('amostra direto:', r.direto[0]);
  if (r.indireto[0]) console.log('amostra indireto:', r.indireto[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
