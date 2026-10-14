import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { gerarCodigoPai, normalizarGrupo, normalizarPaiCadastro } from '../pcp/decomposicao/cadastro.js';
import { vendaDoCodigo, somarCarteiraPorCodigo, type VendaCarteira } from '../pcp/decomposicao/carteiraNomus.js';
import { resumirSugestao } from '../pcp/decomposicao/sugestao.js';

export type FilhoGrade = {
  id: number;
  codigoNomus: string;
  descricao: string;
  quantidade: number;
  qtdePedida: number | null;
  pendente: number | null;
  paisImplicados: number | null;
};

export type PaiGrade = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  qtdFilhos: number;
  qtdePedida: number | null;
  pendente: number | null;
  sugestao: number | null;
};

export type DetalhePai = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  qtdePedida: number | null;
  pendente: number | null;
  sugestao: number | null;
  filhos: FilhoGrade[];
};

type PaiComFilhos = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  filhos: {
    id: number;
    codigoNomus: string;
    descricao: string;
    quantidade: number;
    materiaPrimaCodigo: string | null;
    materiaPrimaDescricao: string | null;
    sortOrder: number;
  }[];
};

function resumir(
  filhos: { quantidade: number; codigoNomus: string }[],
  vendas: Map<string, VendaCarteira> | null
) {
  if (!vendas) return null;
  return resumirSugestao(
    filhos.map((filho) => {
      const venda = vendaDoCodigo(vendas, filho.codigoNomus);
      return {
        quantidade: filho.quantidade,
        qtdePedida: venda.qtdePedida,
        pendente: venda.pendente,
      };
    })
  );
}

async function codigoLivre(preferido: string): Promise<string> {
  let codigo = preferido;
  for (let i = 0; i < 8; i++) {
    const existe = await prisma.decomposicaoProdutoPai.findUnique({ where: { codigo } });
    if (!existe) return codigo;
    codigo = gerarCodigoPai();
  }
  return `PAI-${Date.now().toString(36).toUpperCase()}`;
}

function erroUnico(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function listarGradeDecomposicao(): Promise<{
  carteiraDisponivel: boolean;
  carteiraErro?: string;
  pais: PaiGrade[];
}> {
  const pais = await prisma.decomposicaoProdutoPai.findMany({
    include: { filhos: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { nome: 'asc' },
  });
  const codigos = pais.flatMap((pai) => pai.filhos.map((f) => f.codigoNomus));
  const carteira = await somarCarteiraPorCodigo(codigos);

  return {
    carteiraDisponivel: carteira.disponivel,
    carteiraErro: carteira.erro,
    pais: pais.map((pai) => {
      const resumo = resumir(pai.filhos, carteira.disponivel ? carteira.vendas : null);
      return {
        id: pai.id,
        grupo: pai.grupo,
        codigo: pai.codigo,
        nome: pai.nome,
        observacao: pai.observacao,
        qtdFilhos: pai.filhos.length,
        qtdePedida: resumo ? resumo.qtdePedida : null,
        pendente: resumo ? resumo.pendente : null,
        sugestao: resumo ? resumo.sugestao : null,
      };
    }),
  };
}

export async function detalharDecomposicao(id: number): Promise<{
  carteiraDisponivel: boolean;
  carteiraErro?: string;
  pai: DetalhePai | null;
}> {
  const pai = await prisma.decomposicaoProdutoPai.findUnique({
    where: { id },
    include: { filhos: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!pai) return { carteiraDisponivel: true, pai: null };

  const carteira = await somarCarteiraPorCodigo(pai.filhos.map((f) => f.codigoNomus));
  const resumo = resumir(pai.filhos, carteira.disponivel ? carteira.vendas : null);

  return {
    carteiraDisponivel: carteira.disponivel,
    carteiraErro: carteira.erro,
    pai: {
      id: pai.id,
      grupo: pai.grupo,
      codigo: pai.codigo,
      nome: pai.nome,
      observacao: pai.observacao,
      qtdePedida: resumo ? resumo.qtdePedida : null,
      pendente: resumo ? resumo.pendente : null,
      sugestao: resumo ? resumo.sugestao : null,
      filhos: pai.filhos.map((filho, index) => {
        const linha = resumo?.filhos[index];
        return {
          id: filho.id,
          codigoNomus: filho.codigoNomus,
          descricao: filho.descricao,
          quantidade: filho.quantidade,
          qtdePedida: linha ? linha.qtdePedida : null,
          pendente: linha ? linha.pendente : null,
          paisImplicados: linha ? linha.paisImplicados : null,
        };
      }),
    },
  };
}

async function exigirSetor(nome: string): Promise<void> {
  const setor = await prisma.decomposicaoSetor.findUnique({ where: { nome } });
  if (!setor) throw new Error('Cadastre o setor antes de gravar o produto.');
}

export async function listarSetoresDecomposicao() {
  return prisma.decomposicaoSetor.findMany({ orderBy: [{ sortOrder: 'asc' }, { nome: 'asc' }] });
}

export async function criarSetorDecomposicao(body: unknown) {
  const bruto = body && typeof body === 'object' ? (body as { nome?: unknown }).nome : body;
  const nome = normalizarGrupo(bruto);
  const existe = await prisma.decomposicaoSetor.findUnique({ where: { nome } });
  if (existe) throw new Error('Já existe um setor com esse nome.');
  const ultimo = await prisma.decomposicaoSetor.findFirst({ orderBy: { sortOrder: 'desc' } });
  return prisma.decomposicaoSetor.create({
    data: { nome, sortOrder: (ultimo?.sortOrder ?? 0) + 1 },
  });
}

export async function excluirSetorDecomposicao(id: number): Promise<boolean> {
  const setor = await prisma.decomposicaoSetor.findUnique({ where: { id } });
  if (!setor) return false;
  const uso = await prisma.decomposicaoProdutoPai.count({ where: { grupo: setor.nome } });
  if (uso > 0) throw new Error('Há produtos pai neste setor. Mova ou exclua esses produtos antes.');
  await prisma.decomposicaoSetor.delete({ where: { id } });
  return true;
}

export async function criarProdutoPai(body: unknown, login: string | null): Promise<PaiComFilhos> {
  const cadastro = normalizarPaiCadastro(body);
  await exigirSetor(cadastro.grupo);
  const informouCodigo =
    body && typeof body === 'object' && String((body as { codigo?: unknown }).codigo ?? '').trim() !== '';
  if (!informouCodigo) cadastro.codigo = await codigoLivre(cadastro.codigo);
  try {
    return await prisma.$transaction(async (tx) => {
      const pai = await tx.decomposicaoProdutoPai.create({
        data: {
          grupo: cadastro.grupo,
          codigo: cadastro.codigo,
          nome: cadastro.nome,
          observacao: cadastro.observacao,
          criadoPorLogin: login,
          filhos: {
            create: cadastro.filhos.map((filho, index) => ({
              codigoNomus: filho.codigoNomus,
              descricao: filho.descricao,
              quantidade: filho.quantidade,
              materiaPrimaCodigo: filho.materiaPrimaCodigo,
              materiaPrimaDescricao: filho.materiaPrimaDescricao,
              sortOrder: index,
            })),
          },
        },
        include: { filhos: { orderBy: { sortOrder: 'asc' } } },
      });
      return pai;
    });
  } catch (err) {
    if (erroUnico(err)) throw new Error('Já existe um produto pai com esse código.');
    throw err;
  }
}

export async function atualizarProdutoPai(id: number, body: unknown): Promise<PaiComFilhos> {
  const atual = await prisma.decomposicaoProdutoPai.findUnique({ where: { id } });
  if (!atual) throw new Error('Produto pai não encontrado.');
  const cadastro = normalizarPaiCadastro(body);
  await exigirSetor(cadastro.grupo);
  if (cadastro.codigo !== atual.codigo) {
    const outro = await prisma.decomposicaoProdutoPai.findUnique({ where: { codigo: cadastro.codigo } });
    if (outro && outro.id !== id) throw new Error('Já existe um produto pai com esse código.');
  }
  return prisma.$transaction(async (tx) => {
    await tx.decomposicaoProdutoFilho.deleteMany({ where: { paiId: id } });
    return tx.decomposicaoProdutoPai.update({
      where: { id },
      data: {
        grupo: cadastro.grupo,
        codigo: cadastro.codigo,
        nome: cadastro.nome,
        observacao: cadastro.observacao,
        filhos: {
          create: cadastro.filhos.map((filho, index) => ({
            codigoNomus: filho.codigoNomus,
            descricao: filho.descricao,
            quantidade: filho.quantidade,
            materiaPrimaCodigo: filho.materiaPrimaCodigo,
            materiaPrimaDescricao: filho.materiaPrimaDescricao,
            sortOrder: index,
          })),
        },
      },
      include: { filhos: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}

export async function excluirProdutoPai(id: number): Promise<boolean> {
  const atual = await prisma.decomposicaoProdutoPai.findUnique({ where: { id } });
  if (!atual) return false;
  await prisma.decomposicaoProdutoPai.delete({ where: { id } });
  return true;
}

export async function obterProdutoPai(id: number): Promise<PaiComFilhos | null> {
  return prisma.decomposicaoProdutoPai.findUnique({
    where: { id },
    include: { filhos: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function listarCadastrosDecomposicao(): Promise<PaiComFilhos[]> {
  return prisma.decomposicaoProdutoPai.findMany({
    include: { filhos: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { nome: 'asc' },
  });
}

const includeOrdem = { itens: { orderBy: { sortOrder: 'asc' as const } } };

export async function listarOrdensDecomposicao() {
  return prisma.decomposicaoOrdem.findMany({
    include: includeOrdem,
    orderBy: { createdAt: 'desc' },
  });
}

export async function obterOrdemDecomposicao(id: number) {
  return prisma.decomposicaoOrdem.findUnique({
    where: { id },
    include: includeOrdem,
  });
}

export async function emitirOrdemDecomposicao(body: unknown, login: string | null) {
  const bruto = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const paiId = Number(bruto.paiId);
  if (!Number.isInteger(paiId) || paiId <= 0) throw new Error('Produto pai inválido.');
  const quantidade = Number(bruto.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Informe a quantidade a produzir.');
  }
  const observacao = String(bruto.observacao ?? '').trim();

  const pai = await obterProdutoPai(paiId);
  if (!pai) throw new Error('Produto pai não encontrado.');
  if (pai.filhos.length === 0) throw new Error('Vincule pelo menos um filho antes de gerar a ordem.');

  const carteira = await somarCarteiraPorCodigo(pai.filhos.map((filho) => filho.codigoNomus));
  const vendas = carteira.disponivel ? carteira.vendas : null;
  const numero = `OP-${Date.now().toString(36).toUpperCase()}`;

  return prisma.decomposicaoOrdem.create({
    data: {
      numero,
      paiId: pai.id,
      grupo: pai.grupo,
      codigoPai: pai.codigo,
      nomePai: pai.nome,
      quantidade,
      observacao: observacao || null,
      criadoPorLogin: login,
      itens: {
        create: pai.filhos.map((filho, index) => {
          const venda = vendas ? vendaDoCodigo(vendas, filho.codigoNomus) : null;
          return {
            codigoNomus: filho.codigoNomus,
            descricao: filho.descricao,
            quantidadeNoPai: filho.quantidade,
            quantidadeTotal: filho.quantidade * quantidade,
            materiaPrimaCodigo: filho.materiaPrimaCodigo,
            materiaPrimaDescricao: filho.materiaPrimaDescricao,
            qtdePedida: venda ? venda.qtdePedida : null,
            sortOrder: index,
          };
        }),
      },
    },
    include: includeOrdem,
  });
}
