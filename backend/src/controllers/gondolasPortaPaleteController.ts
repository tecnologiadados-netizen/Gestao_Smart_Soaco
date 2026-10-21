import type { Request, Response } from 'express';
import { buscarItemCarteira, listarItensCarteira } from '../pcp/gondolas/carteiraItens.js';
import { atualizarItensConcluidos, montarDetalheItem, type DetalheItemGondola } from '../pcp/gondolas/detalheItem.js';
import {
  criarOrdemGondola,
  excluirOrdemGondola,
  itensConcluidos,
  listarOrdensGondola,
  type TipoOrdemGondola,
} from '../pcp/gondolas/ordensGondola.js';
import { paisComListaProducao } from '../pcp/gondolas/fichaNomus.js';
import {
  gerarPlanilhaModeloXlsx,
  lerPlanilhaXlsx,
  linhasDoSetor,
  resumoPlanilha,
  salvarPlanilhaSetor,
} from '../pcp/gondolas/fichaPlanilha.js';
import { chavePreferenciaFicha, classificarSetor, fichasDoCodigo, origemDaFicha } from '../pcp/gondolas/regras.js';
import { salvarMedidaPeca } from '../pcp/gondolas/medidasPeca.js';
import { preferenciasFicha, salvarPreferenciasFicha, type PreferenciaFicha } from '../pcp/gondolas/preferenciaFicha.js';

export async function getGondolasItens(_req: Request, res: Response) {
  const lista = await listarItensCarteira();
  if (!lista.disponivel) {
    res.status(503).json({ error: lista.erro || 'NOMUS indisponível' });
    return;
  }
  const concluidos = await itensConcluidos();
  const emAberto = lista.itens.filter((item) => !concluidos.has(item.idItem));
  const fichas = await paisComListaProducao(emAberto.map((item) => item.codigo));
  if (!fichas.disponivel) {
    res.status(503).json({ error: fichas.erro || 'NOMUS indisponível' });
    return;
  }
  const planilhaGondolas = linhasDoSetor('Gôndolas');
  const planilhaPortaPaletes = linhasDoSetor('Porta Paletes');
  const preferencias = await preferenciasFicha(emAberto.map((item) => item.codigo));
  const itens = emAberto.map((item) => {
    const planilha = item.setor === 'Porta Paletes' ? planilhaPortaPaletes : planilhaGondolas;
    const fontes = fichasDoCodigo(item.codigo, fichas.pais, planilha);
    const escolha = preferencias.get(chavePreferenciaFicha(item.codigo)) ?? null;
    const origem = origemDaFicha(item.codigo, fichas.pais, planilha, escolha);
    return {
      ...item,
      origem,
      temFicha: origem !== 'nenhuma',
      ambasFichas: fontes.nomus && fontes.planilha,
      escolhaFicha: fontes.nomus && fontes.planilha ? escolha : null,
    };
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
  if (!codigo) {
    res.status(400).json({ error: 'Informe o código da peça.' });
    return;
  }
  const salvo = await salvarMedidaPeca(codigo, {
    medida01: String(req.body?.medida01 ?? ''),
    medida02: String(req.body?.medida02 ?? ''),
    modelo: String(req.body?.modelo ?? ''),
    materiaPrima: String(req.body?.materiaPrima ?? ''),
  });
  res.json({ codigo, ...salvo });
}

export async function putGondolasPreferenciasFicha(req: Request, res: Response) {
  const bruto = Array.isArray(req.body?.escolhas) ? (req.body.escolhas as unknown[]) : [];
  const escolhas = bruto.flatMap((linha) => {
    const registro = linha as { codigo?: unknown; origem?: unknown };
    const codigo = String(registro?.codigo ?? '').trim();
    const origem = String(registro?.origem ?? '');
    if (!codigo || (origem !== 'nomus' && origem !== 'planilha')) return [];
    return [{ codigo, origem: origem as PreferenciaFicha }];
  });
  if (escolhas.length === 0) {
    res.status(400).json({ error: 'Informe o código e a ficha escolhida (Nomus ou Planilha).' });
    return;
  }
  await salvarPreferenciasFicha(escolhas, req.user?.login ?? null);
  res.json({ ok: true, salvas: escolhas.length });
}

export async function getGondolasOrdens(_req: Request, res: Response) {
  res.json({ ordens: await listarOrdensGondola() });
}

export async function postGondolasOrdem(req: Request, res: Response) {
  const setor = classificarSetor(String(req.body?.setor ?? ''));
  const tipoBruto = String(req.body?.tipo ?? '').toUpperCase();
  const tipo: TipoOrdemGondola | null = tipoBruto === 'PI' || tipoBruto === 'PP' || tipoBruto === 'PLANILHA' ? tipoBruto : null;
  const detalhes = Array.isArray(req.body?.detalhes) ? (req.body.detalhes as DetalheItemGondola[]) : [];
  if (!setor || !tipo) {
    res.status(400).json({ error: 'Informe o setor e o tipo da ordem.' });
    return;
  }
  try {
    const ordem = await criarOrdemGondola({ setor, tipo, detalhes, login: req.user?.login ?? null });
    await atualizarItensConcluidos(
      ordem.detalhes.map((detalhe) => detalhe.item.idItem),
      ordem.id
    );
    res.status(201).json({ ordem });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function deleteGondolasOrdem(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Ordem inválida.' });
    return;
  }
  const ok = await excluirOrdemGondola(id);
  if (!ok) {
    res.status(404).json({ error: 'Ordem não encontrada.' });
    return;
  }
  res.json({ ok: true });
}
