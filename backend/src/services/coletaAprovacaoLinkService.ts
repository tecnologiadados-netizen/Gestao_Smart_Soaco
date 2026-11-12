/**
 * Link público de aprovação da coleta de preços.
 * Cada produto é aprovado com uma quantidade e um fornecedor.
 * A quantidade vai para qtdeAprovada e o fornecedor para idFornecedorVencedor.
 * O status da coleta não muda: o link segue editável enquanto estiver Em Aprovação.
 */

import { randomBytes } from 'crypto';
import { prisma } from '../config/prisma.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { isGrupoMasterNome, isSuperLogin } from '../config/grupoMaster.js';
import { sendWhatsAppTextTo } from './evolutionApi.js';
import { normalizarDestinoEnvioWhatsApp, normalizarJidGrupoWhatsApp } from '../utils/whatsappDestino.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

export class ColetaAprovacaoErro extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ColetaAprovacaoErro';
    this.status = status;
  }
}

export type AprovadorColetaWhatsapp = {
  id: number;
  nome: string;
  login: string;
  temWhatsapp: boolean;
};

export type SituacaoLinkAprovacao = 'aguardando' | 'aprovada' | 'recusada';

export type LinkAprovacaoResumo = {
  destinatarioNome: string;
  destinatarioLogin: string;
  situacao: SituacaoLinkAprovacao;
  enviadoEm: string;
  decididoEm: string | null;
  observacao: string | null;
};

export type RetratoFornecedor = {
  idPessoa: number;
  nome: string;
  condicaoPagamento: string | null;
  formaPagamento: string | null;
  valorFrete: string | null;
  valorFreteTipo: string | null;
  pedidoMinimo: string | null;
};

export type RetratoPreco = {
  idFornecedor: number;
  precoNF: number;
  percIPI: number;
  percICMS: number;
  precoTotal: number;
};

export type RetratoDetalhe = { rotulo: string; valor: string; destaque?: boolean };

export type RetratoProduto = {
  registroId: number;
  codigo: string;
  descricao: string;
  unidade: string;
  qtdSolicitada: string;
  qtdeAprovada: number | null;
  /** Recusa explícita do item. Quantidade 0 ou vazia continua aguardando avaliação. */
  rejeitado: boolean;
  /** Texto informado no modal de rejeição. Vazio quando o item não foi recusado. */
  motivoRejeicao?: string;
  /** Pedido de retorno: o item volta para a equipe ajustar o que foi descrito. */
  reavaliacao?: boolean;
  /** O que precisa ser feito, visto por quem recebe o retorno da avaliação. */
  pedidoReavaliacao?: string;
  idFornecedorVencedor: number | null;
  precos: RetratoPreco[];
  detalhes: RetratoDetalhe[];
};

export type RetratoColetaAprovacao = {
  observacoes: string | null;
  fornecedores: RetratoFornecedor[];
  produtos: RetratoProduto[];
};

export type ResultadoEnvioLink = {
  status: string;
  whatsappOk: boolean;
  whatsappErro?: string;
  link: LinkAprovacaoResumo;
};

type PaginaView =
  | { tipo: 'invalido' }
  | { tipo: 'substituido' }
  | {
      tipo: 'sem_permissao';
      coletaId: number;
      nome: string;
      retrato: RetratoColetaAprovacao;
    }
  | {
      tipo: 'aguardando';
      coletaId: number;
      nome: string;
      token: string;
      retrato: RetratoColetaAprovacao;
      erro?: string;
      registroErroId?: number;
    }
  | {
      tipo: 'consulta';
      coletaId: number;
      nome: string;
      retrato: RetratoColetaAprovacao;
      resultado?: string;
      manual?: boolean;
      erro?: string;
    };

function telefoneValido(raw: string | null | undefined): string | null {
  const n = normalizarDestinoEnvioWhatsApp(raw);
  if (!n || normalizarJidGrupoWhatsApp(n)) return null;
  return n;
}

function novoToken(): string {
  return randomBytes(12).toString('base64url');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CHAVE_REJEICAO = '__rejeitarCompra';
const CHAVE_MOTIVO_REJEICAO = '__motivoRejeicao';
const CHAVE_REAVALIACAO = '__reavaliar';
const CHAVE_PEDIDO_REAVALIACAO = '__pedidoReavaliacao';
const MOTIVO_REJEICAO_MAX = 500;

function lerDadosRegistro(dados: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(dados || '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    /* dados inválidos */
  }
  return {};
}

function compraFoiRejeitada(obj: Record<string, unknown>): boolean {
  return obj[CHAVE_REJEICAO] === true;
}

function motivoRejeicaoDe(obj: Record<string, unknown>): string {
  const valor = obj[CHAVE_MOTIVO_REJEICAO];
  return typeof valor === 'string' ? valor.trim() : '';
}

function compraPediuReavaliacao(obj: Record<string, unknown>): boolean {
  return obj[CHAVE_REAVALIACAO] === true;
}

const PREFIXO_ESCOPO = 'escopo:';
const MARCA_MANUAL = 'manual';
const STATUS_APROVADO_TOTAL = 'Aprovado Total';
const STATUS_APROVADO_PARCIAL = 'Aprovado Parcial';
const STATUS_REAVALIAR = 'Reavaliar';

function qtdePositivaDe(qtde: number | null | undefined): boolean {
  return qtde != null && Number.isFinite(qtde) && qtde > 0;
}

/** Item ainda não aprovado e não rejeitado: entra na próxima rodada. */
function registroAberto(dados: string | null | undefined, qtde: number | null | undefined): boolean {
  const obj = lerDadosRegistro(dados);
  if (compraFoiRejeitada(obj)) return false;
  if (compraPediuReavaliacao(obj)) return true;
  return !qtdePositivaDe(qtde);
}

export function textoEscopo(ids: number[]): string | null {
  const limpos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  return limpos.length ? `${PREFIXO_ESCOPO}${limpos.join(',')}` : null;
}

export function idsDoEscopo(observacao: string | null | undefined): number[] | null {
  if (!observacao?.startsWith(PREFIXO_ESCOPO)) return null;
  const ids = observacao
    .slice(PREFIXO_ESCOPO.length)
    .split(',')
    .map((parte) => parseInt(parte, 10))
    .filter((id) => id > 0);
  return ids.length ? ids : null;
}

export function resultadoDaAnalise(
  produtos: { rejeitado?: boolean; reavaliacao?: boolean; qtdeAprovada: number | null }[]
): typeof STATUS_APROVADO_TOTAL | typeof STATUS_APROVADO_PARCIAL | typeof STATUS_REAVALIAR {
  if (produtos.some((p) => !p.rejeitado && p.reavaliacao === true)) return STATUS_REAVALIAR;
  if (produtos.length > 0 && produtos.every((p) => !p.rejeitado && qtdePositivaDe(p.qtdeAprovada))) {
    return STATUS_APROVADO_TOTAL;
  }
  return STATUS_APROVADO_PARCIAL;
}

function itemAguardando(p: { rejeitado?: boolean; reavaliacao?: boolean; qtdeAprovada: number | null }): boolean {
  return !p.rejeitado && p.reavaliacao !== true && !qtdePositivaDe(p.qtdeAprovada);
}

function pedidoReavaliacaoDe(obj: Record<string, unknown>): string {
  const valor = obj[CHAVE_PEDIDO_REAVALIACAO];
  return typeof valor === 'string' ? valor.trim() : '';
}

function limparDecisaoItem(obj: Record<string, unknown>): void {
  delete obj[CHAVE_REJEICAO];
  delete obj[CHAVE_MOTIVO_REJEICAO];
  delete obj[CHAVE_REAVALIACAO];
  delete obj[CHAVE_PEDIDO_REAVALIACAO];
}

function dadosComRejeicao(dados: string | null | undefined, rejeitar: boolean, motivo?: string): string {
  const obj = lerDadosRegistro(dados);
  limparDecisaoItem(obj);
  if (rejeitar) {
    obj[CHAVE_REJEICAO] = true;
    obj[CHAVE_MOTIVO_REJEICAO] = (motivo ?? '').trim();
  }
  return JSON.stringify(obj);
}

function dadosComReavaliacao(dados: string | null | undefined, pedido: string): string {
  const obj = lerDadosRegistro(dados);
  limparDecisaoItem(obj);
  obj[CHAVE_REAVALIACAO] = true;
  obj[CHAVE_PEDIDO_REAVALIACAO] = pedido.trim();
  return JSON.stringify(obj);
}

function escAttrQuebra(s: string): string {
  return esc(s).replace(/\r\n|\r|\n/g, '&#10;');
}

function apenasNomeFornecedor(nome: string): string {
  const s = nome.trim();
  const idx = s.indexOf(' - ');
  if (idx !== -1) {
    const antes = s.slice(0, idx).trim();
    const depois = s.slice(idx + 3).trim();
    if (/^[\d./-]+$/.test(antes) && depois) return depois;
  }
  return s;
}

function campoJson(obj: Record<string, unknown>, re: RegExp): string {
  const key = Object.keys(obj).find((k) => re.test(k.trim()));
  if (key == null || obj[key] == null) return '';
  return String(obj[key]).trim();
}

function fmtMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPerc(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Mesmos campos da grade de preços da coleta (COLUNAS_PRECOS). */
const CAMPOS_DETALHE: { keys: string[]; label: string; decimals?: boolean; date?: boolean }[] = [
  { keys: ['Codigo do Produto', 'codigo do produto'], label: 'Código do Produto' },
  { keys: ['Descricao do Produto', 'descricao do produto'], label: 'Descrição do Produto' },
  { keys: ['Unidade de Medida', 'unidade de medida'], label: 'Unidade de Medida' },
  { keys: ['Familia do Produto', 'familia do produto'], label: 'Família do Produto' },
  { keys: ['Estoque de Seguranca', 'estoque de seguranca', 'Estoque de Segurança'], label: 'Estoque de Segurança', decimals: true },
  { keys: ['Estoque Maximo', 'estoque maximo', 'Estoque Máximo'], label: 'Estoque Máximo', decimals: true },
  { keys: ['Saldo Estoque', 'saldo estoque'], label: 'Saldo de Estoque', decimals: true },
  { keys: ['Qtd Confirmada', 'qtd confirmada'], label: 'Qtd Confirmada', decimals: true },
  { keys: ['Qtd Liberada', 'qtd liberada'], label: 'Qtd Liberada', decimals: true },
  { keys: ['Data Necessidade', 'data necessidade'], label: 'Data Necessidade', date: true },
  { keys: ['Data Solicitacao', 'data solicitacao'], label: 'Data Solicitação', date: true },
  { keys: ['PC_Aguardando Liberacao', 'pc_aguardando liberacao'], label: 'PC Aguardando Liberação' },
  { keys: ['Ultima Entrada', 'ultima entrada'], label: 'Última Entrada', date: true },
  { keys: ['Data Ultimo Pedido', 'data ultimo pedido'], label: 'Último Pedido', date: true },
  { keys: ['Qtde Ult Compra', 'qtde ult compra'], label: 'Última Compra', decimals: true },
  { keys: ['Custo Unitario Compra', 'custo unitario compra'], label: 'Último Custo', decimals: true },
  { keys: ['Ultimo Fornecedor', 'ultimo fornecedor'], label: 'Último Fornecedor' },
  { keys: ['Consumo Medio', 'consumo medio'], label: 'Consumo Médio', decimals: true },
  { keys: ['Saldo em Estoque Antes UE', 'saldo em estoque antes ue'], label: 'Saldo em Estoque Antes da Última Entrada', decimals: true },
  { keys: ['Qtde Empenhada', 'qtde empenhada', 'Qtdempenhada'], label: 'Qtde Empenhada', decimals: true },
  { keys: ['Pré Compra', 'pré compra', 'Ag Pag', 'ag pag'], label: 'Pré-compra', decimals: true },
];

function valorCampo(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  const aceitos = new Set(keys.map((k) => k.toLowerCase()));
  const found = Object.keys(obj).find((key) => aceitos.has(key.toLowerCase()));
  return found != null ? obj[found] : undefined;
}

function numeroDeQuantidade(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const texto = String(raw).trim().replace(/\s/g, '');
  if (!texto) return null;
  const n = texto.includes(',')
    ? Number(texto.replace(/\./g, '').replace(',', '.'))
    : Number(texto);
  return Number.isFinite(n) ? n : null;
}

/** 80.540000… vira 80,54. Aceita ponto decimal (SQL) ou vírgula (digitado). */
export function formatarQuantidade(raw: unknown): string {
  const n = numeroDeQuantidade(raw);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function parseQtdeInformada(raw: unknown): number | null {
  const n = numeroDeQuantidade(raw);
  if (n == null || n < 0) return null;
  return n;
}

function formatarDataCampo(valor: unknown): string {
  const s = String(valor ?? '').trim();
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

const ROTULOS_DESTAQUE = new Set(['Saldo de Estoque', 'Qtde Empenhada', 'Último Custo']);

function montarDetalhes(obj: Record<string, unknown>): RetratoDetalhe[] {
  return CAMPOS_DETALHE.map((campo) => {
    const destaque = ROTULOS_DESTAQUE.has(campo.label);
    const bruto = valorCampo(obj, campo.keys);
    if (bruto == null || String(bruto).trim() === '') {
      return { rotulo: campo.label, valor: '—', destaque };
    }
    if (campo.date) return { rotulo: campo.label, valor: formatarDataCampo(bruto), destaque };
    if (campo.decimals) return { rotulo: campo.label, valor: formatarQuantidade(bruto), destaque };
    return { rotulo: campo.label, valor: String(bruto).trim(), destaque };
  });
}

function parseFornecedores(json: string | null): RetratoFornecedor[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RetratoFornecedor[] = [];
    for (const item of parsed) {
      if (typeof item === 'string') {
        const nome = item.trim();
        if (nome) {
          out.push({
            idPessoa: 0,
            nome,
            condicaoPagamento: null,
            formaPagamento: null,
            valorFrete: null,
            valorFreteTipo: null,
            pedidoMinimo: null,
          });
        }
        continue;
      }
      if (!item || typeof item !== 'object' || !('nome' in item)) continue;
      const o = item as Record<string, unknown>;
      const nome = String(o.nome ?? '').trim();
      if (!nome) continue;
      out.push({
        idPessoa: typeof o.idPessoa === 'number' ? o.idPessoa : Number(o.idPessoa) || 0,
        nome,
        condicaoPagamento: o.condicaoPagamento != null ? String(o.condicaoPagamento) : null,
        formaPagamento: o.formaPagamento != null ? String(o.formaPagamento) : null,
        valorFrete: o.valorFrete != null ? String(o.valorFrete) : null,
        valorFreteTipo: o.valorFreteTipo != null ? String(o.valorFreteTipo) : null,
        pedidoMinimo: o.pedidoMinimo != null ? String(o.pedidoMinimo) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function situacaoDe(decisao: string | null): SituacaoLinkAprovacao {
  if (decisao === 'aprovada' || decisao === 'recusada') return decisao;
  return 'aguardando';
}

function resumoDe(link: {
  decisao: string | null;
  enviadoEm: Date;
  decididoEm: Date | null;
  observacao: string | null;
  usuario: { nome: string | null; login: string };
}): LinkAprovacaoResumo {
  return {
    destinatarioNome: (link.usuario.nome ?? '').trim() || link.usuario.login,
    destinatarioLogin: link.usuario.login,
    situacao: situacaoDe(link.decisao),
    enviadoEm: link.enviadoEm.toISOString(),
    decididoEm: link.decididoEm?.toISOString() ?? null,
    observacao: link.observacao,
  };
}

function isGrupoAdminNome(nome: string | null | undefined): boolean {
  const n = String(nome ?? '').trim().toLowerCase();
  return n === 'admin' || n === 'administrador';
}

function loginEhAdmin(login: string): boolean {
  return login.trim().toLowerCase() === 'admin';
}

/** Administrador e Master já podem receber e abrir o link, sem permissão extra. */
async function usuarioPodeAprovar(login: string): Promise<boolean> {
  if (isSuperLogin(login) || loginEhAdmin(login)) return true;
  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { ativo: true, grupo: { select: { ativo: true, nome: true } } },
  });
  if (!usuario || usuario.ativo === false) return false;
  if (!usuario.grupo || usuario.grupo.ativo === false) return false;
  return isGrupoMasterNome(usuario.grupo.nome) || isGrupoAdminNome(usuario.grupo.nome);
}

export function montarMensagemColetaAprovacaoWhatsApp(params: {
  coletaId: number;
  enviadoPor: string;
  qtdProdutos: number;
  url: string;
}): string {
  const n = Math.max(0, params.qtdProdutos);
  return [
    '*Coleta de preços para aprovação*',
    `Coleta *#${params.coletaId}*`,
    `Enviada por ${params.enviadoPor}`,
    `${n} produto${n === 1 ? '' : 's'}`,
    '',
    'Abrir para aprovar:',
    params.url,
  ].join('\n');
}

export async function listarAprovadoresColetaWhatsapp(): Promise<AprovadorColetaWhatsapp[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: {
      id: true,
      login: true,
      nome: true,
      telefone: true,
      grupo: { select: { nome: true, ativo: true } },
    },
  });
  const elegiveis: AprovadorColetaWhatsapp[] = [];
  for (const u of usuarios) {
    const grupoOk =
      !!u.grupo &&
      u.grupo.ativo !== false &&
      (isGrupoMasterNome(u.grupo.nome) || isGrupoAdminNome(u.grupo.nome));
    if (!grupoOk && !isSuperLogin(u.login) && !loginEhAdmin(u.login)) continue;
    elegiveis.push({
      id: u.id,
      nome: (u.nome ?? '').trim() || u.login,
      login: u.login,
      temWhatsapp: telefoneValido(u.telefone) != null,
    });
  }
  elegiveis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return elegiveis;
}

export async function buscarUltimosLinksAprovacao(
  coletaIds: number[]
): Promise<Map<number, LinkAprovacaoResumo>> {
  const map = new Map<number, LinkAprovacaoResumo>();
  if (coletaIds.length === 0) return map;
  const links = await prisma.coletaPrecosAprovacaoLink.findMany({
    where: { coletaPrecosId: { in: coletaIds } },
    orderBy: [{ enviadoEm: 'desc' }, { id: 'desc' }],
    select: {
      coletaPrecosId: true,
      decisao: true,
      enviadoEm: true,
      decididoEm: true,
      observacao: true,
      usuario: { select: { nome: true, login: true } },
    },
  });
  for (const link of links) {
    if (map.has(link.coletaPrecosId)) continue;
    map.set(link.coletaPrecosId, resumoDe(link));
  }
  return map;
}

async function montarRetrato(coletaId: number): Promise<RetratoColetaAprovacao> {
  const coleta = await prisma.coletaPrecos.findUnique({
    where: { id: coletaId },
    select: {
      observacoes: true,
      fornecedores: true,
      registros: {
        select: { id: true, idProduto: true, dados: true, qtdeAprovada: true, idFornecedorVencedor: true },
        orderBy: { id: 'asc' },
      },
      cotacoes: {
        select: {
          idProduto: true,
          idFornecedor: true,
          precoNF: true,
          percIPI: true,
          percICMS: true,
          precoTotal: true,
        },
      },
    },
  });
  if (!coleta) return { observacoes: null, fornecedores: [], produtos: [] };

  let fornecedores = parseFornecedores(coleta.fornecedores);
  const produtos: RetratoProduto[] = coleta.registros.map((reg) => {
    let obj: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(reg.dados || '{}') as unknown;
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
    const precos = coleta.cotacoes
      .filter((c) => c.idProduto === reg.idProduto)
      .map((c) => ({
        idFornecedor: c.idFornecedor,
        precoNF: c.precoNF,
        percIPI: c.percIPI,
        percICMS: c.percICMS,
        precoTotal: c.precoTotal,
      }));
    return {
      registroId: reg.id,
      codigo: campoJson(obj, /codigo\s*do\s*produto/i),
      descricao: campoJson(obj, /descricao\s*do\s*produto/i),
      unidade: campoJson(obj, /unidade\s*de\s*medida/i),
      qtdSolicitada: campoJson(obj, /qtd\s*liberada/i),
      qtdeAprovada: reg.qtdeAprovada,
      rejeitado: compraFoiRejeitada(obj),
      motivoRejeicao: compraFoiRejeitada(obj) ? motivoRejeicaoDe(obj) : '',
      reavaliacao: compraPediuReavaliacao(obj),
      pedidoReavaliacao: compraPediuReavaliacao(obj) ? pedidoReavaliacaoDe(obj) : '',
      idFornecedorVencedor: reg.idFornecedorVencedor,
      precos,
      detalhes: montarDetalhes(obj),
    };
  });

  if (fornecedores.length === 0) {
    const ids = [...new Set(coleta.cotacoes.map((c) => c.idFornecedor))].sort((a, b) => a - b);
    fornecedores = ids.map((idPessoa) => ({
      idPessoa,
      nome: `Fornecedor ${idPessoa}`,
      condicaoPagamento: null,
      formaPagamento: null,
      valorFrete: null,
      valorFreteTipo: null,
      pedidoMinimo: null,
    }));
  }
  return {
    observacoes: coleta.observacoes?.trim() ? coleta.observacoes.trim() : null,
    fornecedores,
    produtos,
  };
}

async function validarDestinatario(
  usuarioId: number,
  exigirTelefone: boolean
): Promise<{
  id: number;
  login: string;
  nome: string;
  telefone: string;
}> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, login: true, nome: true, telefone: true, ativo: true },
  });
  if (!usuario || !usuario.ativo) {
    throw new ColetaAprovacaoErro('Pessoa não encontrada ou inativa.');
  }
  const telefone = telefoneValido(usuario.telefone);
  if (exigirTelefone && !telefone) {
    throw new ColetaAprovacaoErro('A pessoa escolhida não tem telefone válido para WhatsApp.');
  }
  if (!(await usuarioPodeAprovar(usuario.login))) {
    throw new ColetaAprovacaoErro('A pessoa escolhida não é administrador nem master.');
  }
  return {
    id: usuario.id,
    login: usuario.login,
    nome: (usuario.nome ?? '').trim() || usuario.login,
    telefone: telefone ?? '',
  };
}

export async function enviarLinkAprovacaoColeta(params: {
  coletaId: number;
  usuarioId: number;
  enviadoPorLogin: string;
  alterarStatus: boolean;
  /** Sem WhatsApp: só registra quem aprova e deixa a coleta Em Aprovação. */
  manual?: boolean;
}): Promise<ResultadoEnvioLink> {
  const manual = params.manual === true && params.alterarStatus;
  const destinatario = await validarDestinatario(params.usuarioId, !manual);
  const agora = new Date();

  const criado = await prisma.$transaction(async (tx) => {
    const coleta = await tx.coletaPrecos.findUnique({
      where: { id: params.coletaId },
      select: { id: true, status: true },
    });
    if (!coleta) throw new ColetaAprovacaoErro('Coleta não encontrada.', 404);
    const statusAtual = coleta.status ?? 'Em cotação';
    const novaRodada = statusAtual === STATUS_REAVALIAR;
    if (params.alterarStatus) {
      if (statusAtual !== 'Em cotação' && !novaRodada) {
        throw new ColetaAprovacaoErro(
          'Só é possível enviar para aprovação quando o status é "Em cotação" ou "Reavaliar".'
        );
      }
      await tx.coletaPrecos.update({
        where: { id: params.coletaId },
        data: {
          status: 'Em Aprovação',
          dataEnvioAprovacao: agora,
          jaEnviadaAprovacao: true,
          dataUltimaMovimentacao: agora,
        },
      });
    } else if (statusAtual !== 'Em Aprovação') {
      throw new ColetaAprovacaoErro(
        'Só é possível reenviar o link quando o status é "Em Aprovação".'
      );
    } else {
      await tx.coletaPrecos.update({
        where: { id: params.coletaId },
        data: { dataUltimaMovimentacao: agora },
      });
    }

    const linkAberto = await tx.coletaPrecosAprovacaoLink.findFirst({
      where: { coletaPrecosId: params.coletaId, decisao: null, substituido: false },
      select: { observacao: true },
      orderBy: { id: 'desc' },
    });
    let observacaoNova = manual ? MARCA_MANUAL : (linkAberto?.observacao ?? null);
    if (!manual && observacaoNova === MARCA_MANUAL) observacaoNova = null;
    if (!manual && novaRodada) {
      const registros = await tx.coletaPrecosRegistro.findMany({
        where: { coletaPrecosId: params.coletaId },
        select: { id: true, dados: true, qtdeAprovada: true },
      });
      const ids = registros.filter((r) => registroAberto(r.dados, r.qtdeAprovada)).map((r) => r.id);
      if (ids.length === 0) {
        throw new ColetaAprovacaoErro('Não há itens pendentes para uma nova aprovação.');
      }
      observacaoNova = textoEscopo(ids);
      for (const r of registros) {
        if (!ids.includes(r.id)) continue;
        const obj = lerDadosRegistro(r.dados);
        if (!compraPediuReavaliacao(obj)) continue;
        delete obj[CHAVE_REAVALIACAO];
        delete obj[CHAVE_PEDIDO_REAVALIACAO];
        await tx.coletaPrecosRegistro.update({
          where: { id: r.id },
          data: { dados: JSON.stringify(obj) },
        });
      }
    }

    await tx.coletaPrecosAprovacaoLink.updateMany({
      where: { coletaPrecosId: params.coletaId, decisao: null, substituido: false },
      data: { substituido: true },
    });

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        return await tx.coletaPrecosAprovacaoLink.create({
          data: {
            coletaPrecosId: params.coletaId,
            token: novoToken(),
            usuarioId: destinatario.id,
            enviadoPorLogin: params.enviadoPorLogin,
            enviadoEm: agora,
            observacao: observacaoNova,
          },
          select: {
            token: true,
            decisao: true,
            enviadoEm: true,
            decididoEm: true,
            observacao: true,
            usuario: { select: { nome: true, login: true } },
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/unique|token/i.test(msg)) throw err;
      }
    }
    throw new ColetaAprovacaoErro('Não foi possível gravar o link de aprovação.', 503);
  });

  if (criado.observacao === MARCA_MANUAL) {
    return {
      status: 'Em Aprovação',
      whatsappOk: false,
      link: resumoDe(criado),
    };
  }

  const escopoEnviado = idsDoEscopo(criado.observacao);
  const qtdRegistros = await prisma.coletaPrecosRegistro.count({
    where: { coletaPrecosId: params.coletaId },
  });
  const qtdItens = escopoEnviado
    ? escopoEnviado.length
    : qtdRegistros > 0
      ? qtdRegistros
      : await prisma.coletaPrecosItem.count({ where: { coletaPrecosId: params.coletaId } });
  const url = `${resolveAppBaseUrl()}/a/${criado.token}`;
  const texto = montarMensagemColetaAprovacaoWhatsApp({
    coletaId: params.coletaId,
    enviadoPor: params.enviadoPorLogin,
    qtdProdutos: qtdItens,
    url,
  });

  let whatsappOk = false;
  let whatsappErro: string | undefined;
  try {
    const envio = await sendWhatsAppTextTo(destinatario.telefone, texto);
    if (envio.dryRun) {
      whatsappErro =
        'O link foi gravado, mas o WhatsApp não saiu (envio de notificações desligado).';
    } else if (!envio.ok) {
      whatsappErro = envio.error ?? 'Não foi possível enviar o WhatsApp.';
    } else {
      whatsappOk = true;
    }
  } catch (err) {
    whatsappErro = err instanceof Error ? err.message : 'Não foi possível enviar o WhatsApp.';
  }

  return {
    status: 'Em Aprovação',
    whatsappOk,
    whatsappErro,
    link: resumoDe(criado),
  };
}

function precoDoFornecedor(produto: RetratoProduto, idPessoa: number): RetratoPreco | undefined {
  return produto.precos.find((p) => p.idFornecedor === idPessoa);
}

const ICONE_INFO =
  '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 8h.01"/></svg>';

const FONTE =
  '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet" />';

const ICONE_CHECK =
  '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const ICONE_X =
  '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function idFornecedorMarcado(produto: RetratoProduto, fornecedores: RetratoFornecedor[]): number | null {
  const ids = fornecedores.map((f) => f.idPessoa).filter((id) => id > 0);
  const gravado = produto.idFornecedorVencedor;
  if (gravado != null && gravado > 0 && ids.includes(gravado)) return gravado;
  if (ids.length === 1) return ids[0];
  return null;
}

function idsMenorPrecoTotal(produto: RetratoProduto, fornecedores: RetratoFornecedor[]): Set<number> {
  const cotados: { id: number; centavos: number }[] = [];
  for (const f of fornecedores) {
    const item = precoDoFornecedor(produto, f.idPessoa);
    if (!item || !Number.isFinite(item.precoTotal) || item.precoTotal <= 0) continue;
    cotados.push({ id: f.idPessoa, centavos: Math.round(item.precoTotal * 100) });
  }
  if (cotados.length < 2) return new Set();
  const menor = Math.min(...cotados.map((c) => c.centavos));
  return new Set(cotados.filter((c) => c.centavos === menor).map((c) => c.id));
}

function htmlFornecedores(
  produto: RetratoProduto,
  fornecedores: RetratoFornecedor[],
  editavel: boolean
): string {
  if (fornecedores.length === 0) return '<p class="vazio">Nenhum fornecedor nesta coleta.</p>';
  const marcado = idFornecedorMarcado(produto, fornecedores);
  const menores = idsMenorPrecoTotal(produto, fornecedores);
  return fornecedores
    .map((f) => {
      const nome = esc(apenasNomeFornecedor(f.nome));
      const condicoes = [
        f.condicaoPagamento ? `Pagamento: ${esc(f.condicaoPagamento)}` : '',
        f.formaPagamento ? `Forma: ${esc(f.formaPagamento)}` : '',
        f.valorFrete
          ? `Frete: ${esc(f.valorFrete)}${f.valorFreteTipo ? ` (${esc(f.valorFreteTipo)})` : ''}`
          : '',
        f.pedidoMinimo ? `Pedido mínimo: ${esc(f.pedidoMinimo)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const item = precoDoFornecedor(produto, f.idPessoa);
      const precos = item
        ? `<div class="preco-nf"><span>Preço NF</span><strong>R$ ${esc(fmtMoeda(item.precoNF))}</strong></div><div class="preco-total"><span>Preço total</span><strong>R$ ${esc(fmtMoeda(item.precoTotal))}</strong></div><span class="preco-extra">IPI ${esc(fmtPerc(item.percIPI))} · ICMS ${esc(fmtPerc(item.percICMS))}</span>`
        : '<span class="preco-extra">Sem preço informado</span>';
      const extras = condicoes ? `<span class="preco-extra">${condicoes}</span>` : '';
      const podeMarcar = f.idPessoa > 0;
      const checked = podeMarcar && f.idPessoa === marcado ? ' checked' : '';
      const travado = editavel ? '' : ' disabled';
      const radio = podeMarcar
        ? `<input type="radio" name="idFornecedor" value="${f.idPessoa}"${checked}${travado} />`
        : '';
      const menor = menores.has(f.idPessoa);
      const tagMenor = menor ? '<span class="tag menor">Menor preço</span>' : '';
      return `<label class="forn${menor ? ' menor' : ''}">${radio}<span class="forn-corpo"><span class="forn-topo"><b>${nome}</b><span class="forn-tags">${tagMenor}<span class="tag">Comprar deste</span></span></span>${precos}${extras}</span></label>`;
    })
    .join('');
}

function htmlCartao(
  produto: RetratoProduto,
  indice: number,
  retrato: RetratoColetaAprovacao,
  token: string | null,
  erro?: string,
  registroErroId?: number
): string {
  const dialogId = `det-${produto.registroId}-${indice}`;
  const codigo = esc(produto.codigo || 'Produto');
  const descricao = esc(produto.descricao || '—');
  const unidade = produto.unidade ? `<em>${esc(produto.unidade)}</em>` : '';
  const qtdePositiva =
    produto.qtdeAprovada != null && Number.isFinite(produto.qtdeAprovada) && produto.qtdeAprovada > 0;
  const rejeitado = produto.rejeitado === true;
  const aprovada = qtdePositiva
    ? `<p class="selo">Quantidade aprovada: ${esc(formatarQuantidade(produto.qtdeAprovada))}</p>`
    : '';
  const detalhes = (produto.detalhes ?? [])
    .filter((d) => d.rotulo !== 'Tipo do Produto' && d.rotulo !== 'Grupo do Produto')
    .map((d) => {
      const destaque = d.destaque || ROTULOS_DESTAQUE.has(d.rotulo);
      return `<div class="linha${destaque ? ' destaque' : ''}"><span class="rotulo">${esc(d.rotulo)}</span><span class="valor">${esc(d.valor)}</span></div>`;
    })
    .join('');
  const fornecedores = htmlFornecedores(produto, retrato.fornecedores, token != null);
  const erroCard =
    erro && registroErroId === produto.registroId && !/motivo|reavalia|precisa ser feito/i.test(erro)
      ? `<p class="erro">${esc(erro)}</p>`
      : '';
  const qtdeOriginal = esc(formatarQuantidade(produto.qtdSolicitada));
  const valorCampo = esc(
    formatarQuantidade(qtdePositiva ? produto.qtdeAprovada : produto.qtdSolicitada)
  );
  const motivoSalvo = rejeitado ? (produto.motivoRejeicao ?? '').trim() : '';
  const pedidoSalvo = !rejeitado && !qtdePositiva ? (produto.pedidoReavaliacao ?? '').trim() : '';
  const reavaliacao = produto.reavaliacao === true && !rejeitado && !qtdePositiva;
  const selo = rejeitado
    ? `<p class="selo nao">Compra rejeitada</p>${motivoSalvo ? `<p class="motivo-salvo">${esc(motivoSalvo)}</p>` : ''}`
    : reavaliacao
      ? `<p class="selo volta">Reavaliação solicitada</p>${pedidoSalvo ? `<p class="motivo-salvo">${esc(pedidoSalvo)}</p>` : ''}`
      : aprovada;
  const formId = `neg-${produto.registroId}`;
  const motivoId = `motivo-${produto.registroId}`;
  const botoesRetorno = token
    ? `<div class="retorno-acoes"><button class="reavaliar" type="button" aria-label="Reavaliar esta negociação" onclick="abrirRetorno('${motivoId}','reavaliar')">Reavaliar</button><button class="rejeitar" type="button" aria-label="Rejeitar esta negociação" onclick="abrirRetorno('${motivoId}','rejeitar')">Rejeitar</button></div>`
    : '';
  const form = token
    ? `<form id="${formId}" class="item" method="post" action="/a/${esc(token)}">${erroCard}<input type="hidden" name="registroId" value="${produto.registroId}" /><div class="qtd-box"><div class="qtd-texto"><div class="qtd-rotulo"><span>Quantidade solicitada</span><b class="qtd-original">${qtdeOriginal}${unidade}</b></div><div class="qtd-editar"><input name="qtde" inputmode="decimal" autocomplete="off" aria-label="Quantidade a confirmar" value="${valorCampo}" />${unidade}</div></div><button class="icone ok" type="submit" name="modo" value="informada" aria-label="Confirmar quantidade">${ICONE_CHECK}</button></div>${fornecedores}</form>${selo}`
    : `${fornecedores}${selo || '<p class="vazio">Sem quantidade aprovada.</p>'}`;

  const comErro = Boolean(erro && registroErroId === produto.registroId);
  const erroReavaliar = Boolean(comErro && erro && /reavalia|precisa ser feito/i.test(erro));
  const erroRejeitar = Boolean(comErro && erro && !erroReavaliar && /motivo/i.test(erro));
  const dialog = `<dialog id="${dialogId}"><div class="painel"><div class="painel-topo"><h3>${codigo}</h3><form method="dialog"><button type="submit" class="fechar">Fechar</button></form></div><div class="painel-corpo"><div class="lista">${detalhes}</div></div></div></dialog>`;
  const dialogMotivo = token
    ? `<dialog class="motivo" id="${motivoId}" onclose="pararGravacao()" data-motivo="${escAttrQuebra(motivoSalvo)}" data-reavaliacao="${escAttrQuebra(pedidoSalvo)}"><form class="motivo-box" method="post" action="/a/${esc(token)}"><h3 data-titulo>Rejeitar esta negociação</h3><p>${codigo} — ${descricao}</p><label data-rotulo for="texto-${motivoId}">Motivo da rejeição</label><textarea id="texto-${motivoId}" name="motivo" required maxlength="${MOTIVO_REJEICAO_MAX}" rows="4" placeholder="Descreva o motivo da rejeição">${esc(motivoSalvo)}</textarea>${erroReavaliar || erroRejeitar ? `<p class="erro">${esc(erro ?? '')}</p>` : ''}<input type="hidden" name="registroId" value="${produto.registroId}" /><div class="motivo-acoes"><button type="button" class="gravar" onpointerdown="iniciarGravacao('texto-${motivoId}', this, event)" onpointerup="soltarGravacao()" onpointercancel="soltarGravacao()" onlostpointercapture="soltarGravacao()" oncontextmenu="event.preventDefault()"><span class="gravar-texto">Segure para gravar</span></button><button type="button" class="cancelar" onclick="this.closest('dialog').close()">Cancelar</button><button class="enviar rejeitar" type="submit" name="modo" value="rejeitar" data-enviar>Rejeitar</button></div></form></dialog>${erroReavaliar || erroRejeitar ? `<script>abrirRetorno('${motivoId}','${erroReavaliar ? 'reavaliar' : 'rejeitar'}')</script>` : ''}`
    : '';
  const info = `<button type="button" class="info" aria-label="Ver informações da coleta" onclick="document.getElementById('${dialogId}').showModal()">${ICONE_INFO}</button>`;
  const topo = `<div class="card-topo"><button type="button" class="recolher">Recolher</button>${info}${botoesRetorno}</div>`;
  const miolo = `${topo}${form}`;
  const estado = rejeitado ? 'rejeitado' : qtdePositiva ? 'avaliado' : reavaliacao ? 'reavaliacao' : 'aguardando';
  const status = rejeitado
    ? 'Compra rejeitada'
    : qtdePositiva
      ? esc(resumoDoItemAprovado(produto, retrato.fornecedores))
      : reavaliacao
        ? 'Reavaliação solicitada'
        : 'Aguardando avaliação';
  const aberto = comErro ? ' aberto' : '';
  const visto = qtdePositiva ? `<span class="visto">${ICONE_CHECK}</span>` : '';
  return `<article class="card ${estado}${aberto}" id="item-${produto.registroId}"><button type="button" class="resumo" aria-expanded="${comErro ? 'true' : 'false'}" aria-controls="miolo-${produto.registroId}">${visto}<span class="resumo-corpo"><span class="resumo-linha"><strong>${codigo}</strong><strong class="resumo-nome">${descricao}</strong></span><span class="resumo-status">${status}</span></span><span class="chevron" aria-hidden="true"></span></button><div class="miolo" id="miolo-${produto.registroId}"><div class="miolo-inner">${miolo}</div></div>${dialog}${dialogMotivo}</article>`;
}

function resumoDoItemAprovado(produto: RetratoProduto, fornecedores: RetratoFornecedor[]): string {
  const qtd = formatarQuantidade(produto.qtdeAprovada);
  const und = produto.unidade ? ` ${produto.unidade}` : '';
  const forn = fornecedores.find((f) => f.idPessoa === produto.idFornecedorVencedor && f.idPessoa > 0);
  const nome = forn ? apenasNomeFornecedor(forn.nome) : '';
  const preco = forn ? precoDoFornecedor(produto, forn.idPessoa) : undefined;
  const total = preco ? `R$ ${fmtMoeda(preco.precoTotal)}` : '';
  return [qtd + und, nome, total].filter((parte) => parte.trim() !== '').join(' · ');
}

function htmlCartoes(
  retrato: RetratoColetaAprovacao,
  token: string | null,
  erro?: string,
  registroErroId?: number
): string {
  if (retrato.produtos.length === 0) return '<p class="vazio">Nenhum produto nesta coleta.</p>';
  const erroGeral = erro && registroErroId == null ? `<p class="erro">${esc(erro)}</p>` : '';
  const cards = retrato.produtos
    .map((p, i) => htmlCartao(p, i, retrato, token, erro, registroErroId))
    .join('');
  return `${erroGeral}<div class="cards">${cards}</div>`;
}

const ESTILO = `
  :root { --navy:#041E42; --blue:#1E22AA; --gold:#FFAD00; --gray:#808080; --graphite:#2E2D2C; --ok:#067647; --no:#b42318; --line:rgb(128 128 128 / 0.3); --surface:#f4f5f8; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Barlow, system-ui, sans-serif; background: var(--surface); color: var(--navy); line-height: 1.4; }
  .topo { background: var(--navy); color: #fff; border-bottom: 4px solid var(--gold); }
  .topo-inner { max-width: 720px; margin: 0 auto; padding: 18px 16px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  form.finalizar { margin: 0; }
  button.finalizar { background: var(--gold); color: var(--navy); min-height: 44px; padding: 8px 18px; white-space: nowrap; }
  .topo h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .topo p { margin: 4px 0 0; color: var(--gold); font-size: 13px; font-weight: 600; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px 14px 48px; }
  .aviso { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--gold); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
  .aviso.encerrada { padding: 28px 20px; text-align: center; border-left-width: 0; border-top: 4px solid var(--gold); }
  .aviso.encerrada strong { display: block; font-size: 22px; margin-bottom: 8px; }
  .aviso.no { border-left-color: var(--no); }
  .aviso strong { display: block; }
  .erro { color: var(--no); font-weight: 700; margin: 0 0 8px; }
  .vazio { color: var(--gray); margin: 8px 0 0; }
  .obs { margin-top: 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; white-space: pre-wrap; }
  .obs p { margin: 6px 0 0; }
  .cards { display: flex; flex-direction: column; gap: 12px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
  .card.avaliado, .card.rejeitado, .card.aguardando, .card.reavaliacao { padding: 0; overflow: hidden; }
  .card.avaliado { border-left: 4px solid var(--ok); }
  .card.rejeitado { border-left: 4px solid var(--no); }
  .card.aguardando { border-left: 4px solid var(--gold); }
  .card.reavaliacao { border-left: 4px solid var(--blue); }
  .resumo { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; color: var(--navy); text-align: left; border-radius: 0; }
  .resumo-corpo { flex: 1; min-width: 0; }
  .resumo-linha { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  .resumo-linha strong, .resumo-nome { font-size: 16px; font-weight: 700; color: var(--navy); line-height: 1.25; }
  .resumo-linha > strong { flex: 0 0 auto; }
  .resumo-nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resumo-status { display: inline-block; width: fit-content; max-width: 100%; margin-top: 6px; padding: 2px 10px; border: 1px solid currentColor; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.35; }
  .card.aguardando .resumo-status { color: #8a5a00; background: #fff6e0; border-color: var(--gold); }
  .card.rejeitado .resumo-status { color: var(--no); background: #fdecec; border-color: #e7b4ae; }
  .card.reavaliacao .resumo-status { color: var(--blue); background: #e8eefc; border-color: #b7c4ef; }
  .card.avaliado .resumo-status { color: var(--ok); background: #e7f6ee; border-color: #9ed4b5; }
  .visto { width: 28px; height: 28px; border-radius: 999px; background: var(--ok); color: #fff; display: grid; place-items: center; flex: 0 0 28px; }
  .visto.nao { background: var(--no); }
  .visto svg { width: 16px; height: 16px; }
  .chevron { width: 10px; height: 10px; margin-right: 4px; border-right: 2px solid var(--navy); border-bottom: 2px solid var(--navy); transform: rotate(45deg); transition: transform .32s ease; flex: 0 0 auto; }
  .card.aberto .chevron { transform: rotate(-135deg); margin-top: 6px; }
  .miolo { display: grid; grid-template-rows: 0fr; overflow: hidden; transition: grid-template-rows .32s ease; }
  .card.aberto .miolo { grid-template-rows: 1fr; }
  .miolo-inner { overflow: hidden; min-height: 0; }
  .card.aberto .miolo-inner { padding: 0 14px 14px; }
  .card.avaliado:not(.aberto) .miolo-inner,
  .card.rejeitado:not(.aberto) .miolo-inner,
  .card.aguardando:not(.aberto) .miolo-inner,
  .card.reavaliacao:not(.aberto) .miolo-inner { max-height: 0; padding: 0; }
  button.recolher { background: transparent; color: var(--blue); padding: 8px 4px; min-height: 44px; }
  .card-topo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .retorno-acoes { margin-left: auto; display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
  button.reavaliar { background: var(--navy); color: #fff; min-height: 44px; padding: 8px 18px; }
  button.rejeitar { background: var(--no); color: #fff; min-height: 44px; padding: 8px 18px; }
  .card-topo > div, .card-topo > .desc { flex: 1; min-width: 0; }
  .card-topo > .retorno-acoes { flex: 0 0 auto; margin-left: auto; }
  .card-topo .desc { margin: 0; color: var(--graphite); }
  .card h2 { margin: 0; font-size: 18px; }
  .card-topo p { margin: 4px 0 0; color: var(--graphite); }
  button { border: 0; border-radius: 10px; padding: 12px 16px; font: inherit; font-weight: 700; cursor: pointer; }
  button.info { flex: 0 0 44px; width: 44px; height: 44px; padding: 0; display: grid; place-items: center; background: #fff; color: var(--blue); border: 1px solid var(--line); }
  .qtd-box { margin: 12px 0 0; background: #fff6e0; border: 1px solid var(--gold); border-radius: 12px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .qtd-box span { display: block; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--blue); }
  .qtd-box strong { display: block; font-size: 32px; line-height: 1.1; }
  .qtd-box em { font-style: normal; font-weight: 600; color: var(--graphite); }
  .qtd-rotulo { display: flex; align-items: baseline; gap: 10px; }
  .qtd-original { font-size: 18px; font-weight: 700; line-height: 1.1; color: var(--navy); white-space: nowrap; }
  .qtd-editar { display: flex; align-items: baseline; gap: 8px; }
  .qtd-editar input { width: 8ch; min-width: 4.5rem; max-width: 12rem; min-height: 44px; border: 0; border-bottom: 2px solid var(--gold); border-radius: 0; padding: 0 2px; background: transparent; font: inherit; font-size: 32px; font-weight: 700; line-height: 1.1; color: var(--navy); }
  button.icone { width: 44px; height: 44px; min-height: 44px; padding: 0; display: grid; place-items: center; flex: 0 0 44px; }
  button.icone.ok { background: var(--ok); color: #fff; }
  button.icone.sec { background: var(--navy); color: #fff; }
  button.icone.nao { background: #fff; color: var(--no); border: 1px solid #f3c3bd; }
  .acoes-item { display: flex; justify-content: flex-end; margin-top: 12px; }
  .selo.nao { background: #fdecec; color: var(--no); }
  .forn { display: flex; align-items: flex-start; gap: 10px; margin-top: 10px; border: 1px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; }
  .forn input { width: 20px; height: 20px; margin-top: 2px; accent-color: #8a5a00; flex: 0 0 auto; }
  .forn-corpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .forn-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .forn-topo b { color: var(--navy); font-size: 16px; }
  .forn-tags { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .tag { display: none; background: var(--gold); color: var(--navy); font-size: 12px; font-weight: 700; border-radius: 999px; padding: 4px 8px; white-space: nowrap; }
  .tag.menor { display: inline-block; background: var(--ok); color: #fff; }
  .forn.menor { background: #e7f6ee; border-color: #9ed4b5; }
  .forn:has(input:checked) { border-color: var(--gold); background: #fffdf6; }
  .forn.menor:has(input:checked) { background: #e7f6ee; }
  .forn:has(input:checked) .tag { display: inline-block; }
  .preco-nf span, .preco-total span { display: block; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .preco-nf span { color: var(--blue); }
  .preco-nf strong { display: block; margin-top: 2px; font-size: 22px; line-height: 1.1; color: var(--navy); }
  .preco-total { background: #fff6e0; border: 1px solid var(--gold); border-radius: 12px; padding: 12px; }
  .preco-total span { color: #8a5a00; }
  .preco-total strong { display: block; margin-top: 2px; font-size: 32px; line-height: 1.1; color: #8a5a00; }
  .preco-extra { color: var(--graphite); font-size: 14px; }
  form.item { margin: 12px 0 0; }
  form.item input[type="radio"] { width: 20px; min-height: 0; margin-top: 2px; font-size: inherit; }
  .selo { display: inline-block; margin: 10px 0 0; background: #e7f6ee; color: var(--ok); font-weight: 700; border-radius: 999px; padding: 6px 12px; }
  button.fechar { background: #fff; color: var(--navy); min-height: 44px; padding: 8px 16px; }
  dialog { border: 0; padding: 0; margin: 0; width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; color: var(--navy); }
  dialog::backdrop { background: rgb(4 30 66 / 0.55); }
  dialog.motivo { inset: 0; width: min(480px, calc(100vw - 24px)); max-width: min(480px, calc(100vw - 24px)); height: fit-content; max-height: calc(100dvh - 32px); margin: auto; border-radius: 16px; border-top: 4px solid var(--gold); background: #fff; overflow: auto; }
  .motivo-box { padding: 18px 16px 16px; }
  .motivo-box h3 { margin: 0; font-size: 20px; }
  .motivo-box p { margin: 6px 0 0; color: var(--graphite); }
  .motivo-box label { display: block; margin-top: 14px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--blue); }
  .motivo-box textarea { width: 100%; min-height: 120px; margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 16px; color: var(--navy); resize: vertical; }
  .motivo-box .erro { margin-top: 8px; }
  .motivo-acoes { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  button.gravar { flex: 1 0 100%; order: -1; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 72px; background: var(--navy); color: #fff; font-size: 18px; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  button.gravar.ouvindo { background: var(--no); }
  .motivo-acoes button.cancelar { margin-right: auto; background: #fff; color: var(--navy); border: 1px solid var(--line); min-height: 44px; }
  .motivo-acoes button.rejeitar, .motivo-acoes button.reavaliar { margin-left: 0; }
  .motivo-salvo { margin: 8px 0 0; color: var(--graphite); white-space: pre-wrap; }
  .selo.volta { background: #e8eefc; color: var(--blue); }
  .painel { display: flex; flex-direction: column; height: 100dvh; background: var(--surface); }
  .painel-topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--navy); color: #fff; border-bottom: 4px solid var(--gold); padding: 14px 16px; }
  .painel-topo h3 { margin: 0; color: #fff; font-size: 22px; }
  .painel-corpo { flex: 1; overflow: auto; padding: 16px; }
  .lista { background: #fff; border: 1px solid var(--line); border-radius: 12px; }
  .linha { padding: 12px 14px; border-bottom: 1px solid var(--line); }
  .linha:last-child { border-bottom: 0; }
  .rotulo { display: block; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--blue); }
  .valor { display: block; margin-top: 2px; font-size: 16px; }
  .linha.destaque { background: #fff6e0; }
  .linha.destaque .valor { color: #8a5a00; font-size: 22px; font-weight: 700; }
  .rodape { color: var(--gray); font-size: 12px; margin-top: 14px; }
  @media (prefers-reduced-motion: reduce) {
    .miolo, .chevron { transition: none; }
  }
  @media (max-width: 640px) {
    .wrap, .topo-inner { padding-left: 12px; padding-right: 12px; }
  }
`;

function documento(titulo: string, corpo: string, acaoTopo = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titulo)}</title>
  ${FONTE}
  <style>${ESTILO}</style>
  <script>
    var reconhecimentoAtual = null;
    var segurandoGravacao = false;
    function pararGravacao() {
      segurandoGravacao = false;
      if (!reconhecimentoAtual) return;
      try { reconhecimentoAtual.stop(); } catch (e) {}
      reconhecimentoAtual = null;
    }
    function soltarGravacao() {
      pararGravacao();
    }
    function iniciarGravacao(campoId, botao, ev) {
      if (ev) {
        ev.preventDefault();
        if (ev.pointerId != null && botao.setPointerCapture) {
          try { botao.setPointerCapture(ev.pointerId); } catch (e) {}
        }
      }
      if (reconhecimentoAtual) return;
      segurandoGravacao = true;
      var campo = document.getElementById(campoId);
      var rotulo = botao.querySelector('.gravar-texto');
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR || !campo) {
        segurandoGravacao = false;
        alert('Este navegador não transcreve áudio. Digite o texto.');
        return;
      }
      var rec = new SR();
      reconhecimentoAtual = rec;
      rec.lang = 'pt-BR';
      rec.interimResults = true;
      rec.continuous = true;
      var base = (campo.value || '').trim();
      botao.classList.add('ouvindo');
      if (rotulo) rotulo.textContent = 'Ouvindo… solte para parar';
      rec.onresult = function (evento) {
        var texto = '';
        for (var i = 0; i < evento.results.length; i++) texto += evento.results[i][0].transcript;
        var junto = (base ? base + ' ' : '') + texto.trim();
        campo.value = junto.slice(0, campo.maxLength || 500);
      };
      function encerra() {
        if (reconhecimentoAtual === rec) reconhecimentoAtual = null;
        botao.classList.remove('ouvindo');
        if (rotulo) rotulo.textContent = 'Segure para gravar';
      }
      rec.onstart = function () {
        if (!segurandoGravacao) {
          try { rec.stop(); } catch (e) {}
        }
      };
      rec.onend = function () {
        if (segurandoGravacao && reconhecimentoAtual === rec) {
          try { rec.start(); return; } catch (e) {}
        }
        encerra();
      };
      rec.onerror = function (evento) {
        var bloqueado = evento && (evento.error === 'not-allowed' || evento.error === 'service-not-allowed');
        if (bloqueado) {
          segurandoGravacao = false;
          encerra();
          alert('Permita o microfone para transcrever o áudio.');
          return;
        }
        if (!segurandoGravacao) encerra();
      };
      try { rec.start(); } catch (e) { encerra(); }
      if (!segurandoGravacao) pararGravacao();
    }
    function abrirRetorno(id, modo) {
      pararGravacao();
      var dlg = document.getElementById(id);
      if (!dlg || typeof dlg.showModal !== 'function') return;
      var rejeitar = modo !== 'reavaliar';
      var titulo = dlg.querySelector('[data-titulo]');
      var rotulo = dlg.querySelector('[data-rotulo]');
      var area = dlg.querySelector('textarea');
      var enviar = dlg.querySelector('[data-enviar]');
      if (titulo) titulo.textContent = rejeitar ? 'Rejeitar esta negociação' : 'Reavaliar esta negociação';
      if (rotulo) rotulo.textContent = rejeitar ? 'Motivo da rejeição' : 'O que precisa ser feito';
      if (area) {
        area.placeholder = rejeitar ? 'Descreva o motivo da rejeição' : 'Descreva o que precisa ser feito';
        area.value = dlg.getAttribute(rejeitar ? 'data-motivo' : 'data-reavaliacao') || '';
      }
      if (enviar) {
        enviar.value = rejeitar ? 'rejeitar' : 'reavaliar';
        enviar.textContent = rejeitar ? 'Rejeitar' : 'Reavaliar';
        enviar.className = rejeitar ? 'enviar rejeitar' : 'enviar reavaliar';
      }
      dlg.showModal();
    }
  </script>
</head>
<body>
  <header class="topo"><div class="topo-inner"><div><h1>${esc(titulo)}</h1><p>Coleta de preços para aprovação</p></div>${acaoTopo}</div></header>
  <main class="wrap">${corpo}</main>
  <script>
    document.addEventListener('click', function (ev) {
      var alvo = ev.target && ev.target.closest ? ev.target.closest('.resumo, .recolher') : null;
      if (!alvo) return;
      var card = alvo.closest('.card');
      if (!card) return;
      var aberto = card.classList.toggle('aberto');
      var resumo = card.querySelector('.resumo');
      if (resumo) resumo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
  </script>
</body>
</html>`;
}

export function renderPaginaAprovacaoHtml(view: PaginaView): string {
  if (view.tipo === 'invalido') {
    return documento(
      'Link não encontrado',
      '<div class="aviso no"><strong>Link não encontrado</strong>Este endereço não corresponde a uma aprovação em aberto.</div>'
    );
  }
  if (view.tipo === 'substituido') {
    return documento(
      'Link substituído',
      '<div class="aviso"><strong>Este link foi substituído</strong>Foi enviado um novo WhatsApp. Use o link da mensagem mais recente.</div>'
    );
  }

  const titulo = `Coleta #${view.coletaId}`;
  const obsColeta = view.retrato.observacoes
    ? `<div class="obs"><strong>Observações da coleta</strong><p>${esc(view.retrato.observacoes)}</p></div>`
    : '';
  let banner = '';
  let cartoes = '';
  if (view.tipo === 'sem_permissao') {
    banner = `<div class="aviso no"><strong>Sem permissão para decidir</strong>${esc(view.nome)} não pode mais aprovar esta coleta por este link.</div>`;
    cartoes = htmlCartoes(view.retrato, null);
  } else if (view.tipo === 'consulta') {
    const erro = view.erro ? `<p class="erro">${esc(view.erro)}</p>` : '';
    if (view.resultado) {
      banner = `<div class="aviso encerrada"><strong>Aprovação finalizada</strong>O portal recebeu o status ${esc(view.resultado)}. Os itens desta análise não aparecem mais neste link.</div>${erro}`;
      cartoes = '';
    } else {
      banner = view.manual
        ? `<div class="aviso"><strong>Aprovação manual</strong>Esta coleta segue no portal. Este endereço não recebe a análise pelo celular.</div>${erro}`
        : `<div class="aviso"><strong>Coleta fora de aprovação</strong>As quantidades já gravadas continuam na coleta. Este link não altera mais os itens.</div>${erro}`;
      cartoes = htmlCartoes(view.retrato, null);
    }
  } else {
    const erroTopo =
      view.erro && view.registroErroId == null ? `<p class="erro">${esc(view.erro)}</p>` : '';
    banner = `<div class="aviso"><strong>Aguardando ${esc(view.nome)}</strong></div>${erroTopo}`;
    cartoes = htmlCartoes(view.retrato, view.token, view.erro, view.registroErroId);
  }

  const acaoTopo =
    view.tipo === 'aguardando'
      ? `<form class="finalizar" method="post" action="/a/${esc(view.token)}"><button class="finalizar" type="submit" name="modo" value="finalizar">Finalizar</button></form>`
      : '';

  const rodape =
    view.tipo === 'consulta' && view.resultado
      ? ''
      : '<p class="rodape">A quantidade aprovada é gravada na coleta. O status da análise só segue para o portal ao finalizar.</p>';
  const obs = view.tipo === 'consulta' && view.resultado ? '' : obsColeta;

  return documento(titulo, `${banner}${cartoes}${obs}${rodape}`, acaoTopo);
}

async function viewDoToken(
  token: string,
  erroForm?: string,
  registroErroId?: number
): Promise<PaginaView> {
  if (!TOKEN_RE.test(token)) return { tipo: 'invalido' };
  const link = await prisma.coletaPrecosAprovacaoLink.findUnique({
    where: { token },
    select: {
      token: true,
      coletaPrecosId: true,
      substituido: true,
      observacao: true,
      usuario: { select: { login: true, nome: true, ativo: true } },
    },
  });
  if (!link) return { tipo: 'invalido' };
  if (link.substituido) return { tipo: 'substituido' };
  const nome = (link.usuario.nome ?? '').trim() || link.usuario.login;
  const retratoCompleto = await montarRetrato(link.coletaPrecosId);
  const pode = link.usuario.ativo && (await usuarioPodeAprovar(link.usuario.login));
  if (!pode) {
    return { tipo: 'sem_permissao', coletaId: link.coletaPrecosId, nome, retrato: retratoCompleto };
  }
  const coleta = await prisma.coletaPrecos.findUnique({
    where: { id: link.coletaPrecosId },
    select: { status: true },
  });
  const statusColeta = coleta?.status ?? '';
  if ((link.observacao ?? '') === MARCA_MANUAL && statusColeta === 'Em Aprovação') {
    return {
      tipo: 'consulta',
      coletaId: link.coletaPrecosId,
      nome,
      retrato: retratoCompleto,
      manual: true,
      erro: erroForm,
    };
  }
  if (statusColeta === 'Em Aprovação') {
    const escopo = idsDoEscopo(link.observacao);
    const produtos = escopo
      ? retratoCompleto.produtos.filter((p) => escopo.includes(p.registroId))
      : retratoCompleto.produtos;
    return {
      tipo: 'aguardando',
      coletaId: link.coletaPrecosId,
      nome,
      token: link.token,
      retrato: { ...retratoCompleto, produtos },
      erro: erroForm,
      registroErroId,
    };
  }
  const resultado =
    statusColeta === STATUS_APROVADO_TOTAL ||
    statusColeta === STATUS_APROVADO_PARCIAL ||
    statusColeta === STATUS_REAVALIAR
      ? statusColeta
      : undefined;
  return {
    tipo: 'consulta',
    coletaId: link.coletaPrecosId,
    nome,
    retrato: retratoCompleto,
    resultado,
    erro: erroForm,
  };
}

export async function htmlPaginaAprovacao(token: string): Promise<{ status: number; html: string }> {
  const view = await viewDoToken(token.trim());
  const status = view.tipo === 'invalido' ? 404 : 200;
  return { status, html: renderPaginaAprovacaoHtml(view) };
}

function textoMotivo(valor: unknown): string {
  if (typeof valor === 'string') return valor.trim();
  if (valor == null) return '';
  return String(valor).trim();
}

export async function registrarQuantidadeItem(
  token: string,
  body: { registroId?: unknown; modo?: unknown; qtde?: unknown; idFornecedor?: unknown; motivo?: unknown }
): Promise<{ redirect: string } | { status: number; html: string }> {
  const tokenLimpo = token.trim();
  if (!TOKEN_RE.test(tokenLimpo)) {
    return { status: 404, html: renderPaginaAprovacaoHtml({ tipo: 'invalido' }) };
  }

  const registroId =
    typeof body.registroId === 'number' ? body.registroId : parseInt(String(body.registroId ?? ''), 10);
  const modo =
    body.modo === 'solicitada' ||
    body.modo === 'informada' ||
    body.modo === 'rejeitar' ||
    body.modo === 'reavaliar' ||
    body.modo === 'finalizar'
      ? body.modo
      : null;

  const falha = async (mensagem: string, id?: number) => {
    const view = await viewDoToken(tokenLimpo, mensagem, id);
    return {
      status: view.tipo === 'invalido' ? 404 : 400,
      html: renderPaginaAprovacaoHtml(view),
    };
  };

  if (!modo || (modo !== 'finalizar' && (!Number.isFinite(registroId) || registroId < 1))) {
    return falha('Não foi possível identificar o produto.');
  }

  const link = await prisma.coletaPrecosAprovacaoLink.findUnique({
    where: { token: tokenLimpo },
    select: {
      id: true,
      coletaPrecosId: true,
      substituido: true,
      observacao: true,
      usuario: { select: { login: true, ativo: true } },
    },
  });
  if (!link) return { status: 404, html: renderPaginaAprovacaoHtml({ tipo: 'invalido' }) };
  if ((link.observacao ?? '') === MARCA_MANUAL) {
    return falha('Esta aprovação é manual e segue no portal.');
  }
  if (link.substituido) {
    return { status: 200, html: renderPaginaAprovacaoHtml({ tipo: 'substituido' }) };
  }
  if (!link.usuario.ativo || !(await usuarioPodeAprovar(link.usuario.login))) {
    const view = await viewDoToken(tokenLimpo);
    return { status: 403, html: renderPaginaAprovacaoHtml(view) };
  }

  const coleta = await prisma.coletaPrecos.findUnique({
    where: { id: link.coletaPrecosId },
    select: { status: true },
  });
  if ((coleta?.status ?? '') !== 'Em Aprovação') {
    return falha('A coleta não está mais em aprovação. A quantidade não foi alterada.');
  }

  if (modo === 'finalizar') {
    const retrato = await montarRetrato(link.coletaPrecosId);
    const pendentes = retrato.produtos.filter(itemAguardando);
    if (pendentes.length > 0) {
      const n = pendentes.length;
      return falha(
        n === 1 ? 'Ainda há 1 item aguardando avaliação.' : `Ainda há ${n} itens aguardando avaliação.`
      );
    }
    const resultado = resultadoDaAnalise(retrato.produtos);
    const agoraAnalise = new Date();
    await prisma.$transaction([
      prisma.coletaPrecos.update({
        where: { id: link.coletaPrecosId },
        data: { status: resultado, dataUltimaMovimentacao: agoraAnalise },
      }),
      prisma.coletaPrecosAprovacaoLink.update({
        where: { id: link.id },
        data: { decisao: resultado, decididoEm: agoraAnalise, retratoJson: JSON.stringify(retrato) },
      }),
    ]);
    return { redirect: `/a/${encodeURIComponent(tokenLimpo)}` };
  }

  const registro = await prisma.coletaPrecosRegistro.findFirst({
    where: { id: registroId, coletaPrecosId: link.coletaPrecosId },
    select: { id: true, idProduto: true, dados: true },
  });
  if (!registro) return falha('Produto não encontrado nesta coleta.');

  if (modo === 'rejeitar') {
    const motivo = textoMotivo(body.motivo);
    if (!motivo) return falha('Informe o motivo da rejeição.', registroId);
    if (motivo.length > MOTIVO_REJEICAO_MAX) {
      return falha(`O motivo pode ter no máximo ${MOTIVO_REJEICAO_MAX} caracteres.`, registroId);
    }
    const agoraRejeicao = new Date();
    await prisma.$transaction([
      prisma.coletaPrecosRegistro.update({
        where: { id: registroId },
        data: {
        qtdeAprovada: null,
        idFornecedorVencedor: null,
        dados: dadosComRejeicao(registro.dados, true, motivo),
      },
      }),
      prisma.coletaPrecos.update({
        where: { id: link.coletaPrecosId },
        data: { dataUltimaMovimentacao: agoraRejeicao },
      }),
    ]);
    const retratoRejeitado = await montarRetrato(link.coletaPrecosId);
    await prisma.coletaPrecosAprovacaoLink.update({
      where: { id: link.id },
      data: { retratoJson: JSON.stringify(retratoRejeitado) },
    });
    return { redirect: `/a/${encodeURIComponent(tokenLimpo)}#item-${registroId}` };
  }

  if (modo === 'reavaliar') {
    const pedido = textoMotivo(body.motivo);
    if (!pedido) return falha('Informe o que precisa ser feito.', registroId);
    if (pedido.length > MOTIVO_REJEICAO_MAX) {
      return falha(`O pedido de reavaliação pode ter no máximo ${MOTIVO_REJEICAO_MAX} caracteres.`, registroId);
    }
    const agoraReavaliacao = new Date();
    await prisma.$transaction([
      prisma.coletaPrecosRegistro.update({
        where: { id: registroId },
        data: {
          qtdeAprovada: null,
          idFornecedorVencedor: null,
          dados: dadosComReavaliacao(registro.dados, pedido),
        },
      }),
      prisma.coletaPrecos.update({
        where: { id: link.coletaPrecosId },
        data: { dataUltimaMovimentacao: agoraReavaliacao },
      }),
    ]);
    const retratoReavaliado = await montarRetrato(link.coletaPrecosId);
    await prisma.coletaPrecosAprovacaoLink.update({
      where: { id: link.id },
      data: { retratoJson: JSON.stringify(retratoReavaliado) },
    });
    return { redirect: `/a/${encodeURIComponent(tokenLimpo)}#item-${registroId}` };
  }

  const idFornecedor =
    typeof body.idFornecedor === 'number'
      ? body.idFornecedor
      : parseInt(String(body.idFornecedor ?? ''), 10);
  if (!Number.isFinite(idFornecedor) || idFornecedor < 1) {
    return falha('Escolha de qual fornecedor comprar.', registroId);
  }
  const coletaForn = await prisma.coletaPrecos.findUnique({
    where: { id: link.coletaPrecosId },
    select: {
      fornecedores: true,
      cotacoes: {
        where: { idProduto: registro.idProduto },
        select: { idFornecedor: true },
      },
    },
  });
  const idsFornecedor = new Set<number>();
  for (const f of parseFornecedores(coletaForn?.fornecedores ?? null)) {
    if (f.idPessoa > 0) idsFornecedor.add(f.idPessoa);
  }
  for (const c of coletaForn?.cotacoes ?? []) idsFornecedor.add(c.idFornecedor);
  if (!idsFornecedor.has(idFornecedor)) {
    return falha('Este fornecedor não faz parte da coleta.', registroId);
  }

  let qtde: number | null = null;
  if (modo === 'solicitada') {
    let obj: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(registro.dados || '{}') as unknown;
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
    qtde = parseQtdeInformada(campoJson(obj, /qtd\s*liberada/i));
    if (qtde == null) return falha('Este item não tem quantidade solicitada.', registroId);
  } else {
    qtde = parseQtdeInformada(body.qtde);
    if (qtde == null) return falha('Informe a quantidade a aprovar.', registroId);
  }

  const agora = new Date();
  await prisma.$transaction([
    prisma.coletaPrecosRegistro.update({
      where: { id: registroId },
      data: {
        qtdeAprovada: qtde,
        idFornecedorVencedor: idFornecedor,
        dados: dadosComRejeicao(registro.dados, false),
      },
    }),
    prisma.coletaPrecos.update({
      where: { id: link.coletaPrecosId },
      data: { dataUltimaMovimentacao: agora },
    }),
  ]);
  const retrato = await montarRetrato(link.coletaPrecosId);
  await prisma.coletaPrecosAprovacaoLink.update({
    where: { id: link.id },
    data: { retratoJson: JSON.stringify(retrato) },
  });

  return { redirect: `/a/${encodeURIComponent(tokenLimpo)}#item-${registroId}` };
}
