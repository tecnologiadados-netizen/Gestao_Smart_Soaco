import type { Request, Response } from 'express';
import {
  listarPreCompraCotacoes,
  listarPreCompraSugestoes,
  listarPreCompraFornecedores,
  listarPreCompraContatos,
  buscarDadosPdfPreCompra,
  buscarIdCotacaoPorNome,
  listarIdsFornecedorPedidoPorCotacao,
  buscarContatoDefinidoNaColeta,
  type CampoSugestaoPreCompra,
} from '../data/preCompraRepository.js';
import { gerarPdfPreCompra } from '../services/preCompraPdfService.js';
import {
  listarPedidosVinculadosPorCotacoesAgrupado,
  listarCotacoesVinculadasPorPedidosAgrupado,
} from '../data/comprasRepository.js';
import { prisma } from '../config/prisma.js';

const CAMPOS_SUGESTAO = new Set<CampoSugestaoPreCompra>(['cotacao', 'fornecedor', 'comprador', 'produto']);

function parseIntParam(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Extrai os vínculos de finalização de uma coleta (JSON novo ou campos legados). */
function parseVinculosColeta(
  jsonStr: string | null | undefined,
  tipoLegacy: string | null | undefined,
  idLegacy: number | null | undefined
): { tipoRegistro: string; idRegistro: number }[] {
  if (typeof jsonStr === 'string' && jsonStr.trim()) {
    try {
      const p = JSON.parse(jsonStr) as unknown;
      if (Array.isArray(p)) {
        const out: { tipoRegistro: string; idRegistro: number }[] = [];
        for (const x of p) {
          if (!x || typeof x !== 'object') continue;
          const o = x as Record<string, unknown>;
          const tr = typeof o.tipoRegistro === 'string' ? o.tipoRegistro.trim().toUpperCase() : '';
          const idR =
            typeof o.idRegistro === 'number'
              ? o.idRegistro
              : typeof o.idRegistro === 'string'
                ? parseInt(o.idRegistro, 10)
                : NaN;
          if ((tr === 'PEDIDO' || tr === 'COTACAO') && Number.isFinite(idR) && idR > 0) {
            out.push({ tipoRegistro: tr, idRegistro: idR });
          }
        }
        if (out.length > 0) return out;
      }
    } catch {
      /* ignore */
    }
  }
  const tl = typeof tipoLegacy === 'string' ? tipoLegacy.trim().toUpperCase() : '';
  if ((tl === 'PEDIDO' || tl === 'COTACAO') && idLegacy != null && Number.isFinite(idLegacy) && idLegacy > 0) {
    return [{ tipoRegistro: tl, idRegistro: idLegacy }];
  }
  return [];
}

/**
 * Resolve o filtro "N° da coleta" em ids de cotação (cotacaocompra.id) do Nomus.
 * Considera vínculos diretos (COTACAO) e indiretos (PEDIDO -> cotação via Nomus).
 * Retorna [] quando a(s) coleta(s) informada(s) não têm vínculo (grade deve ficar vazia).
 */
async function resolverCotacaoIdsPorColeta(coletaFiltro: string): Promise<number[]> {
  const ids = Array.from(
    new Set(
      coletaFiltro
        .split(/[\s,;]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
  if (ids.length === 0) return [];

  const coletas = await prisma.coletaPrecos.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      finalizacaoVinculosJson: true,
      finalizacaoTipoRegistro: true,
      finalizacaoIdRegistro: true,
    },
  });

  const cotacaoIds = new Set<number>();
  const pedidoIds = new Set<number>();
  for (const c of coletas) {
    const vinculos = parseVinculosColeta(
      c.finalizacaoVinculosJson,
      c.finalizacaoTipoRegistro,
      c.finalizacaoIdRegistro
    );
    for (const v of vinculos) {
      if (v.tipoRegistro === 'COTACAO') cotacaoIds.add(v.idRegistro);
      else if (v.tipoRegistro === 'PEDIDO') pedidoIds.add(v.idRegistro);
    }
  }

  if (pedidoIds.size > 0) {
    try {
      const { data } = await listarCotacoesVinculadasPorPedidosAgrupado([...pedidoIds]);
      for (const arr of Object.values(data)) for (const cot of arr) cotacaoIds.add(cot.id);
    } catch {
      /* Nomus indisponível: mantém apenas os vínculos diretos por cotação. */
    }
  }

  return [...cotacaoIds];
}

/**
 * Anexa `numeros_coleta` (números das coletas do Gestão finalizadas) a cada item da pré-compra,
 * casando por cotação vinculada diretamente (COTACAO) ou pelo pedido vinculado (PEDIDO) que
 * pertence àquela cotação no Nomus. Falha silenciosa: se não conseguir, os itens ficam sem coletas.
 */
export async function anexarNumerosColeta(items: Record<string, unknown>[]): Promise<void> {
  const cotacaoIds = Array.from(
    new Set(items.map((it) => Number(it.cotacao_id)).filter((n) => Number.isFinite(n) && n > 0))
  );
  for (const it of items) it.numeros_coleta = [];
  if (cotacaoIds.length === 0) return;
  const cotacaoIdsSet = new Set(cotacaoIds);

  // Pedidos ligados a essas cotações no Nomus (para casar vínculos do tipo PEDIDO).
  const pedidoParaCotacoes = new Map<number, Set<number>>();
  try {
    const { data: pedidosPorCotacao } = await listarPedidosVinculadosPorCotacoesAgrupado(cotacaoIds);
    for (const [cotIdStr, pedidos] of Object.entries(pedidosPorCotacao)) {
      const cotId = Number(cotIdStr);
      for (const p of pedidos) {
        if (!pedidoParaCotacoes.has(p.id)) pedidoParaCotacoes.set(p.id, new Set());
        pedidoParaCotacoes.get(p.id)!.add(cotId);
      }
    }
  } catch {
    /* Nomus indisponível: mantém apenas o casamento direto por cotação. */
  }

  const coletas = await prisma.coletaPrecos.findMany({
    where: {
      OR: [{ finalizacaoVinculosJson: { not: null } }, { finalizacaoIdRegistro: { not: null } }],
    },
    select: {
      id: true,
      finalizacaoVinculosJson: true,
      finalizacaoTipoRegistro: true,
      finalizacaoIdRegistro: true,
    },
  });

  const cotacaoParaColetas = new Map<number, Set<number>>();
  const addColeta = (cotId: number, coletaId: number) => {
    if (!cotacaoIdsSet.has(cotId)) return;
    if (!cotacaoParaColetas.has(cotId)) cotacaoParaColetas.set(cotId, new Set());
    cotacaoParaColetas.get(cotId)!.add(coletaId);
  };
  for (const c of coletas) {
    const vinculos = parseVinculosColeta(
      c.finalizacaoVinculosJson,
      c.finalizacaoTipoRegistro,
      c.finalizacaoIdRegistro
    );
    for (const v of vinculos) {
      if (v.tipoRegistro === 'COTACAO') {
        addColeta(v.idRegistro, c.id);
      } else if (v.tipoRegistro === 'PEDIDO') {
        const cots = pedidoParaCotacoes.get(v.idRegistro);
        if (cots) for (const cotId of cots) addColeta(cotId, c.id);
      }
    }
  }

  for (const it of items) {
    const cotId = Number(it.cotacao_id);
    const set = cotacaoParaColetas.get(cotId);
    it.numeros_coleta = set ? Array.from(set).sort((a, b) => a - b) : [];
  }
}

export async function getPreCompraCotacoes(req: Request, res: Response): Promise<void> {
  const page = parseIntParam(req.query.page, 1, 1, 10_000);
  const pageSize = parseIntParam(req.query.page_size, 20, 1, 5000);

  const statusRaw = req.query.status;
  const status =
    statusRaw != null && String(statusRaw).trim() !== ''
      ? Number(statusRaw)
      : undefined;

  const coletaFiltro = req.query.coleta != null ? String(req.query.coleta).trim() : '';
  let cotacaoIds: number[] | undefined;
  if (coletaFiltro) {
    cotacaoIds = await resolverCotacaoIdsPorColeta(coletaFiltro);
  }

  const result = await listarPreCompraCotacoes(
    {
      cotacao: req.query.cotacao != null ? String(req.query.cotacao) : undefined,
      fornecedor: req.query.fornecedor != null ? String(req.query.fornecedor) : undefined,
      produto: req.query.produto != null ? String(req.query.produto) : undefined,
      comprador: req.query.comprador != null ? String(req.query.comprador) : undefined,
      status: status != null && !Number.isNaN(status) ? status : undefined,
      dataInicio: req.query.data_inicio != null ? String(req.query.data_inicio) : undefined,
      dataFim: req.query.data_fim != null ? String(req.query.data_fim) : undefined,
      cotacaoIds,
    },
    page,
    pageSize
  );

  try {
    await anexarNumerosColeta(result.items);
  } catch (err) {
    console.error('[preCompraController] anexarNumerosColeta:', err instanceof Error ? err.message : String(err));
  }

  res.json(result);
}

export async function getPreCompraSugestoes(req: Request, res: Response): Promise<void> {
  const campo = String(req.query.campo ?? '');
  if (!CAMPOS_SUGESTAO.has(campo as CampoSugestaoPreCompra)) {
    res.status(400).json({ error: 'Campo de sugestão inválido.' });
    return;
  }

  const q = req.query.q != null ? String(req.query.q) : '';
  const limit = parseIntParam(req.query.limit, 12, 1, 20);

  const sugestoes = await listarPreCompraSugestoes(campo as CampoSugestaoPreCompra, q, limit);
  res.json({ sugestoes });
}

/**
 * Resolve o fornecedor “vencedor” da cotação para auto-seleção no PDF.
 * Preferência: `idFornecedorVencedor` das coletas do Gestão vinculadas;
 * fallback: fornecedor único dos pedidos Nomus derivados da cotação.
 */
async function resolverFornecedorVencedorPorCotacao(nomeCotacao: string): Promise<number | null> {
  const cotacaoId = await buscarIdCotacaoPorNome(nomeCotacao);
  if (cotacaoId == null) return null;

  const pedidoIds = new Set<number>();
  try {
    const { data: pedidosPorCotacao } = await listarPedidosVinculadosPorCotacoesAgrupado([cotacaoId]);
    for (const p of pedidosPorCotacao[cotacaoId] ?? []) {
      if (p.id > 0) pedidoIds.add(p.id);
    }
  } catch {
    /* Nomus indisponível: segue só com vínculo direto por cotação. */
  }

  const coletas = await prisma.coletaPrecos.findMany({
    where: {
      OR: [{ finalizacaoVinculosJson: { not: null } }, { finalizacaoIdRegistro: { not: null } }],
    },
    select: {
      id: true,
      finalizacaoVinculosJson: true,
      finalizacaoTipoRegistro: true,
      finalizacaoIdRegistro: true,
    },
  });

  const coletaIds: number[] = [];
  for (const c of coletas) {
    const vinculos = parseVinculosColeta(
      c.finalizacaoVinculosJson,
      c.finalizacaoTipoRegistro,
      c.finalizacaoIdRegistro
    );
    const bate = vinculos.some(
      (v) =>
        (v.tipoRegistro === 'COTACAO' && v.idRegistro === cotacaoId) ||
        (v.tipoRegistro === 'PEDIDO' && pedidoIds.has(v.idRegistro))
    );
    if (bate) coletaIds.push(c.id);
  }

  if (coletaIds.length > 0) {
    const registros = await prisma.coletaPrecosRegistro.findMany({
      where: {
        coletaPrecosId: { in: coletaIds },
        idFornecedorVencedor: { not: null },
      },
      select: { idFornecedorVencedor: true },
    });
    const vencedores = new Set<number>();
    for (const r of registros) {
      const n = Number(r.idFornecedorVencedor);
      if (Number.isFinite(n) && n > 0) vencedores.add(n);
    }
    if (vencedores.size === 1) return [...vencedores][0]!;
  }

  try {
    const idsPedido = await listarIdsFornecedorPedidoPorCotacao(nomeCotacao);
    if (idsPedido.length === 1) return idsPedido[0]!;
  } catch {
    /* ignore */
  }

  return null;
}

export async function getPreCompraFornecedores(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedores = await listarPreCompraFornecedores(nome);
  if (!fornecedores.length) {
    res.status(404).json({ error: 'Cotação não encontrada ou sem fornecedores.' });
    return;
  }

  let vencedorId: number | null = null;
  try {
    vencedorId = await resolverFornecedorVencedorPorCotacao(nome);
  } catch (err) {
    console.error(
      '[preCompraController] resolverFornecedorVencedorPorCotacao:',
      err instanceof Error ? err.message : String(err)
    );
  }

  // Só sugere o vencedor se ele estiver entre os fornecedores da cotação Nomus.
  if (vencedorId != null && !fornecedores.some((f) => Number(f.id) === vencedorId)) {
    vencedorId = null;
  }

  res.json({ fornecedores, vencedorId });
}

export async function getPreCompraContatos(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedorId = Number(req.query.fornecedorId ?? req.query.fornecedor_id);
  if (Number.isNaN(fornecedorId)) {
    res.status(400).json({ error: 'fornecedorId é obrigatório.' });
    return;
  }

  const definido = await buscarContatoDefinidoNaColeta(nome, fornecedorId);
  const contatos = await listarPreCompraContatos(nome, fornecedorId);

  // Garante que o contato da coleta apareça na lista mesmo se o vínculo pessoa_contato estiver incompleto.
  if (
    definido.idContato != null &&
    definido.nome &&
    !contatos.some((c) => Number(c.id) === definido.idContato)
  ) {
    contatos.unshift({ id: definido.idContato, nome: definido.nome });
  }

  if (!contatos.length && !definido.contatoFornecedor) {
    res.status(404).json({ error: 'Nenhum contato encontrado para este fornecedor.' });
    return;
  }

  res.json({
    contatos,
    contatoId: definido.idContato,
    contatoTextoLivre: definido.contatoFornecedor,
  });
}

export async function getPreCompraPdf(req: Request, res: Response): Promise<void> {
  const nome = decodeURIComponent(String(req.params.nome ?? ''));
  const fornecedorId = Number(req.query.fornecedorId ?? req.query.fornecedor_id);
  const contatoRaw = req.query.contatoId ?? req.query.contato_id;
  const contatoId =
    contatoRaw != null && String(contatoRaw).trim() !== ''
      ? Number(contatoRaw)
      : null;

  if (Number.isNaN(fornecedorId)) {
    res.status(400).json({ error: 'fornecedorId é obrigatório.' });
    return;
  }
  if (contatoId != null && Number.isNaN(contatoId)) {
    res.status(400).json({ error: 'contatoId inválido.' });
    return;
  }

  const pdfData = await buscarDadosPdfPreCompra(
    nome,
    fornecedorId,
    contatoId != null && contatoId > 0 ? contatoId : null
  );
  if (!pdfData) {
    res.status(404).json({ error: 'Dados não encontrados para gerar o PDF.' });
    return;
  }

  const contatoNome = pdfData.contato != null ? String(pdfData.contato).trim() : '';
  if (!contatoNome) {
    res.status(400).json({
      error:
        'Contato do fornecedor não definido na coleta de preços do Nomus. Selecione um contato para emitir o PDF.',
    });
    return;
  }

  try {
    await anexarNumerosColeta([pdfData]);
  } catch (err) {
    console.error('[preCompraController] anexarNumerosColeta (pdf):', err instanceof Error ? err.message : String(err));
  }

  const numerosColeta = (pdfData as { numeros_coleta?: number[] }).numeros_coleta ?? [];
  if (numerosColeta.length === 0) {
    res.status(409).json({
      error:
        'Vínculo pendente: finalize a coleta na tela de Coleta de Preços, vinculando o pedido de compra (gerado a partir desta cotação) ou a própria cotação. Após finalizar, o PDF será liberado.',
    });
    return;
  }

  const pdfBytes = await gerarPdfPreCompra(pdfData);
  const fornecedor = String(pdfData.fornecedor ?? 'fornecedor').slice(0, 30);
  const filename = `Cotacao_${nome}_${fornecedor}.pdf`.replace(/\s+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBytes);
}
