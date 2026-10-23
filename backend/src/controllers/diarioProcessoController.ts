/**
 * Processo do contas a pagar do Diário Financeiro.
 */

import type { Request, Response } from 'express';
import {
  aprovarProcessoDiario,
  atualizarDescricaoProcessoDiario,
  devolverProcessoDiario,
  enviarProcessoDiarioAprovacao,
  iniciarProcessoDiario,
  listarHistoricoProcessoDiario,
  listarProcessosDiario,
  listarResultadoAprovacaoProcesso,
  obterProcessoDiario,
  type DiarioAprovacaoItem,
} from '../data/diarioProcessoRepository.js';
import {
  queryDiarioContasPagar,
  queryDiarioVencidosReprogramados,
} from '../data/diarioContasPagarRepository.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function getProcessosDiario(_req: Request, res: Response): Promise<void> {
  try {
    const processos = await listarProcessosDiario();
    res.json({ processos });
  } catch (err) {
    console.error('[getProcessosDiario]', msg(err));
    res.status(500).json({ error: msg(err) });
  }
}

export async function getResultadoAprovacaoProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await obterProcessoDiario(id);
    if (!processo) {
      res.status(404).json({ error: 'Processo não encontrado.' });
      return;
    }
    if (processo.status !== 'aprovado') {
      res.status(409).json({ error: 'O resultado fica disponível somente após a aprovação.' });
      return;
    }
    const itens = await listarResultadoAprovacaoProcesso(id);
    res.json({ itens });
  } catch (err) {
    console.error('[getResultadoAprovacaoProcessoDiario]', msg(err));
    res.status(500).json({ error: msg(err) });
  }
}

export async function getHistoricoProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await obterProcessoDiario(id);
    if (!processo) {
      res.status(404).json({ error: 'Processo não encontrado.' });
      return;
    }
    res.json({ historico: await listarHistoricoProcessoDiario(id) });
  } catch (err) {
    console.error('[getHistoricoProcessoDiario]', msg(err));
    res.status(500).json({ error: msg(err) });
  }
}

export async function postIniciarProcessoDiario(req: Request, res: Response): Promise<void> {
  const dataVencimento = String(req.body?.dataVencimento ?? '').trim();
  const descricao = String(req.body?.descricao ?? '');
  if (!YMD.test(dataVencimento)) {
    res.status(400).json({ error: 'Informe a data de vencimento no formato AAAA-MM-DD.' });
    return;
  }
  try {
    const resultado = await iniciarProcessoDiario({
      dataVencimento,
      descricao,
      usuario: req.user?.login ?? '?',
    });
    res.status(resultado.existente ? 200 : 201).json(resultado);
  } catch (err) {
    console.error('[postIniciarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function patchDescricaoProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await atualizarDescricaoProcessoDiario(id);
    res.json({ processo });
  } catch (err) {
    console.error('[patchDescricaoProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postEnviarProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await enviarProcessoDiarioAprovacao(id, req.user?.login ?? '?');
    res.json({ processo });
  } catch (err) {
    console.error('[postEnviarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postAprovarProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  const bruto = req.body?.itens;
  if (!Array.isArray(bruto) || bruto.length === 0 || bruto.length > 5000) {
    res.status(400).json({ error: 'Selecione de 1 a 5.000 contas para aprovar.' });
    return;
  }
  const solicitados = new Map<string, { origem: 'Nomus' | 'Shop9'; codigo: number; banco: string }>();
  for (const item of bruto) {
    const origem = item?.origem;
    const codigo = Math.trunc(Number(item?.codigo));
    const banco = String(item?.banco ?? '').trim().toLocaleUpperCase('pt-BR');
    if ((origem !== 'Nomus' && origem !== 'Shop9') || !Number.isInteger(codigo) || codigo <= 0) {
      res.status(400).json({ error: 'Há uma conta sem origem ou código válido.' });
      return;
    }
    if (!banco || banco.length > 100) {
      res.status(400).json({ error: 'Informe o Banco de cada conta selecionada (até 100 caracteres).' });
      return;
    }
    solicitados.set(`${origem}:${codigo}`, { origem, codigo, banco });
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  try {
    const processoAtual = await obterProcessoDiario(id);
    if (!processoAtual) {
      res.status(404).json({ error: 'Processo não encontrado.' });
      return;
    }
    const [consulta, consultaVencidos] = await Promise.all([
      queryDiarioContasPagar({
        dataInicio: processoAtual.dataVencimento,
        dataFim: processoAtual.dataVencimento,
        incluirItens: false,
      }),
      queryDiarioVencidosReprogramados(),
    ]);
    const fontesComErro = [
      consulta.erroNomus ? `Nomus: ${consulta.erroNomus}` : null,
      consulta.erroShop9 ? `Shop9: ${consulta.erroShop9}` : null,
      consultaVencidos.erroNomus ? `Nomus vencidos: ${consultaVencidos.erroNomus}` : null,
      consultaVencidos.erroShop9 ? `Shop9 vencidos: ${consultaVencidos.erroShop9}` : null,
    ].filter((erro): erro is string => Boolean(erro));
    if (fontesComErro.length > 0) {
      res.status(503).json({
        error: `A aprovação foi bloqueada porque a consulta está incompleta. ${fontesComErro.join(' · ')}`,
      });
      return;
    }
    const porChaveAtual = new Map<string, (typeof consulta.linhas)[number]>(
      consulta.linhas
        .filter((linha) => linha.status === 'Em aberto' && Number(linha.saldo) > 0)
        .map((linha) => [`${linha.origem}:${linha.codigo}`, linha] as const),
    );
    const porChaveVencidos = new Map<string, (typeof consultaVencidos.linhas)[number]>(
      consultaVencidos.linhas
        .filter((linha) => linha.status === 'Em aberto' && Number(linha.saldo) > 0)
        .map((linha) => [`${linha.origem}:${linha.codigo}`, linha] as const),
    );
    const linhasPersistidas = new Map(porChaveAtual);
    for (const solicitado of solicitados.values()) {
      const chave = `${solicitado.origem}:${solicitado.codigo}`;
      const linha = porChaveAtual.get(chave) ?? porChaveVencidos.get(chave);
      if (!linha) {
        res.status(409).json({
          error: `A conta ${solicitado.origem} ${solicitado.codigo} não está mais em aberto neste processo. Atualize a grade.`,
        });
        return;
      }
      linhasPersistidas.set(chave, linha);
    }
    const itens: DiarioAprovacaoItem[] = [...linhasPersistidas.values()].map((linha) => ({
        origem: linha.origem,
        codigo: linha.codigo,
        banco: solicitados.get(`${linha.origem}:${linha.codigo}`)?.banco ?? '',
        fornecedor: linha.fornecedor,
        empresa: linha.filial?.trim() || linha.empresa,
        descricao: linha.descricao,
        vencimento: linha.dataVencimento,
        saldo: Number(linha.saldo) || 0,
    }));
    const processo = await aprovarProcessoDiario(id, login, itens);
    res.json({ processo, aprovados: solicitados.size });
  } catch (err) {
    console.error('[postAprovarProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}

export async function postDevolverProcessoDiario(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Processo inválido.' });
    return;
  }
  try {
    const processo = await devolverProcessoDiario(
      id,
      String(req.body?.motivo ?? ''),
      req.user?.login ?? '?',
    );
    res.json({ processo });
  } catch (err) {
    console.error('[postDevolverProcessoDiario]', msg(err));
    res.status(400).json({ error: msg(err) });
  }
}
