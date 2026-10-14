import { describe, expect, it } from 'vitest';
import {
  montarEventosHistorico,
  type EntradaHistoricoDoubleCheck,
} from './doubleCheckInHistorico.js';

function base(): EntradaHistoricoDoubleCheck {
  return {
    documento: {
      idDocumento: 10,
      numeroDocumentoFiscal: 'DE1',
      numeroNfe: '100',
      dataEmissao: '2026-10-10',
      dataEntrada: '2026-10-14',
      nomeParceiro: 'Ferro Norte',
      idTipoMovimentacao: 11,
      tipoMovimentacao: 'Entrada',
      dataCriacao: '2026-10-14T12:00:00.000Z',
      nomeUsuarioCriacao: 'Luisa',
    },
    itens: [
      {
        idItemDocumentoEstoque: 11,
        codigoProduto: 'A1',
        descricaoProduto: 'Chapa',
        idItemPedidoCompra: null,
        idPedidoCompra: null,
        nomePedidoCompra: null,
        nomeComprador: null,
        qtdeNF: 2,
        qtdePC: null,
        valorUnitarioNF: 10,
        valorUnitarioPC: null,
      },
    ],
    snapshots: [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        idPedidoCompra: 30,
        nomePedidoCompra: 'PC 30',
        nomeComprador: 'Marcilia',
        campo: 'qtde',
        natureza: 'real',
        apontadoEm: '2026-10-14T15:00:00.000Z',
      },
    ],
    linhasAtuais: [],
    decisoes: [],
    conferencia: null,
    recebimento: null,
    alerta: null,
  };
}

describe('montarEventosHistorico', () => {
  it('coloca o desvínculo depois da primeira leitura e sem horário', () => {
    const eventos = montarEventosHistorico(base());
    const leitura = eventos.findIndex((evento) => evento.id.startsWith('leitura-'));
    const desfeito = eventos.find((evento) => evento.id.startsWith('desfeito-'));
    const desfeitoIdx = eventos.findIndex((evento) => evento.id.startsWith('desfeito-'));
    expect(leitura).toBeGreaterThanOrEqual(0);
    expect(desfeitoIdx).toBe(leitura + 1);
    expect(desfeito).toMatchObject({
      precisao: 'sem_data',
      em: null,
      titulo: 'Desvinculado do pedido',
    });
    expect(desfeito?.detalhe).toContain('PC 30');
    expect(desfeito?.detalhe).toContain('hora do desvínculo não ficou registrada');
    expect(eventos.at(-1)?.id).toBe(desfeito?.id);
    expect(eventos[0]).toMatchObject({ id: 'criado', precisao: 'instante' });
    expect(eventos.find((evento) => evento.id.startsWith('leitura-'))).toMatchObject({
      origemComparativo: 'leitura',
      abreComparativo: true,
    });
    expect(eventos.some((evento) => evento.id === 'sem-desvinculo')).toBe(false);
  });

  it('não chama de desfeito o vínculo que continua e foi aceito', () => {
    const entrada = base();
    entrada.itens[0] = {
      ...entrada.itens[0]!,
      idItemPedidoCompra: 21,
      idPedidoCompra: 30,
      nomePedidoCompra: 'PC 30',
      nomeComprador: 'Marcilia',
      qtdePC: 1,
      valorUnitarioPC: 10,
    };
    entrada.linhasAtuais = [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        nomePedidoCompra: 'PC 30',
        codigoProduto: 'A1',
        descricaoProduto: 'Chapa',
        qtdeNF: 2,
        qtdePC: 1,
        valorUnitarioNF: 10,
        valorUnitarioPC: 10,
        valorIpiNF: 0,
        valorIpiPC: 0,
        condicaoPagamentoNF: null,
        condicaoPagamentoPC: null,
        divergValorUnitario: false,
        divergQtde: true,
        divergIpi: false,
        divergCondicaoPagamento: false,
      },
    ];
    entrada.decisoes = [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        campo: 'qtde',
        decisao: 'aceita',
        justificativaLabel: 'Acordo comercial',
        usuarioLogin: 'ana',
        atualizadoEm: '2026-10-14T16:00:00.000Z',
        vigente: true,
        observacoes: [],
      },
    ];
    const eventos = montarEventosHistorico(entrada);
    expect(eventos.some((evento) => evento.id.startsWith('desfeito-'))).toBe(false);
    expect(eventos.some((evento) => evento.id === 'ajustado')).toBe(false);
    expect(eventos.some((evento) => evento.id === 'permanece-igual')).toBe(false);
    expect(eventos.find((evento) => evento.id.startsWith('decisao-'))).toMatchObject({
      titulo: 'Divergência aceita',
      ator: 'ana',
      precisao: 'instante',
    });
  });

  it('resume o vínculo que ficou igual numa legenda', () => {
    const entrada = base();
    entrada.itens[0] = {
      ...entrada.itens[0]!,
      idItemPedidoCompra: 21,
      idPedidoCompra: 30,
      nomePedidoCompra: 'PC 30',
      nomeComprador: 'Marcilia',
      qtdePC: 1,
      valorUnitarioPC: 9,
    };
    entrada.linhasAtuais = [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        nomePedidoCompra: 'PC 30',
        codigoProduto: 'A1',
        descricaoProduto: 'Chapa',
        qtdeNF: 2,
        qtdePC: 1,
        valorUnitarioNF: 10,
        valorUnitarioPC: 9,
        valorIpiNF: 0,
        valorIpiPC: 0,
        condicaoPagamentoNF: null,
        condicaoPagamentoPC: null,
        divergValorUnitario: true,
        divergQtde: true,
        divergIpi: false,
        divergCondicaoPagamento: false,
      },
    ];
    const eventos = montarEventosHistorico(entrada);
    const legenda = eventos.at(-1);
    expect(legenda).toMatchObject({
      id: 'permanece-igual',
      titulo: 'Documento permanece igual',
      legenda: true,
      abreComparativo: false,
      detalhe: '',
    });
    expect(eventos.some((evento) => evento.id === 'sem-desvinculo')).toBe(false);
  });

  it('mostra desvínculo e um vínculo posterior quando o pedido muda', () => {
    const entrada = base();
    entrada.itens[0] = {
      ...entrada.itens[0]!,
      idItemPedidoCompra: 99,
      idPedidoCompra: 40,
      nomePedidoCompra: 'PC 40',
      nomeComprador: 'Fernanda',
      qtdePC: 2,
      valorUnitarioPC: 8,
    };
    const eventos = montarEventosHistorico(entrada);
    const desfeito = eventos.findIndex((evento) => evento.id.startsWith('desfeito-'));
    const posterior = eventos.findIndex((evento) => evento.id === 'posterior');
    expect(desfeito).toBeGreaterThanOrEqual(0);
    expect(posterior).toBe(desfeito + 1);
    expect(eventos[posterior]?.detalhe).toContain('PC 40');
    expect(eventos.some((evento) => evento.id === 'sem-desvinculo' || evento.id === 'permanece-igual')).toBe(false);
  });
});
