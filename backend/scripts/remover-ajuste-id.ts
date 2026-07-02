import { prisma } from '../src/config/prisma.js';
import { invalidatePedidosCache, listarHistoricoAjustes } from '../src/data/pedidosRepository.js';

const idAjuste = parseInt(process.argv[2] ?? '17305', 10);
const idPedido = process.argv[3] ?? '186020-48561-49516';

async function main() {
  const antes = await listarHistoricoAjustes(idPedido);
  console.log('Antes (topo):', antes[0]?.id, antes[0]?.motivo, antes[0]?.previsao_nova);

  const row = await prisma.pedidoPrevisaoAjuste.findUnique({ where: { id: idAjuste } });
  if (!row) {
    console.log(`Registro #${idAjuste} já não existe.`);
    return;
  }
  await prisma.pedidoPrevisaoAjuste.delete({ where: { id: idAjuste } });
  invalidatePedidosCache();

  const depois = await listarHistoricoAjustes(idPedido);
  console.log('Removido:', row.id_pedido, row.motivo, row.previsao_nova);
  console.log('Depois (topo):', depois[0]?.id, depois[0]?.motivo, depois[0]?.previsao_nova);
}

main().finally(() => prisma.$disconnect());
