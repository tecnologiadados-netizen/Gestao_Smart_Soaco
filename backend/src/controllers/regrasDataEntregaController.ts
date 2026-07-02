import type { Request, Response } from 'express';
import { DEFAULT_REGRA_DATA_ENTREGA } from '../config/regrasDataEntrega.js';
import {
  criarVersaoRegraDataEntrega,
  listarVersoesRegrasDataEntrega,
  mergeRegraDataEntregaParcial,
  obterVersaoVigenteHoje,
} from '../data/regrasDataEntregaRepository.js';
import { invalidatePedidosCache } from '../data/pedidosRepository.js';
import { invalidarRegrasCache } from '../data/regrasDataEntregaRepository.js';
import { criarRegraDataEntregaVersaoSchema } from '../validators/regrasDataEntrega.js';

function parseVigenteApartirDe(raw: string): Date {
  const s = raw.trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Data de vigência inválida.');
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/pcp/regras-data-entrega
 */
export async function getRegrasDataEntrega(req: Request, res: Response): Promise<void> {
  void req;
  const [versoes, vigenteHoje] = await Promise.all([
    listarVersoesRegrasDataEntrega(),
    obterVersaoVigenteHoje(),
  ]);
  res.json({
    padraoSistema: DEFAULT_REGRA_DATA_ENTREGA,
    vigenteHoje,
    versoes,
  });
}

/**
 * POST /api/pcp/regras-data-entrega
 */
export async function postRegraDataEntregaVersao(req: Request, res: Response): Promise<void> {
  const parsed = criarRegraDataEntregaVersaoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }

  const login = req.user?.login?.trim();
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  let vigenteApartirDe: Date;
  try {
    vigenteApartirDe = parseVigenteApartirDe(parsed.data.vigenteApartirDe);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
    return;
  }

  const config = mergeRegraDataEntregaParcial(parsed.data.payload);

  try {
    const versao = await criarVersaoRegraDataEntrega({
      config,
      vigenteApartirDe,
      criadoPorLogin: login,
      criadoPorNome: null,
    });
    invalidatePedidosCache();
    invalidarRegrasCache();
    res.status(201).json({ versao });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
  }
}
