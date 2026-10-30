import type { Request, Response } from 'express';
import {
  obterPortaPalletsDadosAbertos,
  obterPortaPalletsDetalhe,
  obterPortaPalletsMensal,
  type IndicadorPortaPallets,
} from '../data/portaPalletsComercialRepository.js';

const INDICADORES = new Set<IndicadorPortaPallets>([
  'propostas',
  'pedidos',
  'clientes',
  'primeira',
  'conversao',
  'tempo',
  'pedidos_gerados',
  'clientes_com_pedido',
  'clientes_total',
  'clientes_novos',
  'novos_com_pedido',
]);

function flagRefresh(req: Request): boolean {
  return req.query.refresh === '1' || req.query.refresh === 'true';
}

function strQuery(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s || undefined;
}

function recorteQuery(req: Request) {
  return { desde: strQuery(req, 'desde'), ate: strQuery(req, 'ate') };
}

export async function getPortaPalletsMensal(req: Request, res: Response): Promise<void> {
  try {
    const data = await obterPortaPalletsMensal(flagRefresh(req), recorteQuery(req));
    if (data.erro) {
      res.status(503).json({ error: data.erro });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('getPortaPalletsMensal', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getPortaPalletsDetalhe(req: Request, res: Response): Promise<void> {
  const mes = strQuery(req, 'mes') ?? '';
  const indicador = strQuery(req, 'indicador') ?? '';
  if (!INDICADORES.has(indicador as IndicadorPortaPallets)) {
    res.status(400).json({ error: 'Indicador inválido.' });
    return;
  }
  try {
    const data = await obterPortaPalletsDetalhe(
      mes,
      indicador as IndicadorPortaPallets,
      flagRefresh(req),
      recorteQuery(req)
    );
    if (data.erro) {
      res.status(503).json({ error: data.erro });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('getPortaPalletsDetalhe', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}

export async function getPortaPalletsDadosAbertos(req: Request, res: Response): Promise<void> {
  try {
    const data = await obterPortaPalletsDadosAbertos(flagRefresh(req));
    if (data.erro) {
      res.status(503).json({ error: data.erro });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('getPortaPalletsDadosAbertos', err);
    res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
}
