import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getCamasiDatabasePath,
  isCamasiEnabled,
  testCamasiConnection,
} from '../config/camasiFirebirdDb.js';
import {
  buildDashboardResumo,
  buildDiasDoMes,
  listTempoProducao,
  mesLabel,
} from '../data/camasiTempoProducaoRepository.js';

const PERMISSOES_ACESSO_PRODUCAO_CAMASI = [
  PERMISSOES.KPIS_PAINEL_PRODUCAO_CAMASI_VER,
  PERMISSOES.PRODUCAO_VER,
  PERMISSOES.PRODUCAO_TOTAL,
] as const;

const router = Router();
router.use(requireAuth);

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)');

const periodoSchema = z
  .object({
    dataIni: ymdSchema,
    dataFim: ymdSchema,
  })
  .refine((v) => v.dataIni <= v.dataFim, {
    message: 'dataIni deve ser menor ou igual a dataFim',
    path: ['dataIni'],
  });

const diasSchema = periodoSchema.and(
  z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
    tipo: z.enum(['producao', 'parado']),
  })
);

function async503(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      console.error('[producaoCamasiRoutes]', err instanceof Error ? err.message : String(err));
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Serviço temporariamente indisponível. Tente novamente.',
          detalhe: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };
}

/**
 * GET /api/producao-camasi/status
 * Verifica se a conexão Firebird (RICMAQ) está acessível.
 */
router.get(
  '/status',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  async503(async (_req, res) => {
    const enabled = isCamasiEnabled();
    const database = getCamasiDatabasePath();
    if (!enabled) {
      res.json({
        ok: false,
        enabled: false,
        database,
        mensagem: 'Conexão Camasi desabilitada (CAMASI_FDB_DISABLED=true).',
      });
      return;
    }
    const test = await testCamasiConnection();
    res.json({
      ok: test.ok,
      enabled: true,
      database,
      mensagem: test.mensagem,
    });
  })
);

/**
 * GET /api/producao-camasi/dashboard?dataIni&dataFim
 */
router.get(
  '/dashboard',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  async503(async (req, res) => {
    const parsed = periodoSchema.safeParse({
      dataIni: String(req.query.dataIni ?? ''),
      dataFim: String(req.query.dataFim ?? ''),
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' });
      return;
    }
    if (!isCamasiEnabled()) {
      res.status(503).json({ error: 'Conexão Camasi desabilitada.' });
      return;
    }

    const { dataIni, dataFim } = parsed.data;
    const rows = await listTempoProducao(dataIni, dataFim);
    const resumo = buildDashboardResumo(rows);
    res.json({
      dataIni,
      dataFim,
      ...resumo,
    });
  })
);

/**
 * GET /api/producao-camasi/dashboard/dias?dataIni&dataFim&mes&tipo
 */
router.get(
  '/dashboard/dias',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  async503(async (req, res) => {
    const parsed = diasSchema.safeParse({
      dataIni: String(req.query.dataIni ?? ''),
      dataFim: String(req.query.dataFim ?? ''),
      mes: String(req.query.mes ?? ''),
      tipo: String(req.query.tipo ?? ''),
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' });
      return;
    }
    if (!isCamasiEnabled()) {
      res.status(503).json({ error: 'Conexão Camasi desabilitada.' });
      return;
    }

    const { dataIni, dataFim, mes, tipo } = parsed.data;
    const rows = await listTempoProducao(dataIni, dataFim);
    const { dias, totalHoras } = buildDiasDoMes(rows, mes, tipo);
    res.json({
      dataIni,
      dataFim,
      mes,
      label: mesLabel(mes),
      tipo,
      dias,
      totalHoras,
    });
  })
);

export default router;
