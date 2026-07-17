/**
 * Pedidos de venda em aberto (itens com status 1, 2 ou 3) para monitoramento de crédito.
 */

import { nomusQuery } from './crmFinanceiro/nomusQuery.js';

export type PedidoAbertoCreditoRow = {
  idPedido: number;
  numeroPedido: string;
  clienteNome: string;
  statusItem: number;
};

const STATUS_LABEL: Record<number, string> = {
  1: 'Aguardando liberação',
  2: 'Liberado',
  3: 'Atendido parcialmente',
};

export function labelStatusPedidoAberto(statusItem: number): string {
  return STATUS_LABEL[statusItem] ?? `Status ${statusItem}`;
}

/** Labels amplos (inclui status finais para sync da aba Pendências). */
const STATUS_LABEL_COMPLETO: Record<number, string> = {
  ...STATUS_LABEL,
  4: 'Atendido totalmente',
  5: 'Atendido com corte',
  6: 'Cancelado',
  7: 'Devolvido parcialmente',
  8: 'Devolvido totalmente',
};

export function labelStatusItemPedidoCompleto(statusItem: number): string {
  return STATUS_LABEL_COMPLETO[statusItem] ?? `Status ${statusItem}`;
}

/** pd.nome no Nomus já costuma vir como "PD 49511" — evita duplicar o prefixo na UI/e-mail. */
export function formatarNumeroPedidoExibicao(numeroPedido: string): string {
  const trimmed = numeroPedido.trim();
  if (/^PD\s+/i.test(trimmed)) return trimmed;
  return trimmed ? `PD ${trimmed}` : trimmed;
}

const SQL_PEDIDOS_ABERTOS = `
  SELECT DISTINCT
    pd.id AS idPedido,
    pd.nome AS numeroPedido,
    pe.nome AS clienteNome,
    ip.status AS statusItem
  FROM itempedido ip
  INNER JOIN pedido pd ON pd.id = ip.idPedido
  INNER JOIN pessoa pe ON pe.id = pd.idCliente
  WHERE ip.status IN (1, 2, 3)
    AND pd.idEmpresa IN (1, 2)
  ORDER BY pe.nome ASC, pd.nome ASC, ip.status ASC
`;

export async function listarPedidosAbertosCredito(): Promise<PedidoAbertoCreditoRow[]> {
  const rows = await nomusQuery<{
    idPedido: number;
    numeroPedido: string;
    clienteNome: string;
    statusItem: number;
  }>(SQL_PEDIDOS_ABERTOS, []);

  return rows.map((row) => ({
    idPedido: Number(row.idPedido),
    numeroPedido: String(row.numeroPedido ?? '').trim(),
    clienteNome: String(row.clienteNome ?? '').trim(),
    statusItem: Number(row.statusItem),
  }));
}

export type PedidoAbertoPorCliente = {
  clienteNome: string;
  pedidos: Array<{ idPedido: number; numeroPedido: string; statusItem: number; statusLabel: string }>;
};

export function agruparPedidosAbertosPorCliente(
  rows: PedidoAbertoCreditoRow[]
): PedidoAbertoPorCliente[] {
  const map = new Map<string, PedidoAbertoPorCliente>();

  for (const row of rows) {
    if (!row.clienteNome) continue;
    let grupo = map.get(row.clienteNome);
    if (!grupo) {
      grupo = { clienteNome: row.clienteNome, pedidos: [] };
      map.set(row.clienteNome, grupo);
    }
    const dup = grupo.pedidos.some(
      (p) => p.idPedido === row.idPedido && p.statusItem === row.statusItem
    );
    if (!dup) {
      grupo.pedidos.push({
        idPedido: row.idPedido,
        numeroPedido: row.numeroPedido,
        statusItem: row.statusItem,
        statusLabel: labelStatusPedidoAberto(row.statusItem),
      });
    }
  }

  return [...map.values()].sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'));
}

export type StatusPedidoCredito = {
  idPedido: number;
  numeroPedido: string;
  clienteNome: string;
  /** Menor status entre os itens (1 prevalece sobre 2/3 se houver item pausado). */
  statusItem: number;
  statusLabel: string;
};

/**
 * Status atual dos pedidos no Nomus (MIN dos status dos itens).
 * Usado no refresh da grade de pendências de crédito.
 */
export async function listarStatusPedidosCreditoPorIds(
  ids: number[]
): Promise<StatusPedidoCredito[]> {
  const unique = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return [];

  const placeholders = unique.map(() => '?').join(', ');
  const sql = `
    SELECT
      pd.id AS idPedido,
      pd.nome AS numeroPedido,
      pe.nome AS clienteNome,
      MIN(ip.status) AS statusItem
    FROM itempedido ip
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN pessoa pe ON pe.id = pd.idCliente
    WHERE pd.id IN (${placeholders})
      AND pd.idEmpresa IN (1, 2)
    GROUP BY pd.id, pd.nome, pe.nome
  `;

  const rows = await nomusQuery<{
    idPedido: number;
    numeroPedido: string;
    clienteNome: string;
    statusItem: number;
  }>(sql, unique);

  return rows.map((row) => {
    const statusItem = Number(row.statusItem);
    return {
      idPedido: Number(row.idPedido),
      numeroPedido: String(row.numeroPedido ?? '').trim(),
      clienteNome: String(row.clienteNome ?? '').trim(),
      statusItem,
      statusLabel: labelStatusItemPedidoCompleto(statusItem),
    };
  });
}
