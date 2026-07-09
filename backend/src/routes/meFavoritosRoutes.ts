import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { prisma } from '../config/prisma.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import {
  filtrosPermitidosParaPermissoes,
  isRotaFavoritavel,
  normalizarRotaFavorito,
  resumoFiltrosFavorito,
  TELAS_FAVORITAVEIS_CFG,
  validarFiltrosFavorito,
} from '../config/telasFavoritaveis.js';
import { atualizarFavoritoSchema, criarFavoritoSchema } from '../validators/favoritos.js';

const router = Router();
router.use(requireAuth);

async function getUsuarioId(login: string): Promise<number | null> {
  const u = await prisma.usuario.findUnique({ where: { login }, select: { id: true } });
  return u?.id ?? null;
}

function serializeFavorito(f: {
  id: number;
  nome: string;
  rota: string;
  filtros: string;
  ordem: number;
  padrao: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  let filtros: Record<string, string> = {};
  try {
    filtros = JSON.parse(f.filtros) as Record<string, string>;
  } catch {
    filtros = {};
  }
  const rota = normalizarRotaFavorito(f.rota);
  const cfg = isRotaFavoritavel(rota) ? TELAS_FAVORITAVEIS_CFG[rota] : null;
  return {
    id: f.id,
    nome: f.nome,
    rota,
    filtros,
    ordem: f.ordem,
    padrao: f.padrao,
    telaLabel: cfg?.label ?? rota,
    resumoFiltros: resumoFiltrosFavorito(rota, filtros),
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

router.get('/', async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  try {
    const usuarioId = await getUsuarioId(login);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const rotaQ = typeof req.query.rota === 'string' ? normalizarRotaFavorito(req.query.rota) : undefined;
    const rows = await prisma.telaFavorita.findMany({
      where: {
        usuarioId,
        ...(rotaQ ? { rota: rotaQ } : {}),
      },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    res.json({ favoritos: rows.map(serializeFavorito) });
  } catch (err) {
    console.error('[api/me/favoritos GET]', err);
    res.status(503).json({ error: 'Erro ao listar favoritos.' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const usuarioId = await getUsuarioId(login);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const row = await prisma.telaFavorita.findFirst({ where: { id, usuarioId } });
    if (!row) {
      res.status(404).json({ error: 'Favorito não encontrado.' });
      return;
    }
    res.json(serializeFavorito(row));
  } catch (err) {
    console.error('[api/me/favoritos GET :id]', err);
    res.status(503).json({ error: 'Erro ao buscar favorito.' });
  }
});

router.post('/', validateCsrf, async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const parsed = criarFavoritoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  const rota = normalizarRotaFavorito(parsed.data.rota);
  if (!isRotaFavoritavel(rota)) {
    res.status(400).json({ error: 'Esta tela ainda não suporta favoritos.' });
    return;
  }
  const checkFiltros = validarFiltrosFavorito(rota, parsed.data.filtros);
  if (!checkFiltros.ok) {
    res.status(400).json({ error: checkFiltros.error });
    return;
  }
  try {
    const [usuarioId, permissoes] = await Promise.all([getUsuarioId(login), getPermissoesUsuario(login)]);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    if (!filtrosPermitidosParaPermissoes(rota, permissoes)) {
      res.status(403).json({ error: 'Sem permissão para favoritar esta tela.' });
      return;
    }
    const maxOrdem = await prisma.telaFavorita.aggregate({
      where: { usuarioId, rota },
      _max: { ordem: true },
    });
    const row = await prisma.telaFavorita.create({
      data: {
        usuarioId,
        nome: parsed.data.nome.trim(),
        rota,
        filtros: JSON.stringify(checkFiltros.filtros),
        ordem: (maxOrdem._max.ordem ?? -1) + 1,
      },
    });
    res.status(201).json(serializeFavorito(row));
  } catch (err) {
    console.error('[api/me/favoritos POST]', err);
    res.status(503).json({ error: 'Erro ao criar favorito.' });
  }
});

router.put('/:id', validateCsrf, async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const parsed = atualizarFavoritoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    return;
  }
  try {
    const usuarioId = await getUsuarioId(login);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const existente = await prisma.telaFavorita.findFirst({ where: { id, usuarioId } });
    if (!existente) {
      res.status(404).json({ error: 'Favorito não encontrado.' });
      return;
    }
    let filtrosGravar: string | undefined;
    if (parsed.data.filtros !== undefined) {
      const check = validarFiltrosFavorito(existente.rota, parsed.data.filtros);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
      filtrosGravar = JSON.stringify(check.filtros);
    }
    const row = await prisma.telaFavorita.update({
      where: { id },
      data: {
        ...(parsed.data.nome !== undefined ? { nome: parsed.data.nome.trim() } : {}),
        ...(filtrosGravar !== undefined ? { filtros: filtrosGravar } : {}),
        ...(parsed.data.ordem !== undefined ? { ordem: parsed.data.ordem } : {}),
      },
    });
    res.json(serializeFavorito(row));
  } catch (err) {
    console.error('[api/me/favoritos PUT]', err);
    res.status(503).json({ error: 'Erro ao atualizar favorito.' });
  }
});

router.put('/:id/padrao', validateCsrf, async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const usuarioId = await getUsuarioId(login);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const existente = await prisma.telaFavorita.findFirst({ where: { id, usuarioId } });
    if (!existente) {
      res.status(404).json({ error: 'Favorito não encontrado.' });
      return;
    }
    await prisma.$transaction([
      prisma.telaFavorita.updateMany({
        where: { usuarioId, rota: existente.rota, padrao: true },
        data: { padrao: false },
      }),
      prisma.telaFavorita.update({ where: { id }, data: { padrao: true } }),
    ]);
    const row = await prisma.telaFavorita.findUnique({ where: { id } });
    if (!row) {
      res.status(404).json({ error: 'Favorito não encontrado.' });
      return;
    }
    res.json(serializeFavorito(row));
  } catch (err) {
    console.error('[api/me/favoritos PUT padrao]', err);
    res.status(503).json({ error: 'Erro ao definir favorito padrão.' });
  }
});

router.delete('/:id', validateCsrf, async (req: Request, res: Response) => {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const usuarioId = await getUsuarioId(login);
    if (!usuarioId) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const existente = await prisma.telaFavorita.findFirst({ where: { id, usuarioId } });
    if (!existente) {
      res.status(404).json({ error: 'Favorito não encontrado.' });
      return;
    }
    await prisma.telaFavorita.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[api/me/favoritos DELETE]', err);
    res.status(503).json({ error: 'Erro ao excluir favorito.' });
  }
});

export default router;
