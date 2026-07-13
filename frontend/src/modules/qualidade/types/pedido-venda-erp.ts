import type { ClienteErp } from "@qualidade/types/cliente-erp";
import { clienteErpParaCamposRcc } from "@qualidade/types/cliente-erp";

/** Pedido de venda retornado pelo ERP Nomus (tabela `pedido`) com o cliente vinculado. */
export interface PedidoVendaErp {
  pedidoId: string;
  numero: string;
  dataEmissao: string;
  clienteNome: string;
  cliente: ClienteErp | null;
}

/**
 * Converte o pedido de venda selecionado nos campos do RCC:
 * preenche o número do pedido e, quando houver cliente vinculado,
 * os dados do consumidor (nome, cidade, estado, contato, telefone, bairro, endereço).
 */
export function pedidoVendaErpParaCamposRcc(pedido: PedidoVendaErp): {
  numeroPedidoInternoExterno: string;
  nomeClienteConsumidor?: string;
  cidade?: string;
  estado?: string;
  contato?: string;
  telefone?: string;
  bairro?: string;
  endereco?: string;
} {
  const base = { numeroPedidoInternoExterno: pedido.numero };
  if (!pedido.cliente) return base;
  return { ...base, ...clienteErpParaCamposRcc(pedido.cliente) };
}
