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

function itemLabel(idx: number): string {
  return String(idx + 1).padStart(2, '0');
}

export type ItemNomusPdv = {
  idProduto: number;
  quantidade: number;
  valorUnitario: number;
  descontoPercentual: number;
  idUnidadeMedida: number | null;
  idItemProposta?: number | null;
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

export async function resolverContatoCliente(idCliente: number, nomeFallback: string): Promise<number> {
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

export async function criarPropostaNomus(input: {
  config: ConfigNomusPdv;
  idCliente: number;
  clienteNome: string;
  observacao: string;
  itens: ItemNomusPdv[];
  idFormaPagamento: number | null;
}): Promise<number> {
  const { config } = input;
  if (!config.idCondicaoPagamento) {
    throw new PdvErro('Configure a condição de pagamento desta empresa para gerar orçamento.', 409);
  }
  const idContato = await resolverContatoCliente(input.idCliente, input.clienteNome);
  const data = hojeBr();
  const body = {
    idEmpresa: config.idEmpresa,
    idCliente: input.idCliente,
    idContato,
    idTipoMovimentacao: config.idTipoMovimentacao,
    idCondicaoPagamento: config.idCondicaoPagamento,
    idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
    idVendedor: config.idPessoaVendedor,
    idTabelaPreco: config.idTabelaPreco,
    dataHoraAbertura: data,
    dataEmissao: data,
    dataValidade: maisDiasBr(30),
    observacao: input.observacao,
    itensProposta: input.itens.map((item, idx) => ({
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
      idTipoMovimentacao: config.idTipoMovimentacao,
    })),
  };

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
}): Promise<number> {
  const { config } = input;
  if (!config.idTipoPedido) {
    throw new PdvErro('Configure o tipo de pedido desta empresa para emitir pedido.', 409);
  }
  const data = hojeBr();
  const body = {
    dataEmissao: data,
    idCondicaoPagamento: config.idCondicaoPagamento,
    idEmpresa: config.idEmpresa,
    idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
    idPessoaCliente: input.idCliente,
    idPessoaVendedor: config.idPessoaVendedor,
    idTipoMovimentacao: config.idTipoMovimentacao,
    idTipoPedido: config.idTipoPedido,
    idTabelaPreco: config.idTabelaPreco,
    observacoes: input.observacao,
    idSetorSaida: config.idSetorSaida,
    itensPedido: input.itens.map((item, idx) => ({
      item: itemLabel(idx),
      idProduto: item.idProduto,
      idSetorSaida: config.idSetorSaida,
      idTabelaPreco: config.idTabelaPreco,
      idTipoMovimentacao: config.idTipoMovimentacao,
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
}): Promise<number> {
  const { config } = input;
  try {
    const doc = await nomusRest<Record<string, unknown>>('/documentosSaida', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify({
        numero: input.numero,
        idEmpresa: config.idEmpresa,
        idPessoa: input.idCliente,
        idTipoMovimentacao: config.idTipoMovimentacao,
        idSetorSaida: config.idSetorSaida,
        idTabelaPreco: config.idTabelaPreco,
        observacoes: input.observacao,
        idCondicaoPagamento: config.idCondicaoPagamento,
        idFormaPagamento: input.idFormaPagamento || config.idFormaPagamento,
        geraContaReceber: true,
        idContaBancariaContaReceber: config.idContaBancaria,
        itens: input.itens.map((item) => ({
          idProduto: item.idProduto,
          idTipoMovimentacao: config.idTipoMovimentacao,
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
