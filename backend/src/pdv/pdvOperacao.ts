import { prisma } from '../config/prisma.js';
import { idDe, nomusRest } from './nomusRest.js';
import { listarFormas, precosDaTabela } from './pdvCatalogo.js';
import { lerTributacaoPedido, saldoDisponivel } from './pdvEstoque.js';
import { abrirPfx, type CertificadoAberto } from './fiscal/certificado.js';
import { emitirNota, type EmitenteNota } from './fiscal/emitir.js';
import { decifrar, decifrarTexto } from './secrets.js';

export class PdvErro extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function hojeBr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function caixaAberto(usuarioId: number, idEmpresa: number) {
  return prisma.pdvCaixa.findFirst({
    where: { usuarioId, idEmpresa, status: 'aberto' },
    include: { movimentos: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function abrirCaixa(usuarioId: number, idEmpresa: number, fundoTroco: number) {
  const existente = await caixaAberto(usuarioId, idEmpresa);
  if (existente) throw new PdvErro('Já existe um caixa aberto para esta empresa.');
  const caixa = await prisma.pdvCaixa.create({
    data: {
      usuarioId,
      idEmpresa,
      fundoTroco: round2(fundoTroco),
      movimentos: { create: { tipo: 'abertura', valor: round2(fundoTroco), observacao: 'Abertura' } },
    },
    include: { movimentos: true },
  });
  return caixa;
}

export async function movimentarCaixa(
  usuarioId: number,
  idEmpresa: number,
  tipo: 'suprimento' | 'sangria',
  valor: number,
  observacao: string,
) {
  const caixa = await caixaAberto(usuarioId, idEmpresa);
  if (!caixa) throw new PdvErro('Abra o caixa antes de lançar movimento.', 409);
  if (valor <= 0) throw new PdvErro('Informe um valor maior que zero.');
  return prisma.pdvCaixaMovimento.create({
    data: { caixaId: caixa.id, tipo, valor: round2(valor), observacao },
  });
}

export async function retomarEspera(idEmpresa: number, vendaId: number) {
  const venda = await prisma.pdvVenda.findFirst({
    where: { id: vendaId, idEmpresa, status: 'espera' },
    include: { itens: true, pagamentos: true },
  });
  if (!venda) throw new PdvErro('Venda em espera não encontrada.', 404);
  await prisma.pdvVenda.update({ where: { id: venda.id }, data: { status: 'cancelada' } });
  return venda;
}

export async function fecharCaixa(usuarioId: number, idEmpresa: number) {
  const caixa = await caixaAberto(usuarioId, idEmpresa);
  if (!caixa) throw new PdvErro('Não há caixa aberto.', 409);
  return prisma.pdvCaixa.update({
    where: { id: caixa.id },
    data: { status: 'fechado', fechadoEm: new Date() },
    include: { movimentos: true, vendas: true },
  });
}

type ItemEntrada = {
  idProduto: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  descontoPercentual: number;
  ncm: string;
  origem: string;
  idUnidadeMedida: number | null;
  aliquotaIpi?: number;
};

type PagamentoEntrada = { idFormaPagamento: number; valor: number };

export async function confirmarVenda(input: {
  usuarioId: number;
  idEmpresa: number;
  itens: ItemEntrada[];
  pagamentos: PagamentoEntrada[];
  idPessoaCliente: number | null;
  clienteNome: string;
  clienteDocumento: string;
  clienteContribuinte: boolean;
  clienteIe: string;
  clienteUf: string;
  observacao: string;
  fiscal: 'nenhuma' | 'nfce' | 'nfe';
  espera: boolean;
}) {
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa: input.idEmpresa } });
  if (!config?.idTabelaPreco || !config.idSetorSaida || !config.idTipoMovimentacao || !config.idTipoPedido) {
    throw new PdvErro('A empresa do PDV ainda não tem tabela, setor, tipo de movimentação e tipo de pedido.', 409);
  }
  if (!input.itens.length) throw new PdvErro('Inclua ao menos um produto.');
  if (!input.espera && (input.fiscal === 'nfce' || input.fiscal === 'nfe')) {
    await garantirCertificado(input.idEmpresa, input.fiscal);
  }
  const caixa = await caixaAberto(input.usuarioId, input.idEmpresa);
  if (!caixa && !input.espera) throw new PdvErro('Abra o caixa para concluir a venda.', 409);

  const { descontoMaximo } = await precosDaTabela(config.idTabelaPreco);
  const descontoMax = descontoMaximo > 0 ? descontoMaximo : 0;
  const idCliente = input.idPessoaCliente || config.idPessoaConsumidor;
  if (!input.espera && !idCliente) {
    throw new PdvErro('Cadastre o cliente consumidor padrão desta empresa.', 409);
  }
  const itensOk = [];
  for (const item of input.itens) {
    item.quantidade = Number(item.quantidade);
    item.valorUnitario = Number(item.valorUnitario);
    item.descontoPercentual = Number(item.descontoPercentual) || 0;
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) throw new PdvErro('Quantidade inválida.');
    if (item.descontoPercentual < 0 || item.descontoPercentual > descontoMax) {
      throw new PdvErro('Desconto acima do permitido pela tabela.');
    }
    const estoque = await saldoDisponivel(item.idProduto, input.idEmpresa, config.idSetorSaida);
    if (!config.ignorarEstoque) {
      if (!estoque.vinculado || estoque.disponivel <= 0) {
        throw new PdvErro(`${item.codigo || item.descricao} está sem estoque nesta empresa.`, 409);
      }
      if (item.quantidade > estoque.disponivel + 0.0001) {
        throw new PdvErro(
          `${item.codigo || item.descricao}: só há ${estoque.disponivel} em estoque nesta empresa.`,
          409,
        );
      }
    }
    itensOk.push({ ...item, saldo: estoque.disponivel });
  }

  const total = round2(
    itensOk.reduce((s, item) => {
      const bruto = item.quantidade * item.valorUnitario;
      return s + bruto * (1 - item.descontoPercentual / 100);
    }, 0),
  );
  const pago = round2(input.pagamentos.reduce((s, p) => s + p.valor, 0));
  if (!input.espera && pago + 0.009 < total) throw new PdvErro('O pagamento não cobre o total da venda.');
  const troco = round2(Math.max(0, pago - total));

  const formas = await listarFormas().catch(() => []);
  const venda = await prisma.pdvVenda.create({
    data: {
      caixaId: caixa?.id,
      usuarioId: input.usuarioId,
      idEmpresa: input.idEmpresa,
      status: input.espera ? 'espera' : 'aberta',
      idPessoaCliente: input.idPessoaCliente,
      clienteNome: input.clienteNome,
      observacao: input.observacao,
      fiscalTipo: input.fiscal,
      total,
      troco,
      itens: {
        create: itensOk.map((item) => ({
          idProduto: item.idProduto,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          descontoPercentual: item.descontoPercentual,
          idTabelaPreco: config.idTabelaPreco,
          ncm: item.ncm,
          origem: item.origem,
          idUnidadeMedida: item.idUnidadeMedida,
          saldo: item.saldo,
        })),
      },
      pagamentos: {
        create: input.pagamentos.map((p) => ({
          idFormaPagamento: p.idFormaPagamento,
          nomeForma: formas.find((f) => f.id === p.idFormaPagamento)?.nome ?? '',
          valor: round2(p.valor),
        })),
      },
    },
    include: { itens: true, pagamentos: true },
  });

  if (!config.ignorarEstoque) {
    for (const item of venda.itens) {
      const estoque = await saldoDisponivel(item.idProduto, input.idEmpresa, config.idSetorSaida, venda.id);
      if (!estoque.vinculado || item.quantidade > estoque.disponivel + 0.0001) {
        await prisma.pdvVenda.update({
          where: { id: venda.id },
          data: { status: 'erro', motivoFiscal: 'Estoque insuficiente na confirmação.' },
        });
        throw new PdvErro(
          `${item.codigo || item.descricao}: só há ${estoque.disponivel} em estoque nesta empresa.`,
          409,
        );
      }
    }
  }

  if (input.espera) return venda;

  const data = hojeBr();
  const pedidoBody = {
    dataEmissao: data,
    idCondicaoPagamento: config.idCondicaoPagamento,
    idEmpresa: input.idEmpresa,
    idFormaPagamento: input.pagamentos[0]?.idFormaPagamento || config.idFormaPagamento,
    idPessoaCliente: idCliente,
    idTipoMovimentacao: config.idTipoMovimentacao,
    idTipoPedido: config.idTipoPedido,
    observacoes: input.observacao,
    idSetorSaida: config.idSetorSaida,
    itensPedido: venda.itens.map((item, idx) => ({
      idProduto: item.idProduto,
      idSetorSaida: config.idSetorSaida,
      idTabelaPreco: config.idTabelaPreco,
      idTipoMovimentacao: config.idTipoMovimentacao,
      idUnidadeMedida: item.idUnidadeMedida,
      item: String(idx + 1),
      percentualDesconto: String(item.descontoPercentual),
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
        valorParcela: total.toFixed(2).replace('.', ','),
        idContaBancaria: config.idContaBancaria,
        idFormaPagamento: input.pagamentos[0]?.idFormaPagamento || config.idFormaPagamento,
      },
    ],
  };

  let idPedido: number | null = null;
  try {
    const criado = await nomusRest<Record<string, unknown>>('/pedidos', {
      method: 'POST',
      body: JSON.stringify(pedidoBody),
      cacheMs: 0,
    });
    idPedido = idDe(criado);
  } catch (err) {
    await prisma.pdvVenda.update({
      where: { id: venda.id },
      data: { status: 'erro', motivoFiscal: err instanceof Error ? err.message : 'Falha ao criar pedido.' },
    });
    throw new PdvErro(err instanceof Error ? err.message : 'Falha ao criar o pedido no Nomus.', 502);
  }

  let aliquotaMedia = 0;
  if (idPedido) {
    try {
      const mapa = await lerTributacaoPedido(idPedido);
      let soma = 0;
      for (const item of venda.itens) {
        const aliq = mapa.get(item.idProduto) ?? 0;
        soma += aliq;
        await prisma.pdvVendaItem.update({ where: { id: item.id }, data: { aliquotaIpi: aliq } });
      }
      aliquotaMedia = venda.itens.length ? soma / venda.itens.length : 0;
    } catch {
      aliquotaMedia = 0;
    }
  }

  let idDocumento: number | null = null;
  try {
    const doc = await nomusRest<Record<string, unknown>>('/documentosSaida', {
      method: 'POST',
      cacheMs: 0,
      body: JSON.stringify({
        numero: `PDV-${venda.id}`,
        idEmpresa: input.idEmpresa,
        idPessoa: idCliente,
        idTipoMovimentacao: config.idTipoMovimentacao,
        idSetorSaida: config.idSetorSaida,
        idTabelaPreco: config.idTabelaPreco,
        observacoes: input.observacao,
        idCondicaoPagamento: config.idCondicaoPagamento,
        idFormaPagamento: input.pagamentos[0]?.idFormaPagamento || config.idFormaPagamento,
        geraContaReceber: true,
        idContaBancariaContaReceber: config.idContaBancaria,
        itens: venda.itens.map((item) => ({
          idProduto: item.idProduto,
          idTipoMovimentacao: config.idTipoMovimentacao,
          idUnidadeMedida: item.idUnidadeMedida,
          idSetorSaida: config.idSetorSaida,
          idTabelaPreco: config.idTabelaPreco,
          quantidade: String(item.quantidade),
          valorUnitario: String(item.valorUnitario),
          tipoDesconto: 'percentual',
          porcentagemDesconto: String(item.descontoPercentual),
        })),
      }),
    });
    idDocumento = idDe(doc);
  } catch (err) {
    await prisma.pdvVenda.update({
      where: { id: venda.id },
      data: {
        status: 'erro',
        idPedidoNomus: idPedido,
        aliquotaIpiMedia: aliquotaMedia,
        motivoFiscal: err instanceof Error ? err.message : 'Pedido criado, documento de saída falhou.',
      },
    });
    throw new PdvErro(
      `Pedido criado no Nomus${idPedido ? ` (${idPedido})` : ''}, mas o documento de saída falhou. ${err instanceof Error ? err.message : ''}`,
      502,
    );
  }

  let fiscal: {
    statusFiscal: string;
    motivoFiscal: string;
    chave: string;
    protocolo: string;
    xmlNota: string;
    qrCode: string;
  } = { statusFiscal: '', motivoFiscal: '', chave: '', protocolo: '', xmlNota: '', qrCode: '' };

  if (input.fiscal === 'nfce' || input.fiscal === 'nfe') {
    try {
      const itensComIpi = await prisma.pdvVendaItem.findMany({ where: { vendaId: venda.id } });
      fiscal = await emitirFiscal({
        idEmpresa: input.idEmpresa,
        modelo: input.fiscal === 'nfce' ? '65' : '55',
        clienteNome: input.clienteNome,
        clienteDocumento: input.clienteDocumento,
        clienteContribuinte: input.clienteContribuinte,
        clienteIe: input.clienteIe,
        clienteUf: input.clienteUf,
        itens: itensComIpi.map((item) => ({
          idProduto: item.idProduto,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          descontoPercentual: item.descontoPercentual,
          ncm: item.ncm,
          origem: item.origem,
          idUnidadeMedida: item.idUnidadeMedida,
          aliquotaIpi: item.aliquotaIpi,
        })),
        pagamentos: input.pagamentos,
        formas,
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'Falha na emissão.';
      await prisma.pdvVenda.update({
        where: { id: venda.id },
        data: {
          status: 'concluida',
          concluidaEm: new Date(),
          idPedidoNomus: idPedido,
          idDocumentoNomus: idDocumento,
          aliquotaIpiMedia: aliquotaMedia,
          statusFiscal: 'rejeitada',
          motivoFiscal: motivo,
        },
      });
      throw new PdvErro(
        `${motivo} Pedido e documento de saída já foram gravados no Nomus${idPedido ? ` (pedido ${idPedido})` : ''}.`,
        err instanceof PdvErro ? err.status : 502,
      );
    }
  }

  if (caixa) {
    await prisma.pdvCaixaMovimento.create({
      data: { caixaId: caixa.id, tipo: 'venda', valor: total, observacao: `Venda ${venda.id}` },
    });
  }

  return prisma.pdvVenda.update({
    where: { id: venda.id },
    data: {
      status: 'concluida',
      concluidaEm: new Date(),
      idPedidoNomus: idPedido,
      idDocumentoNomus: idDocumento,
      aliquotaIpiMedia: aliquotaMedia,
      ...fiscal,
    },
    include: { itens: true, pagamentos: true },
  });
}

async function garantirCertificado(idEmpresa: number, fiscal: 'nfce' | 'nfe') {
  const cert = await prisma.pdvCertificado.findUnique({ where: { idEmpresa } });
  if (!cert?.pfxCipher || !cert.senhaCipher) {
    throw new PdvErro('Cadastre o certificado digital desta empresa antes de emitir.', 409);
  }
  try {
    const aberto = abrirPfx(decifrar(cert.pfxCipher), decifrarTexto(cert.senhaCipher));
    if (aberto.validoAte.getTime() < Date.now()) throw new PdvErro('Certificado vencido.', 409);
  } catch (err) {
    if (err instanceof PdvErro) throw err;
    throw new PdvErro(err instanceof Error ? err.message : 'Certificado inválido.', 409);
  }
  if (fiscal === 'nfce' && !cert.cscCipher) {
    throw new PdvErro('Informe o CSC desta empresa para emitir NFC-e.', 409);
  }
}

async function emitirFiscal(input: {
  idEmpresa: number;
  modelo: '55' | '65';
  clienteNome: string;
  clienteDocumento: string;
  clienteContribuinte: boolean;
  clienteIe: string;
  clienteUf: string;
  itens: ItemEntrada[];
  pagamentos: PagamentoEntrada[];
  formas: { id: number; nome: string; extra?: Record<string, unknown> }[];
}) {
  const cert = await prisma.pdvCertificado.findUnique({ where: { idEmpresa: input.idEmpresa } });
  if (!cert?.pfxCipher || !cert.senhaCipher) {
    throw new PdvErro('Cadastre o certificado digital desta empresa antes de emitir.', 409);
  }
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa: input.idEmpresa } });
  let aberto: CertificadoAberto;
  try {
    aberto = abrirPfx(decifrar(cert.pfxCipher), decifrarTexto(cert.senhaCipher));
  } catch (err) {
    throw new PdvErro(err instanceof Error ? err.message : 'Certificado inválido.', 409);
  }
  if (aberto.validoAte.getTime() < Date.now()) throw new PdvErro('Certificado vencido.', 409);

  const empresa = await nomusRest<Record<string, unknown>>(`/empresas/${input.idEmpresa}`, { cacheMs: 60_000 }).catch(
    () => ({}) as Record<string, unknown>,
  );
  const txt = (chave: string) => String(empresa[chave] ?? '');
  const emitente: EmitenteNota = {
    cnpj: aberto.cnpj,
    nome: txt('nome') || config?.nomeEmpresa || 'EMITENTE',
    fantasia: txt('nomeFantasia'),
    ie: txt('inscricaoEstadual'),
    crt: txt('crt') || config?.crt || '1',
    logradouro: txt('endereco'),
    numero: txt('numero'),
    bairro: txt('bairro'),
    municipio: txt('municipio'),
    cMun: '',
    uf: txt('uf') || config?.uf || 'PI',
    cep: txt('cep'),
  };
  const ambiente = cert.ambiente === 'producao' ? 'producao' : 'homologacao';
  const numero = input.modelo === '65' ? cert.proximoNfce : cert.proximoNfe;
  const serie = input.modelo === '65' ? cert.serieNfce : cert.serieNfe;
  const csc = cert.cscCipher ? decifrarTexto(cert.cscCipher) : '';
  if (input.modelo === '65' && !csc) {
    throw new PdvErro('Informe o CSC desta empresa para emitir NFC-e.', 409);
  }
  if (input.modelo === '55' && !input.clienteDocumento) {
    throw new PdvErro('A NF-e precisa de um cliente identificado.', 409);
  }

  const resultado = await emitirNota({
    modelo: input.modelo,
    ambiente,
    serie,
    numero,
    emitente,
    destinatario: input.clienteDocumento
      ? {
          documento: input.clienteDocumento,
          nome: input.clienteNome || 'CONSUMIDOR',
          ie: input.clienteIe,
          uf: input.clienteUf || emitente.uf,
          contribuinte: input.clienteContribuinte,
        }
      : null,
    itens: input.itens.map((item) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      origem: item.origem,
      unidade: 'UN',
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      desconto: item.quantidade * item.valorUnitario * (item.descontoPercentual / 100),
      aliquotaIpi: item.aliquotaIpi ?? 0,
    })),
    pagamentos: input.pagamentos.map((p) => ({
      tPag: String(input.formas.find((f) => f.id === p.idFormaPagamento)?.extra?.meioPagamentoNfe ?? '01'),
      valor: p.valor,
    })),
    certificado: aberto,
    cscId: cert.cscId || '1',
    csc,
  });

  await prisma.pdvCertificado.update({
    where: { idEmpresa: input.idEmpresa },
    data: input.modelo === '65' ? { proximoNfce: numero + 1 } : { proximoNfe: numero + 1 },
  });

  if (!resultado.autorizado) {
    throw new PdvErro(`SEFAZ não autorizou a nota: ${resultado.motivo}`, 422);
  }
  return {
    statusFiscal: 'autorizada',
    motivoFiscal: resultado.motivo,
    chave: resultado.chave,
    protocolo: resultado.protocolo,
    xmlNota: resultado.xml,
    qrCode: resultado.qrDataUrl,
  };
}
