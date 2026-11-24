import { describe, expect, it } from 'vitest';
import {
  montarGradePreEntradas,
  montarImpressaoPreEntradas,
  NOME_SEM_PEDIDO_PRE_ENTRADA,
  type DocPreEntradaBruto,
} from './gestaoEntradasPreEntrada.js';

function doc(partial: Partial<DocPreEntradaBruto> & Pick<DocPreEntradaBruto, 'idDocumento'>): DocPreEntradaBruto {
  return {
    numeroDocumentoFiscal: '100',
    numeroNfe: '100',
    nomeParceiro: 'Fornecedor',
    dataEmissao: '2026-11-01',
    dataEntrada: '2026-11-02',
    idTipoMovimentacao: 46,
    nomeTipo: 'IMPORTAÇÃO DE XML - PRÉ ENTRADA',
    usuarioAlteracao: null,
    ...partial,
  };
}

describe('grade de pré-entradas', () => {
  it('lista a pré-entrada atual com pedido vinculado e conferência pendente', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 10, numeroDocumentoFiscal: '55' })],
      comunicacoes: [],
      vinculos: [{ idDocumento: 10, idPedido: 7, nome: 'PC 7' }],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
    });
    expect(grade.linhas).toHaveLength(1);
    expect(grade.linhas[0]).toMatchObject({
      idDocumento: 10,
      situacao: 'pre_entrada',
      conferencia: 'pendente',
      pedidos: [{ idPedido: 7, nome: 'PC 7' }],
      comunicacoes: [],
    });
  });

  it('mostra quem alterou o documento por último e quem conferiu no Double Check', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 15, usuarioAlteracao: 'Maria Souza' })],
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set([15]),
      usuariosConferencia: new Map([[15, 'João Lima']]),
    });
    expect(grade.linhas[0]).toMatchObject({
      usuarioAlteracao: 'Maria Souza',
      usuarioConferencia: 'João Lima',
      conferencia: 'conferida',
    });
  });

  it('conferência pendente não leva usuário de conferência', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 16, usuarioAlteracao: 'Ana' })],
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
      usuariosConferencia: new Map([[16, 'João Lima']]),
    });
    expect(grade.linhas[0]?.usuarioAlteracao).toBe('Ana');
    expect(grade.linhas[0]?.usuarioConferencia).toBeNull();
  });

  it('marca conferida quando o Double Check tem conferência vigente', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 11 })],
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set([11]),
    });
    expect(grade.linhas[0]?.conferencia).toBe('conferida');
  });

  it('entrada anterior a 19/09/2026 fica como conferência não aplicada', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 12, dataEntrada: '2026-09-18' })],
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set([12]),
    });
    expect(grade.linhas[0]?.conferencia).toBe('nao_aplicada');
  });

  it('recupera o pedido e o número do Otimiza quando o vínculo da nota já saiu', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 20 })],
      comunicacoes: [
        { idDocumentoEstoque: 20, idItemPedidoCompra: 90, numero: 1842, status: 'in_progress' },
        { idDocumentoEstoque: 20, idItemPedidoCompra: 91, numero: 1842, status: 'completed' },
        { idDocumentoEstoque: 20, idItemPedidoCompra: 91, numero: 1900, status: 'cancelled' },
      ],
      vinculos: [],
      pedidosPorItem: new Map([[90, { idPedido: 3, nome: 'PC 3' }]]),
      apontamentos: [
        {
          idDocumentoEstoque: 20,
          idItemPedidoCompra: 91,
          idPedidoCompra: 4,
          nomePedidoCompra: 'PC 4',
        },
      ],
      idsConferidos: new Set(),
    });
    expect(grade.linhas[0]?.pedidos).toEqual([
      { idPedido: 3, nome: 'PC 3' },
      { idPedido: 4, nome: 'PC 4' },
    ]);
    expect(grade.linhas[0]?.comunicacoes).toEqual([{ numero: 1842, status: 'in_progress' }]);
  });

  it('não lista documento que já saiu da pré-entrada', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 30, idTipoMovimentacao: 11, nomeTipo: 'Compra' })],
      comunicacoes: [
        { idDocumentoEstoque: 30, idItemPedidoCompra: 8, numero: 77, status: 'in_progress' },
      ],
      vinculos: [],
      pedidosPorItem: new Map([[8, { idPedido: 1, nome: 'PC 1' }]]),
      apontamentos: [],
      idsConferidos: new Set([30]),
    });
    expect(grade.linhas).toHaveLength(0);
  });

  it('filtra pela data de entrada e conserva documento sem essa data', () => {
    const grade = montarGradePreEntradas({
      atuais: [
        doc({ idDocumento: 1, dataEntrada: '2026-11-01' }),
        doc({ idDocumento: 2, dataEntrada: '2026-10-01' }),
        doc({ idDocumento: 3, dataEntrada: null }),
      ],
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    });
    expect(grade.linhas.map((linha) => linha.idDocumento)).toEqual([1, 3]);
  });

  it('não lista comunicação concluída nem cancelada', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 21 })],
      comunicacoes: [
        { idDocumentoEstoque: 21, idItemPedidoCompra: 1, numero: 77, status: 'completed' },
        { idDocumentoEstoque: 21, idItemPedidoCompra: 2, numero: 78, status: 'cancelled' },
        { idDocumentoEstoque: 21, idItemPedidoCompra: 3, numero: 79, status: null },
      ],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
    });
    expect(grade.linhas[0]?.comunicacoes).toEqual([]);
  });
});

describe('impressão das pré-entradas', () => {
  it('agrupa por fornecedor e, dentro dele, por pedido, com o documento do material', () => {
    const relacao = montarImpressaoPreEntradas({
      documentos: [
        doc({ idDocumento: 1, numeroDocumentoFiscal: 'DE1', numeroNfe: '10', nomeParceiro: 'Beta' }),
        doc({ idDocumento: 2, numeroDocumentoFiscal: 'DE2', numeroNfe: '20', nomeParceiro: 'Alfa' }),
      ],
      itens: [
        {
          idDocumento: 2,
          idItem: 8,
          codigo: 'CHAPA',
          descricao: 'Chapa 3mm',
          unidade: 'KG',
          qtde: 12.5,
          idPedido: 4,
          nomePedido: 'PC 4',
          dataEntrega: '2026-12-15',
        },
        {
          idDocumento: 1,
          idItem: 9,
          codigo: 'TUBO',
          descricao: 'Tubo',
          unidade: 'PC',
          qtde: 2,
          idPedido: 0,
          nomePedido: null,
          dataEntrega: null,
        },
      ],
    });
    expect(relacao.fornecedores.map((fornecedor) => fornecedor.nome)).toEqual(['Alfa', 'Beta']);
    expect(relacao.fornecedores[0]?.pedidos[0]).toMatchObject({
      nome: 'PC 4',
      materiais: [
        {
          codigo: 'CHAPA',
          descricao: 'Chapa 3mm',
          qtde: 12.5,
          numeroDocumento: 'DE2',
          numeroNfe: '20',
          dataEntrega: '2026-12-15',
        },
      ],
    });
    expect(relacao.fornecedores[1]?.pedidos[0]?.nome).toBe(NOME_SEM_PEDIDO_PRE_ENTRADA);
    expect(relacao.fornecedores[1]?.pedidos[0]?.materiais[0]?.numeroDocumento).toBe('DE1');
  });

  it('junta o mesmo fornecedor e lista os pedidos diferentes dele', () => {
    const relacao = montarImpressaoPreEntradas({
      documentos: [
        doc({ idDocumento: 1, nomeParceiro: 'DUFRIO TERESINA', numeroDocumentoFiscal: 'DE1' }),
        doc({ idDocumento: 2, nomeParceiro: 'Dufrio  Teresina', numeroDocumentoFiscal: 'DE2' }),
      ],
      itens: [
        {
          idDocumento: 1,
          idItem: 1,
          codigo: 'MP3022',
          descricao: 'Condensador',
          unidade: 'UN',
          qtde: 20,
          idPedido: 10,
          nomePedido: 'PC28343',
          dataEntrega: '2026-11-30',
        },
        {
          idDocumento: 2,
          idItem: 2,
          codigo: 'MP3022',
          descricao: 'Condensador',
          unidade: 'UN',
          qtde: 20,
          idPedido: 0,
          nomePedido: null,
          dataEntrega: '2026-11-30',
        },
      ],
    });
    expect(relacao.fornecedores).toHaveLength(1);
    expect(relacao.fornecedores[0]?.nome).toBe('DUFRIO TERESINA');
    expect(relacao.fornecedores[0]?.pedidos.map((pedido) => pedido.nome)).toEqual([
      'PC28343',
      NOME_SEM_PEDIDO_PRE_ENTRADA,
    ]);
  });

  it('repete o material em cada pedido vinculado e ignora o vínculo vazio', () => {
    const relacao = montarImpressaoPreEntradas({
      documentos: [doc({ idDocumento: 5, nomeParceiro: 'Alfa', numeroDocumentoFiscal: 'DE5' })],
      itens: [
        {
          idDocumento: 5,
          idItem: 1,
          codigo: 'A',
          descricao: 'Aço',
          unidade: 'KG',
          qtde: 3,
          idPedido: 0,
          nomePedido: null,
          dataEntrega: null,
        },
        {
          idDocumento: 5,
          idItem: 1,
          codigo: 'A',
          descricao: 'Aço',
          unidade: 'KG',
          qtde: 3,
          idPedido: 7,
          nomePedido: 'PC 7',
          dataEntrega: '2026-12-20',
        },
        {
          idDocumento: 5,
          idItem: 1,
          codigo: 'A',
          descricao: 'Aço',
          unidade: 'KG',
          qtde: 3,
          idPedido: 7,
          nomePedido: 'PC 7',
          dataEntrega: '2026-12-05',
        },
        {
          idDocumento: 5,
          idItem: 1,
          codigo: 'A',
          descricao: 'Aço',
          unidade: 'KG',
          qtde: 3,
          idPedido: 8,
          nomePedido: 'PC 8',
          dataEntrega: null,
        },
      ],
    });
    expect(relacao.fornecedores[0]?.pedidos.map((pedido) => pedido.nome)).toEqual(['PC 7', 'PC 8']);
    expect(relacao.fornecedores[0]?.pedidos.every((pedido) => pedido.materiais.length === 1)).toBe(true);
    expect(relacao.fornecedores[0]?.pedidos[0]?.materiais[0]?.dataEntrega).toBe('2026-12-05');
    expect(relacao.fornecedores[0]?.pedidos[1]?.materiais[0]?.dataEntrega).toBeNull();
  });

  it('mantém o documento sem item e deixa de fora quem já saiu da pré-entrada', () => {
    const relacao = montarImpressaoPreEntradas({
      documentos: [
        doc({ idDocumento: 3, nomeParceiro: 'Gama', numeroDocumentoFiscal: 'DE3', dataEntrada: null }),
        doc({ idDocumento: 4, idTipoMovimentacao: 11, nomeParceiro: 'Gama' }),
      ],
      itens: [],
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    });
    expect(relacao.fornecedores).toHaveLength(1);
    expect(relacao.fornecedores[0]?.pedidos[0]?.materiais[0]).toMatchObject({
      idItem: 0,
      qtde: null,
      numeroDocumento: 'DE3',
    });
  });
});
