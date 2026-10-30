import { describe, expect, it } from 'vitest';
import {
  agregarMeses,
  clienteNovo,
  montarFunil,
  type LinhaPedidoItem,
  type LinhaPropostaItem,
} from './portaPalletsComercialRepository.js';

function proposta(parcial: Partial<LinhaPropostaItem> & Pick<LinhaPropostaItem, 'idProposta' | 'mes' | 'valor'>): LinhaPropostaItem {
  return {
    idItem: parcial.idItem ?? parcial.idProposta,
    codigoProposta: `PP-${parcial.idProposta}`,
    dataAbertura: `${parcial.mes}-01`,
    idCliente: 1,
    cliente: 'Cliente',
    dataCadastroCliente: '',
    codigoProduto: 'P1',
    descricaoProduto: 'Longarina',
    statusItem: 2,
    statusLabel: 'Em aberto',
    motivoRejeicao: '',
    codigosPedido: '',
    dataPrimeiroPedido: '',
    propostaConvertida: false,
    dias: null,
    ...parcial,
  };
}

function pedido(parcial: Partial<LinhaPedidoItem> & Pick<LinhaPedidoItem, 'idPedido' | 'idCliente' | 'mes' | 'valorVendido'>): LinhaPedidoItem {
  return {
    idItem: parcial.idItem ?? parcial.idPedido,
    codigoPedido: `PD-${parcial.idPedido}`,
    dataEmissao: `${parcial.mes}-10`,
    cliente: `Cliente ${parcial.idCliente}`,
    dataCadastroCliente: '',
    codigoProduto: 'P1',
    descricaoProduto: 'Longarina',
    primeiraCompra: false,
    pedidoDeProposta: false,
    ...parcial,
  };
}

describe('agregarMeses porta-pallets', () => {
  it('conta a proposta uma vez e soma os itens', () => {
    const { meses } = agregarMeses(
      [
        proposta({ idProposta: 1, mes: '2024-01', valor: 10.1 }),
        proposta({ idProposta: 1, mes: '2024-01', valor: 0.2, codigoProduto: 'P2' }),
        proposta({ idProposta: 2, mes: '2024-01', valor: 5, propostaConvertida: true, dias: 4 }),
      ],
      [],
      '2024-01'
    );
    const jan = meses.find((m) => m.mes === '2024-01');
    expect(jan?.qtdPropostas).toBe(2);
    expect(jan?.valorPropostas).toBe(15.3);
    expect(jan?.qtdConvertidas).toBe(1);
    expect(jan?.taxaConversao).toBe(0.5);
    expect(jan?.tempoMedioDias).toBe(4);
  });

  it('não marca de novo quem já comprou e o ticket usa o valor do mês', () => {
    const { meses, totais } = agregarMeses(
      [],
      [
        pedido({ idPedido: 10, idCliente: 1, mes: '2024-01', valorVendido: 100, primeiraCompra: true }),
        pedido({ idPedido: 10, idCliente: 1, mes: '2024-01', valorVendido: 50, primeiraCompra: true, codigoProduto: 'P2' }),
        pedido({ idPedido: 11, idCliente: 1, mes: '2024-02', valorVendido: 80, primeiraCompra: false }),
        pedido({ idPedido: 12, idCliente: 2, mes: '2024-02', valorVendido: 20, primeiraCompra: true }),
      ],
      '2024-02'
    );
    const jan = meses.find((m) => m.mes === '2024-01');
    const fev = meses.find((m) => m.mes === '2024-02');
    expect(jan?.qtdPedidos).toBe(1);
    expect(jan?.valorVendido).toBe(150);
    expect(jan?.ticketMedio).toBe(150);
    expect(jan?.qtdClientes).toBe(1);
    expect(jan?.qtdPrimeiraCompra).toBe(1);
    expect(fev?.qtdPedidos).toBe(2);
    expect(fev?.qtdClientes).toBe(2);
    expect(fev?.qtdPrimeiraCompra).toBe(1);
    expect(totais.qtdClientes).toBe(2);
    expect(totais.qtdPrimeiraCompra).toBe(2);
    expect(totais.qtdPedidos).toBe(3);
    expect(totais.valorVendido).toBe(250);
  });

  it('respeita o recorte desde/até nos totais', () => {
    const { meses, totais } = agregarMeses(
      [],
      [
        pedido({ idPedido: 10, idCliente: 1, mes: '2024-01', valorVendido: 100, primeiraCompra: true }),
        pedido({ idPedido: 11, idCliente: 1, mes: '2024-02', valorVendido: 80, primeiraCompra: false }),
      ],
      '2024-02',
      '2024-02'
    );
    expect(meses.map((m) => m.mes)).toEqual(['2024-02']);
    expect(totais.qtdPedidos).toBe(1);
    expect(totais.valorVendido).toBe(80);
    expect(totais.qtdPrimeiraCompra).toBe(0);
  });

  it('cliente novo depende da criação do cadastro perto do primeiro contato', () => {
    expect(clienteNovo('2024-01-10', '2024-01-10', '2024-01', '2024-01').novo).toBe(true);
    expect(clienteNovo('2024-01-03', '2024-01-10', '2024-01', '2024-01').novo).toBe(true);
    expect(clienteNovo('2024-01-12', '2024-01-10', '2024-01', '2024-01').novo).toBe(true);
    expect(clienteNovo('2024-01-02', '2024-01-10', '2024-01', '2024-01').novo).toBe(false);
    expect(clienteNovo('', '2024-01-10', '2024-01', '2024-01')).toEqual({ novo: false, dias: null });
    expect(clienteNovo('2023-12-20', '2023-12-20', '2024-01', '2024-01').novo).toBe(false);
  });

  it('monta o funil só com as propostas do recorte e os pedidos gerados por elas', () => {
    const propostas = [
      proposta({ idProposta: 1, idCliente: 1, mes: '2023-12', valor: 10, dataCadastroCliente: '2023-12-01' }),
      proposta({ idProposta: 2, idCliente: 1, mes: '2024-01', valor: 10, propostaConvertida: true, dias: 3, dataCadastroCliente: '2023-12-01' }),
      proposta({ idProposta: 3, idCliente: 2, mes: '2024-01', valor: 10, dataCadastroCliente: '2020-01-01' }),
      proposta({ idProposta: 4, idCliente: 3, mes: '2024-01', valor: 10, propostaConvertida: true, dias: 5, dataCadastroCliente: '2024-01-01' }),
      proposta({ idProposta: 5, idCliente: 5, mes: '2024-01', valor: 10, dataAbertura: '2024-01-12', dataCadastroCliente: '2024-01-08' }),
    ];
    const pedidos = [
      pedido({ idPedido: 10, idCliente: 1, mes: '2024-01', valorVendido: 100, pedidoDeProposta: true, dataCadastroCliente: '2023-12-01' }),
      pedido({ idPedido: 11, idCliente: 3, mes: '2024-01', valorVendido: 50, pedidoDeProposta: true, primeiraCompra: true, dataCadastroCliente: '2024-01-01' }),
      pedido({ idPedido: 12, idCliente: 4, mes: '2024-01', valorVendido: 20, primeiraCompra: true }),
    ];
    const vinculos = [
      { idProposta: 1, idPedido: 9, codigoPedido: 'PD-9', dataEmissao: '2023-12-20' },
      { idProposta: 2, idPedido: 10, codigoPedido: 'PD-10', dataEmissao: '2024-01-10' },
      { idProposta: 4, idPedido: 11, codigoPedido: 'PD-11', dataEmissao: '2024-01-10' },
      { idProposta: 4, idPedido: 13, codigoPedido: 'PD-13', dataEmissao: '2024-02-05' },
    ];
    const { totais } = agregarMeses(propostas, pedidos, '2024-01', '2024-01');
    const funil = montarFunil(propostas, pedidos, vinculos, totais, '2024-01', '2024-01');
    expect(funil.propostas).toBe(4);
    expect(funil.convertidas).toBe(2);
    expect(funil.pedidosGerados).toBe(3);
    expect(funil.valorPedidosGerados).toBe(150);
    expect(funil.tempoMedioDias).toBe(4);
    expect(funil.clientesTotal).toBe(4);
    expect(funil.clientesComPedido).toBe(2);
    expect(funil.clientesNovos).toBe(2);
    expect(funil.novosComPedido).toBe(1);
    expect(funil.conciliacao).toEqual({
      pedidosCard: 3,
      pedidosFunil: 3,
      semProposta: 1,
      propostaAnterior: 0,
      geradosForaDaVenda: 0,
      geradosForaDoPeriodo: 1,
    });
  });
});
