import { queryNomus } from '../config/nomusDb.js';
import { prisma } from '../config/prisma.js';
import { comoLista, nomusRest } from './nomusRest.js';
import { saldoDisponivel } from './pdvEstoque.js';

export type NomusRef = { id: number; nome: string; extra?: Record<string, unknown> };

function nomeDe(row: Record<string, unknown>): string {
  return String(row.nome ?? row.descricao ?? row.nomeFantasia ?? row.codigo ?? '').trim();
}

function refs(data: unknown): NomusRef[] {
  return comoLista<Record<string, unknown>>(data)
    .map((row) => ({
      id: Number(row.id),
      nome: nomeDe(row) || `#${row.id}`,
      extra: row,
    }))
    .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.extra?.ativo !== false && r.extra?.ignorarEmpresa !== true);
}

export async function listarEmpresas(): Promise<NomusRef[]> {
  return refs(await nomusRest('/empresas'));
}

export async function listarTabelasPreco(idEmpresa: number): Promise<NomusRef[]> {
  if (!idEmpresa) return [];
  // opcaoEmpresa 0 = qualquer empresa; 1 = só as empresas marcadas na regra da tabela.
  const [rows] = await queryNomus<Array<{ id: number; nome: string }>>(
    `SELECT t.id, t.nome
     FROM tabelapreco t
     WHERE t.ativo = 1
       AND (
         t.opcaoEmpresa = 0
         OR EXISTS (
           SELECT 1 FROM inputtabelapreco i
           WHERE i.idTabelaPreco = t.id
             AND i.discriminador = 'Empresa'
             AND i.idEntidade = ?
         )
       )
     ORDER BY t.nome`,
    [idEmpresa]
  );
  return rows
    .map((row) => ({ id: Number(row.id), nome: String(row.nome ?? '').trim() || `#${row.id}` }))
    .filter((row) => row.id > 0);
}

export async function listarFormas(): Promise<NomusRef[]> {
  return refs(await nomusRest('/formasPagamento'));
}

export async function listarCondicoes(): Promise<NomusRef[]> {
  return refs(await nomusRest('/condicoesPagamentos'));
}

export async function listarTiposMovimentacao(): Promise<NomusRef[]> {
  return refs(await nomusRest('/tiposMovimentacao'));
}

export async function listarSetores(idEmpresa: number): Promise<NomusRef[]> {
  const all = refs(await nomusRest('/setorEstoque'));
  const daEmpresa = all.filter((s) => Number(s.extra?.idEmpresa) === idEmpresa);
  return daEmpresa.length > 0 ? daEmpresa : all;
}

type PrecoItem = { idProduto: number; preco: number; descontoMaximo: number };

const precosCache = new Map<number, { at: number; itens: PrecoItem[]; descontoMaximo: number }>();

function parsePreco(v: unknown): number {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  if (s.includes(',')) return Number(s.replace(',', '.')) || 0;
  return Number(s) || 0;
}

export async function precosDaTabela(idTabela: number): Promise<{ itens: Map<number, number>; descontoMaximo: number }> {
  const hit = precosCache.get(idTabela);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) {
    return { itens: new Map(hit.itens.map((i) => [i.idProduto, i.preco])), descontoMaximo: hit.descontoMaximo };
  }
  const data = await nomusRest<Record<string, unknown>>(`/tabelasPreco/${idTabela}/itens`, { cacheMs: 0 });
  const linhas = comoLista<Record<string, unknown>>(data.itensTabelaPreco ?? data);
  const descontoItens = linhas.reduce((max, row) => Math.max(max, parsePreco(row.percentualDescontoMaximo)), 0);
  const descontoMaximo = parsePreco(data.percentualDescontoMaximo) || descontoItens;
  const itens = linhas.map((row) => ({
    idProduto: Number(row.idProduto),
    preco: parsePreco(row.preco),
    descontoMaximo,
  }));
  precosCache.set(idTabela, { at: Date.now(), itens, descontoMaximo });
  return { itens: new Map(itens.map((i) => [i.idProduto, i.preco])), descontoMaximo };
}

export type ProdutoPdv = {
  id: number;
  codigo: string;
  descricao: string;
  ncm: string;
  origem: string;
  gtin: string;
  idUnidadeMedida: number | null;
  sigla: string;
  preco: number;
  descontoMaximo: number;
  saldo: number;
  vinculado: boolean;
};

export async function buscarProdutos(q: string, idEmpresa: number): Promise<ProdutoPdv[]> {
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa } });
  if (!config?.idTabelaPreco || !config.idSetorSaida) {
    throw Object.assign(new Error('Configure a tabela de preço e o setor de saída desta empresa.'), { status: 409 });
  }
  const termo = q.trim();
  const query = termo
    ? `?query=${encodeURIComponent(`nome==*${termo}*,codigo==*${termo}*`)}&pagina=1&tamanhoPagina=40`
    : '?pagina=1&tamanhoPagina=40';
  let rows: Record<string, unknown>[] = [];
  try {
    rows = comoLista(await nomusRest(`/produtos${query}`, { cacheMs: termo ? 0 : 60_000 }));
  } catch (err) {
    try {
      rows = comoLista(await nomusRest('/produtos?pagina=1&tamanhoPagina=80', { cacheMs: 60_000 }));
    } catch {
      const detalhe = err instanceof Error ? err.message : 'Falha ao consultar produtos.';
      throw Object.assign(new Error(`Não foi possível consultar os produtos no Nomus. ${detalhe}`), { status: 502 });
    }
  }
  const needle = termo.toLowerCase();
  if (needle) {
    rows = rows.filter((row) => {
      const blob = `${row.codigo ?? ''} ${row.nome ?? ''} ${row.descricao ?? ''} ${row.codigoGTIN ?? ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }
  const { itens, descontoMaximo } = await precosDaTabela(config.idTabelaPreco);
  const daEmpresa = rows.filter((row) => {
    const setores = row.empresasSetoresEstoque;
    if (!Array.isArray(setores) || setores.length === 0) return true;
    return setores.some((s) => Number((s as { idEmpresa?: number }).idEmpresa) === idEmpresa);
  });

  const lista = daEmpresa.slice(0, 30);
  const produtos: ProdutoPdv[] = [];
  for (const row of lista) {
    const id = Number(row.id);
    if (!id) continue;
    const estoque = await saldoDisponivel(id, idEmpresa, config.idSetorSaida);
    produtos.push({
      id,
      codigo: String(row.codigo ?? row.nome ?? ''),
      descricao: String(row.descricao ?? row.nome ?? ''),
      ncm: String(row.ncm ?? ''),
      origem: String(row.origemProdutoPadrao ?? ''),
      gtin: String(row.codigoGTIN ?? ''),
      idUnidadeMedida: Number(row.idUnidadeMedida) || null,
      sigla: String(row.siglaUnidadeMedida ?? ''),
      preco: itens.get(id) ?? 0,
      descontoMaximo,
      saldo: estoque.disponivel,
      vinculado: estoque.vinculado,
    });
  }
  return produtos;
}

export async function buscarClientes(q: string): Promise<NomusRef[]> {
  const termo = q.trim();
  const path = termo
    ? `/clientes?query=${encodeURIComponent(`nome==*${termo}*`)}&pagina=1&tamanhoPagina=20`
    : '/clientes?pagina=1&tamanhoPagina=20';
  try {
    return refs(await nomusRest(path, { cacheMs: 0 })).slice(0, 20);
  } catch {
    const all = refs(await nomusRest('/clientes?pagina=1&tamanhoPagina=50'));
    const needle = termo.toLowerCase();
    return all.filter((c) => !needle || c.nome.toLowerCase().includes(needle)).slice(0, 20);
  }
}

async function registroNomus(path: string, id: number): Promise<NomusRef | null> {
  if (!id) return null;
  try {
    const row = await nomusRest<Record<string, unknown>>(`${path}/${id}`, { cacheMs: 60_000 });
    const nome = path.includes('contasBancarias') ? nomeConta(row) : nomeDe(row);
    return nome ? { id, nome } : null;
  } catch {
    return null;
  }
}

function nomeConta(row: Record<string, unknown>): string {
  const conta = String(row.contaBancaria ?? '').trim();
  const banco = String(row.nomeBanco ?? '').trim();
  return [conta, banco].filter(Boolean).join(' · ');
}

function combina(nome: string, termo: string): boolean {
  return !termo || nome.toLowerCase().includes(termo.toLowerCase());
}

export async function listarTiposPedido(q = ''): Promise<NomusRef[]> {
  const [rows] = await queryNomus<Array<{ id: number; nome: string }>>(
    'SELECT id, nome FROM tipopedido WHERE nome IS NOT NULL AND TRIM(nome) <> \'\' ORDER BY nome',
  );
  const termo = q.trim();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({ id: Number(row.id), nome: String(row.nome ?? '').trim() }))
    .filter((row) => row.id > 0 && row.nome && combina(row.nome, termo));
}

export async function listarContasBancarias(q: string, idEmpresa: number): Promise<NomusRef[]> {
  const todas: NomusRef[] = [];
  for (let pagina = 1; pagina <= 6; pagina += 1) {
    const data = await nomusRest(`/contasBancarias?pagina=${pagina}&tamanhoPagina=50`, { cacheMs: 60_000 });
    const lista = comoLista<Record<string, unknown>>(data);
    if (!lista.length) break;
    for (const row of lista) {
      if (row.ativo === false) continue;
      const id = Number(row.id);
      if (!id) continue;
      if (idEmpresa && Number(row.idEmpresa) !== idEmpresa) continue;
      const nome = nomeConta(row);
      if (!nome || !combina(nome, q)) continue;
      todas.push({ id, nome });
    }
    if (lista.length < 40) break;
  }
  return todas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 30);
}

export async function consultarCadastro(
  tipo: string,
  q: string,
  idEmpresa: number,
  id: number,
): Promise<NomusRef[]> {
  const termo = q.trim();
  if (tipo === 'tipoPedido') {
    const lista = await listarTiposPedido(termo);
    if (id && !lista.some((item) => item.id === id)) {
      const atual = (await listarTiposPedido('')).find((item) => item.id === id);
      return atual ? [atual, ...lista] : lista;
    }
    return lista;
  }
  if (tipo === 'conta') {
    const lista = await listarContasBancarias(termo, idEmpresa);
    if (id && !lista.some((item) => item.id === id)) {
      const atual = await registroNomus('/contasBancarias', id);
      return atual ? [atual, ...lista] : lista;
    }
    return lista;
  }
  if (tipo === 'vendedor') {
    const path = termo
      ? `/vendedores?query=${encodeURIComponent(`nome==*${termo}*`)}&pagina=1&tamanhoPagina=20`
      : '/vendedores?pagina=1&tamanhoPagina=30';
    let lista = refs(await nomusRest(path, { cacheMs: termo ? 0 : 60_000 })).slice(0, 20);
    if (termo && lista.length === 0) {
      lista = refs(await nomusRest('/vendedores?pagina=1&tamanhoPagina=50', { cacheMs: 60_000 }))
        .filter((item) => combina(item.nome, termo))
        .slice(0, 20);
    }
    if (id && !lista.some((item) => item.id === id)) {
      const atual = await registroNomus('/vendedores', id);
      return atual ? [atual, ...lista] : lista;
    }
    return lista;
  }
  if (tipo === 'cliente') {
    const lista = await buscarClientes(termo);
    if (id && !lista.some((item) => item.id === id)) {
      const atual = await registroNomus('/clientes', id);
      return atual ? [atual, ...lista] : lista;
    }
    return lista;
  }
  throw Object.assign(new Error('Consulta inválida.'), { status: 400 });
}
