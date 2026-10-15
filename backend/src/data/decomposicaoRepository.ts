import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  gerarCodigoPai,
  normalizarGrupo,
  normalizarPaiCadastro,
  type PaiCadastro,
} from '../pcp/decomposicao/cadastro.js';
import {
  listarAlocacoesCarteira,
  vendaDoCodigo,
  type AlocacaoPedido,
  type VendaCarteira,
} from '../pcp/decomposicao/carteiraNomus.js';
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
  qtdPecas: number;
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
  pecas: {
    id: number;
    descricao: string;
    quantidade: number;
    medidaL: string;
    medidaA: string;
    materiaPrima: string;
    sortOrder: number;
  }[];
};

const includePai = {
  filhos: { orderBy: { sortOrder: 'asc' as const } },
  pecas: { orderBy: { sortOrder: 'asc' as const } },
};

function criarPecas(pecas: PaiCadastro['pecas']) {
  return pecas.map((peca, index) => ({
    descricao: peca.descricao,
    quantidade: peca.quantidade,
    medidaL: peca.medidaL,
    medidaA: peca.medidaA,
    materiaPrima: peca.materiaPrima,
    sortOrder: index,
  }));
}

function chaveCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

function vendasDasLinhas(linhas: AlocacaoPedido[]): Map<string, VendaCarteira> {
  const mapa = new Map<string, VendaCarteira>();
  for (const linha of linhas) {
    const chave = chaveCodigo(linha.codigoFilho);
    const atual = mapa.get(chave) ?? { qtdePedida: 0, pendente: 0 };
    atual.qtdePedida += linha.qtdePedida;
    atual.pendente += linha.saldo;
    mapa.set(chave, atual);
  }
  return mapa;
}

function filtrarElegiveis(alocacoes: AlocacaoPedido[], codigos: string[], bloqueados: Set<number>): AlocacaoPedido[] {
  const filhos = new Set(codigos.map(chaveCodigo));
  return alocacoes.filter((linha) => filhos.has(chaveCodigo(linha.codigoFilho)) && !bloqueados.has(linha.idItem));
}

async function bloqueiosPorPai(excetoOrdemId?: number): Promise<Map<number, Set<number>>> {
  const rows = await prisma.decomposicaoOrdemAlocacao.findMany({
    where: {
      apareceNaProxima: false,
      ...(excetoOrdemId ? { ordemId: { not: excetoOrdemId } } : {}),
    },
    select: { idItem: true, ordem: { select: { paiId: true } } },
  });
  const mapa = new Map<number, Set<number>>();
  for (const row of rows) {
    if (row.ordem.paiId == null) continue;
    const conjunto = mapa.get(row.ordem.paiId) ?? new Set<number>();
    conjunto.add(row.idItem);
    mapa.set(row.ordem.paiId, conjunto);
  }
  return mapa;
}

function nomeStatus(status: number): string {
  if (status === 2) return 'Liberado';
  if (status === 3) return 'Atendido parcialmente';
  return String(status);
}

function dadosAlocacao(linha: AlocacaoPedido, apareceNaProxima: boolean) {
  return {
    idItem: linha.idItem,
    idPedido: linha.idPedido,
    numeroPedido: linha.numeroPedido,
    cliente: linha.cliente,
    codigoFilho: linha.codigoFilho,
    descricaoFilho: linha.descricaoFilho,
    statusItem: linha.statusItem,
    qtdePedida: linha.qtdePedida,
    saldo: linha.saldo,
    apareceNaProxima,
  };
}

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

function textoCurto(valor: unknown, limite: number): string {
  return String(valor ?? '').trim().slice(0, limite);
}

function lerAlocacoesInformadas(lista: unknown): (AlocacaoPedido & { apareceNaProxima: boolean })[] | null {
  if (!Array.isArray(lista)) return null;
  const saida: AlocacaoPedido[] = [];
  for (const item of lista) {
    const linha = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const idItem = Number(linha.idItem);
    if (!Number.isInteger(idItem) || idItem <= 0) continue;
    const statusItem = Number(linha.statusItem) || 0;
    saida.push({
      idItem,
      idPedido: Number(linha.idPedido) || 0,
      numeroPedido: String(linha.numeroPedido ?? '').trim().slice(0, 40),
      cliente: String(linha.cliente ?? '').trim().slice(0, 160),
      codigoFilho: String(linha.codigoFilho ?? '').trim().slice(0, 60),
      descricaoFilho: String(linha.descricaoFilho ?? '').trim().slice(0, 240),
      statusItem,
      statusNome: nomeStatus(statusItem),
      qtdePedida: Number(linha.qtdePedida) || 0,
      saldo: Number(linha.saldo) || 0,
      apareceNaProxima: linha.apareceNaProxima === true,
    });
  }
  return saida;
}

function anotacoesDasPecas(lista: unknown): { medidaCorte: string; observacao: string }[] {
  if (!Array.isArray(lista)) return [];
  return lista.map((item) => {
    const linha = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      medidaCorte: textoCurto(linha.medidaCorte, 80),
      observacao: textoCurto(linha.observacao, 240),
    };
  });
}

function erroUnico(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** A grade não pode ficar presa no tempo limite do MySQL quando o NOMUS está fora. */
function alocacoesComLimite(codigos: string[]) {
  if (codigos.length === 0) return listarAlocacoesCarteira(codigos);
  return new Promise<Awaited<ReturnType<typeof listarAlocacoesCarteira>>>((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        disponivel: false,
        alocacoes: [],
        saldo: 0,
        erro: 'A carteira do NOMUS demorou para responder. O cadastro continua disponível.',
      });
    }, 8_000);
    listarAlocacoesCarteira(codigos)
      .then((resultado) => {
        clearTimeout(timer);
        resolve(resultado);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        resolve({ disponivel: false, alocacoes: [], saldo: 0, erro: msg });
      });
  });
}

export async function listarGradeDecomposicao(): Promise<{
  carteiraDisponivel: boolean;
  carteiraErro?: string;
  pais: PaiGrade[];
}> {
  const pais = await prisma.decomposicaoProdutoPai.findMany({
    include: {
      filhos: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { pecas: true } },
    },
    orderBy: { nome: 'asc' },
  });
  const codigos = pais.flatMap((pai) => pai.filhos.map((f) => f.codigoNomus));
  const [carteira, bloqueios] = await Promise.all([alocacoesComLimite(codigos), bloqueiosPorPai()]);
  const vendasPorPai = carteira.disponivel ? carteira.alocacoes : null;

  return {
    carteiraDisponivel: carteira.disponivel,
    carteiraErro: carteira.erro,
    pais: pais.map((pai) => {
      const linhas = vendasPorPai
        ? filtrarElegiveis(vendasPorPai, pai.filhos.map((filho) => filho.codigoNomus), bloqueios.get(pai.id) ?? new Set())
        : null;
      const resumo = resumir(pai.filhos, linhas ? vendasDasLinhas(linhas) : null);
      return {
        id: pai.id,
        grupo: pai.grupo,
        codigo: pai.codigo,
        nome: pai.nome,
        observacao: pai.observacao,
        qtdFilhos: pai.filhos.length,
        qtdPecas: pai._count.pecas,
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

  const codigos = pai.filhos.map((filho) => filho.codigoNomus);
  const [carteira, bloqueios] = await Promise.all([listarAlocacoesCarteira(codigos), bloqueiosPorPai()]);
  const linhas = carteira.disponivel
    ? filtrarElegiveis(carteira.alocacoes, codigos, bloqueios.get(pai.id) ?? new Set())
    : null;
  const resumo = resumir(pai.filhos, linhas ? vendasDasLinhas(linhas) : null);

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
          pecas: { create: criarPecas(cadastro.pecas) },
        },
        include: includePai,
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
    await tx.decomposicaoPeca.deleteMany({ where: { paiId: id } });
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
        pecas: { create: criarPecas(cadastro.pecas) },
      },
      include: includePai,
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
    include: includePai,
  });
}

export async function listarCadastrosDecomposicao(): Promise<PaiComFilhos[]> {
  return prisma.decomposicaoProdutoPai.findMany({
    include: includePai,
    orderBy: { nome: 'asc' },
  });
}

const includeOrdem = {
  itens: { orderBy: { sortOrder: 'asc' as const } },
  pecas: { orderBy: { sortOrder: 'asc' as const } },
};

export async function listarOrdensDecomposicao() {
  return prisma.decomposicaoOrdem.findMany({
    include: includeOrdem,
    orderBy: { createdAt: 'desc' },
  });
}

export async function excluirOrdemDecomposicao(id: number): Promise<boolean> {
  const ordem = await prisma.decomposicaoOrdem.findUnique({ where: { id }, select: { id: true } });
  if (!ordem) return false;
  await prisma.$transaction([
    prisma.decomposicaoOrdemAlocacao.deleteMany({ where: { ordemId: id } }),
    prisma.decomposicaoOrdemItem.deleteMany({ where: { ordemId: id } }),
    prisma.decomposicaoOrdemPeca.deleteMany({ where: { ordemId: id } }),
    prisma.decomposicaoOrdem.delete({ where: { id } }),
  ]);
  return true;
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
  const anotacoes = anotacoesDasPecas(bruto.pecas);
  const alocacoesInformadas = lerAlocacoesInformadas(bruto.alocacoes);
  let numero = String(bruto.numero ?? '').trim().toUpperCase();

  const pai = await obterProdutoPai(paiId);
  if (!pai) throw new Error('Produto pai não encontrado.');
  if (pai.filhos.length === 0 && pai.pecas.length === 0) {
    throw new Error('Cadastre ao menos uma peça ou um produto filho antes de gerar a ordem.');
  }

  const codigos = pai.filhos.map((filho) => filho.codigoNomus);
  const [linhasCarteira, bloqueios] = await Promise.all([
    listarAlocacoesCarteira(codigos),
    bloqueiosPorPai(),
  ]);
  const elegiveisLive = linhasCarteira.disponivel
    ? filtrarElegiveis(linhasCarteira.alocacoes, codigos, bloqueios.get(pai.id) ?? new Set())
    : [];
  const elegiveis = alocacoesInformadas ?? elegiveisLive.map((linha) => ({ ...linha, apareceNaProxima: false }));
  const vendas = vendasDasLinhas(elegiveis);
  if (!/^OP-[A-Z0-9]+$/.test(numero)) numero = `OP-${Date.now().toString(36).toUpperCase()}`;
  const numeroEmUso = await prisma.decomposicaoOrdem.findUnique({ where: { numero }, select: { id: true } });
  if (numeroEmUso) numero = `OP-${Date.now().toString(36).toUpperCase()}`;

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
      alocacoesFixadas: alocacoesInformadas !== null,
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
      pecas: {
        create: pai.pecas.map((peca, index) => ({
          descricao: peca.descricao,
          quantidadeNoPai: peca.quantidade,
          quantidadeTotal: peca.quantidade * quantidade,
          medidaL: peca.medidaL,
          medidaA: peca.medidaA,
          materiaPrima: peca.materiaPrima,
          medidaCorte: anotacoes[index]?.medidaCorte ?? '',
          observacao: anotacoes[index]?.observacao ?? '',
          sortOrder: index,
        })),
      },
      alocacoes: {
        create: elegiveis.map((linha) => dadosAlocacao(linha, linha.apareceNaProxima === true)),
      },
    },
    include: includeOrdem,
  });
}

export async function preverAlocacoesDoPai(paiId: number) {
  const pai = await obterProdutoPai(paiId);
  if (!pai) return null;
  const codigos = pai.filhos.map((filho) => filho.codigoNomus);
  const [live, bloqueios] = await Promise.all([listarAlocacoesCarteira(codigos), bloqueiosPorPai()]);
  if (!live.disponivel) return { disponivel: false, alocacoes: [], saldo: 0, erro: live.erro };
  const alocacoes = filtrarElegiveis(live.alocacoes, codigos, bloqueios.get(pai.id) ?? new Set()).map((linha) => ({
    ...linha,
    apareceNaProxima: false,
  }));
  const saldo = alocacoes.reduce((soma, linha) => soma + linha.saldo, 0);
  return { disponivel: true, alocacoes, saldo };
}

export async function listarAlocacoesDaOrdem(ordemId: number) {
  const ordem = await prisma.decomposicaoOrdem.findUnique({
    where: { id: ordemId },
    include: { itens: true, pai: { include: { filhos: true } }, alocacoes: { orderBy: { id: 'asc' } } },
  });
  if (!ordem) return null;
  const codigos =
    ordem.pai && ordem.pai.filhos.length > 0
      ? ordem.pai.filhos.map((filho) => filho.codigoNomus)
      : ordem.itens.map((item) => item.codigoNomus);
  const live = await listarAlocacoesCarteira(codigos);

  if (!ordem.alocacoesFixadas && ordem.alocacoes.length === 0) {
    if (!live.disponivel) return { disponivel: false, alocacoes: [], saldo: 0, erro: live.erro };
    const bloqueios = await bloqueiosPorPai(ordem.id);
    const elegiveis = filtrarElegiveis(live.alocacoes, codigos, bloqueios.get(ordem.paiId ?? -1) ?? new Set());
    if (elegiveis.length > 0) {
      await prisma.decomposicaoOrdemAlocacao.createMany({
        data: elegiveis.map((linha) => ({ ordemId: ordem.id, ...dadosAlocacao(linha, false) })),
        skipDuplicates: true,
      });
    }
    const saldo = elegiveis.reduce((soma, linha) => soma + linha.saldo, 0);
    return {
      disponivel: true,
      alocacoes: elegiveis.map((linha) => ({ ...linha, apareceNaProxima: false })),
      saldo,
    };
  }

  const porItem = new Map((live.disponivel ? live.alocacoes : []).map((linha) => [linha.idItem, linha]));
  const alocacoes = ordem.alocacoes.map((salva) => {
    const atual = porItem.get(salva.idItem);
    const statusItem = atual ? atual.statusItem : salva.statusItem;
    return {
      idItem: salva.idItem,
      idPedido: atual?.idPedido ?? salva.idPedido,
      numeroPedido: atual?.numeroPedido || salva.numeroPedido,
      cliente: atual?.cliente || salva.cliente,
      codigoFilho: atual?.codigoFilho || salva.codigoFilho,
      descricaoFilho: atual?.descricaoFilho || salva.descricaoFilho,
      statusItem,
      statusNome: nomeStatus(statusItem),
      qtdePedida: atual ? atual.qtdePedida : salva.qtdePedida,
      saldo: atual ? atual.saldo : salva.saldo,
      apareceNaProxima: salva.apareceNaProxima,
    };
  });
  const saldo = alocacoes.reduce((soma, linha) => soma + linha.saldo, 0);
  return { disponivel: true, alocacoes, saldo, erro: live.disponivel ? undefined : live.erro };
}

export async function marcarAlocacaoNaProximaOrdem(ordemId: number, idItem: number, apareceNaProxima: boolean) {
  if (!Number.isInteger(idItem) || idItem <= 0) throw new Error('Item da carteira inválido.');
  const salva = await prisma.decomposicaoOrdemAlocacao.findUnique({
    where: { ordemId_idItem: { ordemId, idItem } },
  });
  if (!salva) throw new Error('Item não encontrado nesta ordem.');
  await prisma.decomposicaoOrdemAlocacao.update({
    where: { id: salva.id },
    data: { apareceNaProxima },
  });
  return { idItem, apareceNaProxima };
}

export async function atualizarQuantidadeOrdem(ordemId: number, quantidade: number) {
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Informe a quantidade a produzir.');
  }
  const ordem = await obterOrdemDecomposicao(ordemId);
  if (!ordem) throw new Error('Ordem não encontrada.');

  await prisma.$transaction([
    prisma.decomposicaoOrdem.update({
      where: { id: ordemId },
      data: { quantidade },
    }),
    ...ordem.pecas.map((peca) =>
      prisma.decomposicaoOrdemPeca.update({
        where: { id: peca.id },
        data: { quantidadeTotal: peca.quantidadeNoPai * quantidade },
      })
    ),
    ...ordem.itens.map((item) =>
      prisma.decomposicaoOrdemItem.update({
        where: { id: item.id },
        data: { quantidadeTotal: item.quantidadeNoPai * quantidade },
      })
    ),
  ]);

  return obterOrdemDecomposicao(ordemId);
}
