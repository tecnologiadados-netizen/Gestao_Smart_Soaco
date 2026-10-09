import { describe, expect, it } from 'vitest';
import {
  SC_STATUS_LIBERADA,
  SQL_EXISTS_SC_DA_EMPRESA,
  SQL_IPC_COMPRADO,
  SQL_IPC_ATENDIDO,
  SQL_SC_LIBERADA_SEM_PEDIDO,
  montarLinhasPipeline,
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
  });
});
