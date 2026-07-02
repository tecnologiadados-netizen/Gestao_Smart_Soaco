/**
 * Mensagem WhatsApp: pedidos com Previsão atual vencida (≤ hoje), por Entrega G. The e Retirada.
 */

import type { DadosPedidosEntregaVencida, PedidoEntregaVencidaAgregado } from '../data/pedidosRepository.js';

function formatarBRL(val: number): string {
  const formatted = val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$${formatted}`;
}

function blocoPedido(row: PedidoEntregaVencidaAgregado): string {
  const bolinha = row.disponivel ? '🟢' : '🔴';
  let bloco = `${bolinha} ${row.pd} | ${formatarBRL(row.valor)}\n`;
  bloco += `- ${row.cliente}\n`;
  bloco += `- ${row.dataOriginal} | ${row.segundaData}`;
  return bloco;
}

function blocoSecao(titulo: string, linhas: PedidoEntregaVencidaAgregado[]): string {
  let bloco = `*${titulo}:*\n`;
  if (linhas.length === 0) {
    bloco += '(nenhum pedido)\n';
    return bloco;
  }
  for (let i = 0; i < linhas.length; i++) {
    bloco += blocoPedido(linhas[i]!);
    if (i < linhas.length - 1) bloco += '\n------------------------------------\n';
    else bloco += '\n';
  }
  return bloco;
}

export function montarMensagemPedidosEntregaVencida(dados: DadosPedidosEntregaVencida): string {
  const hoje = new Date();
  const dataStr = hoje.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let msg = `Pedidos com previsão de entrega vencida em ${dataStr}\n\n`;
  msg += blocoSecao('Entrega G. The', dados.entregaGrandeTeresina);
  msg += '\n';
  msg += blocoSecao('Retirada', dados.retirada);
  return msg.trimEnd();
}
