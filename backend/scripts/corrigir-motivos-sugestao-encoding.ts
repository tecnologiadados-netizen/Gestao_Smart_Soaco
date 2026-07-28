/**
 * Corrige MotivoSugestao.descricao e pedido_previsao_ajuste.motivo onde acentos
 * foram gravados como literais "?" (ex.: "programa????o" → "programação").
 *
 * Uso:
 *   cd backend && npx tsx scripts/corrigir-motivos-sugestao-encoding.ts
 * Simular:
 *   DRY_RUN=1 npx tsx scripts/corrigir-motivos-sugestao-encoding.ts
 */
import { prisma } from '../src/config/prisma.js';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

/** Mapa texto corrompido → texto correto (UTF-8). */
const MAPA_MOTIVOS: Array<{ de: string; para: string }> = [
  { de: 'Ajuste de programa????o de produ????o', para: 'Ajuste de programação de produção' },
  { de: 'Antecipa????o por determina????o da diretoria', para: 'Antecipação por determinação da diretoria' },
  { de: 'Antecipa????o por oportunidade de antecipa????o', para: 'Antecipação por oportunidade de antecipação' },
  { de: 'Antecipa????o por risco de cancelamento', para: 'Antecipação por risco de cancelamento' },
  {
    de: 'Cliente n??o veio retirar mercadoria e a mesma foi transferida para outro PD',
    para: 'Cliente não veio retirar mercadoria e a mesma foi transferida para outro PD',
  },
  {
    de: 'Dispon??vel para entrega, mas expedi????o ainda n??o realizou',
    para: 'Disponível para entrega, mas expedição ainda não realizou',
  },
  {
    de: 'Dispon??vel, mas cliente reprogramou data de retirada/recebimento',
    para: 'Disponível, mas cliente reprogramou data de retirada/recebimento',
  },
  {
    de: 'Dispon??vel, mas n??o h?? informa????o de quando cliente ir?? retirar/receber',
    para: 'Disponível, mas não há informação de quando cliente irá retirar/receber',
  },
  {
    de: 'Estimativa de entrega passada pela produ????o equivocada',
    para: 'Estimativa de entrega passada pela produção equivocada',
  },
  { de: 'Problema de log??stica', para: 'Problema de logística' },
  {
    de: 'Reprograma????o devido a antecipa????o de outro(s) PD',
    para: 'Reprogramação devido a antecipação de outro(s) PD',
  },
  {
    de: 'Reprograma????o devido a ruptura no estoque de MP',
    para: 'Reprogramação devido a ruptura no estoque de MP',
  },
  {
    de: 'Reprograma????o devido a ruptura no estoque de PP',
    para: 'Reprogramação devido a ruptura no estoque de PP',
  },
  {
    de: 'Reprograma????o devido a transfer??ncia de mercadoria para outro PD',
    para: 'Reprogramação devido a transferência de mercadoria para outro PD',
  },
  { de: 'Reprograma????o devido m??quina quebrada', para: 'Reprogramação devido máquina quebrada' },
  {
    de: 'Reprograma????o pois n??o coube na carrada enviada',
    para: 'Reprogramação pois não coube na carrada enviada',
  },
  {
    de: 'Reprogramado devido a oportunidade de melhor efici??ncia log??stica',
    para: 'Reprogramado devido a oportunidade de melhor eficiência logística',
  },
  {
    de: 'Sem informa????o de quando o cliente ir?? retirar/receber',
    para: 'Sem informação de quando o cliente irá retirar/receber',
  },
];

async function main() {
  console.log(DRY_RUN ? '[DRY_RUN] Corrigindo motivos (sem gravar)...' : 'Corrigindo motivos...');

  let atualizadosSugestao = 0;
  let puladosSugestao = 0;
  let atualizadosHistorico = 0;

  for (const { de, para } of MAPA_MOTIVOS) {
    const existentes = await prisma.motivoSugestao.findMany({ where: { descricao: de } });
    if (existentes.length === 0) {
      console.log(`  MotivoSugestao: nenhum "${de}"`);
    }
    for (const row of existentes) {
      const conflito = await prisma.motivoSugestao.findFirst({
        where: { descricao: para, NOT: { id: row.id } },
      });
      if (conflito) {
        console.log(`  MotivoSugestao id=${row.id}: destino já existe (id=${conflito.id}); removendo corrompido`);
        if (!DRY_RUN) await prisma.motivoSugestao.delete({ where: { id: row.id } });
        puladosSugestao += 1;
        continue;
      }
      console.log(`  MotivoSugestao id=${row.id}: "${de}" → "${para}"`);
      if (!DRY_RUN) {
        await prisma.motivoSugestao.update({ where: { id: row.id }, data: { descricao: para } });
      }
      atualizadosSugestao += 1;
    }

    const histCount = await prisma.pedidoPrevisaoAjuste.count({ where: { motivo: de } });
    if (histCount > 0) {
      console.log(`  pedido_previsao_ajuste: ${histCount} linha(s) "${de}" → "${para}"`);
      if (!DRY_RUN) {
        const r = await prisma.pedidoPrevisaoAjuste.updateMany({
          where: { motivo: de },
          data: { motivo: para },
        });
        atualizadosHistorico += r.count;
      } else {
        atualizadosHistorico += histCount;
      }
    }
  }

  const restantes = await prisma.motivoSugestao.findMany({
    where: { descricao: { contains: '?' } },
    select: { id: true, descricao: true },
  });
  if (restantes.length > 0) {
    console.warn(`\nAinda há ${restantes.length} MotivoSugestao com "?":`);
    for (const r of restantes) console.warn(`  id=${r.id} "${r.descricao}"`);
  }

  console.log(
    `\nConcluído: MotivoSugestao atualizados=${atualizadosSugestao}, removidos/pulados=${puladosSugestao}, histórico=${atualizadosHistorico}`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
