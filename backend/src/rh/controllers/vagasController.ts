import type { Request, Response } from 'express';
import { VagaErro } from '../lib/vagas.js';
import { anexarPdf, atualizarVaga, criarVaga, excluirVaga, listarVagas, removerPdf } from '../repositories/vagasRepository.js';

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

export async function getVagasHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ vagas: await listarVagas() });
  } catch (err) {
    responder(res, err);
  }
}

export async function criarVagaHandler(req: Request, res: Response): Promise<void> {
  try {
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
    const vaga = await atualizarVaga(
      String(req.params.id ?? ''),
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
    res.json({ vaga: await removerPdf(String(req.params.id ?? '')) });
  } catch (err) {
    responder(res, err);
  }
}

export async function excluirVagaHandler(req: Request, res: Response): Promise<void> {
  try {
    await excluirVaga(String(req.params.id ?? ''));
    res.json({ vagas: await listarVagas() });
  } catch (err) {
    responder(res, err);
  }
}
