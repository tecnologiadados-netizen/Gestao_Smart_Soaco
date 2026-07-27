/**
 * Consultas do Calendário de produção congeladas dentro de um snapshot de sequência.
 *
 * - PC Pend (Entrada PC) sai direto da base congelada no Gravar.
 * - Consulta de estoque / saldo por setor / empenho por pedido são congeladas sob demanda:
 *   a primeira abertura consulta o Nomus e persiste o resultado, que nunca mais muda.
 */

import type { Request, Response } from 'express';
import { consultarEstoque, listarSaldoDetalhePorProduto } from '../data/consultaEstoqueRepository.js';
import { listarEmpenhoRessupPorPedido } from '../data/comprasRepository.js';
import {
  obterBaseMateriaisSnapshot,
  obterOuCongelarConsultaSnapshot,
} from '../data/sequenciamentoCarradasRepository.js';
import { pcPendentesCongeladasDoProduto } from '../services/disponibilidadeMateriaisCalendarioService.js';

function parseId(valor: unknown): number | null {
  const n = parseInt(String(valor ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * GET /api/pedidos/sequenciamento-carradas/snapshots/:id/pc-pend?idProduto=
 * Detalhe de PC pendente congelado (modal "PC Pend" do Horizonte).
 */
export async function getSequenciamentoSnapshotPcPend(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const idProduto = parseId(req.query.idProduto);
  if (id == null || idProduto == null) {
    res.status(400).json({ error: 'Parâmetros inválidos.', data: [] });
    return;
  }
  try {
    const base = await obterBaseMateriaisSnapshot(id);
    if (!base) {
      res.status(404).json({ error: 'Snapshot sem base de materiais congelada.', data: [] });
      return;
    }
    const data = pcPendentesCongeladasDoProduto(base, idProduto).map((l) => ({
      pedidoCompra: l.pedidoCompra,
      qtde: l.qtde,
      dataEntrega: l.dataEntrega,
    }));
    res.json({ data, capturadoEm: base.capturadoEm });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoConsultaCongelada] pcPend:', msg);
    res.status(503).json({ error: msg, data: [] });
  }
}

/**
 * POST /api/pedidos/sequenciamento-carradas/snapshots/:id/consulta-congelada
 * body: { tipo: 'estoque' | 'saldoSetor' | 'empenhoPedido', codigo?, idProduto?, considerarRequisicoes? }
 */
export async function postSequenciamentoConsultaCongelada(req: Request, res: Response): Promise<void> {
  const snapshotId = parseId(req.params.id);
  if (snapshotId == null) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tipo = String(body.tipo ?? '').trim();
  const considerarRequisicoes = body.considerarRequisicoes === true;
  const idProduto = parseId(body.idProduto);
  const codigo = String(body.codigo ?? '').trim();

  try {
    if (tipo === 'estoque') {
      if (!codigo) {
        res.status(400).json({ error: 'Parâmetro codigo obrigatório.' });
        return;
      }
      const r = await obterOuCongelarConsultaSnapshot(
        snapshotId,
        tipo,
        `${codigo}|${considerarRequisicoes ? 1 : 0}`,
        async () => {
          const { data, total, erro } = await consultarEstoque({
            filtros: { codigos: [codigo] },
            considerarRequisicoes,
          });
          if (erro) throw new Error(erro);
          return { data, total };
        }
      );
      if (!r.ok) {
        res.status(r.notFound ? 404 : 503).json({ error: r.error });
        return;
      }
      res.json({ ...r.data, capturadoEm: r.capturadoEm });
      return;
    }

    if (tipo === 'saldoSetor') {
      if (idProduto == null) {
        res.status(400).json({ error: 'Parâmetro idProduto obrigatório.' });
        return;
      }
      const r = await obterOuCongelarConsultaSnapshot(
        snapshotId,
        tipo,
        String(idProduto),
        async () => {
          const { data, erro } = await listarSaldoDetalhePorProduto(idProduto);
          if (erro) throw new Error(erro);
          return data;
        }
      );
      if (!r.ok) {
        res.status(r.notFound ? 404 : 503).json({ error: r.error });
        return;
      }
      res.json({ data: r.data, capturadoEm: r.capturadoEm });
      return;
    }

    if (tipo === 'empenhoPedido') {
      if (idProduto == null) {
        res.status(400).json({ error: 'Parâmetro idProduto obrigatório.' });
        return;
      }
      const r = await obterOuCongelarConsultaSnapshot(
        snapshotId,
        tipo,
        `${idProduto}|${considerarRequisicoes ? 1 : 0}`,
        async () => {
          const { data, erro } = await listarEmpenhoRessupPorPedido(
            idProduto,
            considerarRequisicoes,
            false
          );
          if (erro) throw new Error(erro);
          return data;
        }
      );
      if (!r.ok) {
        res.status(r.notFound ? 404 : 503).json({ error: r.error });
        return;
      }
      res.json({ data: r.data, capturadoEm: r.capturadoEm });
      return;
    }

    res.status(400).json({ error: `Tipo de consulta congelada inválido: "${tipo}".` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sequenciamentoConsultaCongelada] postConsulta:', msg);
    res.status(503).json({ error: msg });
  }
}
