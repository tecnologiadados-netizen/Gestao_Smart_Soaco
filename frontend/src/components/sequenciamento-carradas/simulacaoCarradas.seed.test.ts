import { describe, it, expect } from 'vitest';
import { filtrarSimulacaoSeedConsultaAoVivo, linhaCarradaKey } from './simulacaoCarradas';
import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';

const CARRADA = 'ROTA BELEM ABAETETUBA - LIBERADA';
const COD = '01688';

function linha(id: string, dataProducao: string | null): Record<string, unknown> {
  return {
    RM: COD,
    Observacoes: CARRADA,
    idChave: id,
    id_pedido: id,
    data_producao: dataProducao,
    previsao_entrega_atualizada: '2026-07-14',
  };
}

const carradas: SequenciamentoCarradaAgregada[] = [
  {
    cod: COD,
    carrada: CARRADA,
    saldoAFaturar: 100,
    saldoEmDia: 50,
    percentualEmDia: 50,
    adiantamento: 0,
    valorAVistaAte10d: 0,
  },
];

describe('filtrarSimulacaoSeedConsultaAoVivo', () => {
  it('semear produção do último snapshot quando baseline está vazio', () => {
    const linhas = [linha('a', null), linha('b', null)];
    const key = linhaCarradaKey(linhas[0]!);
    const seed = filtrarSimulacaoSeedConsultaAoVivo(linhas, carradas, {
      ordem: [key],
      itens: [{ chave: key, cod: COD, carrada: CARRADA, dataProducao: '2026-07-14' }],
    });
    expect(seed?.itens).toHaveLength(1);
    expect(seed?.itens[0]?.dataProducao).toBe('2026-07-14');
  });

  it('não sobrescreve carrada que já tem data no banco', () => {
    const linhas = [linha('a', '2026-07-13'), linha('b', '2026-07-13')];
    const key = linhaCarradaKey(linhas[0]!);
    const seed = filtrarSimulacaoSeedConsultaAoVivo(linhas, carradas, {
      ordem: [key],
      itens: [{ chave: key, cod: COD, carrada: CARRADA, dataProducao: '2026-07-14' }],
    });
    expect(seed).toBeNull();
  });
});
