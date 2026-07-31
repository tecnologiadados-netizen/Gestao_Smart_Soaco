/**
 * Alerta WhatsApp (Integração → SMS) de DISPONÍVEL / NÃO DISPONÍVEL nos cards da Comunicação PD.
 * Texto centralizado aqui para o disparo do card e o reenvio por script gerarem a mesma mensagem.
 */

import { listarPedidos } from '../data/pedidosRepository.js';
import { enviarNotificacaoPorTipo } from './whatsappNotificacaoService.js';
import {
  codigoWhatsAppTagDisponivel,
  resolverEscopoWhatsAppPorVendedor,
  type EscopoWhatsAppComunicacaoPd,
} from '../utils/sycroOrderVendedorEscopoWhatsApp.js';
import {
  gerenciadorRowMatchesOrderNumber,
  parseJsonArray,
  pickFirstDistinctFromRows,
  resolveRelevantRowsForCard,
} from '../utils/sycroOrderCardRows.js';

const WHATSAPP_MAX_PRODUTOS_LISTA = 8;

export type DadosWhatsAppTagDisponivel = {
  available: boolean;
  orderNumber: string;
  deliveryMethod: string;
  promisedDate: string;
  userName: string;
  isUrgent?: boolean | number | null;
  itemIdsJson?: string | null;
  itemCodesJson?: string | null;
  /** Comentário/justificativa do modal "Atualizar" (obrigatório ao marcar NÃO DISPONÍVEL). */
  justificativa?: string | null;
};

function formatarDataBR(iso: string): string {
  const s = String(iso).trim().slice(0, 10);
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
}

function truncarTextoWhatsApp(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Cliente + vendedor + produtos do card (Gerenciador Nomus) para WhatsApp.
 * Lista cada produto em linha própria: código + descrição completa.
 */
export async function resolverClienteEProdutosWhatsApp(
  orderNumber: string,
  itemIdsJson: string | null | undefined,
  itemCodesJson: string | null | undefined
): Promise<{ cliente: string | null; vendedor: string | null; produtosLinhas: string[] }> {
  const codesFallback = parseJsonArray(itemCodesJson);
  try {
    const { data } = await listarPedidos({ pd: orderNumber });
    const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    const rowsDoPd = rows.filter((r) => gerenciadorRowMatchesOrderNumber(r, orderNumber));
    const selectedIds = parseJsonArray(itemIdsJson);
    const relevant = resolveRelevantRowsForCard(rowsDoPd, selectedIds, itemCodesJson);
    const useRows = relevant.length > 0 ? relevant : rowsDoPd;

    const cliente = pickFirstDistinctFromRows(rowsDoPd, ['Cliente', 'cliente']);
    const vendedor = pickFirstDistinctFromRows(rowsDoPd, [
      'Vendedor/Representante',
      'vendedor/representante',
      'Vendedor',
      'vendedor',
    ]);

    const byCod = new Map<string, string>();
    for (const r of useRows) {
      const cod = String(r['Cod'] ?? r['cod'] ?? '').trim();
      if (!cod || byCod.has(cod)) continue;
      const desc = String(
        r['Descricao do produto'] ?? r['Descrição do produto'] ?? r['produto'] ?? ''
      ).trim();
      byCod.set(cod, desc);
    }
    if (byCod.size === 0 && codesFallback?.length) {
      for (const c of codesFallback) {
        const cod = String(c).trim();
        if (cod) byCod.set(cod, '');
      }
    }

    const entries = [...byCod.entries()].filter(([c]) => Boolean(c));
    if (entries.length === 0) return { cliente, vendedor, produtosLinhas: [] };

    const show = entries.slice(0, WHATSAPP_MAX_PRODUTOS_LISTA);
    const extra = entries.length - show.length;
    const produtosLinhas = show.map(([cod, desc]) => (desc ? `${cod} — ${desc}` : cod));
    if (extra > 0) produtosLinhas.push(`(+${extra} outro${extra === 1 ? '' : 's'})`);
    return { cliente, vendedor, produtosLinhas };
  } catch (e) {
    console.warn('[SycroOrder] WhatsApp: falha ao resolver cliente/produtos:', e);
    if (codesFallback?.length) {
      const show = codesFallback
        .slice(0, WHATSAPP_MAX_PRODUTOS_LISTA)
        .map((c) => String(c).trim())
        .filter(Boolean);
      const extra = codesFallback.length - show.length;
      const produtosLinhas = [...show];
      if (extra > 0) produtosLinhas.push(`(+${extra} outro${extra === 1 ? '' : 's'})`);
      return { cliente: null, vendedor: null, produtosLinhas };
    }
    return { cliente: null, vendedor: null, produtosLinhas: [] };
  }
}

export function montarTextoWhatsAppTagDisponivel(
  opts: DadosWhatsAppTagDisponivel,
  contexto: { cliente: string | null; vendedor: string | null; produtosLinhas: string[] }
): string {
  const disponivel = opts.available;
  const titulo = disponivel
    ? '✅ *Comunicação PD – Pedido disponível*'
    : '⛔ *Comunicação PD – Pedido não disponível*';
  const statusLinha = disponivel ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL';
  const justificativa = opts.justificativa != null ? String(opts.justificativa).trim() : '';
  const { cliente, vendedor, produtosLinhas } = contexto;

  let texto = `${titulo}\n\n`;
  texto += `📄 *Pedido:* ${opts.orderNumber}\n`;
  if (cliente) texto += `🏢 *Cliente:* ${truncarTextoWhatsApp(cliente, 80)}\n`;
  if (vendedor) texto += `🧑‍💼 *Vendedor:* ${truncarTextoWhatsApp(vendedor, 80)}\n`;
  if (produtosLinhas.length === 1) {
    texto += `📦 *Produto:* ${produtosLinhas[0]}\n`;
  } else if (produtosLinhas.length > 1) {
    texto += `📦 *Produtos:*\n`;
    for (const linha of produtosLinhas) {
      texto += `• ${linha}\n`;
    }
  }
  texto += `🏷️ *Status:* ${statusLinha}\n`;
  texto += `🚚 *Entrega:* ${opts.deliveryMethod}\n`;
  texto += `📅 *Data prometida:* ${formatarDataBR(opts.promisedDate)}\n`;
  texto += `👤 *Alterado por:* ${opts.userName}\n`;
  if (opts.isUrgent) texto += `⚠️ *Urgente:* Sim\n`;
  if (justificativa) {
    texto += `\n💬 *Justificativa:*\n${truncarTextoWhatsApp(justificativa, 800)}\n`;
  }
  return texto;
}

/**
 * Monta e envia o alerta no tipo do escopo do vendedor (Loja ou Indústria).
 * `escopoForcado` só para reenvio manual de mensagens que saíram no escopo errado.
 */
export async function enviarWhatsAppTagDisponivel(
  opts: DadosWhatsAppTagDisponivel,
  escopoForcado?: EscopoWhatsAppComunicacaoPd
): Promise<{ code: string; escopo: EscopoWhatsAppComunicacaoPd; texto: string }> {
  const contexto = await resolverClienteEProdutosWhatsApp(
    opts.orderNumber,
    opts.itemIdsJson,
    opts.itemCodesJson
  );
  const escopo = escopoForcado ?? resolverEscopoWhatsAppPorVendedor(contexto.vendedor);
  const code = codigoWhatsAppTagDisponivel(opts.available, escopo);
  const texto = montarTextoWhatsAppTagDisponivel(opts, contexto);

  await enviarNotificacaoPorTipo(code, texto);
  return { code, escopo, texto };
}

/** WhatsApp (Integração SMS) ao marcar/desmarcar DISPONÍVEL no card Comunicação PD. */
export function dispararWhatsAppTagDisponivel(opts: DadosWhatsAppTagDisponivel): void {
  void enviarWhatsAppTagDisponivel(opts).catch((err) => {
    console.error(`[SycroOrder] WhatsApp tag disponibilidade:`, err);
  });
}
