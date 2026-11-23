import type { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getPermissoesUsuario } from '../middleware/requirePermission.js';
import { abrirPfx } from './fiscal/certificado.js';
import {
  buscarClientes,
  consultarCadastro,
  criarCliente,
  buscarProdutos,
  listarAtributosProposta,
  listarCondicoes,
  listarContatosCliente,
  listarEmpresas,
  listarEnderecosCliente,
  listarFormas,
  listarSetores,
  listarTabelasPreco,
  listarTiposMovimentacao,
  listarTiposMovimentacaoProposta,
} from './pdvCatalogo.js';
import { contextoPdv, exigirEmpresa } from './pdvContext.js';
import {
  abrirCaixa,
  caixaAberto,
  confirmarVenda,
  emitirFiscalVendaPdv,
  fecharCaixa,
  movimentarCaixa,
  PdvErro,
  retomarEspera,
  transformarOrcamento,
} from './pdvOperacao.js';
import {
  montarHtmlPropostaPdv,
  type PdfCabecalhoEmpresa,
  type PdfClienteProposta,
  type PdfPropostaExtra,
} from './pdvPropostaPdf.js';
import { normalizarModoOperacao, obterPropostaNomus } from './pdvNomusVenda.js';
import { queryNomus } from '../config/nomusDb.js';
import { nomusRest } from './nomusRest.js';
import { cifrar } from './secrets.js';

function dataBrDeMysql(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  const s = String(v);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const br = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  return br ? br[1] : '';
}

async function carregarClientePropostaPdf(idCliente: number, nomeContato: string): Promise<PdfClienteProposta | null> {
  if (!idCliente) return null;
  try {
    const c = await nomusRest<Record<string, unknown>>(`/clientes/${idCliente}`, { cacheMs: 30_000 });
    return {
      nome: String(c.nome ?? c.razaoSocial ?? '').trim(),
      nomeFantasia: String(c.nomeFantasia ?? c.nome ?? c.razaoSocial ?? '').trim(),
      contato: nomeContato,
      cnpjCpf: String(c.cnpj ?? c.cpf ?? '').trim(),
      ie: String(c.inscricaoEstadual ?? '').trim(),
      email: String(c.email ?? '').trim(),
      telefone: String(c.telefone ?? '').trim(),
      endereco: String(c.endereco ?? '').trim(),
      numero: String(c.numero ?? '').trim(),
      bairro: String(c.bairro ?? '').trim(),
      municipio: String(c.municipio ?? '').trim(),
      uf: String(c.uf ?? '').trim(),
      cep: String(c.cep ?? '').trim(),
    };
  } catch {
    return null;
  }
}

function formatarIeBr(ie: string): string {
  const dig = ie.replace(/\D/g, '');
  if (dig.length === 9) return `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5, 8)}-${dig.slice(8)}`;
  return ie.trim();
}

async function carregarCabecalhoEmpresaPdf(idEmpresa: number): Promise<PdfCabecalhoEmpresa | null> {
  if (!idEmpresa) return null;
  try {
    const [rows] = await queryNomus<
      Array<{
        nome: string | null;
        nomeRazaoSocial: string | null;
        endereco: string | null;
        numero: string | null;
        complemento: string | null;
        bairro: string | null;
        cep: string | null;
        municipio: string | null;
        uf: string | null;
        cnpj: string | null;
        inscricaoEstadual: string | null;
        telefone: string | null;
        site: string | null;
      }>
    >(
      `SELECT nome, nomeRazaoSocial, endereco, numero, complemento, bairro, cep, municipio, uf,
              cnpj, inscricaoEstadual, telefone, site
       FROM empresa
       WHERE id = ?
       LIMIT 1`,
      [idEmpresa],
    );
    const e = Array.isArray(rows) ? rows[0] : null;
    if (!e) return null;
    const razao = String(e.nomeRazaoSocial || e.nome || '')
      .trim()
      .toUpperCase();
    const endParts = [
      String(e.endereco ?? '').trim(),
      String(e.numero ?? '').trim() && String(e.numero).trim() !== '0' ? String(e.numero).trim() : '',
      String(e.complemento ?? '').trim(),
      String(e.bairro ?? '').trim(),
    ].filter(Boolean);
    const enderecoLinha = endParts.join(' - ');
    const cep = String(e.cep ?? '').trim();
    const mun = String(e.municipio ?? '').trim();
    const uf = String(e.uf ?? '').trim();
    const cidadeLinha = [cep && `CEP - ${cep}`, mun, uf].filter(Boolean).join(' - ');
    const fone = String(e.telefone ?? '').trim();
    const telefoneLinha = fone ? `TELE-VENDAS - ${fone}` : '';
    const cnpj = String(e.cnpj ?? '').trim();
    const ie = formatarIeBr(String(e.inscricaoEstadual ?? ''));
    const documentoLinha = [cnpj && `CNPJ – ${cnpj}`, ie && `INSC. EST. ${ie}`].filter(Boolean).join(' - ');
    let site = String(e.site ?? '').trim();
    if (site && !/^https?:\/\//i.test(site) && !site.startsWith('www.')) site = `www.${site}`;
    return {
      razaoSocial: razao,
      enderecoLinha,
      cidadeLinha,
      telefoneLinha,
      documentoLinha,
      siteLinha: site,
    };
  } catch {
    return null;
  }
}

async function carregarExtraPropostaPdf(idProposta: number): Promise<PdfPropostaExtra> {
  try {
    const [rows] = await queryNomus<
      Array<{
        dataAbertura: unknown;
        dataValidade: unknown;
        observacao: string | null;
        idFormaPagamento: number | null;
        idCondicaoPagamento: number | null;
        condicaoPagamento: string | null;
      }>
    >(
      `SELECT dataAbertura, dataValidade, observacao, idFormaPagamento, idCondicaoPagamento, condicaoPagamento
       FROM proposta WHERE id = ? LIMIT 1`,
      [idProposta],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return {};
    let formaPagamento = '';
    let condicaoPagamento = '';
    const idForma = Number(row.idFormaPagamento) || 0;
    const idCond = Number(row.idCondicaoPagamento) || Number(row.condicaoPagamento) || 0;
    if (idForma) {
      const [f] = await queryNomus<Array<{ nome: string }>>(
        `SELECT nome FROM formapagamento WHERE id = ? LIMIT 1`,
        [idForma],
      );
      formaPagamento = String(f?.[0]?.nome ?? '').trim();
    }
    if (idCond) {
      const [c] = await queryNomus<Array<{ nome: string }>>(
        `SELECT nome FROM condicaopagamento WHERE id = ? LIMIT 1`,
        [idCond],
      );
      condicaoPagamento = String(c?.[0]?.nome ?? '').trim();
    }
    return {
      dataEmissao: dataBrDeMysql(row.dataAbertura),
      dataValidade: dataBrDeMysql(row.dataValidade),
      observacao: String(row.observacao ?? '').trim(),
      formaPagamento,
      condicaoPagamento,
    };
  } catch {
    return {};
  }
}

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
      modoOperacao: normalizarModoOperacao(config?.modoOperacao),
      exigeAberturaCaixa: config?.exigeAberturaCaixa !== false,
      idTipoMovimentacao: config?.idTipoMovimentacao ?? null,
      idCondicaoPagamento: config?.idCondicaoPagamento ?? null,
      idFormaPagamento: config?.idFormaPagamento ?? null,
      idPessoaVendedor: config?.idPessoaVendedor ?? null,
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
    const pagina = Number(req.query.pagina) || 1;
    const tamanho = Number(req.query.tamanho) || 24;
    res.json(await buscarProdutos(q, idEmpresa, { pagina, tamanho }));
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getClientes(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    const lista = await buscarClientes(String(req.query.q ?? ''));
    res.json({
      clientes: lista.map((c) => ({
        id: c.id,
        nome: c.nome,
        cpf: String(c.extra?.cpf ?? ''),
        cnpj: String(c.extra?.cnpj ?? ''),
      })),
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postCliente(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    const body = req.body ?? {};
    const tipoPessoa = Number(body.tipoPessoa) === 1 ? 1 : 2;
    const tipoContribuinteICMS = [1, 2, 3].includes(Number(body.tipoContribuinteICMS))
      ? (Number(body.tipoContribuinteICMS) as 1 | 2 | 3)
      : 3;
    const cliente = await criarCliente({
      tipoPessoa,
      nome: String(body.nome ?? ''),
      razaoSocial: String(body.razaoSocial ?? ''),
      cpf: String(body.cpf ?? ''),
      cnpj: String(body.cnpj ?? ''),
      tipoContribuinteICMS,
      inscricaoEstadual: String(body.inscricaoEstadual ?? ''),
      email: String(body.email ?? ''),
      telefone: String(body.telefone ?? ''),
      cep: String(body.cep ?? ''),
      endereco: String(body.endereco ?? ''),
      numero: String(body.numero ?? ''),
      bairro: String(body.bairro ?? ''),
      municipio: String(body.municipio ?? ''),
      uf: String(body.uf ?? ''),
    });
    res.status(201).json({ cliente: { id: cliente.id, nome: cliente.nome } });
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

export async function getOrcamentoOpcoes(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa } });
    const [formas, condicoes, tipos, atributos] = await Promise.all([
      listarFormas(),
      listarCondicoes(),
      listarTiposMovimentacaoProposta(config?.idTipoMovimentacao),
      listarAtributosProposta().catch(() => []),
    ]);
    res.json({
      formas: formas.map((f) => ({ id: f.id, nome: f.nome })),
      condicoes: condicoes.map((c) => ({ id: c.id, nome: c.nome })),
      tipos: tipos.map((t) => ({ id: t.id, nome: t.nome })),
      atributos,
      padrao: {
        idTipoMovimentacao: config?.idTipoMovimentacao ?? null,
        idCondicaoPagamento: config?.idCondicaoPagamento ?? null,
        idFormaPagamento: config?.idFormaPagamento ?? null,
      },
    });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getClienteContatos(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    const idCliente = Number(req.params.id);
    if (!idCliente) throw new PdvErro('Cliente inválido.');
    res.json({ contatos: await listarContatosCliente(idCliente) });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getClienteEnderecos(req: Request, res: Response): Promise<void> {
  try {
    await contextoPdv(req);
    const idCliente = Number(req.params.id);
    if (!idCliente) throw new PdvErro('Cliente inválido.');
    res.json({ enderecos: await listarEnderecosCliente(idCliente) });
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

export async function getOrcamentos(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const vendas = await prisma.pdvVenda.findMany({
      where: { idEmpresa, status: 'orcamento' },
      include: { itens: true, pagamentos: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ vendas });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postTransformar(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    // Nota fiscal fica para o modal pós-gravação (/emitir-fiscal).
    const venda = await transformarOrcamento({
      usuarioId: ctx.usuarioId,
      idEmpresa,
      vendaId: Number(req.params.id),
      pagamentos: Array.isArray(req.body?.pagamentos) ? req.body.pagamentos : undefined,
      fiscal: 'nenhuma',
      clienteDocumento: String(req.body?.clienteDocumento ?? ''),
      clienteContribuinte: Boolean(req.body?.clienteContribuinte),
      clienteIe: String(req.body?.clienteIe ?? ''),
      clienteUf: String(req.body?.clienteUf ?? ''),
    });
    res.json(venda);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postEmitirFiscal(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const fiscalRaw = String(req.body?.fiscal ?? '');
    if (fiscalRaw !== 'nfce' && fiscalRaw !== 'nfe') {
      res.status(400).json({ error: 'Informe fiscal=nfce ou fiscal=nfe.' });
      return;
    }
    const venda = await emitirFiscalVendaPdv({
      idEmpresa,
      vendaId: Number(req.params.id),
      fiscal: fiscalRaw,
      clienteDocumento: String(req.body?.clienteDocumento ?? ''),
      clienteContribuinte: Boolean(req.body?.clienteContribuinte),
      clienteIe: String(req.body?.clienteIe ?? ''),
      clienteUf: String(req.body?.clienteUf ?? ''),
    });
    res.json(venda);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function postVenda(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    // Nota fiscal fica para o modal pós-gravação (/emitir-fiscal).
    const fiscal = 'nenhuma' as const;
    const body = req.body ?? {};
    const mapAtributos = (lista: unknown) =>
      Array.isArray(lista)
        ? lista.map((a: { nomeAtributo?: unknown; valorAtributo?: unknown }) => ({
            nomeAtributo: String(a?.nomeAtributo ?? ''),
            valorAtributo: String(a?.valorAtributo ?? ''),
          }))
        : [];
    const atributosProposta = mapAtributos(body.atributosProposta);
    const atributosItemProposta = mapAtributos(body.atributosItemProposta);
    const itens = Array.isArray(body.itens)
      ? body.itens.map((item: Record<string, unknown>) => ({
          ...item,
          atributosItem: mapAtributos(item?.atributosItem),
        }))
      : [];
    const venda = await confirmarVenda({
      usuarioId: ctx.usuarioId,
      idEmpresa,
      itens,
      pagamentos: Array.isArray(body.pagamentos) ? body.pagamentos : [],
      idPessoaCliente: Number(body.idPessoaCliente) || null,
      clienteNome: String(body.clienteNome ?? ''),
      clienteDocumento: String(body.clienteDocumento ?? ''),
      clienteContribuinte: Boolean(body.clienteContribuinte),
      clienteIe: String(body.clienteIe ?? ''),
      clienteUf: String(body.clienteUf ?? ''),
      observacao: String(body.observacao ?? ''),
      fiscal,
      espera: Boolean(body.espera),
      destino: body.destino,
      idFormaPagamento: Number(body.idFormaPagamento) || null,
      idCondicaoPagamento: Number(body.idCondicaoPagamento) || null,
      idTipoMovimentacao: Number(body.idTipoMovimentacao) || null,
      idContato: Number(body.idContato) || null,
      idPessoaVendedor: Number(body.idPessoaVendedor) || null,
      dataValidade: String(body.dataValidade ?? ''),
      atributosProposta,
      atributosItemProposta,
      localRetiradaDifEnderecoRemetente: Boolean(body.localRetiradaDifEnderecoRemetente),
      idEnderecoLocalRetirada: Number(body.idEnderecoLocalRetirada) || null,
      localEntregaDifEnderecoDestinatario: Boolean(body.localEntregaDifEnderecoDestinatario),
      idEnderecoLocalEntrega: Number(body.idEnderecoLocalEntrega) || null,
    });
    res.json(venda);
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getVendedores(req: Request, res: Response): Promise<void> {
  try {
    const ctx = await contextoPdv(req);
    const idEmpresa = exigirEmpresa(ctx);
    const q = String(req.query.q ?? '');
    const id = Number(req.query.id) || 0;
    const itens = await consultarCadastro('vendedor', q, idEmpresa, id);
    res.json({ vendedores: itens.map((item) => ({ id: item.id, nome: item.nome })) });
  } catch (err) {
    res.status(statusDe(err)).json({ error: mensagem(err) });
  }
}

export async function getPropostaPdf(req: Request, res: Response): Promise<void> {
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
    if (!venda.idPropostaNomus) {
      res.status(409).json({ error: 'Esta venda não tem proposta no Nomus para imprimir.' });
      return;
    }
    const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa } });
    let proposta: Record<string, unknown> | null = null;
    try {
      proposta = await obterPropostaNomus(venda.idPropostaNomus);
    } catch {
      proposta = null;
    }
    const idCliente = Number(proposta?.idCliente || venda.idPessoaCliente) || 0;
    const idEmpresaCab = Number(proposta?.idEmpresa || idEmpresa) || idEmpresa;
    const [cliente, extra, cabecalho] = await Promise.all([
      carregarClientePropostaPdf(idCliente, String(proposta?.nomeContato ?? '')),
      carregarExtraPropostaPdf(venda.idPropostaNomus),
      carregarCabecalhoEmpresaPdf(idEmpresaCab),
    ]);
    const html = montarHtmlPropostaPdv({
      venda: {
        id: venda.id,
        empresa: cabecalho?.razaoSocial || config?.nomeEmpresa || '',
        clienteNome: venda.clienteNome,
        observacao: venda.observacao,
        total: venda.total,
        itens: venda.itens.map((i) => ({
          codigo: i.codigo,
          descricao: i.descricao,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
          descontoPercentual: i.descontoPercentual,
        })),
        pagamentos: venda.pagamentos.map((p) => ({ nomeForma: p.nomeForma, valor: p.valor })),
      },
      proposta,
      cliente,
      extra,
      cabecalho,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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
    const modoOperacao = normalizarModoOperacao(body.modoOperacao);
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
        modoOperacao,
        exigeAberturaCaixa: body.exigeAberturaCaixa !== false && body.exigeAberturaCaixa !== 'false',
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
        modoOperacao,
        exigeAberturaCaixa: body.exigeAberturaCaixa !== false && body.exigeAberturaCaixa !== 'false',
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
