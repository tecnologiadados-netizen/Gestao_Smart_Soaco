import { describe, expect, it } from 'vitest';
import {
  aplicarChamadosAbertosOtimiza,
  montarGradePreEntradas,
  type DocPreEntradaBruto,
} from './gestaoEntradasPreEntrada.js';

function doc(partial: Partial<DocPreEntradaBruto> & Pick<DocPreEntradaBruto, 'idDocumento'>): DocPreEntradaBruto {
  return {
    numeroDocumentoFiscal: '100',
    numeroNfe: '100',
    nomeParceiro: 'Fornecedor',
    dataEmissao: '2026-11-01',
    dataEntrada: '2026-11-02',
    idTipoMovimentacao: 173,
    nomeTipo: 'PRÉ ENTRADA',
    usuarioAlteracao: null,
    ...partial,
  };
}

describe('grade de pré-entradas', () => {
  it('lista a pré-entrada atual com pedido vinculado e conferência pendente', () => {
    const grade = montarGradePreEntradas({
      atuais: [doc({ idDocumento: 10, numeroDocumentoFiscal: '55' })],
      demais: [],
      idsMesa: new Set(),
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
      demais: [],
      idsMesa: new Set(),
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
      demais: [],
      idsMesa: new Set(),
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
      demais: [],
      idsMesa: new Set(),
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
      demais: [],
      idsMesa: new Set(),
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
      demais: [],
      idsMesa: new Set([20]),
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
    expect(grade.linhas[0]?.comunicacoes).toEqual([
      { numero: 1842, status: 'in_progress' },
      { numero: 1900, status: 'cancelled' },
    ]);
  });

  it('mantém a linha efetivada que passou pela Mesa e tem comunicação do Otimiza', () => {
    const grade = montarGradePreEntradas({
      atuais: [],
      demais: [doc({ idDocumento: 30, idTipoMovimentacao: 11, nomeTipo: 'Compra' })],
      idsMesa: new Set([30]),
      comunicacoes: [
        { idDocumentoEstoque: 30, idItemPedidoCompra: 8, numero: 77, status: 'completed' },
      ],
      vinculos: [],
      pedidosPorItem: new Map([[8, { idPedido: 1, nome: 'PC 1' }]]),
      apontamentos: [],
      idsConferidos: new Set([30]),
    });
    expect(grade.linhas).toHaveLength(1);
    expect(grade.linhas[0]?.situacao).toBe('efetivada');
    expect(grade.linhas[0]?.conferencia).toBe('conferida');
  });

  it('deixa de fora a nota comum que tem Otimiza e nunca passou pela Mesa', () => {
    const grade = montarGradePreEntradas({
      atuais: [],
      demais: [doc({ idDocumento: 40, idTipoMovimentacao: 11, nomeTipo: 'Compra' })],
      idsMesa: new Set(),
      comunicacoes: [
        { idDocumentoEstoque: 40, idItemPedidoCompra: 1, numero: 10, status: null },
      ],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
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
      demais: [],
      idsMesa: new Set(),
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

  it('preenche o chamado aberto pelo documento e pela NF, e esvazia a coluna se a consulta falhar', () => {
    const grade = montarGradePreEntradas({
      atuais: [
        doc({ idDocumento: 1, numeroDocumentoFiscal: 'DE40369', numeroNfe: '86110' }),
        doc({ idDocumento: 2, numeroDocumentoFiscal: 'DE40415', numeroNfe: null }),
      ],
      demais: [],
      idsMesa: new Set(),
      comunicacoes: [],
      vinculos: [],
      pedidosPorItem: new Map(),
      apontamentos: [],
      idsConferidos: new Set(),
    });
    const comChamado = aplicarChamadosAbertosOtimiza(
      grade,
      new Map([
        ['DE40369', [8752]],
        ['86110', [8746]],
        ['DE40415', []],
      ]),
    );
    expect(comChamado.chamadoOtimizaOk).toBe(true);
    expect(comChamado.linhas.map((linha) => [linha.idDocumento, linha.chamadosAbertos])).toEqual([
      [2, []],
      [1, [8746, 8752]],
    ]);

    const semConsulta = aplicarChamadosAbertosOtimiza(grade, null);
    expect(semConsulta.chamadoOtimizaOk).toBe(false);
    expect(semConsulta.linhas.every((linha) => linha.chamadosAbertos === null)).toBe(true);
  });
});
