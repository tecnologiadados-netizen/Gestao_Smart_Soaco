import { describe, expect, it } from 'vitest';
import {
  chaveFicha,
  classificarSetor,
  componentesDaPlanilha,
  fichasDoCodigo,
  incluirPecasDasListasFilhas,
  itemTemFicha,
  origemDaFicha,
  qtdePendenteReal,
  tipoComponente,
} from './regras.js';

describe('ficha de gôndolas e porta-paletes', () => {
  it('ignora o sufixo depois do ponto no código', () => {
    expect(chaveFicha('PI 2860.2')).toBe('PI 2860');
    expect(chaveFicha('  pa   12064.8 ')).toBe('PA 12064');
  });

  it('reconhece o setor mesmo com acento', () => {
    expect(classificarSetor('Gôndolas')).toBe('Gôndolas');
    expect(classificarSetor('Porta Paletes')).toBe('Porta Paletes');
    expect(classificarSetor('Fogões')).toBeNull();
  });

  it('calcula a quantidade pendente real pela rota', () => {
    expect(qtdePendenteReal('4-Inserir em Romaneio', 6, 2)).toBe(6);
    expect(qtdePendenteReal('3-Entrega em Grande Teresina', 4, 9)).toBe(4);
    expect(qtdePendenteReal('5-Requisicao', 8, 1)).toBe(0);
    expect(qtdePendenteReal('ROTA BELEM - LIBERADA', 3, 5)).toBe(5);
  });

  it('separa PI e PP pelo tipo do Nomus', () => {
    expect(tipoComponente('Produto intermediário')).toBe('PI');
    expect(tipoComponente('Produto em processo')).toBe('PP');
    expect(tipoComponente('Matéria-prima')).toBeNull();
  });

  it('marca ficha pelo Nomus e, sem lista, pela planilha do setor', () => {
    const planilha = [{ codigo: 'PI 2860' }];
    expect(itemTemFicha('PI 2860.2', [], planilha)).toBe(true);
    expect(origemDaFicha('PI 2860.2', [], planilha)).toBe('planilha');
    expect(origemDaFicha('PA 11023.2', ['PA 11023'], planilha)).toBe('nomus');
    expect(itemTemFicha('PA 11023.2', ['PA 11023'], [])).toBe(true);
    expect(origemDaFicha('PI 0021', ['PA 11023'], planilha)).toBe('nenhuma');
  });

  it('com as duas fichas usa o Nomus, a menos que a escolha guardada seja a planilha', () => {
    const planilha = [{ codigo: 'PA 11023' }];
    expect(fichasDoCodigo('PA 11023.2', ['PA 11023.2'], planilha)).toEqual({ nomus: true, planilha: true });
    expect(origemDaFicha('PA 11023.2', ['PA 11023.2'], planilha)).toBe('nomus');
    expect(origemDaFicha('PA 11023.2', ['PA 11023.2'], planilha, 'planilha')).toBe('planilha');
    expect(origemDaFicha('PA 11023.2', ['PA 11023.2'], [], 'planilha')).toBe('nomus');
  });

  it('a planilha do pai explode pela quantidade pendente real', () => {
    const linhas = componentesDaPlanilha(
      [
        {
          codigo: 'PI 4740',
          descricaoPeca: 'BANDA DA COLUNA',
          quantidade: 2,
          materiaPrima: '2,0',
          medida01: '3040',
          medida02: '198',
          pesoPeca: 18.9,
          codigoNomus: '',
        },
        {
          codigo: 'PI 9999',
          descricaoPeca: 'OUTRA',
          quantidade: 1,
          materiaPrima: '1,2',
          medida01: '10',
          medida02: '',
          pesoPeca: 0,
          codigoNomus: 'MP 1',
        },
      ],
      'PI 4740.1',
      3
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.descricao).toBe('BANDA DA COLUNA');
    expect(linhas[0]?.quantidadeTotal).toBe(6);
  });

  it('inclui o PP da lista de produção de cada PI', () => {
    const pi = {
      codigo: 'PI 0015',
      descricao: 'MÃO FRANCESA',
      tipo: 'PI' as const,
      quantidade: 16,
      quantidadeTotal: 16,
      materiaPrima: '',
      medida01: '',
      medida02: '',
    };
    const lista = incluirPecasDasListasFilhas(
      [pi],
      [
        {
          codigoPai: 'PI 0015',
          codigo: 'PP 2308',
          descricao: 'MÃO FRANCESA SEM PINTURA',
          tipo: 'PP',
          quantidade: 1,
        },
      ],
      1
    );
    expect(lista.map((peca) => peca.codigo)).toEqual(['PI 0015', 'PP 2308']);
    expect(lista[1]?.quantidade).toBe(16);
    expect(lista[1]?.quantidadeTotal).toBe(16);
  });
});
