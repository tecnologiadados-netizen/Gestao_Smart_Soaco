import { describe, it, expect } from 'vitest';
import {
  montarEixoDatasCalendario,
  isFimDeSemana,
  proximoDiaUtil,
  dataProducaoDaLinha,
  dataProducaoInserirRomaneioApartirDe,
  maxDataProducaoCarradasNormais,
  computarCalendarioProducao,
  resolverDataCalendarioLinha,
  encontrarLinhaSnapshotNoDrill,
  linhaCarradaKey,
  type SimEntry,
  type CarradaBaseline,
} from './simulacaoCarradas';

describe('montarEixoDatasCalendario', () => {
  it('descarta colunas antes da primeira data com saldo', () => {
    const total = new Map<string, number>([
      ['2026-03-13', 120],
      ['2026-03-14', 0],
      ['2026-04-06', 50],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    const datas = colunas.filter((c) => c.tipo === 'data').map((c) => (c.tipo === 'data' ? c.iso : ''));
    expect(datas[0]).toBe('2026-03-13');
    expect(datas.some((d) => d < '2026-03-13')).toBe(false);
  });

  it('colapsa gap ≥5 dias em coluna ociosa', () => {
    const total = new Map<string, number>([
      ['2026-03-13', 100],
      ['2026-04-06', 50],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    expect(colunas.some((c) => c.tipo === 'ocioso')).toBe(true);
    const ocioso = colunas.find((c) => c.tipo === 'ocioso');
    expect(ocioso?.tipo === 'ocioso' && ocioso.de).toBe('2026-03-13');
  });

  it('inclui fins de semana em intervalo curto', () => {
    const total = new Map<string, number>([
      ['2026-07-09', 10],
      ['2026-07-13', 20],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    const datas = colunas.filter((c) => c.tipo === 'data').map((c) => (c.tipo === 'data' ? c.iso : ''));
    expect(datas).toContain('2026-07-11');
    expect(isFimDeSemana('2026-07-11')).toBe(true);
  });
});

describe('Inserir em Romaneio — data de produção', () => {
  it('proximoDiaUtil avança para segunda quando cai no sábado', () => {
    // 2026-07-10 = sexta → +1 útil = sábado → segunda 13
    expect(proximoDiaUtil('2026-07-10')).toBe('2026-07-13');
    // quinta → sexta
    expect(proximoDiaUtil('2026-07-09')).toBe('2026-07-10');
  });

  it('dataProducaoInserirRomaneioApartirDe usa 1 dia útil após o máximo', () => {
    expect(dataProducaoInserirRomaneioApartirDe('2026-07-10')).toBe('2026-07-13');
    expect(dataProducaoInserirRomaneioApartirDe('')).toBe('');
  });

  it('usa 1 dia útil após a maior data das carradas normais', () => {
    const linhaNormal: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      data_producao: '2026-07-10',
      'Qtde Pendente Real': 10,
      PD: '1',
    };
    const linhaRomaneio: Record<string, unknown> = {
      RM: '—',
      Observacoes: 'Inserir em Romaneio',
      tipoF: 'Inserir em Romaneio',
      Emissao: '2025-01-01',
      previsao_entrega: '2026-01-01',
      'Qtde Pendente Real': 120,
      'Setor de Producao': '',
      PD: '47776',
    };
    const key = linhaCarradaKey(linhaNormal);
    const baseline = new Map<string, CarradaBaseline>([
      [key, { dataProducao: '2026-07-10', dataEntrega: '', dataProducaoDivergente: false, dataEntregaDivergente: false }],
    ]);
    const max = maxDataProducaoCarradasNormais([linhaNormal, linhaRomaneio], new Map(), baseline);
    expect(max).toBe('2026-07-10');
    const dataInserir = dataProducaoInserirRomaneioApartirDe(max);
    expect(dataProducaoDaLinha(linhaRomaneio, new Map(), baseline, dataInserir)).toBe('2026-07-13');
  });

  it('posiciona no calendário no dia útil seguinte ao máximo das carradas', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '01677',
        Observacoes: 'ROTA BAIXADA',
        data_producao: '2026-07-10',
        'Qtde Pendente Real': 10,
        'Setor de Producao': 'Solda',
        PD: '1',
      },
      {
        RM: '—',
        Observacoes: 'Inserir em Romaneio',
        tipoF: 'Inserir em Romaneio',
        Emissao: '13/12/2025',
        previsao_entrega: '2026-01-01',
        'Qtde Pendente Real': 120,
        'Setor de Producao': '',
        PD: '47776',
      },
    ];
    const key = linhaCarradaKey(linhas[0]!);
    const baseline = new Map<string, CarradaBaseline>([
      [key, { dataProducao: '2026-07-10', dataEntrega: '', dataProducaoDivergente: false, dataEntregaDivergente: false }],
    ]);
    const sim = new Map<string, SimEntry>();
    const dados = computarCalendarioProducao(linhas, sim, baseline);
    expect(dados.totalPorData.get('2026-07-10')).toBe(10);
    expect(dados.totalPorData.get('2026-07-13')).toBe(120);
  });
});

describe('Fallback previsão atual no calendário', () => {
  const sim = new Map<string, SimEntry>();
  const baseline = new Map<string, CarradaBaseline>();

  it('posiciona linha sem data_producao pela previsão atual com flag', () => {
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      previsao_entrega_atualizada: '2026-08-15',
      'Qtde Pendente Real': 25,
      'Setor de Producao': 'Pintura',
      tipoF: 'Normal',
      PD: '9001',
      Cod: 'ABC',
    };
    const resolvido = resolverDataCalendarioLinha(linha, sim, baseline);
    expect(resolvido).toEqual({ data: '2026-08-15', origem: 'previsao' });

    const dados = computarCalendarioProducao([linha], sim, baseline);
    expect(dados.totalPorData.get('2026-08-15')).toBe(25);
    expect(dados.detalhes[0]?.producaoPorPrevisao).toBe(true);
  });

  it('usa data_producao quando preenchida (sem flag de fallback)', () => {
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      data_producao: '2026-08-20',
      previsao_entrega_atualizada: '2026-08-15',
      'Qtde Pendente Real': 10,
      'Setor de Producao': 'Solda',
      PD: '9002',
      Cod: 'DEF',
    };
    const key = linhaCarradaKey(linha);
    const bl = new Map<string, CarradaBaseline>([
      [key, { dataProducao: '2026-08-20', dataEntrega: '2026-08-15', dataProducaoDivergente: false, dataEntregaDivergente: false }],
    ]);
    const dados = computarCalendarioProducao([linha], sim, bl);
    expect(dados.totalPorData.get('2026-08-20')).toBe(10);
    expect(dados.detalhes[0]?.producaoPorPrevisao).toBeUndefined();
  });

  it('exclui linha sem data_producao e sem previsão', () => {
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      'Qtde Pendente Real': 5,
      'Setor de Producao': 'Solda',
      PD: '9003',
      Cod: 'GHI',
    };
    const dados = computarCalendarioProducao([linha], sim, baseline);
    expect(dados.totalGeral).toBe(0);
    expect(dados.detalhes).toHaveLength(0);
  });

  it('maxDataProducaoCarradasNormais ignora fallback de previsão', () => {
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      previsao_entrega_atualizada: '2026-09-01',
      'Qtde Pendente Real': 15,
      PD: '9004',
      Cod: 'JKL',
    };
    expect(maxDataProducaoCarradasNormais([linha], sim, baseline)).toBe('');
  });

  it('encontrarLinhaSnapshotNoDrill localiza item posicionado por previsão', () => {
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      previsao_entrega_atualizada: '2026-08-15',
      'Qtde Pendente Real': 25,
      'Setor de Producao': 'Pintura',
      tipoF: 'Normal',
      PD: '9001',
      Cod: 'ABC',
    };
    const encontrada = encontrarLinhaSnapshotNoDrill(
      [linha],
      '9001',
      { setor: 'Pintura', data: '2026-08-15', tipoF: 'Normal' },
      sim,
      baseline
    );
    expect(encontrada).toBe(linha);
  });
});
