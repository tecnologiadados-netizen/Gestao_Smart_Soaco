import { prisma } from '../config/prisma.js';
import { nomusRest } from './nomusRest.js';
import { listarFormas, precosDaTabela } from './pdvCatalogo.js';
import { PdvErro } from './pdvErro.js';
import { lerTributacaoPedido, saldoDisponivel } from './pdvEstoque.js';
import {
  criarDocumentoSaidaNomus,
  criarPedidoNomus,
  criarPropostaNomus,
  destinoPermitido,
  itensPropostaNomus,
  normalizarDestino,
  normalizarModoOperacao,
  type ConfigNomusPdv,
  type DestinoVendaPdv,
} from './pdvNomusVenda.js';
import { abrirPfx, type CertificadoAberto } from './fiscal/certificado.js';
import { emitirNota, type EmitenteNota } from './fiscal/emitir.js';
import { decifrar, decifrarTexto } from './secrets.js';

export { PdvErro } from './pdvErro.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function configNomusDe(config: {
  idEmpresa: number;
  idTabelaPreco: number | null;
  idTipoMovimentacao: number | null;
  idTipoPedido: number | null;
  idSetorSaida: number | null;
  idCondicaoPagamento: number | null;
  idFormaPagamento: number | null;
  idContaBancaria: number | null;
  idPessoaVendedor: number | null;
}): ConfigNomusPdv {
  if (!config.idTabelaPreco || !config.idSetorSaida || !config.idTipoMovimentacao) {
    throw new PdvErro('A empresa do PDV ainda não tem tabela, setor e tipo de movimentação.', 409);
  }
  return {
    idEmpresa: config.idEmpresa,
    idTabelaPreco: config.idTabelaPreco,
    idTipoMovimentacao: config.idTipoMovimentacao,
    idTipoPedido: config.idTipoPedido,
    idSetorSaida: config.idSetorSaida,
    idCondicaoPagamento: config.idCondicaoPagamento,
    idFormaPagamento: config.idFormaPagamento,
    idContaBancaria: config.idContaBancaria,
    idPessoaVendedor: config.idPessoaVendedor,
  };
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
  destino?: DestinoVendaPdv | string;
}) {
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa: input.idEmpresa } });
  if (!config?.idTabelaPreco || !config.idSetorSaida || !config.idTipoMovimentacao) {
    throw new PdvErro('A empresa do PDV ainda não tem tabela, setor e tipo de movimentação.', 409);
  }
  const modo = normalizarModoOperacao(config.modoOperacao);
  const destino = normalizarDestino(input.destino ?? (modo === 'orcamento' ? 'orcamento' : 'pedido'));
  if (!destinoPermitido(modo, destino)) {
    throw new PdvErro(
      modo === 'orcamento'
        ? 'Esta empresa está configurada só para orçamento.'
        : 'Esta empresa está configurada só para pedido direto.',
      409,
    );
  }
  if (!input.itens.length) throw new PdvErro('Inclua ao menos um produto.');
  if (destino === 'pedido' && !config.idTipoPedido) {
    throw new PdvErro('Configure o tipo de pedido desta empresa para emitir pedido.', 409);
  }
  if (!input.espera && destino === 'pedido' && (input.fiscal === 'nfce' || input.fiscal === 'nfe')) {
    await garantirCertificado(input.idEmpresa, input.fiscal);
  }
  const caixa = await caixaAberto(input.usuarioId, input.idEmpresa);
  if (!caixa && !input.espera && destino === 'pedido') {
    throw new PdvErro('Abra o caixa para concluir a venda.', 409);
  }

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
  if (!input.espera && destino === 'pedido' && pago + 0.009 < total) {
    throw new PdvErro('O pagamento não cobre o total da venda.');
  }
  const troco = destino === 'pedido' ? round2(Math.max(0, pago - total)) : 0;

  const formas = await listarFormas().catch(() => []);
  const venda = await prisma.pdvVenda.create({
    data: {
      caixaId: caixa?.id ?? null,
      usuarioId: input.usuarioId,
      idEmpresa: input.idEmpresa,
      status: input.espera ? 'espera' : 'aberta',
      idPessoaCliente: input.idPessoaCliente,
      clienteNome: input.clienteNome,
      observacao: input.observacao,
      fiscalTipo: destino === 'orcamento' ? 'nenhuma' : input.fiscal,
      destinoNomus: destino,
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

  const nomusCfg = configNomusDe({ ...config, idEmpresa: input.idEmpresa });
  const idForma = input.pagamentos[0]?.idFormaPagamento || config.idFormaPagamento;
  const itensNomus = venda.itens.map((item) => ({
    idProduto: item.idProduto,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    descontoPercentual: item.descontoPercentual,
    idUnidadeMedida: item.idUnidadeMedida,
  }));

  if (destino === 'orcamento') {
    let idProposta: number | null = null;
    try {
      idProposta = await criarPropostaNomus({
        config: nomusCfg,
        idCliente: idCliente!,
        clienteNome: input.clienteNome,
        observacao: input.observacao,
        itens: itensNomus,
        idFormaPagamento: idForma,
      });
    } catch (err) {
      await prisma.pdvVenda.update({
        where: { id: venda.id },
        data: { status: 'erro', motivoFiscal: err instanceof Error ? err.message : 'Falha ao criar proposta.' },
      });
      throw err instanceof PdvErro ? err : new PdvErro('Falha ao criar a proposta no Nomus.', 502);
    }
    return prisma.pdvVenda.update({
      where: { id: venda.id },
      data: {
        status: 'orcamento',
        concluidaEm: new Date(),
        idPropostaNomus: idProposta,
        destinoNomus: 'orcamento',
      },
      include: { itens: true, pagamentos: true },
    });
  }

  let idPedido: number | null = null;
  try {
    idPedido = await criarPedidoNomus({
      config: nomusCfg,
      idCliente: idCliente!,
      observacao: input.observacao,
      total,
      itens: itensNomus,
      idFormaPagamento: idForma,
    });
  } catch (err) {
    await prisma.pdvVenda.update({
      where: { id: venda.id },
      data: { status: 'erro', motivoFiscal: err instanceof Error ? err.message : 'Falha ao criar pedido.' },
    });
    throw err instanceof PdvErro ? err : new PdvErro('Falha ao criar o pedido no Nomus.', 502);
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
    idDocumento = await criarDocumentoSaidaNomus({
      config: nomusCfg,
      idCliente: idCliente!,
      observacao: input.observacao,
      numero: `PDV-${venda.id}`,
      itens: itensNomus,
      idFormaPagamento: idForma,
    });
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
      destinoNomus: 'pedido',
      idPedidoNomus: idPedido,
      idDocumentoNomus: idDocumento,
      aliquotaIpiMedia: aliquotaMedia,
      ...fiscal,
    },
    include: { itens: true, pagamentos: true },
  });
}

export async function transformarOrcamento(input: {
  usuarioId: number;
  idEmpresa: number;
  vendaId: number;
  pagamentos?: PagamentoEntrada[];
  fiscal?: 'nenhuma' | 'nfce' | 'nfe';
  clienteDocumento?: string;
  clienteContribuinte?: boolean;
  clienteIe?: string;
  clienteUf?: string;
}) {
  const config = await prisma.pdvEmpresaConfig.findUnique({ where: { idEmpresa: input.idEmpresa } });
  if (!config) throw new PdvErro('Empresa do PDV sem configuração.', 409);
  const modo = normalizarModoOperacao(config.modoOperacao);
  if (modo !== 'ambos') {
    throw new PdvErro('Só empresas no modo "Orçamento e pedido" transformam orçamento em pedido no PDV.', 409);
  }
  const venda = await prisma.pdvVenda.findFirst({
    where: { id: input.vendaId, idEmpresa: input.idEmpresa, status: 'orcamento' },
    include: { itens: true, pagamentos: true },
  });
  if (!venda?.idPropostaNomus) throw new PdvErro('Orçamento não encontrado ou sem proposta no Nomus.', 404);

  const caixa = await caixaAberto(input.usuarioId, input.idEmpresa);
  if (!caixa) throw new PdvErro('Abra o caixa para transformar o orçamento em pedido.', 409);

  const idCliente = venda.idPessoaCliente || config.idPessoaConsumidor;
  if (!idCliente) throw new PdvErro('Cadastre o cliente consumidor padrão desta empresa.', 409);

  const nomusCfg = configNomusDe({ ...config, idEmpresa: input.idEmpresa });
  if (!nomusCfg.idTipoPedido) {
    throw new PdvErro('Configure o tipo de pedido desta empresa para transformar o orçamento.', 409);
  }

  const pagamentos =
    input.pagamentos && input.pagamentos.length > 0
      ? input.pagamentos
      : venda.pagamentos.map((p) => ({ idFormaPagamento: p.idFormaPagamento, valor: p.valor }));
  const pago = round2(pagamentos.reduce((s, p) => s + Number(p.valor), 0));
  if (pago + 0.009 < venda.total) throw new PdvErro('O pagamento não cobre o total do orçamento.');
  const troco = round2(Math.max(0, pago - venda.total));
  const fiscal = input.fiscal === 'nfce' || input.fiscal === 'nfe' ? input.fiscal : 'nenhuma';
  if (fiscal !== 'nenhuma') await garantirCertificado(input.idEmpresa, fiscal);

  let itensNomus = await itensPropostaNomus(venda.idPropostaNomus);
  if (!itensNomus.length) {
    itensNomus = venda.itens.map((item) => ({
      idProduto: item.idProduto,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      descontoPercentual: item.descontoPercentual,
      idUnidadeMedida: item.idUnidadeMedida,
    }));
  }

  const idForma = pagamentos[0]?.idFormaPagamento || config.idFormaPagamento;
  let idPedido: number | null = null;
  try {
    idPedido = await criarPedidoNomus({
      config: nomusCfg,
      idCliente,
      observacao: venda.observacao,
      total: venda.total,
      itens: itensNomus,
      idFormaPagamento: idForma,
    });
  } catch (err) {
    throw err instanceof PdvErro ? err : new PdvErro('Falha ao criar o pedido a partir da proposta.', 502);
  }

  let aliquotaMedia = 0;
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

  let idDocumento: number | null = null;
  try {
    idDocumento = await criarDocumentoSaidaNomus({
      config: nomusCfg,
      idCliente,
      observacao: venda.observacao,
      numero: `PDV-${venda.id}`,
      itens: itensNomus,
      idFormaPagamento: idForma,
    });
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
      `Pedido criado no Nomus (${idPedido}), mas o documento de saída falhou. ${err instanceof Error ? err.message : ''}`,
      502,
    );
  }

  const formas = await listarFormas().catch(() => []);
  let fiscalResult = {
    statusFiscal: '',
    motivoFiscal: '',
    chave: '',
    protocolo: '',
    xmlNota: '',
    qrCode: '',
  };
  if (fiscal === 'nfce' || fiscal === 'nfe') {
    try {
      const itensComIpi = await prisma.pdvVendaItem.findMany({ where: { vendaId: venda.id } });
      fiscalResult = await emitirFiscal({
        idEmpresa: input.idEmpresa,
        modelo: fiscal === 'nfce' ? '65' : '55',
        clienteNome: venda.clienteNome,
        clienteDocumento: input.clienteDocumento ?? '',
        clienteContribuinte: Boolean(input.clienteContribuinte),
        clienteIe: input.clienteIe ?? '',
        clienteUf: input.clienteUf ?? '',
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
        pagamentos,
        formas,
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'Falha na emissão.';
      await prisma.pdvVenda.update({
        where: { id: venda.id },
        data: {
          status: 'concluida',
          concluidaEm: new Date(),
          caixaId: caixa.id,
          destinoNomus: 'pedido',
          idPedidoNomus: idPedido,
          idDocumentoNomus: idDocumento,
          aliquotaIpiMedia: aliquotaMedia,
          troco,
          fiscalTipo: fiscal,
          statusFiscal: 'rejeitada',
          motivoFiscal: motivo,
        },
      });
      throw new PdvErro(
        `${motivo} Pedido e documento de saída já foram gravados no Nomus (pedido ${idPedido}).`,
        err instanceof PdvErro ? err.status : 502,
      );
    }
  }

  if (pagamentos.length) {
    await prisma.pdvVendaPagamento.deleteMany({ where: { vendaId: venda.id } });
    await prisma.pdvVendaPagamento.createMany({
      data: pagamentos.map((p) => ({
        vendaId: venda.id,
        idFormaPagamento: p.idFormaPagamento,
        nomeForma: formas.find((f) => f.id === p.idFormaPagamento)?.nome ?? '',
        valor: round2(p.valor),
      })),
    });
  }

  await prisma.pdvCaixaMovimento.create({
    data: { caixaId: caixa.id, tipo: 'venda', valor: venda.total, observacao: `Transformação orçamento ${venda.id}` },
  });

  return prisma.pdvVenda.update({
    where: { id: venda.id },
    data: {
      status: 'concluida',
      concluidaEm: new Date(),
      caixaId: caixa.id,
      destinoNomus: 'pedido',
      idPedidoNomus: idPedido,
      idDocumentoNomus: idDocumento,
      aliquotaIpiMedia: aliquotaMedia,
      troco,
      fiscalTipo: fiscal,
      ...fiscalResult,
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
