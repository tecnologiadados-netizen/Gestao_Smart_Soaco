import { prisma } from '../src/config/prisma.js';
import { listarHistoricoAjustes } from '../src/data/pedidosRepository.js';

async function main() {
  const order = await prisma.sycroOrderOrder.findFirst({
    where: { order_number: { contains: '47570' } },
    select: {
      id: true,
      order_number: true,
      aguarda_resposta_pendente: true,
      aguarda_resposta_de_label: true,
      current_promised_date: true,
      status: true,
      item_ids_json: true,
    },
  });
  console.log('ORDER:', JSON.stringify(order, null, 2));
  if (!order) return;
  const hist = await prisma.sycroOrderHistory.findMany({
    where: { order_id: order.id },
    orderBy: { created_at: 'desc' },
    take: 20,
  });
  console.log('\nSYCRO HISTORY:');
  for (const h of hist) {
    console.log(
      JSON.stringify({
        id: h.id,
        action: h.action_type,
        user: h.user_name,
        prev: h.previous_date,
        new: h.new_date,
        obs: h.observation,
        at: h.created_at.toISOString(),
      })
    );
  }
  const ids = order.item_ids_json ? JSON.parse(order.item_ids_json) : [];
  console.log('\nITEM IDS:', ids);
  for (const id of Array.isArray(ids) ? ids.slice(0, 5) : []) {
    const ajustes = await listarHistoricoAjustes(String(id), { apenasPrevisaoConfiavel: true });
    console.log(`\nAJUSTES id ${id}: ${ajustes.length}`);
    for (const a of ajustes.slice(0, 8)) {
      console.log(
        JSON.stringify({
          id: a.id,
          nova: a.previsao_nova?.toISOString?.(),
          motivo: a.motivo,
          obs: a.observacao,
          user: a.usuario,
          at: a.data_ajuste?.toISOString?.(),
          confiavel: a.previsao_confiavel,
        })
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
