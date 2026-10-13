import type { Request, Response } from 'express';
import { buscarProdutosNomusDecomposicao, listarMateriasPrimasPp } from '../pcp/decomposicao/carteiraNomus.js';
import {
  atualizarProdutoPai,
  criarProdutoPai,
  detalharDecomposicao,
  emitirOrdemDecomposicao,
  criarSetorDecomposicao,
  excluirProdutoPai,
  excluirSetorDecomposicao,
  listarCadastrosDecomposicao,
  listarGradeDecomposicao,
  listarOrdensDecomposicao,
  listarSetoresDecomposicao,
  obterOrdemDecomposicao,
  obterProdutoPai,
} from '../data/decomposicaoRepository.js';

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Produto pai inválido.');
  return id;
}

function mensagem(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function getDecomposicaoGrade(_req: Request, res: Response): Promise<void> {
  const data = await listarGradeDecomposicao();
  res.json(data);
}

export async function getDecomposicaoDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const data = await detalharDecomposicao(idParam(req));
    if (!data.pai) {
      res.status(404).json({ error: 'Produto pai não encontrado.' });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function getDecomposicaoProduto(req: Request, res: Response): Promise<void> {
  try {
    const pai = await obterProdutoPai(idParam(req));
    if (!pai) {
      res.status(404).json({ error: 'Produto pai não encontrado.' });
      return;
    }
    res.json({ pai });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function getDecomposicaoCadastros(_req: Request, res: Response): Promise<void> {
  const pais = await listarCadastrosDecomposicao();
  res.json({
    pais: pais.map((pai) => ({
      id: pai.id,
      grupo: pai.grupo,
      codigo: pai.codigo,
      nome: pai.nome,
      observacao: pai.observacao,
      filhos: pai.filhos.map((filho) => ({
        codigoNomus: filho.codigoNomus,
        descricao: filho.descricao,
        quantidade: filho.quantidade,
        materiaPrimaCodigo: filho.materiaPrimaCodigo,
        materiaPrimaDescricao: filho.materiaPrimaDescricao,
      })),
    })),
  });
}

export async function getDecomposicaoMateriasPrimasPp(req: Request, res: Response): Promise<void> {
  const bruto = req.query.codigo;
  const lista = Array.isArray(bruto) ? bruto : bruto != null ? [bruto] : [];
  const codigos = lista.filter((item): item is string => typeof item === 'string');
  const data = await listarMateriasPrimasPp(codigos);
  if (!data.disponivel) {
    res.status(503).json({ materiais: [], error: data.erro ?? 'NOMUS indisponível' });
    return;
  }
  res.json({ materiais: data.materiais });
}

export async function getDecomposicaoProdutosNomus(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await buscarProdutosNomusDecomposicao(q);
  if (!data.disponivel) {
    res.status(503).json({ produtos: [], error: data.erro ?? 'NOMUS indisponível' });
    return;
  }
  res.json({ produtos: data.produtos });
}

export async function getDecomposicaoSetores(_req: Request, res: Response): Promise<void> {
  const setores = await listarSetoresDecomposicao();
  res.json({ setores });
}

export async function postDecomposicaoSetor(req: Request, res: Response): Promise<void> {
  try {
    const setor = await criarSetorDecomposicao(req.body);
    res.status(201).json({ setor });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function deleteDecomposicaoSetor(req: Request, res: Response): Promise<void> {
  try {
    const ok = await excluirSetorDecomposicao(idParam(req));
    if (!ok) {
      res.status(404).json({ error: 'Setor não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function getDecomposicaoOrdens(_req: Request, res: Response): Promise<void> {
  const ordens = await listarOrdensDecomposicao();
  res.json({ ordens });
}

export async function getDecomposicaoOrdem(req: Request, res: Response): Promise<void> {
  try {
    const ordem = await obterOrdemDecomposicao(idParam(req));
    if (!ordem) {
      res.status(404).json({ error: 'Ordem não encontrada.' });
      return;
    }
    res.json({ ordem });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function postDecomposicaoOrdem(req: Request, res: Response): Promise<void> {
  try {
    const ordem = await emitirOrdemDecomposicao(req.body, req.user?.login ?? null);
    res.status(201).json({ ordem });
  } catch (err) {
    const msg = mensagem(err);
    res.status(msg.includes('não encontrado') ? 404 : 400).json({ error: msg });
  }
}

export async function postDecomposicaoPai(req: Request, res: Response): Promise<void> {
  try {
    const pai = await criarProdutoPai(req.body, req.user?.login ?? null);
    res.status(201).json({ pai });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}

export async function putDecomposicaoPai(req: Request, res: Response): Promise<void> {
  try {
    const pai = await atualizarProdutoPai(idParam(req), req.body);
    res.json({ pai });
  } catch (err) {
    const msg = mensagem(err);
    res.status(msg.includes('não encontrado') ? 404 : 400).json({ error: msg });
  }
}

export async function deleteDecomposicaoPai(req: Request, res: Response): Promise<void> {
  try {
    const ok = await excluirProdutoPai(idParam(req));
    if (!ok) {
      res.status(404).json({ error: 'Produto pai não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: mensagem(err) });
  }
}
