import type { Request, Response } from 'express';
import { buscarItemCarteira, listarItensCarteira } from '../pcp/gondolas/carteiraItens.js';
import { montarDetalheItem } from '../pcp/gondolas/detalheItem.js';
import { paisComListaProducao } from '../pcp/gondolas/fichaNomus.js';
import {
  gerarPlanilhaModeloXlsx,
  lerPlanilhaXlsx,
  linhasDoSetor,
  resumoPlanilha,
  salvarPlanilhaSetor,
} from '../pcp/gondolas/fichaPlanilha.js';
import { classificarSetor, origemDaFicha } from '../pcp/gondolas/regras.js';
import { salvarMedidaPeca } from '../pcp/gondolas/medidasPeca.js';

export async function getGondolasItens(_req: Request, res: Response) {
  const lista = await listarItensCarteira();
  if (!lista.disponivel) {
    res.status(503).json({ error: lista.erro || 'NOMUS indisponível' });
    return;
  }
  const fichas = await paisComListaProducao(lista.itens.map((item) => item.codigo));
  if (!fichas.disponivel) {
    res.status(503).json({ error: fichas.erro || 'NOMUS indisponível' });
    return;
  }
  const planilhaGondolas = linhasDoSetor('Gôndolas');
  const planilhaPortaPaletes = linhasDoSetor('Porta Paletes');
  const itens = lista.itens.map((item) => {
    const origem = origemDaFicha(
      item.codigo,
      fichas.pais,
      item.setor === 'Porta Paletes' ? planilhaPortaPaletes : planilhaGondolas
    );
    return { ...item, origem, temFicha: origem !== 'nenhuma' };
  });
  res.json({ itens, planilha: resumoPlanilha() });
}

export async function getGondolasItemDetalhe(req: Request, res: Response) {
  const idItem = Number(req.params.idItem);
  if (!Number.isFinite(idItem) || idItem <= 0) {
    res.status(400).json({ error: 'Item de pedido inválido.' });
    return;
  }
  const busca = await buscarItemCarteira(idItem);
  if (!busca.disponivel) {
    res.status(503).json({ error: busca.erro || 'NOMUS indisponível' });
    return;
  }
  if (!busca.item) {
    res.status(404).json({ error: 'Item fora da carteira de gôndolas e porta-paletes.' });
    return;
  }
  const detalhe = await montarDetalheItem(busca.item);
  if (!detalhe.disponivel || !detalhe.detalhe) {
    res.status(503).json({ error: detalhe.erro || 'NOMUS indisponível' });
    return;
  }
  res.json(detalhe.detalhe);
}

export async function getGondolasPlanilhaModelo(req: Request, res: Response) {
  const setor = classificarSetor(String(req.query.setor ?? ''));
  if (!setor) {
    res.status(400).json({ error: 'Informe o setor: Gôndolas ou Porta Paletes.' });
    return;
  }
  const data = new Date().toISOString().slice(0, 10);
  const nome = setor === 'Gôndolas' ? 'gondolas' : 'porta-paletes';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="ficha-${nome}-${data}.xlsx"`);
  res.send(gerarPlanilhaModeloXlsx(setor));
}

export async function postGondolasPlanilha(req: Request, res: Response) {
  const setor = classificarSetor(String(req.body?.setor ?? ''));
  const arquivo = req.file;
  if (!setor) {
    res.status(400).json({ error: 'Informe o setor: Gôndolas ou Porta Paletes.' });
    return;
  }
  if (!arquivo?.buffer?.length) {
    res.status(400).json({ error: 'Envie a planilha .xlsx da ficha.' });
    return;
  }
  const linhas = lerPlanilhaXlsx(arquivo.buffer, setor);
  if (linhas.length === 0) {
    res.status(400).json({ error: 'A planilha não tem linhas com código do produto.' });
    return;
  }
  res.json({ planilha: salvarPlanilhaSetor(setor, linhas), importadas: linhas.length });
}

export async function putGondolasMedida(req: Request, res: Response) {
  const codigo = String(req.body?.codigo ?? '').trim();
  const medida01 = String(req.body?.medida01 ?? '');
  const medida02 = String(req.body?.medida02 ?? '');
  if (!codigo) {
    res.status(400).json({ error: 'Informe o código da peça.' });
    return;
  }
  await salvarMedidaPeca(codigo, medida01, medida02);
  res.json({ codigo, medida01: medida01.trim(), medida02: medida02.trim() });
}
