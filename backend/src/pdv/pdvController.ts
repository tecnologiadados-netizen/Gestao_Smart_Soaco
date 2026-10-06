import type { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import { abrirPfx } from './fiscal/certificado.js';
import {
  buscarClientes,
  consultarCadastro,
  buscarProdutos,
  listarCondicoes,
  listarEmpresas,
  listarFormas,
  listarSetores,
  listarTabelasPreco,
  listarTiposMovimentacao,
} from './pdvCatalogo.js';
import { contextoPdv, exigirEmpresa } from './pdvContext.js';
import {
  abrirCaixa,
  caixaAberto,
  confirmarVenda,
  fecharCaixa,
  movimentarCaixa,
  PdvErro,
  retomarEspera,
} from './pdvOperacao.js';
import { cifrar } from './secrets.js';

export const uploadPfx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function statusDe(err: unknown): number {
  if (err instanceof PdvErro) return err.status;
  if (err && typeof err === 'object' && 'status' in err) return Number((err as { status: number }).status) || 500;
  return 500;
}

function mensagem(err: unknown): string {
  return err instanceof Error ? err.message : 'Falha no PDV.';
}

async function exigirConfig(req: Request): Promise<void> {
  const login = req.user?.login;
  if (!login) throw new PdvErro('Não autorizado.', 401);
  const perms = await getPermissoesUsuario(login);
  if (!perms.includes(PERMISSOES.PDV_CONFIGURAR)) throw new PdvErro('Sem permissão para configurar o PDV.', 403);
}

export async function getSessao(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const config = ctx.idEmpresa
      ? await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa: ctx.idEmpresa } })
      : null;
    const caixa = ctx.idEmpresa ? await caixaAberto(ctx.usuarioId, ctx.idEmpresa) : null;
    const cert = ctx.idEmpresa
      ? await prisma.pdvCertificado.findUnique({ where: { idEmpresa: ctx.idEmpresa } })
      : null;
    res.json({
      operador: ctx.nome,
      podeConfigurar: ctx.podeConfigurar,
      idEmpresa: ctx.idEmpresa,
      empresa: config?.nomeEmpresa ?? '',
      uf: config?.uf ?? '',
      crt: config?.crt ?? '',
      configurado: Boolean(config?.idTabelaPreco && config?.idSetorSaida),
      ignorarEstoque: Boolean(config?.ignorarEstoque),
      certificado: cert
        ? {
            cnpj: cert.cnpj,
            titular: cert.titular,
            validoAte: cert.validoAte,
            ambiente: cert.ambiente,
            temCsc: Boolean(cert.cscCipher),
            serieNfce: cert.serieNfce,
            serieNfe: cert.serieNfe,
          }
        : null,
      caixa,
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getProdutos(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const q = String(req.query.q ?? '');
    res.json({ produtos: await buscarProdutos(q, idEmpresa) });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getClientes(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    res.json({ clientes: await buscarClientes(String(req.query.q ?? '')) });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getFormas(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    const [formas, condicoes] = await Promise.all([listarFormas(), listarCondicoes()]);
    res.json({
      formas: formas.map((f) => ({ id: f.id, nome: f.nome, meio: String(f.extra?.meioPagamentoNfe ?? '') })),
      condicoes: condicoes.map((c) => ({ id: c.id, nome: c.nome })),
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postAbrirCaixa(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    res.json(await abrirCaixa(ctx.usuarioId, idEmpresa, Number(req.body?.fundoTroco ?? 0)));
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postMovimento(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const tipo = req.body?.tipo === 'sangria' ? 'sangria' : 'suprimento';
    res.json(await movimentarCaixa(ctx.usuarioId, idEmpresa, tipo, Number(req.body?.valor ?? 0), String(req.body?.observacao ?? '')));
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postFecharCaixa(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    res.json(await fecharCaixa(ctx.usuarioId, exigirEmpresa(ctx)));
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getEspera(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const vendas = await prisma.pdvVenda.findMany({
      where: { idEmpresa, status: 'espera' },
      include: { itens: true, pagamentos: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({ vendas });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postVenda(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const fiscalRaw = String(req.body?.fiscal ?? 'nenhuma');
    const fiscal = fiscalRaw === 'nfce' || fiscalRaw === 'nfe' ? fiscalRaw : 'nenhuma';
    const venda = await confirmarVenda({
      usuarioId: ctx.usuarioId,
      idEmpresa,
      itens: Array.isArray(req.body?.itens) ? req.body.itens : [],
      pagamentos: Array.isArray(req.body?.pagamentos) ? req.body.pagamentos : [],
      idPessoaCliente: Number(req.body?.idPessoaCliente) || null,
      clienteNome: String(req.body?.clienteNome ?? ''),
      clienteDocumento: String(req.body?.clienteDocumento ?? ''),
      clienteContribuinte: Boolean(req.body?.clienteContribuinte),
      clienteIe: String(req.body?.clienteIe ?? ''),
      clienteUf: String(req.body?.clienteUf ?? ''),
      observacao: String(req.body?.observacao ?? ''),
      fiscal,
      espera: Boolean(req.body?.espera),
    });
    res.json(venda);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postRetomar(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    res.json(await retomarEspera(idEmpresa, Number(req.params.id)));
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getVenda(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const venda = await prisma.pdvVenda.findFirst({
      where: { id: Number(req.params.id), idEmpresa },
      include: { itens: true, pagamentos: true },
    });
    if (!venda) {
      res.status(404).json({ error: 'Venda não encontrada.' });
      return;
    }
    res.json(venda);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getConsultaConfig(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const tipo = String(req.query.tipo ?? '');
    const q = String(req.query.q ?? '');
    const idEmpresa = Number(req.query.idEmpresa) || 0;
    const id = Number(req.query.id) || 0;
    const itens = await consultarCadastro(tipo, q, idEmpresa, id);
    res.json({ itens: itens.map((item) => ({ id: item.id, nome: item.nome })) });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getOpcoesConfig(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const idEmpresa = Number(req.query.idEmpresa) || 0;
    const [empresas, tabelas, formas, condicoes, tipos, setores, usuarios] = await Promise.all([
      listarEmpresas(),
      idEmpresa ? listarTabelasPreco(idEmpresa) : Promise.resolve([]),
      listarFormas(),
      listarCondicoes(),
      listarTiposMovimentacao(),
      idEmpresa ? listarSetores(idEmpresa) : Promise.resolve([]),
      prisma.usuario.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, login: true, pdvEmpresa: { select: { idEmpresa: true } } },
        orderBy: { nome: 'asc' },
      }),
    ]);
    const [configs, certificados] = await Promise.all([
      prisma.pdvEmpresaConfig.findMany(),
      prisma.pdvCertificado.findMany(),
    ]);
    res.json({
      empresas: empresas.map((e) => ({
        id: e.id,
        nome: e.nome,
        uf: String(e.extra?.uf ?? ''),
        crt: String(e.extra?.crt ?? ''),
      })),
      tabelas: tabelas.map((t) => ({ id: t.id, nome: t.nome })),
      formas: formas.map((f) => ({ id: f.id, nome: f.nome })),
      condicoes: condicoes.map((c) => ({ id: c.id, nome: c.nome })),
      tipos: tipos.map((t) => ({ id: t.id, nome: t.nome })),
      setores: setores.map((s) => ({ id: s.id, nome: s.nome })),
      usuarios: usuarios.map((u) => ({
        id: u.id,
        nome: u.nome || u.login,
        login: u.login,
        idEmpresa: u.pdvEmpresa?.idEmpresa ?? null,
      })),
      configs,
      certificados: certificados.map((c) => ({
        idEmpresa: c.idEmpresa,
        cnpj: c.cnpj,
        titular: c.titular,
        validoAte: c.validoAte,
        ambiente: c.ambiente,
        temCertificado: Boolean(c.pfxCipher),
        temCsc: Boolean(c.cscCipher),
        cscId: c.cscId,
        serieNfce: c.serieNfce,
        serieNfe: c.serieNfe,
        proximoNfce: c.proximoNfce,
        proximoNfe: c.proximoNfe,
      })),
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function putEmpresaConfig(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const idEmpresa = Number(req.params.idEmpresa);
    if (!idEmpresa) throw new PdvErro('Empresa inválida.');
    const body = req.body ?? {};
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const config = await prisma.pdvEmpresaConfig.upsert({
      where: { idEmpresa },
      create: {
        idEmpresa,
        nomeEmpresa: String(body.nomeEmpresa ?? ''),
        uf: String(body.uf ?? ''),
        crt: String(body.crt ?? ''),
        idTabelaPreco: num(body.idTabelaPreco),
        idTipoMovimentacao: num(body.idTipoMovimentacao),
        idTipoPedido: num(body.idTipoPedido),
        idSetorSaida: num(body.idSetorSaida),
        idCondicaoPagamento: num(body.idCondicaoPagamento),
        idFormaPagamento: num(body.idFormaPagamento),
        idPessoaConsumidor: num(body.idPessoaConsumidor),
        idContaBancaria: num(body.idContaBancaria),
        idPessoaVendedor: num(body.idPessoaVendedor),
        ignorarEstoque: Boolean(body.ignorarEstoque),
      },
      update: {
        nomeEmpresa: String(body.nomeEmpresa ?? ''),
        uf: String(body.uf ?? ''),
        crt: String(body.crt ?? ''),
        idTabelaPreco: num(body.idTabelaPreco),
        idTipoMovimentacao: num(body.idTipoMovimentacao),
        idTipoPedido: num(body.idTipoPedido),
        idSetorSaida: num(body.idSetorSaida),
        idCondicaoPagamento: num(body.idCondicaoPagamento),
        idFormaPagamento: num(body.idFormaPagamento),
        idPessoaConsumidor: num(body.idPessoaConsumidor),
        idContaBancaria: num(body.idContaBancaria),
        idPessoaVendedor: num(body.idPessoaVendedor),
        ignorarEstoque: Boolean(body.ignorarEstoque),
      },
    });
    res.json(config);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function putVinculo(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const usuarioId = Number(req.params.usuarioId);
    const idEmpresa = Number(req.body?.idEmpresa);
    if (!usuarioId) throw new PdvErro('Usuário inválido.');
    if (!idEmpresa) {
      await prisma.pdvUsuarioEmpresa.deleteMany({ where: { usuarioId } });
      res.json({ ok: true, idEmpresa: null });
      return;
    }
    const row = await prisma.pdvUsuarioEmpresa.upsert({
      where: { usuarioId },
      create: { usuarioId, idEmpresa },
      update: { idEmpresa },
    });
    res.json(row);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postCertificado(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const idEmpresa = Number(req.params.idEmpresa);
    const senha = String(req.body?.senha ?? '');
    const arquivo = req.file;
    if (!idEmpresa || !arquivo || !senha) throw new PdvErro('Envie o arquivo .pfx e a senha.');
    const aberto = abrirPfx(arquivo.buffer, senha);
    const atual = await prisma.pdvCertificado.findUnique({ where: { idEmpresa } });
    const salvo = await prisma.pdvCertificado.upsert({
      where: { idEmpresa },
      create: {
        idEmpresa,
        pfxCipher: cifrar(arquivo.buffer),
        senhaCipher: cifrar(senha),
        cnpj: aberto.cnpj,
        titular: aberto.titular,
        validoAte: aberto.validoAte,
      },
      update: {
        pfxCipher: cifrar(arquivo.buffer),
        senhaCipher: cifrar(senha),
        cnpj: aberto.cnpj,
        titular: aberto.titular,
        validoAte: aberto.validoAte,
      },
    });
    res.json({
      cnpj: salvo.cnpj,
      titular: salvo.titular,
      validoAte: salvo.validoAte,
      ambiente: salvo.ambiente,
      serieNfce: salvo.serieNfce,
      serieNfe: salvo.serieNfe,
      cscId: salvo.cscId,
      temCsc: Boolean(atual?.cscCipher),
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function putFiscal(req: Request, res: Response): Promise<void> {
  try {
    await exigirConfig(req);
    const idEmpresa = Number(req.params.idEmpresa);
    if (!idEmpresa) throw new PdvErro('Empresa inválida.');
    const ambiente = req.body?.ambiente === 'producao' ? 'producao' : 'homologacao';
    const csc = req.body?.csc != null ? String(req.body.csc) : null;
    const atual = await prisma.pdvCertificado.findUnique({ where: { idEmpresa } });
    const salvo = await prisma.pdvCertificado.upsert({
      where: { idEmpresa },
      create: {
        idEmpresa,
        ambiente,
        cscId: String(req.body?.cscId ?? ''),
        cscCipher: csc ? cifrar(csc) : '',
        serieNfce: Number(req.body?.serieNfce) || 1,
        serieNfe: Number(req.body?.serieNfe) || 1,
        proximoNfce: Number(req.body?.proximoNfce) || 1,
        proximoNfe: Number(req.body?.proximoNfe) || 1,
      },
      update: {
        ambiente,
        cscId: String(req.body?.cscId ?? atual?.cscId ?? ''),
        ...(csc ? { cscCipher: cifrar(csc) } : {}),
        serieNfce: Number(req.body?.serieNfce) || atual?.serieNfce || 1,
        serieNfe: Number(req.body?.serieNfe) || atual?.serieNfe || 1,
        proximoNfce: Number(req.body?.proximoNfce) || atual?.proximoNfce || 1,
        proximoNfe: Number(req.body?.proximoNfe) || atual?.proximoNfe || 1,
      },
    });
    res.json({
      ambiente: salvo.ambiente,
      cscId: salvo.cscId,
      temCsc: Boolean(salvo.cscCipher),
      serieNfce: salvo.serieNfce,
      serieNfe: salvo.serieNfe,
      proximoNfce: salvo.proximoNfce,
      proximoNfe: salvo.proximoNfe,
      cnpj: salvo.cnpj,
      titular: salvo.titular,
      validoAte: salvo.validoAte,
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}
