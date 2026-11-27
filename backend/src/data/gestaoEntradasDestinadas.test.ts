import { describe, expect, it } from 'vitest';
import {
  chamadosExclusivosPorPalavra,
  documentoExibidoDestinada,
  erroPeriodoDestinadas,
  fundirChamadosDestinada,
  montarLinhaDestinada,
  palavrasDaNota,
  situacaoNotaDestinada,
  type ChamadoDestinada,
  type DocDestinadaOrigem,
} from './gestaoEntradasDestinadas.js';

function chamado(parcial: Partial<ChamadoDestinada> & Pick<ChamadoDestinada, 'numero'>): ChamadoDestinada {
  return {
    status: 'in_progress',
    responsavel: null,
    processo: null,
    ...parcial,
  };
}

const origemVazia: DocDestinadaOrigem = {
  idDocumento: null,
  numeroDocumentoFiscal: null,
  idTipoMovimentacao: null,
  nomeTipo: null,
  dataEntrada: null,
  idParceiro: null,
};

describe('situação da nota destinada', () => {
  it('recusa período maior que 62 dias', () => {
    expect(erroPeriodoDestinadas('2026-11-01', '2026-11-27')).toBeNull();
    expect(erroPeriodoDestinadas('2026-09-01', '2026-11-27')).toMatch(/62/);
  });

  it('ignora número curto demais para o Otimiza', () => {
    expect(palavrasDaNota('448', ['DE1', 'DE40522'])).toEqual(['DE40522']);
  });

  it('não atribui o chamado que cita várias notas do período', () => {
    const mapa = chamadosExclusivosPorPalavra(
      new Map([
        ['4659', [chamado({ numero: 8968 })]],
        ['15749', [chamado({ numero: 8968 })]],
        ['359305', [chamado({ numero: 9001, status: 'completed' })]],
      ])
    );
    expect(mapa.get('4659')).toEqual([]);
    expect(mapa.get('15749')).toEqual([]);
    expect(mapa.get('359305')?.map((item) => item.numero)).toEqual([9001]);
  });

  it('mantém o número gravado no Double Check junto do chamado encontrado pelo nome', () => {
    const fundidos = fundirChamadosDestinada(
      [chamado({ numero: 10, status: 'completed', responsavel: 'Compras' })],
      [chamado({ numero: 10, status: 'in_progress' }), chamado({ numero: 11, status: 'in_progress', responsavel: 'Fiscal' })]
    );
    expect(fundidos.map((item) => item.numero)).toEqual([11, 10]);
    expect(fundidos[1]).toMatchObject({ status: 'completed', responsavel: 'Compras' });
  });

  it('mostra a entrada efetivada quando a pré-entrada ganhou outro documento', () => {
    const exibido = documentoExibidoDestinada(
      {
        idDocumento: 10,
        numeroDocumentoFiscal: 'DE10',
        idTipoMovimentacao: 46,
        nomeTipo: 'PRÉ ENTRADA',
        dataEntrada: '2026-11-02',
        idParceiro: 3,
      },
      {
        idDocumento: 20,
        numeroDocumentoFiscal: 'DE20',
        idTipoMovimentacao: 111,
        nomeTipo: 'Compra',
        dataEntrada: '2026-11-10',
        idParceiro: 3,
      }
    );
    expect(exibido).toMatchObject({ idDocumento: 20, efetivado: true, nomeTipo: 'Compra' });
  });

  it('classifica a nota sem documento pelo chamado e pela manifestação', () => {
    expect(
      situacaoNotaDestinada({
        idDocumento: null,
        efetivado: false,
        conferencia: 'sem_documento',
        fisica: 'sem_registro',
        manifestacao: null,
        chamados: [],
      })
    ).toBe('aguardando_confirmacao');
    expect(
      situacaoNotaDestinada({
        idDocumento: null,
        efetivado: false,
        conferencia: 'sem_documento',
        fisica: 'sem_registro',
        manifestacao: null,
        chamados: [chamado({ numero: 1 })],
      })
    ).toBe('em_confirmacao');
    expect(
      situacaoNotaDestinada({
        idDocumento: null,
        efetivado: false,
        conferencia: 'sem_documento',
        fisica: 'sem_registro',
        manifestacao: null,
        chamados: [chamado({ numero: 1, status: 'completed' })],
      })
    ).toBe('confirmada_sem_documento');
    expect(
      situacaoNotaDestinada({
        idDocumento: null,
        efetivado: false,
        conferencia: 'sem_documento',
        fisica: 'sem_registro',
        manifestacao: 3,
        chamados: [chamado({ numero: 1 })],
      })
    ).toBe('nao_e_compra');
  });

  it('segue a pré-entrada até a Mesa e a entrada lançada', () => {
    const base = {
      idDestinada: 1,
      numero: '359336',
      serie: '1',
      nomeFornecedor: 'Fornecedor',
      dataEmissao: '2026-11-26',
      valor: 10,
      statusNomus: 2,
      manifestacao: 1,
      finalidade: 1,
      pedidosOrigem: [{ idPedido: 7, nome: 'PC 7' }],
      pedidosAtual: [],
      conferidoPor: 'Ana',
      irmao: null,
    };
    const pendente = montarLinhaDestinada({
      ...base,
      origem: {
        idDocumento: 10,
        numeroDocumentoFiscal: 'DE10',
        idTipoMovimentacao: 46,
        nomeTipo: 'PRÉ ENTRADA',
        dataEntrada: '2026-11-26',
        idParceiro: 3,
      },
      conferido: false,
      fisica: 'sem_registro',
      chamados: [],
    });
    expect(pendente.situacao).toBe('pre_entrada_pendente');
    expect(pendente.conferencia).toBe('pendente');
    expect(pendente.pedidos).toEqual([{ idPedido: 7, nome: 'PC 7' }]);

    const divergencia = montarLinhaDestinada({
      ...base,
      origem: pendente.idDocumento
        ? {
            idDocumento: 10,
            numeroDocumentoFiscal: 'DE10',
            idTipoMovimentacao: 46,
            nomeTipo: 'PRÉ ENTRADA',
            dataEntrada: '2026-11-26',
            idParceiro: 3,
          }
        : origemVazia,
      conferido: false,
      fisica: 'sem_registro',
      chamados: [chamado({ numero: 80, responsavel: 'Compras' })],
    });
    expect(divergencia.situacao).toBe('divergencia_responsavel');

    const mesa = montarLinhaDestinada({
      ...base,
      origem: {
        idDocumento: 10,
        numeroDocumentoFiscal: 'DE10',
        idTipoMovimentacao: 46,
        nomeTipo: 'PRÉ ENTRADA',
        dataEntrada: '2026-11-26',
        idParceiro: 3,
      },
      conferido: true,
      fisica: 'em_conferencia',
      chamados: [],
    });
    expect(mesa.situacao).toBe('em_conferencia_fisica');
    expect(mesa.conferidoPor).toBe('Ana');

    const lancada = montarLinhaDestinada({
      ...base,
      origem: {
        idDocumento: 10,
        numeroDocumentoFiscal: 'DE10',
        idTipoMovimentacao: 46,
        nomeTipo: 'PRÉ ENTRADA',
        dataEntrada: '2026-11-26',
        idParceiro: 3,
      },
      irmao: {
        idDocumento: 20,
        numeroDocumentoFiscal: 'DE20',
        idTipoMovimentacao: 111,
        nomeTipo: 'Compra',
        dataEntrada: '2026-11-27',
        idParceiro: 3,
      },
      conferido: true,
      fisica: 'finalizada',
      chamados: [],
      pedidosAtual: [{ idPedido: 8, nome: 'PC 8' }],
    });
    expect(lancada.situacao).toBe('documento_lancado');
    expect(lancada.numeroDocumento).toBe('DE20');
    expect(lancada.nomeTipo).toBe('Compra');
    expect(lancada.pedidos).toEqual([{ idPedido: 8, nome: 'PC 8' }]);
  });
});
