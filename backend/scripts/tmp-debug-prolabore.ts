import 'dotenv/config';
import { carregarSaidasSoAcoDre } from '../src/data/dreSaidasSoAcoRepository.js';

const dataInicio = '2026-01-01';
const dataFim = '2026-06-30';
const PK = 'D/10/0/12'; // 13.1.12 Pró-labore

for (const idEmpresas of [[1, 2, 3, 4], [1], [3]]) {
  const r = await carregarSaidasSoAcoDre({ dataInicio, dataFim, granularidade: 'mes', idEmpresas });
  const total = r.linhas.filter((l) => l.pathKey === PK).reduce((s, l) => s + l.valor, 0);
  console.log(`empresas=${JSON.stringify(idEmpresas)} Pró-labore[${PK}] total=${total.toFixed(2)} idsNomus=${JSON.stringify(r.idsPorPathKey?.[PK])} idsShop9=${JSON.stringify(r.idsPorPathKeyShop9?.[PK])}`);
}
