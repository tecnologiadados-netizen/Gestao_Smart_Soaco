/**
 * Mensagem de faturamento do dia por linha (Normal vs Antecipado) para WhatsApp/SMS.
 */

import type { FaturamentoDiarioLinhasDados } from '../data/faturamentoDiarioRepository.js';

function formatarBRL(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emojiLinha(tipo: string): string {
  if (/antecipado/i.test(tipo)) return '⚡';
  return '📦';
}

export function montarMensagemFaturamentoDiarioLinhas(dados: FaturamentoDiarioLinhasDados): string {
  const linhas = dados.linhas.filter((l) => l.tipoFaturamento);
  const devolucoes = dados.devolucaoDiaria;

  let somaValorTotal = 0;
  let somaIPI = 0;
  let somaComIPI = 0;
  let somaDesconto = 0;
  let somaCalculado = 0;

  let msg = 'Olá, Diretoria! Aqui está o faturamento do dia!💵\n';
  msg += `${dados.dataEmissao}\n`;

  for (const l of linhas) {
    somaValorTotal += l.valorTotal;
    somaIPI += l.valorIPI;
    somaComIPI += l.valorTotalComIPI;
    somaDesconto += l.totalDesconto;
    somaCalculado += l.valorTotalCalculado;

    msg += `\n${emojiLinha(l.tipoFaturamento)} ${l.tipoFaturamento}\n`;
    msg += `Valor Faturado: ${formatarBRL(l.valorTotal)}\n`;
    msg += `IPI: ${formatarBRL(l.valorIPI)}\n`;
    msg += `Valor c/ IPI: ${formatarBRL(l.valorTotalComIPI)}\n`;
    msg += `Descontos: ${formatarBRL(l.totalDesconto)}\n`;
    msg += `Líquido da linha: ${formatarBRL(l.valorTotalCalculado)}\n`;
  }

  if (linhas.length === 0) {
    msg += `\nSem faturamento no dia.\n`;
  }

  const liquidoDia = somaCalculado - devolucoes;
  msg += `\n──── Totais do dia ────\n`;
  msg += `Valor Faturado: ${formatarBRL(somaValorTotal)}\n`;
  msg += `IPI: ${formatarBRL(somaIPI)}\n`;
  msg += `Valor c/ IPI: ${formatarBRL(somaComIPI)}\n`;
  msg += `Descontos: ${formatarBRL(somaDesconto)}\n`;
  msg += `Valor Devoluções: ${formatarBRL(devolucoes)}\n`;
  msg += `Líquido do Dia: ${formatarBRL(liquidoDia)}`;
  return msg;
}
