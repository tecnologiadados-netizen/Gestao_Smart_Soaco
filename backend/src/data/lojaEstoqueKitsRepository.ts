import { prisma } from '../config/prisma.js';

export type TipoMovimentacaoLojaKit = 'entrada' | 'saida' | 'inventario';

const PRODUTOS_SEED = [
  { codigo: 'PA0496', descricao: 'Filtro', estoqueInicial: 0 },
  { codigo: 'PC0001', descricao: 'Engate', estoqueInicial: 0 },
] as const;

export async function ensureLojaKitProdutosSeed(): Promise<void> {
  for (const p of PRODUTOS_SEED) {
    await prisma.lojaKitProduto.upsert({
      where: { codigo: p.codigo },
      create: {
        codigo: p.codigo,
        descricao: p.descricao,
        estoqueInicial: p.estoqueInicial,
        ativo: true,
      },
      update: {},
    });
  }
}

export async function listarProdutosAtivos() {
  await ensureLojaKitProdutosSeed();
  return prisma.lojaKitProduto.findMany({
    where: { ativo: true },
    orderBy: { codigo: 'asc' },
  });
}

/** Calcula saldo atual processando movimentações em ordem cronológica. */
export async function calcularSaldos(): Promise<
  Map<number, { produtoId: number; codigo: string; descricao: string; saldo: number }>
> {
  const produtos = await listarProdutosAtivos();
  const map = new Map<number, { produtoId: number; codigo: string; descricao: string; saldo: number }>();
  for (const p of produtos) {
    map.set(p.id, {
      produtoId: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      saldo: p.estoqueInicial,
    });
  }

  const movs = await prisma.lojaKitMovimentacao.findMany({
    where: { produtoId: { in: produtos.map((p) => p.id) } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { produtoId: true, tipo: true, quantidade: true },
  });

  for (const m of movs) {
    const row = map.get(m.produtoId);
    if (!row) continue;
    if (m.tipo === 'entrada') row.saldo += m.quantidade;
    else if (m.tipo === 'saida') row.saldo -= m.quantidade;
    else if (m.tipo === 'inventario') row.saldo = m.quantidade;
  }

  return map;
}

export async function obterResumo() {
  const saldos = await calcularSaldos();
  const produtos = Array.from(saldos.values());
  const movs = await prisma.lojaKitMovimentacao.findMany({
    select: { tipo: true, quantidade: true, produtoId: true },
  });
  const invCount = await prisma.lojaKitInventario.count();

  let totalEntradas = 0;
  let totalSaidas = 0;
  const porProduto = new Map<number, { entradas: number; saidas: number }>();
  for (const p of produtos) {
    porProduto.set(p.produtoId, { entradas: 0, saidas: 0 });
  }
  for (const m of movs) {
    if (m.tipo === 'entrada') {
      totalEntradas += m.quantidade;
      const agg = porProduto.get(m.produtoId);
      if (agg) agg.entradas += m.quantidade;
    } else if (m.tipo === 'saida') {
      totalSaidas += m.quantidade;
      const agg = porProduto.get(m.produtoId);
      if (agg) agg.saidas += m.quantidade;
    }
  }

  return {
    produtos: produtos.map((p) => ({
      ...p,
      entradas: porProduto.get(p.produtoId)?.entradas ?? 0,
      saidas: porProduto.get(p.produtoId)?.saidas ?? 0,
      estoqueBaixo: p.saldo < 10,
    })),
    totais: {
      entradas: totalEntradas,
      saidas: totalSaidas,
      inventarios: invCount,
      registros: movs.length,
    },
  };
}

export type ListarMovimentacoesFiltro = {
  tipo?: TipoMovimentacaoLojaKit;
  produtoId?: number;
  limit?: number;
};

export async function listarMovimentacoes(filtro: ListarMovimentacoesFiltro = {}) {
  await ensureLojaKitProdutosSeed();
  const limit = Math.min(Math.max(filtro.limit ?? 500, 1), 2000);
  const rows = await prisma.lojaKitMovimentacao.findMany({
    where: {
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.produtoId ? { produtoId: filtro.produtoId } : {}),
    },
    include: {
      produto: { select: { codigo: true, descricao: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    produtoId: r.produtoId,
    codigo: r.produto.codigo,
    descricao: r.produto.descricao,
    tipo: r.tipo as TipoMovimentacaoLojaKit,
    quantidade: r.quantidade,
    pd: r.pd,
    usuarioId: r.usuarioId,
    responsavelNome: r.responsavelNome,
    observacao: r.observacao,
    inventarioId: r.inventarioId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function registrarMovimentacao(input: {
  produtoId: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  pd: string;
  documentoSaida: string;
  produtoPedidoCodigo: string;
  produtoPedidoDescricao?: string | null;
  usuarioId: number | null;
  responsavelNome: string;
}) {
  const produto = await prisma.lojaKitProduto.findFirst({
    where: { id: input.produtoId, ativo: true },
  });
  if (!produto) {
    throw Object.assign(new Error('Kit não encontrado ou inativo.'), { status: 404 });
  }

  if (input.tipo === 'saida') {
    const saldos = await calcularSaldos();
    const saldo = saldos.get(input.produtoId)?.saldo ?? 0;
    if (input.quantidade > saldo) {
      throw Object.assign(
        new Error(`Estoque insuficiente. Disponível: ${saldo}`),
        { status: 400 },
      );
    }
  }

  const pd = input.pd.trim();
  const doc = input.documentoSaida.trim();
  const prodCod = input.produtoPedidoCodigo.trim();
  const prodDesc = input.produtoPedidoDescricao?.trim() || '';
  const observacao = prodDesc
    ? `Doc. saída: ${doc} | Produto: ${prodCod} — ${prodDesc}`
    : `Doc. saída: ${doc} | Produto: ${prodCod}`;

  const row = await prisma.lojaKitMovimentacao.create({
    data: {
      produtoId: input.produtoId,
      tipo: input.tipo,
      quantidade: input.quantidade,
      pd,
      usuarioId: input.usuarioId,
      responsavelNome: input.responsavelNome,
      observacao,
    },
    include: { produto: { select: { codigo: true, descricao: true } } },
  });

  return {
    id: row.id,
    produtoId: row.produtoId,
    codigo: row.produto.codigo,
    descricao: row.produto.descricao,
    tipo: row.tipo as TipoMovimentacaoLojaKit,
    quantidade: row.quantidade,
    pd: row.pd,
    usuarioId: row.usuarioId,
    responsavelNome: row.responsavelNome,
    observacao: row.observacao,
    inventarioId: row.inventarioId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listarInventarios(limit = 50) {
  const take = Math.min(Math.max(limit, 1), 200);
  const rows = await prisma.lojaKitInventario.findMany({
    include: {
      itens: {
        include: { produto: { select: { codigo: true, descricao: true } } },
        orderBy: { produtoId: 'asc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });
  return rows.map((inv) => ({
    id: inv.id,
    observacao: inv.observacao,
    usuarioId: inv.usuarioId,
    responsavelNome: inv.responsavelNome,
    createdAt: inv.createdAt.toISOString(),
    itens: inv.itens.map((it) => ({
      produtoId: it.produtoId,
      codigo: it.produto.codigo,
      descricao: it.produto.descricao,
      qtdSistema: it.qtdSistema,
      qtdContada: it.qtdContada,
      diferenca: it.qtdContada - it.qtdSistema,
    })),
  }));
}

export async function confirmarInventario(input: {
  observacao?: string | null;
  itens: { produtoId: number; qtdContada: number }[];
  usuarioId: number | null;
  responsavelNome: string;
}) {
  const saldos = await calcularSaldos();
  const produtosAtivos = await listarProdutosAtivos();
  const ativosIds = new Set(produtosAtivos.map((p) => p.id));

  for (const it of input.itens) {
    if (!ativosIds.has(it.produtoId)) {
      throw Object.assign(new Error(`Produto ${it.produtoId} inválido ou inativo.`), { status: 400 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.lojaKitInventario.create({
      data: {
        observacao: input.observacao?.trim() || null,
        usuarioId: input.usuarioId,
        responsavelNome: input.responsavelNome,
      },
    });

    for (const it of input.itens) {
      const qtdSistema = saldos.get(it.produtoId)?.saldo ?? 0;
      await tx.lojaKitInventarioItem.create({
        data: {
          inventarioId: inv.id,
          produtoId: it.produtoId,
          qtdSistema,
          qtdContada: it.qtdContada,
        },
      });
      await tx.lojaKitMovimentacao.create({
        data: {
          produtoId: it.produtoId,
          tipo: 'inventario',
          quantidade: it.qtdContada,
          usuarioId: input.usuarioId,
          responsavelNome: input.responsavelNome,
          observacao: input.observacao?.trim() || null,
          inventarioId: inv.id,
          pd: null,
        },
      });
    }

    return inv.id;
  });

  const list = await listarInventarios(1);
  return list.find((i) => i.id === result) ?? (await listarInventarios(5)).find((i) => i.id === result)!;
}
