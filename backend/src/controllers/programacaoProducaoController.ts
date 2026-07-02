import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { garantirSemInconsistenciaQtdePendente } from '../services/qtdePendenteInconsistenciaService.js';
import {
  buscarBobinasPorCodigos,
  buscarBobinasProgramacaoProducao,
  loadEstoqueBobinaSetores,
  loadEstoqueComponenteDetalhe,
  loadProgramacaoProducaoGrade,
  loadOrdensNomusPorComponente,
} from '../data/programacaoProducaoRepository.js';
import {
  loadProgramacaoProducaoCatalogo,
  saveCatalogoBobinasAlternativas,
  saveCatalogoDescricaoSimplificada,
  type BobinaAlternativaCatalogEntry,
} from '../data/programacaoProducaoCatalogRepository.js';
import {
  createProgramacaoProducaoRecurso,
  deleteProgramacaoProducaoRecurso,
  listProgramacaoProducaoRecursos,
  updateProgramacaoProducaoRecurso,
} from '../data/programacaoProducaoRecursosRepository.js';

const DADOS_VAZIOS = JSON.stringify({ versao: 1, linhas: [] });

/** Código automático: PCP-AAAAMMDD-NNN (sequencial no dia). */
async function gerarCodigoProgramacaoProducao(): Promise<string> {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, '0');
  const d = String(hoje.getDate()).padStart(2, '0');
  const prefix = `PCP-${y}${m}${d}-`;
  const rows = await prisma.programacaoProducaoRegistro.findMany({
    where: { name: { startsWith: prefix } },
    select: { name: true },
  });
  let maxSeq = 0;
  for (const r of rows) {
    const tail = r.name.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

function validarDadosPayload(dados: unknown): dados is Record<string, unknown> {
  if (!dados || typeof dados !== 'object') return false;
  const d = dados as Record<string, unknown>;
  if (d.versao !== 1) return false;
  if (!Array.isArray(d.linhas)) return false;
  return true;
}

function parseDadosJson(raw: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

function linhaCountFromDados(dados: Record<string, unknown>): number {
  const linhas = dados.linhas;
  return Array.isArray(linhas) ? linhas.length : 0;
}

function rowToListItem(row: {
  uid: string;
  name: string;
  description: string | null;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  createdAt: Date;
  updatedAt: Date;
  linhaCount: number;
  status: string;
  processadoAt: Date | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: Date | null;
  usuarioLoginConcluido: string | null;
}) {
  return {
    id: row.uid,
    name: row.name,
    description: row.description ?? undefined,
    criadoPorLogin: row.criadoPorLogin,
    criadoPorNome: row.criadoPorNome ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    linhaCount: row.linhaCount,
    status: row.status as 'em_processamento' | 'processado' | 'concluido',
    processadoAt: row.processadoAt ? row.processadoAt.toISOString() : null,
    usuarioLoginProcessado: row.usuarioLoginProcessado ?? null,
    concluidoAt: row.concluidoAt ? row.concluidoAt.toISOString() : null,
    usuarioLoginConcluido: row.usuarioLoginConcluido ?? null,
  };
}

function rowToSaved(row: {
  uid: string;
  name: string;
  description: string | null;
  dadosJson: string;
  updatedAt: Date;
  status: string;
  processadoAt: Date | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: Date | null;
  usuarioLoginConcluido: string | null;
}) {
  const dados = parseDadosJson(row.dadosJson);
  if (!dados) return null;
  return {
    id: row.uid,
    name: row.name,
    description: row.description ?? undefined,
    dados,
    updatedAt: row.updatedAt.toISOString(),
    status: row.status as 'em_processamento' | 'processado' | 'concluido',
    processadoAt: row.processadoAt ? row.processadoAt.toISOString() : null,
    usuarioLoginProcessado: row.usuarioLoginProcessado ?? null,
    concluidoAt: row.concluidoAt ? row.concluidoAt.toISOString() : null,
    usuarioLoginConcluido: row.usuarioLoginConcluido ?? null,
  };
}

/** GET /api/programacao-producao */
export async function listProgramacoesProducao(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.programacaoProducaoRegistro.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        uid: true,
        name: true,
        description: true,
        criadoPorLogin: true,
        criadoPorNome: true,
        createdAt: true,
        updatedAt: true,
        linhaCount: true,
        status: true,
        processadoAt: true,
        usuarioLoginProcessado: true,
        concluidoAt: true,
        usuarioLoginConcluido: true,
      },
    });
    res.json({ data: rows.map(rowToListItem) });
  } catch (err) {
    console.error('[programacaoProducao] list:', err);
    res.status(503).json({ error: 'Erro ao listar programações.' });
  }
}

/** POST /api/programacao-producao */
export async function createProgramacaoProducao(req: Request, res: Response): Promise<void> {
  const bloqueio = await garantirSemInconsistenciaQtdePendente();
  if (!bloqueio.ok) {
    res.status(409).json({ error: bloqueio.error, grupos: bloqueio.grupos });
    return;
  }
  const login = req.user?.login ?? 'anon';
  const nome = req.user?.nome ?? null;
  const body = (req.body ?? {}) as {
    name?: string;
    description?: string;
    dados?: Record<string, unknown>;
  };
  const nameInformado = String(body.name ?? '').trim();
  const name = nameInformado || (await gerarCodigoProgramacaoProducao());
  if (body.dados != null && !validarDadosPayload(body.dados)) {
    res.status(400).json({ error: 'Payload dados inválido (versao 1 e linhas obrigatórias).' });
    return;
  }
  const dadosPayload =
    body.dados && validarDadosPayload(body.dados)
      ? {
          ...body.dados,
          snapshotEm:
            typeof body.dados.snapshotEm === 'string'
              ? body.dados.snapshotEm
              : new Date().toISOString(),
        }
      : (JSON.parse(DADOS_VAZIOS) as Record<string, unknown>);
  const dadosJson = JSON.stringify(dadosPayload);
  const linhaCount = linhaCountFromDados(dadosPayload);
  try {
    const row = await prisma.programacaoProducaoRegistro.create({
      data: {
        name,
        description: body.description?.trim() || null,
        dadosJson,
        linhaCount,
        status: 'em_processamento',
        criadoPorLogin: login,
        criadoPorNome: nome,
        atualizadoPorLogin: login,
      },
    });
    const saved = rowToSaved(row);
    if (!saved) {
      res.status(503).json({ error: 'Erro ao serializar programação.' });
      return;
    }
    res.status(201).json({ data: saved });
  } catch (err) {
    console.error('[programacaoProducao] create:', err);
    res.status(503).json({ error: 'Erro ao criar programação.' });
  }
}

/** GET /api/programacao-producao/:id */
export async function getProgramacaoProducao(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const row = await prisma.programacaoProducaoRegistro.findUnique({ where: { uid } });
    if (!row) {
      res.status(404).json({ error: 'Programação não encontrada.' });
      return;
    }
    const saved = rowToSaved(row);
    if (!saved) {
      res.status(503).json({ error: 'Dados da programação inválidos.' });
      return;
    }
    res.json({ data: saved });
  } catch (err) {
    console.error('[programacaoProducao] get:', err);
    res.status(503).json({ error: 'Erro ao carregar programação.' });
  }
}

/** PUT /api/programacao-producao/:id */
export async function updateProgramacaoProducao(req: Request, res: Response): Promise<void> {
  const login = req.user?.login ?? 'anon';
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const body = (req.body ?? {}) as {
    name?: string;
    description?: string;
    dados?: Record<string, unknown>;
  };
  if (body.dados != null && !validarDadosPayload(body.dados)) {
    res.status(400).json({ error: 'Payload dados inválido (versao 1 e linhas obrigatórias).' });
    return;
  }
  let dadosJson: string | undefined;
  let linhaCount: number | undefined;
  if (body.dados && validarDadosPayload(body.dados)) {
    const existing = await prisma.programacaoProducaoRegistro.findUnique({
      where: { uid },
      select: { status: true, dadosJson: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Programação não encontrada.' });
      return;
    }
    const prev = parseDadosJson(existing.dadosJson);
    const snapshotEm =
      typeof prev?.snapshotEm === 'string' ? prev.snapshotEm : new Date().toISOString();

    if (existing.status === 'concluido') {
      res.status(409).json({ error: 'Programação concluída não pode ser alterada.' });
      return;
    }

    let payload: Record<string, unknown>;
    if (existing.status === 'processado') {
      const incoming = body.dados as { linhas?: unknown[] };
      const prevLinhas = Array.isArray(prev?.linhas) ? (prev.linhas as Record<string, unknown>[]) : [];
      const inLinhas = Array.isArray(incoming.linhas) ? (incoming.linhas as Record<string, unknown>[]) : [];
      const mergedLinhas = prevLinhas.map((prevLinha) => {
        const id = prevLinha.idComponente;
        const found = inLinhas.find((l) => l.idComponente === id);
        if (!found) return prevLinha;
        return {
          ...prevLinha,
          ordens_producao_nomus: found.ordens_producao_nomus ?? prevLinha.ordens_producao_nomus,
          ordem_producao_nomus: found.ordem_producao_nomus ?? prevLinha.ordem_producao_nomus,
        };
      });
      payload = { ...prev, linhas: mergedLinhas, snapshotEm };
    } else {
      payload = { ...body.dados, snapshotEm };
    }
    dadosJson = JSON.stringify(payload);
    linhaCount = linhaCountFromDados(payload);
  }
  try {
    const row = await prisma.programacaoProducaoRegistro.update({
      where: { uid },
      data: {
        name: body.name != null ? String(body.name).trim() || 'Nova programação' : undefined,
        description: body.description !== undefined ? body.description?.trim() || null : undefined,
        dadosJson,
        linhaCount,
        atualizadoPorLogin: login,
      },
    });
    const saved = rowToSaved(row);
    if (!saved) {
      res.status(503).json({ error: 'Erro ao serializar programação.' });
      return;
    }
    res.json({ data: saved });
  } catch {
    res.status(404).json({ error: 'Programação não encontrada.' });
  }
}

/** PATCH /api/programacao-producao/:id/processar */
export async function patchProgramacaoProducaoProcessar(req: Request, res: Response): Promise<void> {
  const bloqueio = await garantirSemInconsistenciaQtdePendente();
  if (!bloqueio.ok) {
    res.status(409).json({ error: bloqueio.error, grupos: bloqueio.grupos });
    return;
  }
  const login = req.user?.login?.trim();
  if (!login) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const existing = await prisma.programacaoProducaoRegistro.findUnique({
    where: { uid },
    select: { status: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Programação não encontrada.' });
    return;
  }
  if (existing.status === 'processado' || existing.status === 'concluido') {
    res.status(409).json({ error: 'Programação já processada ou concluída.' });
    return;
  }
  try {
    await prisma.programacaoProducaoRegistro.update({
      where: { uid },
      data: {
        status: 'processado',
        processadoAt: new Date(),
        usuarioLoginProcessado: login,
        atualizadoPorLogin: login,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] processar:', msg);
    res.status(503).json({ error: msg });
  }
}

/** PATCH /api/programacao-producao/:id/concluir */
export async function patchProgramacaoProducaoConcluir(req: Request, res: Response): Promise<void> {
  const login = req.user?.login?.trim();
  if (!login) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const existing = await prisma.programacaoProducaoRegistro.findUnique({
    where: { uid },
    select: { status: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Programação não encontrada.' });
    return;
  }
  if (existing.status === 'concluido') {
    res.status(409).json({ error: 'Programação já concluída.' });
    return;
  }
  if (existing.status === 'em_processamento') {
    res.status(409).json({
      error: 'A programação precisa estar com status "processado" antes de ser concluída.',
    });
    return;
  }
  try {
    await prisma.programacaoProducaoRegistro.update({
      where: { uid },
      data: {
        status: 'concluido',
        concluidoAt: new Date(),
        usuarioLoginConcluido: login,
        atualizadoPorLogin: login,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] concluir:', msg);
    res.status(503).json({ error: msg });
  }
}

/** GET /api/programacao-producao/bobinas-busca?q=&limit= */
export async function getBobinasProgramacaoProducaoBusca(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const { data, erro } = await buscarBobinasProgramacaoProducao(q, limit);
  if (erro && data.length === 0) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data, erro: erro ?? undefined });
}

/** GET /api/programacao-producao/bobinas-por-codigos?codigos=MP 5237,MP 5712 */
export async function getBobinasProgramacaoProducaoPorCodigos(
  req: Request,
  res: Response
): Promise<void> {
  const raw = typeof req.query.codigos === 'string' ? req.query.codigos : '';
  const codigos = raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const { data, erro } = await buscarBobinasPorCodigos(codigos);
  if (erro && data.length === 0) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data, erro: erro ?? undefined });
}

/** GET /api/programacao-producao/catalogo */
export async function getProgramacaoProducaoCatalogo(_req: Request, res: Response): Promise<void> {
  try {
    const catalogo = loadProgramacaoProducaoCatalogo();
    const recursos = listProgramacaoProducaoRecursos();
    res.json({ data: { ...catalogo, recursos } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[programacaoProducao] catalogo:', msg);
    res.status(503).json({ error: msg });
  }
}

function usuarioReq(req: Request): { login: string; nome: string | null } {
  return {
    login: req.user?.login ?? 'anon',
    nome: req.user?.nome ?? null,
  };
}

/** GET /api/programacao-producao/recursos */
export async function getProgramacaoProducaoRecursos(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: listProgramacaoProducaoRecursos() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
}

/** POST /api/programacao-producao/recursos */
export async function postProgramacaoProducaoRecurso(req: Request, res: Response): Promise<void> {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome : '';
  try {
    const data = createProgramacaoProducaoRecurso(nome, usuarioReq(req));
    res.status(201).json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/** PUT /api/programacao-producao/recursos/:cod */
export async function putProgramacaoProducaoRecurso(req: Request, res: Response): Promise<void> {
  const cod = String(req.params.cod ?? '').trim();
  const nome = typeof req.body?.nome === 'string' ? req.body.nome : '';
  try {
    const data = updateProgramacaoProducaoRecurso(cod, nome, usuarioReq(req));
    res.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/** DELETE /api/programacao-producao/recursos/:cod */
export async function deleteProgramacaoProducaoRecursoHandler(
  req: Request,
  res: Response
): Promise<void> {
  const cod = String(req.params.cod ?? '').trim();
  try {
    deleteProgramacaoProducaoRecurso(cod);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/** PUT /api/programacao-producao/catalogo/descricao */
export async function putProgramacaoProducaoCatalogoDescricao(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as { codComponente?: string; descricao?: string | null };
  const cod = typeof body.codComponente === 'string' ? body.codComponente : '';
  if (!cod.trim()) {
    res.status(400).json({ error: 'codComponente é obrigatório.' });
    return;
  }
  const descricao =
    body.descricao === null || body.descricao === undefined
      ? null
      : String(body.descricao);
  try {
    const { descricoes } = saveCatalogoDescricaoSimplificada(cod, descricao);
    res.json({ data: { descricoes } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/** PUT /api/programacao-producao/catalogo/bobinas */
export async function putProgramacaoProducaoCatalogoBobinas(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as {
    codComponente?: string;
    codigo_mp?: string;
    alternativas?: unknown;
  };
  const cod = typeof body.codComponente === 'string' ? body.codComponente : '';
  if (!cod.trim()) {
    res.status(400).json({ error: 'codComponente é obrigatório.' });
    return;
  }
  if (!Array.isArray(body.alternativas)) {
    res.status(400).json({ error: 'alternativas deve ser um array.' });
    return;
  }
  const entry: BobinaAlternativaCatalogEntry = {
    codigo_mp: typeof body.codigo_mp === 'string' ? body.codigo_mp : undefined,
    alternativas: body.alternativas.map((c) => String(c)),
  };
  try {
    const { bobinas } = saveCatalogoBobinasAlternativas(cod, entry);
    res.json({ data: { bobinas } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/** GET /api/programacao-producao/ordens-nomus?idComponente= */
export async function getOrdensNomusProgramacaoProducao(req: Request, res: Response): Promise<void> {
  const idComponente = Number(req.query.idComponente);
  if (!Number.isFinite(idComponente) || idComponente <= 0) {
    res.status(400).json({ error: 'idComponente inválido.', data: [] });
    return;
  }
  const { data, erro } = await loadOrdensNomusPorComponente(idComponente);
  res.setHeader('Cache-Control', 'no-store');
  if (erro && data.length === 0) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data, erro: erro ?? undefined });
}

/** GET /api/programacao-producao/grade */
export async function getProgramacaoProducaoGrade(_req: Request, res: Response): Promise<void> {
  const { data, erro } = await loadProgramacaoProducaoGrade();
  if (erro && data.length === 0) {
    res.status(503).json({ error: erro, data: [] });
    return;
  }
  res.json({ data, erro: erro ?? undefined });
}

/** GET /api/programacao-producao/estoque-bobina/:idBobina */
export async function getEstoqueBobinaSetores(req: Request, res: Response): Promise<void> {
  const idBobina = Number(req.params.idBobina);
  if (!Number.isFinite(idBobina) || idBobina <= 0) {
    res.status(400).json({ error: 'ID da bobina inválido.' });
    return;
  }
  const { setores, erro } = await loadEstoqueBobinaSetores(idBobina);
  if (erro && setores.length === 0) {
    res.status(503).json({ error: erro, setores: [] });
    return;
  }
  res.json({ setores, explosaoPa: undefined, erro: erro ?? undefined });
}

/** GET /api/programacao-producao/estoque-componente/:idComponente */
export async function getEstoqueComponenteDetalhe(req: Request, res: Response): Promise<void> {
  const idComponente = Number(req.params.idComponente);
  if (!Number.isFinite(idComponente) || idComponente <= 0) {
    res.status(400).json({ error: 'ID do componente inválido.' });
    return;
  }
  const { setores, explosaoPa, erro } = await loadEstoqueComponenteDetalhe(idComponente);
  if (erro && setores.length === 0 && explosaoPa.length === 0) {
    res.status(503).json({ error: erro, setores: [], explosaoPa: [] });
    return;
  }
  res.json({ setores, explosaoPa, erro: erro ?? undefined });
}

/** DELETE /api/programacao-producao/:id */
export async function deleteProgramacaoProducao(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    await prisma.programacaoProducaoRegistro.delete({ where: { uid } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Programação não encontrada.' });
  }
}
