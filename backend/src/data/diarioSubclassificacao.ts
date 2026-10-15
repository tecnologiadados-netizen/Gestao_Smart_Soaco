/**
 * SubClassificação: agrupamento local pelo nome da classificação.
 * Não grava no Nomus nem no Shop9.
 */

import { prisma } from '../config/prisma.js';

export interface SubclassificacaoItem {
  nome: string;
  classificacao: string;
}

export interface SubclassificacaoConflito {
  classificacao: string;
  atual: string;
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
  const existentes = await prisma.diarioSubclassificacao.findMany({ select: { chave: true, nome: true } });
  const chaves = new Set(existentes.map((row) => row.chave));
  const faltantes = SEMENTE.filter(([classificacao]) => !chaves.has(chaveClassificacao(classificacao)));
  if (faltantes.length > 0) {
    await prisma.diarioSubclassificacao.createMany({
      data: faltantes.map(([classificacao, nome]) => ({
        nome,
        classificacao,
        chave: chaveClassificacao(classificacao),
      })),
    });
  }
  await garantirCatalogo();
}

async function garantirCatalogo(): Promise<void> {
  const [mapeados, catalogo] = await Promise.all([
    prisma.diarioSubclassificacao.findMany({ select: { nome: true } }),
    prisma.diarioSubclassificacaoCatalogo.findMany({ select: { chave: true } }),
  ]);
  const chaves = new Set(catalogo.map((row) => row.chave));
  const nomes = new Set<string>();
  for (const [, nome] of SEMENTE) nomes.add(nome);
  for (const row of mapeados) if (row.nome.trim()) nomes.add(row.nome);
  const faltantes = [...nomes].filter((nome) => !chaves.has(chaveClassificacao(nome)));
  if (faltantes.length === 0) return;
  const agora = new Date();
  await prisma.diarioSubclassificacaoCatalogo.createMany({
    data: faltantes.map((nome) => ({
      nome: limparNome(nome, 80).toLocaleUpperCase('pt-BR'),
      chave: chaveClassificacao(nome),
      atualizadoEm: agora,
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

export async function listarNomesSubclassificacaoDiario(): Promise<string[]> {
  await garantirSemente();
  const rows = await prisma.diarioSubclassificacaoCatalogo.findMany({
    orderBy: [{ nome: 'asc' }],
  });
  return rows.map((row) => row.nome);
}

export async function cadastrarNomeSubclassificacaoDiario(nomeBruto: string): Promise<{ nome: string }> {
  const nome = limparNome(nomeBruto, 80).toLocaleUpperCase('pt-BR');
  if (!nome) throw new Error('Informe a subclassificação.');
  const chave = chaveClassificacao(nome);
  if (!chave) throw new Error('Informe a subclassificação.');
  const row = await prisma.diarioSubclassificacaoCatalogo.upsert({
    where: { chave },
    create: { nome, chave },
    update: { nome },
  });
  return { nome: row.nome };
}

export async function alocarSubclassificacaoDiario(input: {
  classificacoes: string[];
  nome: string;
  confirmarTroca?: boolean;
}): Promise<{
  precisaConfirmar?: boolean;
  conflitos?: SubclassificacaoConflito[];
  atualizados?: number;
}> {
  const nome = limparNome(input.nome, 80).toLocaleUpperCase('pt-BR');
  if (!nome) throw new Error('Informe a subclassificação.');
  const chaveNome = chaveClassificacao(nome);
  const catalogo = await prisma.diarioSubclassificacaoCatalogo.findUnique({ where: { chave: chaveNome } });
  if (!catalogo) throw new Error('Cadastre a subclassificação antes de relacionar.');

  const porChave = new Map<string, string>();
  for (const bruto of input.classificacoes) {
    const classificacao = limparNome(String(bruto ?? ''), 180);
    const chave = chaveClassificacao(classificacao);
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, classificacao);
  }
  if (porChave.size === 0) throw new Error('Informe ao menos uma classificação.');

  const existentes = await prisma.diarioSubclassificacao.findMany({
    where: { chave: { in: [...porChave.keys()] } },
  });
  const atualPorChave = new Map(existentes.map((row) => [row.chave, row]));
  const conflitos: SubclassificacaoConflito[] = [];
  for (const [chave, classificacao] of porChave) {
    const atual = atualPorChave.get(chave);
    if (!atual) continue;
    if (chaveClassificacao(atual.nome) === chaveNome) continue;
    conflitos.push({ classificacao: atual.classificacao || classificacao, atual: atual.nome });
  }
  if (conflitos.length > 0 && input.confirmarTroca !== true) {
    return { precisaConfirmar: true, conflitos };
  }

  let atualizados = 0;
  for (const [chave, classificacao] of porChave) {
    await prisma.diarioSubclassificacao.upsert({
      where: { chave },
      create: { nome, classificacao, chave },
      update: { nome, classificacao },
    });
    atualizados += 1;
  }
  return { atualizados };
}
