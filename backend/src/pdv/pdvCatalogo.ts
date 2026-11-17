import { queryNomus } from '../config/nomusDb.js';
import { prisma } from '../config/prisma.js';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca.js';
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
  // A REST do Nomus devolve o id em `codigo` (não em `id`).
  return comoLista<Record<string, unknown>>(await nomusRest('/tiposMovimentacao'))
    .map((row) => ({
      id: Number(row.id ?? row.codigo),
      nome: nomeDe(row) || `#${row.id ?? row.codigo}`,
      extra: row,
    }))
    .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.extra?.ativo !== false);
}

/** Tipos ativos permitidos/úteis para proposta e pedido de venda no PDV. */
export async function listarTiposMovimentacaoProposta(idPadrao?: number | null): Promise<NomusRef[]> {
  try {
    const [rows] = await queryNomus<
      Array<{ id: number; nome: string; natureza: number | null }>
    >(
      `SELECT id, nome, natureza
       FROM tipomovimentacao
       WHERE ativo = 1
         AND (
           natureza IN (1, 2)
           OR id = ?
           OR permitirTipoMovimentacaoCriacaoEdicaoPropostasEPedidoVenda = 1
         )
       ORDER BY nome`,
      [Number(idPadrao) || 0],
    );
    const lista = (Array.isArray(rows) ? rows : [])
      .map((row) => ({ id: Number(row.id), nome: String(row.nome ?? '').trim() || `#${row.id}` }))
      .filter((row) => row.id > 0 && row.nome);
    if (lista.length) return lista;
  } catch {
    /* fallback REST */
  }
  const todos = await listarTiposMovimentacao();
  const filtrados = todos.filter((t) => {
    const nome = t.nome.toUpperCase();
    const natureza = Number(t.extra?.natureza);
    return (
      t.id === idPadrao ||
      natureza === 1 ||
      natureza === 2 ||
      nome.includes('VENDA') ||
      nome.includes('FATURAMENTO')
    );
  });
  return filtrados.length ? filtrados : todos;
}

export type ContatoPdv = { id: number; nome: string; email: string; telefone: string };

export async function listarContatosCliente(idCliente: number): Promise<ContatoPdv[]> {
  if (!idCliente) return [];
  try {
    const data = await nomusRest(`/pessoas/${idCliente}/contatos`, { cacheMs: 0 });
    return comoLista<Record<string, unknown>>(data)
      .filter((row) => row.ativo !== false)
      .map((row) => ({
        id: Number(row.id),
        nome: String(row.nomeCompleto ?? row.nome ?? '').trim() || `Contato #${row.id}`,
        email: String(row.email_1 ?? row.email ?? '').trim(),
        telefone: String(row.telefone_1 ?? row.telefone ?? row.celular ?? '').trim(),
      }))
      .filter((c) => c.id > 0);
  } catch {
    const [rows] = await queryNomus<Array<{ id: number; nome: string; email: string | null }>>(
      `SELECT c.id, COALESCE(NULLIF(TRIM(c.nomeCompleto), ''), NULLIF(TRIM(c.nome), ''), CONCAT('Contato #', c.id)) AS nome,
              COALESCE(c.email_1, '') AS email
       FROM pessoa_contato pc
       INNER JOIN contato c ON c.id = pc.idContato
       WHERE pc.idParceiro = ?
       ORDER BY c.id`,
      [idCliente],
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: Number(row.id),
      nome: String(row.nome ?? '').trim() || `Contato #${row.id}`,
      email: String(row.email ?? '').trim(),
      telefone: '',
    }));
  }
}

export type EnderecoPdv = {
  id: number;
  rotulo: string;
  tipoEndereco: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

function rotuloEndereco(row: Record<string, unknown>): string {
  const tipo = String(row.tipoEndereco ?? '').trim();
  const end = [row.endereco, row.numero, row.bairro, row.municipio, row.uf]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return [tipo, end].filter(Boolean).join(' · ') || `Endereço #${row.id}`;
}

export async function listarEnderecosCliente(idCliente: number): Promise<EnderecoPdv[]> {
  if (!idCliente) return [];
  const cliente = await nomusRest<Record<string, unknown>>(`/clientes/${idCliente}`, { cacheMs: 30_000 });
  const lista = comoLista<Record<string, unknown>>(cliente.enderecos);
  return lista
    .map((row) => ({
      id: Number(row.id),
      rotulo: rotuloEndereco(row),
      tipoEndereco: String(row.tipoEndereco ?? '').trim(),
      endereco: String(row.endereco ?? '').trim(),
      numero: String(row.numero ?? '').trim(),
      bairro: String(row.bairro ?? '').trim(),
      municipio: String(row.municipio ?? '').trim(),
      uf: String(row.uf ?? '').trim(),
      cep: String(row.cep ?? '').trim(),
    }))
    .filter((e) => e.id > 0);
}

export type AtributoPropostaPdv = {
  nome: string;
  obrigatorio: boolean;
  formato: 'texto' | 'data' | 'lista';
  opcoes: string[];
  /** cabecalho = IPROP/LPROP; item = LIPROP/IIPROP (vai em cada item da proposta). */
  escopo: 'cabecalho' | 'item';
};

/** Atributos de proposta: cabeçalho (IPROP/LPROP) e de item (LIPROP/IIPROP). */
export async function listarAtributosProposta(): Promise<AtributoPropostaPdv[]> {
  const [attrs] = await queryNomus<
    Array<{ id: number; nome: string; formato: number; obrigatorio: number; discriminador: string }>
  >(
    `SELECT id, nome, formato, obrigatorio, discriminador
     FROM atributo
     WHERE ativo = 1 AND discriminador IN ('IPROP', 'LPROP', 'LIPROP', 'IIPROP')
     ORDER BY
       CASE discriminador
         WHEN 'IPROP' THEN 1
         WHEN 'LPROP' THEN 2
         WHEN 'IIPROP' THEN 3
         WHEN 'LIPROP' THEN 4
         ELSE 9
       END,
       CASE nome
         WHEN 'Data de entrega' THEN 1
         WHEN 'Método de entrega' THEN 2
         WHEN 'Montagem' THEN 3
         WHEN 'Primeiro contato efetivado através de:' THEN 4
         WHEN 'Projeto' THEN 5
         WHEN 'Tipo de venda' THEN 6
         WHEN 'FRETE' THEN 7
         WHEN 'Produto Montado ?' THEN 8
         ELSE 99
       END,
       nome`,
  );
  const lista = Array.isArray(attrs) ? attrs : [];
  if (!lista.length) return [];
  const ids = lista.map((a) => a.id);
  const [ops] = await queryNomus<Array<{ idAtributo: number; opcao: string }>>(
    `SELECT idAtributo, opcao
     FROM atributolistaopcao
     WHERE idAtributo IN (${ids.map(() => '?').join(',')})
       AND (ativo IS NULL OR ativo = 1)
     ORDER BY idAtributo, posicao, opcao`,
    ids,
  );
  const porAtributo = new Map<number, string[]>();
  for (const op of Array.isArray(ops) ? ops : []) {
    const id = Number(op.idAtributo);
    const valor = String(op.opcao ?? '').trim();
    if (!id || !valor) continue;
    const arr = porAtributo.get(id) ?? [];
    if (!arr.includes(valor)) arr.push(valor);
    porAtributo.set(id, arr);
  }
  return lista.map((a) => {
    const formatoNum = Number(a.formato);
    const formato: AtributoPropostaPdv['formato'] =
      formatoNum === 3 ? 'data' : formatoNum === 4 || (porAtributo.get(a.id)?.length ?? 0) > 0 ? 'lista' : 'texto';
    const disc = String(a.discriminador || '').toUpperCase();
    const escopo: AtributoPropostaPdv['escopo'] =
      disc === 'LIPROP' || disc === 'IIPROP' ? 'item' : 'cabecalho';
    return {
      nome: String(a.nome),
      obrigatorio: Boolean(a.obrigatorio),
      formato,
      opcoes: porAtributo.get(a.id) ?? [],
      escopo,
    };
  });
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

export type BuscaProdutosPdv = {
  produtos: ProdutoPdv[];
  pagina: number;
  tamanho: number;
  temMais: boolean;
};

/** Nomus RSQL quebra com espaço dentro do valor (`*SM 00852*` → 400). Usa tokens sem espaço. */
function montarQueryProdutosNomus(termo: string): string | null {
  const tokens = termo
    .trim()
    .split(/[\s/\\|_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);
  if (tokens.length === 0) return null;
  // Preferir o token mais específico (mais longo) primeiro; AND entre tokens no nome.
  const ordenados = [...tokens].sort((a, b) => b.length - a.length);
  if (ordenados.length === 1) {
    const t = ordenados[0];
    return `nome==*${t}*,codigo==*${t}*`;
  }
  const andNome = ordenados.map((t) => `nome==*${t}*`).join(';');
  const andCodigo = ordenados.map((t) => `codigo==*${t}*`).join(';');
  // Também OR só no token mais longo (ex.: 00852) para não perder cadastro.
  const principal = ordenados[0];
  return `${andNome},${andCodigo},nome==*${principal}*,codigo==*${principal}*`;
}

export async function buscarProdutos(
  q: string,
  idEmpresa: number,
  opts?: { pagina?: number; tamanho?: number },
): Promise<BuscaProdutosPdv> {
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa } });
  if (!config?.idTabelaPreco || !config.idSetorSaida) {
    throw Object.assign(new Error('Configure a tabela de preço e o setor de saída desta empresa.'), { status: 409 });
  }
  const pagina = Math.max(1, Math.floor(Number(opts?.pagina) || 1));
  const tamanho = Math.min(48, Math.max(12, Math.floor(Number(opts?.tamanho) || 24)));
  const termo = q.trim();
  const rsql = termo ? montarQueryProdutosNomus(termo) : null;
  const query = rsql
    ? `?query=${encodeURIComponent(rsql)}&pagina=${pagina}&tamanhoPagina=${tamanho}`
    : `?pagina=${pagina}&tamanhoPagina=${tamanho}`;

  let rowsBrutos: Record<string, unknown>[] = [];
  try {
    rowsBrutos = comoLista(await nomusRest(`/produtos${query}`, { cacheMs: termo ? 0 : 60_000 }));
  } catch (err) {
    // Fallback: token principal sem espaços (ex.: 00852) se a query composta falhar.
    if (termo) {
      const tokens = termo.split(/[\s/\\|_-]+/).filter((t) => t.trim().length >= 2);
      const principal = [...tokens].sort((a, b) => b.length - a.length)[0];
      if (principal) {
        try {
          const fb = `?query=${encodeURIComponent(`nome==*${principal}*,codigo==*${principal}*`)}&pagina=${pagina}&tamanhoPagina=${tamanho}`;
          rowsBrutos = comoLista(await nomusRest(`/produtos${fb}`, { cacheMs: 0 }));
        } catch {
          const detalhe = err instanceof Error ? err.message : 'Falha ao consultar produtos.';
          throw Object.assign(new Error(`Não foi possível consultar os produtos no Nomus. ${detalhe}`), { status: 502 });
        }
      } else {
        const detalhe = err instanceof Error ? err.message : 'Falha ao consultar produtos.';
        throw Object.assign(new Error(`Não foi possível consultar os produtos no Nomus. ${detalhe}`), { status: 502 });
      }
    } else {
      const detalhe = err instanceof Error ? err.message : 'Falha ao consultar produtos.';
      throw Object.assign(new Error(`Não foi possível consultar os produtos no Nomus. ${detalhe}`), { status: 502 });
    }
  }

  const match = criarMatcherTextoLivre(termo);
  let rows = rowsBrutos;
  if (termo) {
    rows = rows.filter((row) => {
      const blob = `${row.codigo ?? ''} ${row.nome ?? ''} ${row.descricao ?? ''} ${row.codigoGTIN ?? ''}`;
      return match(blob);
    });
  }
  const { itens, descontoMaximo } = await precosDaTabela(config.idTabelaPreco);
  const daEmpresa = rows.filter((row) => {
    const setores = row.empresasSetoresEstoque;
    if (!Array.isArray(setores) || setores.length === 0) return true;
    return setores.some((s) => Number((s as { idEmpresa?: number }).idEmpresa) === idEmpresa);
  });

  const produtos: ProdutoPdv[] = [];
  for (const row of daEmpresa) {
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
  return {
    produtos,
    pagina,
    tamanho,
    temMais: rowsBrutos.length >= tamanho,
  };
}

export async function buscarClientes(q: string): Promise<NomusRef[]> {
  const termo = q.trim();
  const tokens = termo.split(/[\s/\\|_-]+/).filter((t) => t.trim().length >= 1);
  const principal = [...tokens].sort((a, b) => b.length - a.length)[0];
  const path = principal
    ? `/clientes?query=${encodeURIComponent(`nome==*${principal}*,razaoSocial==*${principal}*,cpf==*${principal}*,cnpj==*${principal}*`)}&pagina=1&tamanhoPagina=20`
    : '/clientes?pagina=1&tamanhoPagina=20';
  try {
    const lista = refs(await nomusRest(path, { cacheMs: 0 }));
    if (!termo) return lista.slice(0, 20);
    const match = criarMatcherTextoLivre(termo);
    return lista.filter((c) => match(c.nome) || match(String(c.extra?.cpf ?? '')) || match(String(c.extra?.cnpj ?? ''))).slice(0, 20);
  } catch {
    const all = refs(await nomusRest('/clientes?pagina=1&tamanhoPagina=50'));
    if (!termo) return all.slice(0, 20);
    const match = criarMatcherTextoLivre(termo);
    return all.filter((c) => match(c.nome)).slice(0, 20);
  }
}

export type CadastroClientePdv = {
  tipoPessoa: 1 | 2;
  nome: string;
  razaoSocial?: string;
  cpf?: string;
  cnpj?: string;
  tipoContribuinteICMS: 1 | 2 | 3;
  inscricaoEstadual?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
};

export async function criarCliente(input: CadastroClientePdv): Promise<NomusRef> {
  const nome = String(input.nome ?? '').trim();
  if (!nome) throw Object.assign(new Error('Informe o nome do cliente.'), { status: 400 });
  const tipoPessoa = input.tipoPessoa === 1 ? 1 : 2;
  const tipoContribuinteICMS = [1, 2, 3].includes(Number(input.tipoContribuinteICMS))
    ? Number(input.tipoContribuinteICMS)
    : 3;
  const razaoSocial = String(input.razaoSocial ?? nome).trim() || nome;
  const cpf = String(input.cpf ?? '').trim();
  const cnpj = String(input.cnpj ?? '').trim();
  if (tipoPessoa === 2 && !cpf) {
    throw Object.assign(new Error('Informe o CPF do cliente.'), { status: 400 });
  }
  if (tipoPessoa === 1 && !cnpj) {
    throw Object.assign(new Error('Informe o CNPJ do cliente.'), { status: 400 });
  }

  const body: Record<string, unknown> = {
    ativo: true,
    nome,
    razaoSocial,
    tipoPessoa,
    tipoContribuinteICMS,
    email: String(input.email ?? '').trim() || undefined,
    telefone: String(input.telefone ?? '').trim() || undefined,
    cep: String(input.cep ?? '').trim() || undefined,
    endereco: String(input.endereco ?? '').trim() || undefined,
    numero: String(input.numero ?? '').trim() || undefined,
    bairro: String(input.bairro ?? '').trim() || undefined,
    municipio: String(input.municipio ?? '').trim() || undefined,
    uf: String(input.uf ?? '').trim().toUpperCase() || undefined,
    inscricaoEstadual: String(input.inscricaoEstadual ?? '').trim() || undefined,
  };
  if (tipoPessoa === 2) body.cpf = cpf;
  else body.cnpj = cnpj;

  try {
    const criado = await nomusRest<Record<string, unknown>>('/clientes', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify(body),
    });
    const id = Number(criado.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('Nomus não retornou o id do cliente.');
    }
    return { id, nome: String(criado.nome ?? nome), extra: criado };
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : 'Falha ao cadastrar cliente.';
    throw Object.assign(new Error(detalhe), { status: 502 });
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
