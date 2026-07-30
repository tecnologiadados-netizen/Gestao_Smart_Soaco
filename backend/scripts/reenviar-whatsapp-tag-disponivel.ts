/**
 * Reenvia o alerta WhatsApp de DISPONÍVEL / NÃO DISPONÍVEL de um card da Comunicação PD.
 * Usado quando a mensagem saiu no escopo errado (ex.: vendedor de Loja que caiu na Indústria).
 *
 * Uso (na pasta backend):
 *   npx tsx scripts/reenviar-whatsapp-tag-disponivel.ts 49722 --escopo=loja
 *   npx tsx scripts/reenviar-whatsapp-tag-disponivel.ts 49722 --escopo=loja --dry
 *
 * Sem --escopo, o escopo é resolvido pelo vendedor do PD (mesma regra do disparo automático).
 * Com --dry, apenas imprime a mensagem e o tipo de destino, sem enviar.
 */
import { prisma } from '../src/config/prisma.js';
import {
  enviarWhatsAppTagDisponivel,
  montarTextoWhatsAppTagDisponivel,
  resolverClienteEProdutosWhatsApp,
} from '../src/services/sycroOrderTagDisponivelWhatsApp.js';
import {
  codigoWhatsAppTagDisponivel,
  resolverEscopoWhatsAppPorVendedor,
  type EscopoWhatsAppComunicacaoPd,
} from '../src/utils/sycroOrderVendedorEscopoWhatsApp.js';

function orderNumberVariants(num: string): string[] {
  const n = num.trim();
  return [...new Set([`PD ${n}`, `PD${n}`, `pd ${n}`, `pd${n}`, n, `PD  ${n}`])];
}

function parseArgs(argv: string[]): {
  pd: string;
  escopo?: EscopoWhatsAppComunicacaoPd;
  dry: boolean;
} {
  const args = argv.slice(2);
  const pd = args.find((a) => !a.startsWith('--'))?.trim() ?? '';
  const escopoRaw = args.find((a) => a.startsWith('--escopo='))?.split('=')[1]?.trim().toLowerCase();
  if (escopoRaw && escopoRaw !== 'loja' && escopoRaw !== 'industria') {
    throw new Error('--escopo aceita apenas "loja" ou "industria".');
  }
  return {
    pd,
    escopo: escopoRaw as EscopoWhatsAppComunicacaoPd | undefined,
    dry: args.includes('--dry'),
  };
}

async function main() {
  const { pd, escopo, dry } = parseArgs(process.argv);
  if (!pd) {
    throw new Error('Informe o número do PD. Ex.: npx tsx scripts/reenviar-whatsapp-tag-disponivel.ts 49722 --escopo=loja');
  }

  const order = await prisma.sycroOrderOrder.findFirst({
    where: { order_number: { in: orderNumberVariants(pd) } },
    orderBy: { created_at: 'desc' },
  });
  if (!order) {
    throw new Error(`Nenhum card encontrado para o PD ${pd}.`);
  }

  // "Alterado por" precisa ser quem marcou a TAG, não quem criou o card.
  const ultimaTag = await prisma.sycroOrderHistory.findFirst({
    where: { order_id: order.id, action_type: { in: ['TAG_DISPONIVEL_TRUE', 'TAG_DISPONIVEL_FALSE'] } },
    orderBy: { created_at: 'desc' },
    select: { action_type: true, user_name: true, usuario: { select: { nome: true } } },
  });

  const dados = {
    available: ultimaTag ? ultimaTag.action_type === 'TAG_DISPONIVEL_TRUE' : order.tag_disponivel === 1,
    orderNumber: String(order.order_number ?? '').trim(),
    deliveryMethod: String(order.delivery_method ?? ''),
    promisedDate: String(order.current_promised_date ?? ''),
    userName: ultimaTag?.usuario?.nome ?? ultimaTag?.user_name ?? order.creator_name ?? '—',
    isUrgent: order.is_urgent,
    itemIdsJson: order.item_ids_json,
    itemCodesJson: order.item_codes_json,
  };

  if (dry) {
    const contexto = await resolverClienteEProdutosWhatsApp(
      dados.orderNumber,
      dados.itemIdsJson,
      dados.itemCodesJson
    );
    const escopoFinal = escopo ?? resolverEscopoWhatsAppPorVendedor(contexto.vendedor);
    console.log(`Card #${order.id} — ${dados.orderNumber}`);
    console.log(`Vendedor: ${contexto.vendedor ?? '(não encontrado)'}`);
    console.log(`Escopo: ${escopoFinal} | Tipo: ${codigoWhatsAppTagDisponivel(dados.available, escopoFinal)}`);
    console.log('--- mensagem ---');
    console.log(montarTextoWhatsAppTagDisponivel(dados, contexto));
    console.log('--- (dry-run: nada enviado) ---');
    return;
  }

  const { code, escopo: escopoFinal } = await enviarWhatsAppTagDisponivel(dados, escopo);
  console.log(`Card #${order.id} — ${dados.orderNumber}: reenviado no escopo ${escopoFinal} (tipo ${code}).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
