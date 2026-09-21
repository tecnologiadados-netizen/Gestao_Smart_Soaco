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
  listTempoProducaoComFonte,
  mesLabel,
} from '../data/camasiTempoProducaoRepository.js';
import { getCamasiSyncEstado } from '../data/camasiTempoProducaoCacheRepository.js';
import {
  listarOpcoesJustificativaCamasi,
  listarParadasJustificadasNoPeriodo,
  salvarParadaJustificada,
} from '../data/camasiJustificativaRepository.js';
import {
  aplicarJustificativasManuais,
  isParadaJustificativaEditavel,
  motivosAPartirDeParadas,
} from '../utils/camasiJustificativa.js';

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
 * Firebird + estado do espelho SQLite.
 */
router.get(
  '/status',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  async503(async (_req, res) => {
    const enabled = isCamasiEnabled();
    const database = getCamasiDatabasePath();
    const sync = await getCamasiSyncEstado();
    if (!enabled) {
      res.json({
        ok: false,
        enabled: false,
        database,
        mensagem: 'Conexão Camasi desabilitada (CAMASI_FDB_DISABLED=true).',
        sync,
      });
      return;
    }
    const test = await testCamasiConnection();
    res.json({
      ok: test.ok || sync.totalRows > 0,
      enabled: true,
      database,
      mensagem: test.ok
        ? test.mensagem
        : sync.totalRows > 0
          ? `Firebird offline; usando cópia local (${sync.totalRows} registro(s)).`
          : test.mensagem,
      firebirdOk: test.ok,
      sync,
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
      const sync = await getCamasiSyncEstado();
      if (sync.totalRows <= 0) {
        res.status(503).json({ error: 'Conexão Camasi desabilitada e sem cópia local.' });
        return;
      }
    }

    const { dataIni, dataFim } = parsed.data;
    const recurso = getRecursoPainelCamasi();
    const escala = escalaEfetivaDoRecurso(recurso);
    const horasEscala = escala ? horasEscalaNoPeriodo(dataIni, dataFim, escala) : null;
    const { rows, fonte, cacheSyncedAt } = await listTempoProducaoComFonte(dataIni, dataFim, escala);
    const resumo = buildDashboardResumo(rows, { horasEscala, escala, dataIni, dataFim });
    const manuais = await listarParadasJustificadasNoPeriodo(dataIni, dataFim);
    aplicarJustificativasManuais(resumo.paradasValidas, manuais);
    resumo.motivos = motivosAPartirDeParadas(resumo.paradasValidas);
    res.json({
      dataIni,
      dataFim,
      fonte,
      cacheSyncedAt,
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
      const sync = await getCamasiSyncEstado();
      if (sync.totalRows <= 0) {
        res.status(503).json({ error: 'Conexão Camasi desabilitada e sem cópia local.' });
        return;
      }
    }

    const { dataIni, dataFim, mes, tipo } = parsed.data;
    const recurso = getRecursoPainelCamasi();
    const escala = escalaEfetivaDoRecurso(recurso);
    const { rows, fonte, cacheSyncedAt } = await listTempoProducaoComFonte(dataIni, dataFim, escala);
    const { dias, totalHoras } = buildDiasDoMes(rows, mes, tipo, escala);
    res.json({
      dataIni,
      dataFim,
      mes,
      label: mesLabel(mes),
      tipo,
      dias,
      totalHoras,
      fonte,
      cacheSyncedAt,
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

/**
 * GET /api/producao-camasi/justificativas
 * Catálogo da máquina (MOTIVO_PARADA) + motivos já cadastrados no GS (sem duplicar).
 */
router.get(
  '/justificativas',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  async503(async (_req, res) => {
    const opcoes = await listarOpcoesJustificativaCamasi();
    res.json({ opcoes });
  })
);

const justificarSchema = z.object({
  data: ymdSchema,
  inicioParado: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Início inválido.'),
  fimParado: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Fim inválido.'),
  observacao: z.string().max(240).optional().nullable(),
  nome: z.string().trim().min(1, 'Informe a justificativa.').max(120),
});

/**
 * POST /api/producao-camasi/paradas/justificar
 * Aponta motivo em parada SEM JUSTIFICATIVA (corte automático de escala).
 */
router.post(
  '/paradas/justificar',
  requirePermission(...PERMISSOES_ACESSO_PRODUCAO_CAMASI),
  validateCsrf,
  async503(async (req, res) => {
    const parsed = justificarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }
    const obs = (parsed.data.observacao ?? '').trim();
    if (!isParadaJustificativaEditavel({ observacao: obs })) {
      res.status(400).json({ error: 'Só é possível apontar motivo em parada sem justificativa gerada pelo GS.' });
      return;
    }
    const saved = await salvarParadaJustificada({
      data: parsed.data.data,
      inicioParado: parsed.data.inicioParado,
      fimParado: parsed.data.fimParado,
      observacaoOrigem: obs,
      nome: parsed.data.nome,
      usuarioLogin: req.user?.login ?? null,
    });
    res.json({ ok: true, nome: saved.nome });
  })
);

export default router;
