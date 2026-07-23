import type { Pedido } from '../../api/pedidos';
import type { DataProducaoLoteItem } from '../../api/pedidos';
import { rotaFromPedidoRow } from '../../utils/rotaCarrada';

/**
 * Itens para `data-producao-lote` a partir do modal do calendário.
 * Sempre envia a Observacoes da linha como `rota` (override), alinhado à grade.
 */
export function montarItensDataProducaoCalendario(
  pedido: Pedido,
  dataProducao: string,
  demaisItens: Pedido[] = []
): DataProducaoLoteItem[] {
  const data = String(dataProducao ?? '').trim().slice(0, 10);
  if (!data) return [];
  const out: DataProducaoLoteItem[] = [];
  const vistos = new Set<string>();
  for (const p of [pedido, ...demaisItens]) {
    const id_pedido = String(p?.id_pedido ?? '').trim();
    if (!id_pedido) continue;
    const rota = rotaFromPedidoRow(p as Record<string, unknown>).trim();
    const chave = `${id_pedido}\0${rota}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(rota ? { id_pedido, data_producao: data, rota } : { id_pedido, data_producao: data });
  }
  return out;
}

/**
 * Rota a enviar em `ajustarPrevisao` no fluxo do calendário.
 * - `rotaOverride` preenchido → override dessa rota (linha ou "somente esta").
 * - `rotaOverride === null` e modo calendário sem decisão "todas" → usa Observacoes da linha.
 * - `forcarBase === true` → ajuste base (usuário escolheu todas as rotas).
 */
export function rotaPayloadAjusteDoCalendario(
  pedido: Pedido,
  rotaOverride: string | null,
  opcoes?: { forcarBase?: boolean; modoCalendario?: boolean }
): string | undefined {
  if (opcoes?.forcarBase) return undefined;
  if (rotaOverride != null && String(rotaOverride).trim() !== '') {
    return String(rotaOverride).trim();
  }
  if (opcoes?.modoCalendario) {
    const rotaLinha = rotaFromPedidoRow(pedido as Record<string, unknown>).trim();
    return rotaLinha || undefined;
  }
  return undefined;
}
