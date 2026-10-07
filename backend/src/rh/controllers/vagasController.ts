import type { Request, Response } from 'express';
import { acaoVagaPermitida, podeEntrarNaAbaVaga, vagaStatusVisivel } from '../lib/rh-permissions.js';
import { VagaErro } from '../lib/vagas.js';
import {
  anexarPdf,
  atualizarVaga,
  buscarVaga,
  criarVaga,
  excluirVaga,
  listarVagas,
  removerPdf,
} from '../repositories/vagasRepository.js';

function sessao(req: Request) {
  return {
    isMaster: req.rhAuth?.isMaster === true,
    permissions: req.rhAuth?.permissions ?? null,
  };
}

function negarAba(res: Response): void {
  res.status(403).json({ error: 'Sem permissão para esta operação nesta aba.' });
}

function ator(req: Request): string {
  return req.rhAuth?.actor?.trim() || 'sistema';
}

function responder(res: Response, err: unknown): void {
  if (err instanceof VagaErro) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[vagas]', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Não foi possível concluir a operação.' });
}

export async function getVagasHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = sessao(req);
    const vagas = (await listarVagas()).filter((vaga) => vagaStatusVisivel(auth, vaga.status));
    res.json({ vagas });
  } catch (err) {
    responder(res, err);
  }
}

export async function criarVagaHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.body?.status === 'string' ? req.body.status : '';
    if (!acaoVagaPermitida(sessao(req), status, 'create')) {
      negarAba(res);
      return;
    }
    const vaga = await criarVaga({
      titulo: req.body?.titulo,
      status: req.body?.status,
      prazo: req.body?.prazo,
      observacao: req.body?.observacao,
      links: req.body?.links,
      cor: req.body?.cor,
      createdBy: ator(req),
    });
    res.json({ vaga });
  } catch (err) {
    responder(res, err);
  }
}

export async function atualizarVagaHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    const atual = await buscarVaga(id);
    if (!atual) {
      res.status(404).json({ error: 'Vaga não encontrada.' });
      return;
    }
    const auth = sessao(req);
    if (!acaoVagaPermitida(auth, atual.status, 'edit')) {
      negarAba(res);
      return;
    }
    const proximo = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (proximo && proximo !== atual.status && !podeEntrarNaAbaVaga(auth, proximo)) {
      negarAba(res);
      return;
    }
    const vaga = await atualizarVaga(
      id,
      {
        titulo: req.body?.titulo,
        observacao: req.body?.observacao,
        prazo: req.body?.prazo,
        status: req.body?.status,
        detalhe: req.body?.detalhe,
        links: req.body?.links,
        cor: req.body?.cor,
      },
      ator(req),
    );
    res.json({ vaga });
  } catch (err) {
    responder(res, err);
  }
}

export async function anexarPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const atual = await buscarVaga(String(req.params.id ?? ''));
    if (!atual) {
      res.status(404).json({ error: 'Vaga não encontrada.' });
      return;
    }
    if (!acaoVagaPermitida(sessao(req), atual.status, 'edit')) {
      negarAba(res);
      return;
    }
    const arquivo = req.file;
    if (!arquivo) throw new VagaErro('Selecione o PDF do post da vaga.');
    const vaga = await anexarPdf(String(req.params.id ?? ''), {
      buffer: arquivo.buffer,
      mimetype: arquivo.mimetype,
      originalname: arquivo.originalname,
    });
    res.json({ vaga });
  } catch (err) {
    responder(res, err);
  }
}

export async function removerPdfHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    const atual = await buscarVaga(id);
    if (!atual) {
      res.status(404).json({ error: 'Vaga não encontrada.' });
      return;
    }
    if (!acaoVagaPermitida(sessao(req), atual.status, 'edit')) {
      negarAba(res);
      return;
    }
    res.json({ vaga: await removerPdf(id) });
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirVagaHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    const atual = await buscarVaga(id);
    if (!atual) {
      res.status(404).json({ error: 'Vaga não encontrada.' });
      return;
    }
    if (!acaoVagaPermitida(sessao(req), atual.status, 'delete')) {
      negarAba(res);
      return;
    }
    await excluirVaga(id);
    const auth = sessao(req);
    const vagas = (await listarVagas()).filter((vaga) => vagaStatusVisivel(auth, vaga.status));
    res.json({ vagas });
  } catch (err) {
    responder(res, err);
  }
}
