import type { Request, Response } from 'express';
import {
  getDashboardDetalhes,
  getIndicadorDetalhe,
  getIndicadoresGlobais,
  getSaudeQuadroReceberEmpresa,
  listEmpresas,
  searchPessoasEGrupos,
} from '../data/crmFinanceiro/crmDashboardService.js';
import { parseEmpresaIdParam } from '../data/crmFinanceiro/empresaConfig.js';
import type { ColunaIndicador } from '../data/crmFinanceiro/types.js';

const COLUNAS_VALIDAS = new Set<ColunaIndicador>([
  'total',
  'emAtraso',
  'emDia',
  'recebido30d',
  'recebido90d',
  'recebidoAno',
  'recebidoHistorico',
]);

function parseGrupoIdParam(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function getCrmDashboard(req: Request, res: Response): Promise<void> {
  try {
    const pessoa = String(req.query.pessoa ?? '').trim() || null;
    const grupoId = parseGrupoIdParam(req.query.grupoId);
    const empresaId = parseEmpresaIdParam(
      typeof req.query.empresa === 'string' ? req.query.empresa : null,
    );

    if (pessoa || grupoId != null) {
      const data = await getDashboardDetalhes(pessoa, empresaId, grupoId);
      res.json(data);
      return;
    }

    const data = await getIndicadoresGlobais(null, {
      refresh: req.query.refresh === '1',
      empresaId,
    });
    res.json(data);
  } catch (error) {
    console.error('Erro ao carregar CRM dashboard:', error);
    res.status(500).json({ error: 'Não foi possível carregar os dados do painel.' });
  }
}

export async function getCrmDetalhe(req: Request, res: Response): Promise<void> {
  try {
    const tipo = req.query.tipo;
    const coluna = req.query.coluna as ColunaIndicador | undefined;
    const classificacao =
      typeof req.query.classificacao === 'string' ? req.query.classificacao : null;
    const pessoa = String(req.query.pessoa ?? '').trim() || null;
    const grupoId = parseGrupoIdParam(req.query.grupoId);
    const empresaId = parseEmpresaIdParam(
      typeof req.query.empresa === 'string' ? req.query.empresa : null,
    );

    if (tipo !== 'receber' && tipo !== 'pagar') {
      res.status(400).json({ error: "Parâmetro 'tipo' inválido. Use 'receber' ou 'pagar'." });
      return;
    }

    if (!coluna || !COLUNAS_VALIDAS.has(coluna)) {
      res.status(400).json({ error: "Parâmetro 'coluna' inválido." });
      return;
    }

    const resultado = await getIndicadorDetalhe(
      tipo,
      coluna,
      classificacao,
      pessoa,
      empresaId,
      grupoId,
    );
    res.json(resultado);
  } catch (error) {
    console.error('Erro ao carregar CRM detalhe:', error);
    res.status(500).json({ error: 'Não foi possível carregar os registros.' });
  }
}

export async function getCrmSaudeEmpresa(req: Request, res: Response): Promise<void> {
  try {
    const empresaId = parseEmpresaIdParam(
      typeof req.query.empresa === 'string' ? req.query.empresa : null,
    );
    const data = await getSaudeQuadroReceberEmpresa({
      refresh: req.query.refresh === '1',
      empresaId,
    });
    res.json(data);
  } catch (error) {
    console.error('Erro ao carregar saúde CRM empresa:', error);
    res.status(500).json({
      error: 'Não foi possível carregar os indicadores de saúde da empresa.',
    });
  }
}

export async function getCrmPessoas(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q : null;
    const empresaId = parseEmpresaIdParam(
      typeof req.query.empresa === 'string' ? req.query.empresa : null,
    );
    const data = await searchPessoasEGrupos(search, empresaId);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar pessoas CRM:', error);
    res.status(500).json({ error: 'Não foi possível buscar pessoas.' });
  }
}

export async function getCrmEmpresas(_req: Request, res: Response): Promise<void> {
  try {
    const empresas = await listEmpresas();
    res.json(empresas);
  } catch (error) {
    console.error('Erro ao buscar empresas CRM:', error);
    res.status(500).json({ error: 'Não foi possível buscar empresas.' });
  }
}
