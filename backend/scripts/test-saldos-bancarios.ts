import '../src/load-dotenv.js';
import { queryDfcSaldosBancarios } from '../src/data/dfcSaldosBancariosRepository.js';

const t0 = Date.now();
const r = await queryDfcSaldosBancarios({
  dataInicio: '2026-01-01',
  dataFim: '2026-05-26',
});
console.log('ms', Date.now() - t0);
console.log('erro', r.erro);
console.log('linhas', r.linhas.length);
const porMes = new Map<string, number>();
for (const l of r.linhas) {
  const m = l.dataLancamento.slice(0, 7);
  porMes.set(m, (porMes.get(m) ?? 0) + l.saldoFinal);
}
console.log('soma saldoFinal por mes (amostra)', Object.fromEntries(porMes));
console.log('ultima', r.linhas[r.linhas.length - 1]);
