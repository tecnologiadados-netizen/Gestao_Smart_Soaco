import type { Request, Response } from 'express';
import { isNomusEnabled } from '../config/nomusDb.js';
import { listarPedidos } from '../data/pedidosRepository.js';
import {
  atualizarVeiculo,
  criarVeiculo,
  excluirProdutoCubagem,
  excluirVeiculo,
  listarVeiculos,
  obterCubagemPorIdProduto,
  obterVeiculo,
  salvarProdutoCubagem,
  type ProdutoCubagemInput,
  type VeiculoInput,
} from '../data/cubagemRepository.js';
import {
  listarProdutosCubagem,
  obterProdutoElegivelNomus,
  obterProdutoElegivelPorCodigo,
  type FiltrosProdutosCubagem,
} from '../data/cubagemProdutosNomus.js';
import {
  executarSimulacao,
  type CubagemProdutoInput,
  type ItemSimulacaoInput,
} from '../services/cubagemSimulacaoService.js';

function parseIntOpcional(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function parseFloatOpcional(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseVeiculoBody(body: Record<string, unknown>): VeiculoInput {
  const placa = String(body.placa ?? '').trim();
  if (!placa) throw new Error('Placa é obrigatória.');
  return {
    placa,
    modelo: body.modelo != null ? String(body.modelo) : null,
    alturaMm: parseIntOpcional(body.alturaMm),
    larguraMm: parseIntOpcional(body.larguraMm),
    profundidadeMm: parseIntOpcional(body.profundidadeMm),
    capacidadePesoKg: parseIntOpcional(body.capacidadePesoKg),
    taraKg: parseIntOpcional(body.taraKg),
    pbtKg: parseIntOpcional(body.pbtKg),
    alturaEmpilhamentoMm: parseIntOpcional(body.alturaEmpilhamentoMm),
    aberturas: body.aberturas != null ? String(body.aberturas) : null,
    fatorAproveitamento:
      body.fatorAproveitamento != null ? Number(body.fatorAproveitamento) : 0.85,
    ano: parseIntOpcional(body.ano),
    motoristaPadrao: body.motoristaPadrao != null ? String(body.motoristaPadrao) : null,
    ativo: body.ativo !== false,
  };
}

function parseProdutoCubagemBody(
  idProduto: number,
  produtoNomus: { codigoProduto: string; descricaoProduto: string },
  body: Record<string, unknown>
): ProdutoCubagemInput {
  const numVolumes = Math.max(1, Math.round(Number(body.numVolumes) || 1));
  const volumesRaw = Array.isArray(body.volumes) ? body.volumes : [];
  const volumes = volumesRaw.map((v, idx) => {
    const row = v as Record<string, unknown>;
    return {
      ordem: Math.round(Number(row.ordem) || idx + 1),
      descricao: row.descricao != null ? String(row.descricao) : null,
      alturaMm: parseIntOpcional(row.alturaMm),
      larguraMm: parseIntOpcional(row.larguraMm),
      profundidadeMm: parseIntOpcional(row.profundidadeMm),
      pesoKg: parseFloatOpcional(row.pesoKg),
    };
  });

  return {
    idProduto,
    codigoProduto: produtoNomus.codigoProduto,
    descricaoProduto: produtoNomus.descricaoProduto,
    pesoKg: parseFloatOpcional(body.pesoKg),
    alturaMm: parseIntOpcional(body.alturaMm),
    larguraMm: parseIntOpcional(body.larguraMm),
    profundidadeMm: parseIntOpcional(body.profundidadeMm),
    numVolumes,
    empilhavel: body.empilhavel !== false,
    pesoMaxTopoKg: parseFloatOpcional(body.pesoMaxTopoKg),
    podeDeitar: body.podeDeitar !== false,
    podeVirar: body.podeVirar !== false,
    esteLadoParaCima: body.esteLadoParaCima === true,
    fragilNaoSobrepor: body.fragilNaoSobrepor === true,
    volumes: numVolumes > 1 ? volumes : [],
  };
}

function parseFiltrosProdutos(query: Request['query']): FiltrosProdutosCubagem {
  const tipo = String(query.tipo ?? 'todos');
  const status = String(query.status ?? 'todos');
  return {
    busca: query.busca != null ? String(query.busca) : undefined,
    tipo:
      tipo === 'acabado' || tipo === 'intermediario' ? tipo : 'todos',
    status:
      status === 'dimensionado' || status === 'pendente' ? status : 'todos',
  };
}

function handleError(res: Response, err: unknown, fallback = 'Erro ao processar solicitação.') {
  const msg = err instanceof Error ? err.message : fallback;
  if (msg.includes('Unique constraint') || msg.includes('UNIQUE constraint')) {
    res.status(409).json({ error: 'Registro duplicado (placa ou produto já cadastrado).' });
    return;
  }
  res.status(400).json({ error: msg });
}

// --- Veículos ---

export async function getVeiculos(req: Request, res: Response): Promise<void> {
  try {
    const apenasAtivos = req.query.apenasAtivos === 'true';
    const data = await listarVeiculos(apenasAtivos);
    res.json({ data });
  } catch (err) {
    handleError(res, err);
  }
}

export async function getVeiculoById(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const row = await obterVeiculo(id);
    if (!row) {
      res.status(404).json({ error: 'Veículo não encontrado.' });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    handleError(res, err);
  }
}

export async function postVeiculo(req: Request, res: Response): Promise<void> {
  try {
    const input = parseVeiculoBody(req.body as Record<string, unknown>);
    const data = await criarVeiculo(input);
    res.status(201).json({ data });
  } catch (err) {
    handleError(res, err);
  }
}

export async function putVeiculo(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const existente = await obterVeiculo(id);
    if (!existente) {
      res.status(404).json({ error: 'Veículo não encontrado.' });
      return;
    }
    const input = parseVeiculoBody(req.body as Record<string, unknown>);
    const data = await atualizarVeiculo(id, input);
    res.json({ data });
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteVeiculo(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const existente = await obterVeiculo(id);
    if (!existente) {
      res.status(404).json({ error: 'Veículo não encontrado.' });
      return;
    }
    await excluirVeiculo(id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

// --- Produtos cubagem ---

export async function getProdutosCubagem(req: Request, res: Response): Promise<void> {
  try {
    if (!isNomusEnabled()) {
      res.status(503).json({ error: 'Nomus não configurado (NOMUS_DB_URL).' });
      return;
    }
    const filtros = parseFiltrosProdutos(req.query);
    const data = await listarProdutosCubagem(filtros);
    res.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao listar produtos.';
    if (msg.includes('Nomus')) {
      res.status(503).json({ error: msg });
      return;
    }
    handleError(res, err);
  }
}

export async function getProdutoCubagemById(req: Request, res: Response): Promise<void> {
  try {
    if (!isNomusEnabled()) {
      res.status(503).json({ error: 'Nomus não configurado (NOMUS_DB_URL).' });
      return;
    }
    const idProduto = Number(req.params.idProduto);
    const produto = await obterProdutoElegivelNomus(idProduto);
    if (!produto) {
      res.status(404).json({ error: 'Produto não encontrado ou não elegível para cubagem.' });
      return;
    }
    const cubagem = await obterCubagemPorIdProduto(idProduto);
    res.json({
      data: {
        ...produto,
        status: cubagem?.status ?? 'pendente',
        cubagem,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao obter produto.';
    if (msg.includes('Nomus')) {
      res.status(503).json({ error: msg });
      return;
    }
    handleError(res, err);
  }
}

export async function putProdutoCubagem(req: Request, res: Response): Promise<void> {
  try {
    if (!isNomusEnabled()) {
      res.status(503).json({ error: 'Nomus não configurado (NOMUS_DB_URL).' });
      return;
    }
    const idProduto = Number(req.params.idProduto);
    const produto = await obterProdutoElegivelNomus(idProduto);
    if (!produto) {
      res.status(404).json({ error: 'Produto não encontrado ou não elegível para cubagem.' });
      return;
    }
    const input = parseProdutoCubagemBody(
      idProduto,
      produto,
      req.body as Record<string, unknown>
    );
    const data = await salvarProdutoCubagem(input);
    res.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar cubagem.';
    if (msg.includes('Nomus')) {
      res.status(503).json({ error: msg });
      return;
    }
    handleError(res, err);
  }
}

export async function deleteProdutoCubagemHandler(req: Request, res: Response): Promise<void> {
  try {
    const idProduto = Number(req.params.idProduto);
    const row = await excluirProdutoCubagem(idProduto);
    if (!row) {
      res.status(404).json({ error: 'Cubagem do produto não encontrada.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

// --- Simulação ---

function getField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null) return row[k];
  }
  return undefined;
}

function cubagemParaInput(
  cub: Awaited<ReturnType<typeof obterCubagemPorIdProduto>>,
  produto: { codigoProduto: string; descricaoProduto: string }
): CubagemProdutoInput | null {
  if (!cub) return null;
  return {
    idProduto: cub.idProduto,
    codigoProduto: produto.codigoProduto,
    descricaoProduto: produto.descricaoProduto,
    pesoKg: cub.pesoKg,
    alturaMm: cub.alturaMm,
    larguraMm: cub.larguraMm,
    profundidadeMm: cub.profundidadeMm,
    numVolumes: cub.numVolumes,
    empilhavel: cub.empilhavel,
    esteLadoParaCima: cub.esteLadoParaCima,
    fragilNaoSobrepor: cub.fragilNaoSobrepor,
    volumes: cub.volumes.map((v) => ({
      ordem: v.ordem,
      alturaMm: v.alturaMm,
      larguraMm: v.larguraMm,
      profundidadeMm: v.profundidadeMm,
      pesoKg: v.pesoKg,
    })),
  };
}

export async function getPedidoItensCubagem(req: Request, res: Response): Promise<void> {
  try {
    if (!isNomusEnabled()) {
      res.status(503).json({ error: 'Nomus não configurado (NOMUS_DB_URL).' });
      return;
    }

    const pd = String(req.params.pd ?? '').trim();
    if (!pd) {
      res.status(400).json({ error: 'Número do pedido (PD) é obrigatório.' });
      return;
    }

    const { data: linhas, erroConexao } = await listarPedidos({ pd, limit: 500 });
    if (erroConexao) {
      res.status(503).json({ error: erroConexao });
      return;
    }

    const itens = [];
    for (const row of linhas) {
      const r = row as Record<string, unknown>;
      const qtdePendenteReal = Number(getField(r, ['Qtde Pendente Real', 'qtde_pendente_real']) ?? 0) || 0;
      if (qtdePendenteReal <= 0) continue;

      const codigo = String(getField(r, ['Cod', 'codigo', 'cod']) ?? '').trim();
      const descricao = String(getField(r, ['Descricao do produto', 'descricao']) ?? '').trim();
      const idChave = String(getField(r, ['idChave', 'id_pedido', 'idChave']) ?? '');
      const pdLinha = String(getField(r, ['PD', 'pd']) ?? pd);
      const valorPendenteReal =
        Number(getField(r, ['Saldo a Faturar Real', 'saldo_a_faturar_real']) ?? 0) || 0;
      const valorUnitario = qtdePendenteReal > 0 ? valorPendenteReal / qtdePendenteReal : 0;

      const produtoNomus = codigo ? await obterProdutoElegivelPorCodigo(codigo) : null;
      let statusCubagem: 'dimensionado' | 'pendente' = 'pendente';
      let cubagemInput: CubagemProdutoInput | null = null;
      let idProduto = produtoNomus?.idProduto ?? 0;

      if (produtoNomus) {
        const cub = await obterCubagemPorIdProduto(produtoNomus.idProduto);
        cubagemInput = cubagemParaInput(cub, produtoNomus);
        statusCubagem = cub?.status ?? 'pendente';
        idProduto = produtoNomus.idProduto;
      }

      itens.push({
        idChave,
        pd: pdLinha,
        codigo: produtoNomus?.codigoProduto ?? codigo,
        descricao: produtoNomus?.descricaoProduto ?? descricao,
        idProduto,
        qtdePendenteReal,
        valorPendenteReal,
        valorUnitario,
        statusCubagem,
        cubagem: cubagemInput,
      });
    }

    res.json({ data: itens });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar itens do pedido.';
    if (msg.includes('Nomus')) {
      res.status(503).json({ error: msg });
      return;
    }
    handleError(res, err);
  }
}

export async function postSimulacaoCalcular(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const veiculoId = Number(body.veiculoId);
    if (!Number.isFinite(veiculoId)) {
      res.status(400).json({ error: 'veiculoId é obrigatório.' });
      return;
    }

    const veiculo = await obterVeiculo(veiculoId);
    if (!veiculo) {
      res.status(404).json({ error: 'Veículo não encontrado.' });
      return;
    }

    const rawItens = Array.isArray(body.itens) ? body.itens : [];
    const itens: ItemSimulacaoInput[] = [];

    for (const raw of rawItens) {
      const item = raw as Record<string, unknown>;
      const idProduto = Number(item.idProduto);
      const quantidade = Math.max(0, Number(item.quantidade) || 0);
      if (!Number.isFinite(idProduto) || quantidade <= 0) continue;

      const produtoNomus = await obterProdutoElegivelNomus(idProduto);
      const cub = await obterCubagemPorIdProduto(idProduto);
      const cubagemInput = produtoNomus
        ? cubagemParaInput(cub, produtoNomus)
        : null;

      itens.push({
        idProduto,
        quantidade,
        idChave: item.idChave != null ? String(item.idChave) : undefined,
        pd: item.pd != null ? String(item.pd) : undefined,
        sequencia: item.sequencia != null ? Number(item.sequencia) : undefined,
        valorUnitario:
          item.valorUnitario != null ? Number(item.valorUnitario) : undefined,
        codigoProduto: produtoNomus?.codigoProduto,
        descricaoProduto: produtoNomus?.descricaoProduto,
        cubagem: cubagemInput,
      });
    }

    if (itens.length === 0) {
      res.status(400).json({ error: 'Informe ao menos um item com quantidade > 0.' });
      return;
    }

    const resultado = executarSimulacao(veiculo, itens);
    res.json({
      data: {
        veiculo,
        itens,
        ...resultado,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
}
