import type { Request, Response } from 'express';
import { AUTH_COOKIE_OPTIONS } from '../controllers/authController.js';
import {
  buscarClientesNomus,
  buscarFornecedoresNomus,
  buscarProdutosNomus,
} from '../data/qualidadeNomusRepository.js';
import { gerarRccPdfBuffer, gerarRncPdfBuffer } from '../services/qualidadePdfService.js';

const CLIENTES_SEARCH_LIMIT = 80;
const PRODUTOS_SEARCH_LIMIT = 100;
const FORNECEDORES_SEARCH_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  return Math.min(Math.max(Number(raw) || fallback, 1), max);
}

export async function getQualidadeClientes(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;
    const limit = parseLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined, 30, CLIENTES_SEARCH_LIMIT);

    const result = await buscarClientesNomus({ q, id, limit });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar clientes.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeProdutos(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const codigo = typeof req.query.codigo === 'string' ? req.query.codigo : undefined;
    const limit = parseLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined, 40, PRODUTOS_SEARCH_LIMIT);

    const result = await buscarProdutosNomus({ q, codigo, limit });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar produtos.';
    res.status(500).json({ error: message });
  }
}

export async function getQualidadeFornecedores(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = parseLimit(
      typeof req.query.limit === 'string' ? req.query.limit : undefined,
      40,
      FORNECEDORES_SEARCH_LIMIT
    );

    const result = await buscarFornecedoresNomus({ q, limit });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar fornecedores.';
    res.status(500).json({ error: message });
  }
}

interface RncPdfBody {
  registro?: { tipo?: string; rnc?: unknown };
}

interface RccPdfBody {
  versao?: 'cliente' | 'empresa';
  registro?: { tipo?: string; rcc?: unknown };
}

export async function postQualidadeRncPdf(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as RncPdfBody;
    const registro = body?.registro;

    if (!registro || registro.tipo !== 'rnc' || !registro.rnc) {
      res.status(400).json({ error: 'Registro RNC inválido para geração do PDF.' });
      return;
    }

    const pdfBuffer = await gerarRncPdfBuffer(registro);
    const codigo =
      (registro as { codigoDocumento?: string; numero?: string }).codigoDocumento ??
      (registro as { numero?: string }).numero ??
      'relatorio';
    const filename = `RNC_${String(codigo).replace(/[^\w.-]+/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o PDF do RNC.';
    res.status(500).json({ error: message });
  }
}

export async function postQualidadeRccPdf(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as RccPdfBody;
    const registro = body?.registro;
    const versao = body?.versao === 'empresa' ? 'empresa' : 'cliente';

    if (!registro || registro.tipo !== 'rcc' || !registro.rcc) {
      res.status(400).json({ error: 'Registro RCC inválido para geração do PDF.' });
      return;
    }

    const pdfBuffer = await gerarRccPdfBuffer(registro, versao);
    const codigo =
      (registro as { codigoDocumento?: string; numero?: string }).codigoDocumento ??
      (registro as { numero?: string }).numero ??
      'relatorio';
    const sufixo = versao === 'cliente' ? 'Cliente' : 'Empresa';
    const filename = `RCC_${String(codigo).replace(/[^\w.-]+/g, '_')}_${sufixo}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o PDF do RCC.';
    res.status(500).json({ error: message });
  }
}

/** Garante cookie httpOnly para o iframe do SGQ (sessão pode estar só no Bearer/sessionStorage). */
export function postQualidadeEmbedSession(req: Request, res: Response): void {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.token ?? headerToken;

  if (!token) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  if (!req.cookies?.token) {
    res.cookie('token', token, AUTH_COOKIE_OPTIONS);
  }

  res.json({ ok: true });
}
