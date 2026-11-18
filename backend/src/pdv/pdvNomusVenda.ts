/**
 * Gravação de pedido/proposta do PDV no Nomus REST.
 */
import { queryNomus } from '../config/nomusDb.js';
import { idDe, nomusRest } from './nomusRest.js';
import { PdvErro } from './pdvErro.js';

export type ModoOperacaoPdv = 'pedido' | 'orcamento' | 'ambos';
export type DestinoVendaPdv = 'pedido' | 'orcamento';

export function normalizarModoOperacao(v: unknown): ModoOperacaoPdv {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'orcamento' || s === 'ambos') return s;
  return 'pedido';
}

export function normalizarDestino(v: unknown): DestinoVendaPdv {
  return String(v ?? '').trim().toLowerCase() === 'orcamento' ? 'orcamento' : 'pedido';
}

export function destinoPermitido(modo: ModoOperacaoPdv, destino: DestinoVendaPdv): boolean {
  if (modo === 'ambos') return true;
  if (modo === 'orcamento') return destino === 'orcamento';
  return destino === 'pedido';
}

function hojeBr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function maisDiasBr(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Aceita YYYY-MM-DD ou DD/MM/YYYY e devolve DD/MM/YYYY. */
export function normalizarDataBr(v: unknown, fallback?: string): string {
  const raw = String(v ?? '').trim();
  if (!raw) return fallback || maisDiasBr(30);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return fallback || maisDiasBr(30);
}

function itemLabel(idx: number): string {
  return String(idx + 1).padStart(2, '0');
}

export type AtributoPropostaValor = { nomeAtributo: string; valorAtributo: string };

export type ItemNomusPdv = {
  idProduto: number;
  quantidade: number;
  valorUnitario: number;
  descontoPercentual: number;
  idUnidadeMedida: number | null;
  idItemProposta?: number | null;
  atributosItem?: AtributoPropostaValor[];
};

export type ConfigNomusPdv = {
  idEmpresa: number;
  idTabelaPreco: number;
  idTipoMovimentacao: number;
  idTipoPedido: number | null;
  idSetorSaida: number;
  idCondicaoPagamento: number | null;
  idFormaPagamento: number | null;
  idContaBancaria: number | null;
  idPessoaVendedor: number | null;
};

export type DadosPropostaPdv = {
  idContato?: number | null;
  idTipoMovimentacao?: number | null;
  idCondicaoPagamento?: number | null;
  idFormaPagamento?: number | null;
  dataValidade?: string;
  observacao?: string;
  atributos?: AtributoPropostaValor[];
  /** Atributos de item (LIPROP) aplicados a todos os itens da proposta. */
  atributosItem?: AtributoPropostaValor[];
  localRetiradaDifEnderecoRemetente?: boolean;
  idEnderecoLocalRetirada?: number | null;
  localEntregaDifEnderecoDestinatario?: boolean;
  idEnderecoLocalEntrega?: number | null;
};

export async function resolverContatoCliente(
  idCliente: number,
  nomeFallback: string,
  idContatoPreferido?: number | null,
): Promise<number> {
  if (idContatoPreferido && Number.isFinite(idContatoPreferido) && idContatoPreferido > 0) {
    return idContatoPreferido;
  }
  const [rows] = await queryNomus<Array<{ idContato: number }>>(
    `SELECT pc.idContato AS idContato
     FROM pessoa_contato pc
     WHERE pc.idParceiro = ?
     ORDER BY pc.idContato ASC
     LIMIT 1`,
    [idCliente],
  );
  const existente = Number(rows?.[0]?.idContato);
  if (Number.isFinite(existente) && existente > 0) return existente;

  const nome = (nomeFallback || 'Consumidor PDV').trim().slice(0, 120) || 'Consumidor PDV';
  try {
    const criado = await nomusRest<Record<string, unknown>>('/contatos', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify({
        nome,
        nomeCompleto: nome,
        ativo: true,
        pessoas: [{ id: idCliente }],
      }),
    });
    const id = idDe(criado);
    if (id) return id;
  } catch (err) {
    throw new PdvErro(
      err instanceof Error
        ? `Não foi possível criar o contato do cliente no Nomus. ${err.message}`
        : 'Não foi possível criar o contato do cliente no Nomus.',
      502,
    );
  }
  throw new PdvErro('Cliente sem contato no Nomus e a API não devolveu o id do contato criado.', 502);
}

function montarAtributos(attrs: AtributoPropostaValor[] | undefined): AtributoPropostaValor[] {
  return (attrs ?? [])
    .map((a) => ({
      nomeAtributo: String(a.nomeAtributo ?? '').trim(),
      valorAtributo: String(a.valorAtributo ?? '').trim(),
    }))
    .filter((a) => a.nomeAtributo && a.valorAtributo);
}

/** Resolve idAtributo/idListaOpcao no Nomus — atributo de lista de item grava por idListaOpcao. */
async function montarAtributosItemNomus(
  attrs: AtributoPropostaValor[] | undefined,
): Promise<Array<Record<string, unknown>>> {
  const base = montarAtributos(attrs);
  if (!base.length) return [];
  const nomes = [...new Set(base.map((a) => a.nomeAtributo))];
  const [rows] = await queryNomus<
    Array<{ idAtributo: number; nome: string; idListaOpcao: number | null; opcao: string | null }>
  >(
    `SELECT a.id AS idAtributo, a.nome, alo.id AS idListaOpcao, alo.opcao
     FROM atributo a
     LEFT JOIN atributolistaopcao alo ON alo.idAtributo = a.id
     WHERE a.ativo = 1
       AND a.discriminador IN ('LIPROP', 'IIPROP')
       AND a.nome IN (${nomes.map(() => '?').join(',')})`,
    nomes,
  );
  const lista = Array.isArray(rows) ? rows : [];
  return base.map((a) => {
    const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const opcaoNorm = strip(a.valorAtributo);
    const match =
      lista.find((r) => String(r.nome) === a.nomeAtributo && strip(String(r.opcao ?? '')) === opcaoNorm) ||
      lista.find((r) => String(r.nome) === a.nomeAtributo && String(r.opcao ?? '').trim() === a.valorAtributo);
    const out: Record<string, unknown> = {
      nomeAtributo: a.nomeAtributo,
      valorAtributo: a.valorAtributo,
      valor: a.valorAtributo,
    };
    if (match?.idAtributo) out.idAtributo = Number(match.idAtributo);
    if (match?.idListaOpcao) out.idListaOpcao = Number(match.idListaOpcao);
    return out;
  });
}

export async function criarPropostaNomus(input: {
  config: ConfigNomusPdv;
  idCliente: number;
  clienteNome: string;
  observacao: string;
  itens: ItemNomusPdv[];
  idFormaPagamento: number | null;
  proposta?: DadosPropostaPdv;
}): Promise<number> {
  const { config, proposta } = input;
  const idCondicao = proposta?.idCondicaoPagamento || config.idCondicaoPagamento;
  if (!idCondicao) {
    throw new PdvErro('Informe ou configure a condição de pagamento desta empresa para gerar orçamento.', 409);
  }
  const idTipoMov = proposta?.idTipoMovimentacao || config.idTipoMovimentacao;
  if (!idTipoMov) {
    throw new PdvErro('Informe o tipo de movimentação da proposta.', 409);
  }
  const idContato = await resolverContatoCliente(input.idCliente, input.clienteNome, proposta?.idContato);
  const data = hojeBr();
  const dataValidade = normalizarDataBr(proposta?.dataValidade, maisDiasBr(30));
  const observacao = String(proposta?.observacao ?? input.observacao ?? '').trim();
  const atributos = montarAtributos(proposta?.atributos);
  const atributosItemPadrao = montarAtributos(proposta?.atributosItem);

  const itensProposta = [];
  for (let idx = 0; idx < input.itens.length; idx++) {
    const item = input.itens[idx];
    const attrsFonte = item.atributosItem?.length ? item.atributosItem : atributosItemPadrao;
    const attrsDoItem = await montarAtributosItemNomus(attrsFonte);
    if (!attrsDoItem.length) {
      throw new PdvErro(
        `Item ${itemLabel(idx)}: preencha o atributo obrigatório "Produto Montado ?" antes de gravar a proposta.`,
        400,
      );
    }
    const temMontado = attrsDoItem.some(
      (a) => String(a.nomeAtributo) === 'Produto Montado ?' && String(a.valorAtributo || a.valor || '').trim(),
    );
    if (!temMontado) {
      throw new PdvErro(
        `Item ${itemLabel(idx)}: o atributo "Produto Montado ?" é obrigatório (Sim/Não).`,
        400,
      );
    }
    itensProposta.push({
      item: itemLabel(idx),
      idProduto: item.idProduto,
      qtde: String(item.quantidade),
      precoUnitario: String(item.valorUnitario),
      valorUnitario: String(item.valorUnitario),
      percentualDesconto: String(item.descontoPercentual || 0),
      prazoEntregaDias: '1',
      prazoEntrega: '1',
      idUnidadeMedida: item.idUnidadeMedida,
      idTabelaPreco: config.idTabelaPreco,
      idTipoMovimentacao: idTipoMov,
      atributosItemProposta: attrsDoItem,
    });
  }

  const body: Record<string, unknown> = {
    idEmpresa: config.idEmpresa,
    idCliente: input.idCliente,
    idContato,
    idTipoMovimentacao: idTipoMov,
    idCondicaoPagamento: idCondicao,
    idFormaPagamento: proposta?.idFormaPagamento || input.idFormaPagamento || config.idFormaPagamento,
    idVendedor: config.idPessoaVendedor,
    idTabelaPreco: config.idTabelaPreco,
    dataHoraAbertura: data,
    dataEmissao: data,
    dataValidade,
    observacao,
    itensProposta,
  };

  if (atributos.length) body.atributosProposta = atributos;

  if (proposta?.localRetiradaDifEnderecoRemetente && proposta.idEnderecoLocalRetirada) {
    body.localRetiradaDifEnderecoRemetente = true;
    body.idEnderecoLocalRetirada = proposta.idEnderecoLocalRetirada;
  }
  if (proposta?.localEntregaDifEnderecoDestinatario && proposta.idEnderecoLocalEntrega) {
    body.localEntregaDifEnderecoDestinatario = true;
    body.idEnderecoLocalEntrega = proposta.idEnderecoLocalEntrega;
  }

  try {
    const criado = await nomusRest<Record<string, unknown>>('/propostas', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify(body),
    });
    const id = idDe(criado);
    if (!id) throw new Error('Nomus não retornou o id da proposta.');
    return id;
  } catch (err) {
    throw new PdvErro(err instanceof Error ? err.message : 'Falha ao criar a proposta no Nomus.', 502);
  }
}

export async function criarPedidoNomus(input: {
  config: ConfigNomusPdv;
  idCliente: number;
  observacao: string;
  total: number;
  itens: ItemNomusPdv[];
  idFormaPagamento: number | null;
  idTipoMovimentacao?: number | null;
  idCondicaoPagamento?: number | null;
}): Promise<number> {
  const { config } = input;
  if (!config.idTipoPedido) {
    throw new PdvErro('Configure o tipo de pedido desta empresa para emitir pedido.', 409);
  }
  const idTipoMov = input.idTipoMovimentacao || config.idTipoMovimentacao;
  const data = hojeBr();
  const body = {
    dataEmissao: data,
    idCondicaoPagamento: input.idCondicaoPagamento || config.idCondicaoPagamento,
    idEmpresa: config.idEmpresa,
    idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
    idPessoaCliente: input.idCliente,
    idPessoaVendedor: config.idPessoaVendedor,
    idTipoMovimentacao: idTipoMov,
    idTipoPedido: config.idTipoPedido,
    idTabelaPreco: config.idTabelaPreco,
    observacoes: input.observacao,
    idSetorSaida: config.idSetorSaida,
    itensPedido: input.itens.map((item, idx) => ({
      item: itemLabel(idx),
      idProduto: item.idProduto,
      idSetorSaida: config.idSetorSaida,
      idTabelaPreco: config.idTabelaPreco,
      idTipoMovimentacao: idTipoMov,
      idUnidadeMedida: item.idUnidadeMedida,
      idItemProposta: item.idItemProposta || undefined,
      percentualDesconto: String(item.descontoPercentual || 0),
      quantidade: String(item.quantidade),
      status: 4,
      valorDesconto: '0',
      valorUnitario: String(item.valorUnitario),
      dataEntrega: data,
    })),
    parcelas: [
      {
        dataVencimento: data,
        geraAdiantamento: false,
        valorParcela: input.total.toFixed(2).replace('.', ','),
        idContaBancaria: config.idContaBancaria,
        idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
      },
    ],
  };

  try {
    const criado = await nomusRest<Record<string, unknown>>('/pedidos', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify(body),
    });
    const id = idDe(criado);
    if (!id) throw new Error('Nomus não retornou o id do pedido.');
    return id;
  } catch (err) {
    throw new PdvErro(err instanceof Error ? err.message : 'Falha ao criar o pedido no Nomus.', 502);
  }
}

export async function criarDocumentoSaidaNomus(input: {
  config: ConfigNomusPdv;
  idCliente: number;
  observacao: string;
  numero: string;
  itens: ItemNomusPdv[];
  idFormaPagamento: number | null;
  idTipoMovimentacao?: number | null;
}): Promise<number> {
  const { config } = input;
  const idTipoMov = input.idTipoMovimentacao || config.idTipoMovimentacao;
  try {
    const doc = await nomusRest<Record<string, unknown>>('/documentosSaida', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify({
        numero: input.numero,
        idEmpresa: config.idEmpresa,
        idPessoa: input.idCliente,
        idTipoMovimentacao: idTipoMov,
        idSetorSaida: config.idSetorSaida,
        idTabelaPreco: config.idTabelaPreco,
        observacoes: input.observacao,
        idCondicaoPagamento: config.idCondicaoPagamento,
        idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
        geraContaReceber: true,
        idContaBancariaContaReceber: config.idContaBancaria,
        itens: input.itens.map((item) => ({
          idProduto: item.idProduto,
          idTipoMovimentacao: idTipoMov,
          idUnidadeMedida: item.idUnidadeMedida,
          idSetorSaida: config.idSetorSaida,
          idTabelaPreco: config.idTabelaPreco,
          quantidade: String(item.quantidade),
          valorUnitario: String(item.valorUnitario),
          tipoDesconto: 'percentual',
          porcentagemDesconto: String(item.descontoPercentual || 0),
        })),
      }),
    });
    const id = idDe(doc);
    if (!id) throw new Error('Nomus não retornou o id do documento de saída.');
    return id;
  } catch (err) {
    throw new PdvErro(err instanceof Error ? err.message : 'Falha ao criar o documento de saída no Nomus.', 502);
  }
}

function parseNumeroNomus(v: unknown): number {
  const s = String(v ?? '')
    .replace(/\s+por\s+.*/i, '')
    .trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  if (s.includes(',')) return Number(s.replace(',', '.')) || 0;
  return Number(s) || 0;
}

export async function itensPropostaNomus(idProposta: number): Promise<ItemNomusPdv[]> {
  const prop = await nomusRest<Record<string, unknown>>(`/propostas/${idProposta}`, { cacheMs: 0 });
  const itens = Array.isArray(prop.itensProposta) ? (prop.itensProposta as Record<string, unknown>[]) : [];
  return itens
    .map((row) => ({
      idProduto: Number(row.idProduto),
      quantidade: parseNumeroNomus(row.qtde ?? row.quantidade),
      valorUnitario: parseNumeroNomus(row.precoUnitario ?? row.valorUnitario) || parseNumeroNomus(row.valorTotal),
      descontoPercentual: parseNumeroNomus(row.percentualDesconto),
      idUnidadeMedida: Number(row.idUnidadeMedida) || null,
      idItemProposta: Number(row.id) || null,
    }))
    .filter((item) => item.idProduto > 0 && item.quantidade > 0);
}

export async function obterPropostaNomus(idProposta: number): Promise<Record<string, unknown>> {
  return nomusRest<Record<string, unknown>>(`/propostas/${idProposta}`, { cacheMs: 0 });
}
