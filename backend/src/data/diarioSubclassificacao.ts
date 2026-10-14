/**
 * SubClassificação: agrupamento local pelo nome da classificação.
 * Não grava no Nomus nem no Shop9.
 */

import { prisma } from '../config/prisma.js';

export interface SubclassificacaoItem {
  nome: string;
  classificacao: string;
}

/** Lista enviada para o cadastro inicial. A chave ignora acento e maiúsculas. */
const SEMENTE: Array<[string, string]> = [
  ['Emprestimos E Financiamentos - Cg - Principal', 'EMPRESTIMO'],
  ['Seguro De Vida', 'OUTRAS CONTAS'],
  ['Emprestimos E Financiamentos - Cg - Juros', 'EMPRESTIMO'],
  ['INSS', 'IMPOSTO'],
  ['Cofins S/Vendas', 'IMPOSTO'],
  ['IRPJ', 'IMPOSTO'],
  ['CSLL', 'IMPOSTO'],
  ['Dívida Federal', 'DÍVIDA IMPOSTO'],
  ['Cartões De Crédito Empresarial', 'OUTRAS CONTAS'],
  ['Pis S/Vendas', 'IMPOSTO'],
  ['Fretes - Mercadorias', 'PRESTADOR DE SERVIÇO'],
  ['Juros de Empréstimos e Financiamentos', 'EMPRESTIMO'],
  ['Principal de Empréstimos e Financiamentos', 'EMPRESTIMO'],
  ['IPTU e Condomínio', 'IMPOSTO'],
  ['Fornecedor - Materia Prima', 'FORNECEDOR'],
  ['Fornecedor - Material Embalagem', 'FORNECEDOR'],
  ['Fornecedor - Material revenda', 'FORNECEDOR'],
  ['Simples Nacional', 'IMPOSTO'],
  ['Pro-Labore', 'OUTRAS CONTAS'],
  ['9165 - Juros de Empréstimos e Financiamentos', 'EMPRESTIMO'],
  ['9146 - Principal de Empréstimos e Financiamentos', 'EMPRESTIMO'],
  ['9022 - Fornecedor - Material Revenda', 'FORNECEDOR'],
  ['PESSOAL SR MARQUES', 'PESSOAL SR MARQUES'],
];

export function chaveClassificacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function limparNome(valor: string, limite: number): string {
  return valor.trim().replace(/\s+/g, ' ').slice(0, limite);
}

async function garantirSemente(): Promise<void> {
  const existentes = await prisma.diarioSubclassificacao.findMany({ select: { chave: true } });
  const chaves = new Set(existentes.map((row) => row.chave));
  const faltantes = SEMENTE.filter(([classificacao]) => !chaves.has(chaveClassificacao(classificacao)));
  if (faltantes.length === 0) return;
  await prisma.diarioSubclassificacao.createMany({
    data: faltantes.map(([classificacao, nome]) => ({
      nome,
      classificacao,
      chave: chaveClassificacao(classificacao),
    })),
  });
}

export async function listarSubclassificacoesDiario(): Promise<SubclassificacaoItem[]> {
  await garantirSemente();
  const rows = await prisma.diarioSubclassificacao.findMany({
    orderBy: [{ classificacao: 'asc' }],
  });
  return rows.map((row) => ({ nome: row.nome, classificacao: row.classificacao }));
}

export async function cadastrarSubclassificacaoDiario(input: {
  classificacao: string;
  nome: string;
}): Promise<SubclassificacaoItem> {
  const classificacao = limparNome(input.classificacao, 180);
  const nome = limparNome(input.nome, 80).toLocaleUpperCase('pt-BR');
  if (!classificacao) throw new Error('Informe a classificação.');
  if (!nome) throw new Error('Informe a subclassificação.');
  const chave = chaveClassificacao(classificacao);
  if (!chave) throw new Error('Informe a classificação.');

  const row = await prisma.diarioSubclassificacao.upsert({
    where: { chave },
    create: { nome, classificacao, chave },
    update: { nome, classificacao },
  });
  return { nome: row.nome, classificacao: row.classificacao };
}
