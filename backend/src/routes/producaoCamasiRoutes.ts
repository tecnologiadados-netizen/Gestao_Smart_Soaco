import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI } from '../utils/kpisPermissoes.js';
import {
  getCamasiDatabasePath,
  isCamasiEnabled,
  testCamasiConnection,
} from '../config/camasiFirebirdDb.js';
import {
  escalaEfetivaDoRecurso,
  getRecursoPainelCamasi,
  updateProgramacaoProducaoRecurso,
} from '../data/programacaoProducaoRecursosRepository.js';
import { horasEscalaNoPeriodo } from '../utils/recursoEscalaTrabalho.js';
import {
  buildDashboardResumo,
  buildDiasDoMes,
  listTempoProducao,
  mesLabel,
} from '../data/camasiTempoProducaoRepository.js';

const PERMISSOES_ACESSO_PRODUCAO_CAMASI = PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI;

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
      const detalhe = err instanceof Error ? err.message : String(err);
      console.error('[producaoCamasiRoutes]', detalhe);
      if (!res.headersSent) {
        const host = process.env.CAMASI_FDB_HOST?.trim() || '127.0.0.1';
        const port = process.env.CAMASI_FDB_PORT?.trim() || '3050';
        const rede =
          detalhe.includes('ENETUNREACH') ||
          detalhe.includes('EHOSTUNREACH') ||
          detalhe.includes('ETIMEDOUT') ||
          detalhe.includes('timeout');
        const recusado = detalhe.includes('ECONNREFUSED');
        const error = recusado
          ? `Não foi possível conectar ao Firebird da Camasi (${host}:${port}). O RICMAQ não está escutando nessa porta.`
          : rede
            ? `O PC do banco Camasi (${host}) está desligado ou fora da rede. Ligue a máquina do RICMAQ e clique em Atualizar.`
            : `Não foi possível ler o banco da Camasi: ${detalhe}`;
        res.status(503).json({ error, detalhe });
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
    const recurso = getRecursoPainelCamasi();
    const escala = escalaEfetivaDoRecurso(recurso);
    const horasEscala = escala ? horasEscalaNoPeriodo(dataIni, dataFim, escala) : null;
    const rows = await listTempoProducao(dataIni, dataFim, escala);
    const resumo = buildDashboardResumo(rows, { horasEscala, escala, dataIni, dataFim });
    res.json({
      dataIni,
      dataFim,
      escala: escala
        ? {
            recursoCod: recurso?.cod ?? null,
            recursoNome: recurso?.nome ?? null,
            diasSemana: escala.diasSemana,
            faixas: escala.faixas,
            horasEscala: resumo.kpis.horasEscala,
            excecoes: escala.excecoes ?? [],
          }
        : null,
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
    const recurso = getRecursoPainelCamasi();
    const escala = escalaEfetivaDoRecurso(recurso);
    const rows = await listTempoProducao(dataIni, dataFim, escala);
    const { dias, totalHoras } = buildDiasDoMes(rows, mes, tipo, escala);
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

/**
 * GET /api/producao-camasi/recurso-escala
 * Recurso Camasi (R001) com escala semanal e pontualidades.
 */
router.get(
  '/recurso-escala',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  (_req, res) => {
    const recurso = getRecursoPainelCamasi();
    if (!recurso) {
      res.status(404).json({ error: 'Recurso do painel Camasi não cadastrado.' });
      return;
    }
    res.json({ data: recurso });
  }
);

/**
 * PUT /api/producao-camasi/recurso-escala/excecoes
 * Folga / horário especial no recurso do painel (sem exigir permissão de PCP).
 */
router.put(
  '/recurso-escala/excecoes',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  validateCsrf,
  (req, res) => {
    const recurso = getRecursoPainelCamasi();
    if (!recurso) {
      res.status(404).json({ error: 'Recurso do painel Camasi não cadastrado.' });
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, 'escalaExcecoes')) {
      res.status(400).json({ error: 'Informe as escalas pontuais.' });
      return;
    }
    try {
      const data = updateProgramacaoProducaoRecurso(
        recurso.cod,
        recurso.nome,
        {
          login: req.user?.login ?? 'anon',
          nome: null,
        },
        undefined,
        req.body.escalaExcecoes
      );
      res.json({ data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  }
);

export default router;
