import { describe, expect, it } from 'vitest';
import {
  SC_STATUS_LIBERADA,
  SQL_EXISTS_SC_DA_EMPRESA,
  SQL_IPC_COMPRADO,
  SQL_IPC_ATENDIDO,
  SQL_SC_LIBERADA_SEM_PEDIDO,
  SQL_STATUS_ITEM_PEDIDO,
  SQL_IPC_DATA_ENTREGA_A_ATUALIZAR,
  IPC_STATUS_DATA_ENTREGA_SQL,
  DATA_ENTREGA_DIAS_ALERTA,
  ordenarPedidosDataEntrega,
  montarItensPedido,
  montarItensPreEntrada,
  montarLinhasPipeline,
  parseRefsDocumento,
  unirTokensBusca,
} from './acompanhamentoSolicitacaoRepository.js';

describe('montarLinhasPipeline', () => {
  const produtos = [
    { idProduto: 2, codigo: 'B', descricao: 'Beta', unidadeMedida: 'UN' },
    { idProduto: 1, codigo: 'A', descricao: 'Alfa', unidadeMedida: 'KG' },
    { idProduto: 3, codigo: 'C', descricao: 'Gama', unidadeMedida: 'UN' },
  ];

  it('mantém uma linha por produto e as quantidades de cada etapa', () => {
    const linhas = montarLinhasPipeline(
      produtos,
      new Map([[1, { qtde: 10, emissao: '2026-08-01', necessidade: '2026-08-15' }]]),
      new Map([
        [1, { qtde: 4, emissao: '2026-08-02' }],
        [2, { qtde: 7, emissao: '2026-09-01' }],
      ]),
      new Map([[2, { qtde: 3, emissao: '2026-09-10' }]])
    );
    expect(linhas.map((l) => l.codigo)).toEqual(['A', 'B']);
    expect(linhas[0]).toMatchObject({
      qtdeSolicitado: 10,
      qtdeComprado: 4,
      qtdePreEntrada: 0,
      emissaoSolicitacao: '2026-08-01',
      necessidadeSolicitacao: '2026-08-15',
      emissaoPedido: '2026-08-02',
      emissaoPreEntrada: null,
    });
    expect(linhas[1]).toMatchObject({
      qtdeSolicitado: 0,
      qtdeComprado: 7,
      qtdePreEntrada: 3,
      emissaoSolicitacao: null,
      emissaoPedido: '2026-09-01',
      emissaoPreEntrada: '2026-09-10',
    });
  });

  it('mostra pré-entrada mesmo sem solicitação liberada na linha', () => {
    const linhas = montarLinhasPipeline(
      produtos,
      new Map(),
      new Map(),
      new Map([[3, { qtde: 12.5, emissao: '2026-09-15' }]])
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ codigo: 'C', qtdePreEntrada: 12.5 });
  });

  it('reúne solicitação, pedido e documento das três etapas para a busca', () => {
    const linhas = montarLinhasPipeline(
      produtos,
      new Map([[1, { qtde: 10, emissao: '2026-08-01', necessidade: '2026-08-15', solicitacoes: '900' }]]),
      new Map([[1, { qtde: 4, emissao: '2026-08-02', pedidos: 'PC 10', solicitacoes: '900\n901' }]]),
      new Map([
        [
          1,
          {
            qtde: 2,
            emissao: '2026-08-20',
            documentos: '55221',
            pedidos: 'PC 10\nPC 11',
            solicitacoes: '901',
          },
        ],
      ])
    );
    expect(linhas[0]).toMatchObject({
      solicitacoes: '900\n901',
      pedidos: 'PC 10\nPC 11',
      documentos: '55221',
    });
  });
});

describe('unirTokensBusca', () => {
  it('ignora vazio e não repete o mesmo número', () => {
    expect(unirTokensBusca('12\n12', ' 12 ', null, 'PC 1,PC 1')).toBe('12\nPC 1');
  });
});

describe('recorte SQL do pipeline', () => {
  it('só a etapa Solicitado exige status Liberada e ausência de pedido', () => {
    expect(SQL_SC_LIBERADA_SEM_PEDIDO).toContain(`sc.status = ${SC_STATUS_LIBERADA}`);
    expect(SQL_SC_LIBERADA_SEM_PEDIDO).toContain('NOT EXISTS');
    expect(SQL_IPC_COMPRADO).not.toContain(`status = ${SC_STATUS_LIBERADA}`);
    expect(SQL_IPC_ATENDIDO).not.toContain(`status = ${SC_STATUS_LIBERADA}`);
    expect(SQL_EXISTS_SC_DA_EMPRESA).not.toContain('sc.status');
  });

  it('trata status 1 do item de pedido como atendido, não como fora do pipeline', () => {
    expect(SQL_IPC_ATENDIDO).toContain('NOT IN (5, 6)');
    expect(SQL_IPC_ATENDIDO).not.toContain('NOT IN (1,');
    expect(SQL_IPC_ATENDIDO).not.toContain('EXISTS');
    expect(SQL_IPC_COMPRADO).toContain('EXISTS');
  });

  it('status do item do pedido reaproveita os recortes da grade', () => {
    expect(SQL_STATUS_ITEM_PEDIDO).toContain(SQL_IPC_COMPRADO);
    expect(SQL_STATUS_ITEM_PEDIDO).toContain(SQL_IPC_ATENDIDO);
  });
});

describe('datas de entrega a atualizar', () => {
  it('Liberado/parcial ou atendido com pré-entrada, na janela de dias', () => {
    expect(IPC_STATUS_DATA_ENTREGA_SQL).toBe('2, 3');
    expect(SQL_IPC_DATA_ENTREGA_A_ATUALIZAR).toContain(`ipc.status IN (${IPC_STATUS_DATA_ENTREGA_SQL})`);
    expect(SQL_IPC_DATA_ENTREGA_A_ATUALIZAR).toContain(SQL_IPC_ATENDIDO);
    expect(SQL_IPC_DATA_ENTREGA_A_ATUALIZAR).toContain(`INTERVAL ${DATA_ENTREGA_DIAS_ALERTA} DAY`);
    expect(SQL_IPC_DATA_ENTREGA_A_ATUALIZAR).toContain('ipc.dataEntrega IS NULL');
  });

  it('ordena sem data primeiro, depois o mais atrasado', () => {
    const base = {
      fornecedor: null,
      dataEmissao: null,
      itens: 1,
      liberados: 1,
      parciais: 0,
      preEntradas: 0,
      menorDataEntrega: null,
    };
    const ordem = ordenarPedidosDataEntrega([
      { ...base, idPedido: 1, pedido: 'PC 1', semData: 0, menorDias: 3 },
      { ...base, idPedido: 2, pedido: 'PC 2', semData: 0, menorDias: -10 },
      { ...base, idPedido: 3, pedido: 'PC 3', semData: 1, menorDias: null },
    ]).map((p) => p.pedido);
    expect(ordem).toEqual(['PC 3', 'PC 2', 'PC 1']);
  });
});

describe('parseRefsDocumento', () => {
  it('lê id|número sem repetir o mesmo id', () => {
    expect(parseRefsDocumento('10|PC 10\n11|PC 11\n10|PC 10')).toEqual([
      { id: 10, numero: 'PC 10' },
      { id: 11, numero: 'PC 11' },
    ]);
    expect(parseRefsDocumento(null)).toEqual([]);
  });
});

describe('montarItensPedido', () => {
  it('em caminho: saldo no Comprado e soma única dos itens 173 na Pré-entrada', () => {
    const itens = montarItensPedido(
      [
        { idItem: 1, idProduto: 7, codigo: 'MP 1', qtde: 10, qtdeAtendida: 4, saldo: 6, status: 'comprado' },
        { idItem: 2, idProduto: 8, codigo: 'MP 2', qtde: 5, qtdeAtendida: 5, saldo: 0, status: 'pre_entrada' },
        { idItem: 3, idProduto: 9, codigo: 'MP 3', qtde: 2, qtdeAtendida: 2, saldo: 0, status: 'recebido' },
      ],
      [
        { idItemPedido: 2, idItemDocumento: 50, qtde: 3, idDocumento: 900, numeroDocumento: '55' },
        { idItemPedido: 2, idItemDocumento: 51, qtde: 2, idDocumento: 900, numeroDocumento: '55' },
        { idItemPedido: 2, idItemDocumento: 51, qtde: 2, idDocumento: 900, numeroDocumento: '55' },
      ]
    );
    expect(itens.map((i) => i.qtdeCaminho)).toEqual([6, 5, 0]);
    expect(itens[1].preEntradas).toEqual([{ id: 900, numero: '55' }]);
  });
});

describe('montarItensPreEntrada', () => {
  it('soma em caminho só o item dentro do recorte da grade', () => {
    const itens = montarItensPreEntrada(
      [
        { idItem: 50, idProduto: 7, codigo: 'MP 1', qtde: 3, status: 'pre_entrada' },
        { idItem: 51, idProduto: 8, codigo: 'MP 2', qtde: 4, status: 'pre_entrada_fora_grade' },
      ],
      [
        { idItemDocumento: 50, idPedido: 10, pedido: 'PC 10', solicitacoes: '901' },
        { idItemDocumento: 50, idPedido: 11, pedido: 'PC 11', solicitacoes: '900, 901' },
      ]
    );
    expect(itens.map((i) => i.qtdeCaminho)).toEqual([3, 0]);
    expect(itens[0].pedidos.map((p) => p.numero)).toEqual(['PC 10', 'PC 11']);
    expect(itens[0].solicitacoes).toBe('900, 901');
  });
});
