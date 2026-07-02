import 'dotenv/config';
import { carregarSaidasSoAcoDre } from '../src/data/dreSaidasSoAcoRepository.js';

const dataInicio = process.argv[2] ?? '2026-01-01';
const dataFim = process.argv[3] ?? '2026-06-30';

const r = await carregarSaidasSoAcoDre({ dataInicio, dataFim, granularidade: 'mes' });
console.log('periodo', dataInicio, '->', dataFim, 'erro:', r.erro, 'fonte:', r.fonteSaidas);

const alvos: Record<string, string> = {
  'D/7/0/8': '10.1.9 Horas Extras (Operacional)',
  'D/10/0/2': '13.1.3 Horas Extras - Administrativo',
  'D/8/1/0/9': '11.2.1.10 Despesas de Viagens OP',
  'D/12/3/0': '15.4.1 Assessoria Contábil',
  'D/3/4': '4.5 ICMS Difer. Ativo Imobilizado',
};

console.log('\n=== Valores por pathKey alvo ===');
for (const [pk, label] of Object.entries(alvos)) {
  const linhas = r.linhas.filter((l) => l.pathKey === pk);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  console.log(`${label} [${pk}] ids=${JSON.stringify(r.idsPorPathKey?.[pk])} total=${total.toFixed(2)} linhas=${JSON.stringify(linhas)}`);
}

console.log('\n=== Não mapeados relevantes ===');
const re = /horas extras|viag|assessoria|difal|legal|labore/i;
for (const n of r.naoMapeados.filter((x) => re.test(x.nomePlanoFinanceiro))) {
  console.log(`id=${n.idContaFinanceiro} "${n.nomePlanoFinanceiro}" valor=${n.valor.toFixed(2)} qtd=${n.quantidade}`);
}

console.log('\n=== Top 15 não mapeados (geral) ===');
for (const n of r.naoMapeados.slice(0, 15)) {
  console.log(`id=${n.idContaFinanceiro} "${n.nomePlanoFinanceiro}" valor=${n.valor.toFixed(2)} qtd=${n.quantidade}`);
}
