import 'dotenv/config';
import { carregarSaidasSoAcoDre, queryDreNomusSaidasDetalhe } from '../src/data/dreSaidasSoAcoRepository.js';
import { queryDreShop9SaidasDetalhe } from '../src/data/dreShop9SaidasRepository.js';

const dataInicio = '2026-01-01';
const dataFim = '2026-06-30';

const r = await carregarSaidasSoAcoDre({ dataInicio, dataFim, granularidade: 'mes' });

const alvos: Record<string, string> = {
  'D/7/0/8': '10.1.9 Horas Extras - Operacional',
  'D/8/1/0/9': '11.2.1.10 Despesas de Viagens OP',
  'D/12/3/0': '15.4.1 Assessoria Contábil',
};

for (const [pk, label] of Object.entries(alvos)) {
  const idsAll = r.idsPorPathKey?.[pk] ?? [];
  const idsShop9All = r.idsPorPathKeyShop9?.[pk] ?? [];
  const idsNomus = idsAll.filter((id) => !idsShop9All.includes(id));
  const totalGrade = r.linhas.filter((l) => l.pathKey === pk).reduce((s, l) => s + l.valor, 0);

  const det = await queryDreNomusSaidasDetalhe({
    dataInicio, dataFim, idEmpresas: [1, 2, 3, 4],
    idsContaFinanceiro: idsNomus, granularidade: 'mes',
  });
  const totalNomus = det.detalhes.reduce((s, d) => s + d.valorBaixado, 0);

  let totalShop9 = 0;
  let qtdShop9 = 0;
  if (idsShop9All.length) {
    const detS = await queryDreShop9SaidasDetalhe({
      dataInicio, dataFim, idEmpresas: [1, 2, 3, 4],
      idsPlanoContas3: idsShop9All, granularidade: 'mes',
    });
    totalShop9 = (detS.detalhes ?? []).reduce((s: number, d: any) => s + (d.valorBaixado ?? 0), 0);
    qtdShop9 = (detS.detalhes ?? []).length;
  }

  console.log(`\n${label} [${pk}]`);
  console.log(`  grade total = ${totalGrade.toFixed(2)}`);
  console.log(`  idsNomus=${JSON.stringify(idsNomus)} detalhe Nomus: ${det.detalhes.length} linhas, total=${totalNomus.toFixed(2)} ${det.erro ? '(erro: ' + det.erro + ')' : ''}`);
  console.log(`  idsShop9=${JSON.stringify(idsShop9All)} detalhe Shop9: ${qtdShop9} linhas, total=${totalShop9.toFixed(2)}`);
  console.log(`  modal total (Nomus+Shop9) = ${(totalNomus + totalShop9).toFixed(2)}`);
}
