import { describe, it, expect, vi } from 'vitest';
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
  computarBaselines,
  listarCarradasComDatasPassadas,
  atualizarEstadoLinhaCorrigirDatas,
  listarProdutosSetorCalendario,
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

  it('disponível sem data_producao usa hoje como produção', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00'));
    const linha: Record<string, unknown> = {
      RM: '01677',
      Observacoes: 'ROTA BAIXADA',
      Card: 'Disponível',
      previsao_entrega_atualizada: '2026-08-15',
      PD: '9005',
      Cod: 'MNO',
    };
    expect(dataProducaoDaLinha(linha, sim, baseline)).toBe('2026-07-14');
    expect(resolverDataCalendarioLinha(linha, sim, baseline)).toEqual({
      data: '2026-07-14',
      origem: 'producao',
    });
    vi.useRealTimers();
  });
});

describe('listarCarradasComDatasPassadas', () => {
  it('inclui carrada quando previsão atual é anterior a hoje', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '01677',
        Observacoes: 'ROTA BAIXADA',
        previsao_entrega_atualizada: '2026-07-03',
        PD: '9001',
        Cod: 'ABC',
      },
    ];
    const key = linhaCarradaKey(linhas[0]!);
    const bl = computarBaselines(linhas);
    const simLocal = new Map<string, SimEntry>([[key, { dataEntrega: '' }]]);
    const invalidas = listarCarradasComDatasPassadas(
      [{ cod: '01677', carrada: 'ROTA BAIXADA' }],
      simLocal,
      bl,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-14',
      linhas
    );
    expect(invalidas).toHaveLength(1);
    expect(invalidas[0]?.previsaoPassada).toBe(true);
    expect(invalidas[0]?.previsaoAtual).toBe('2026-07-03');
  });

  it('remove carrada após ajuste de produção e entrega para hoje ou futuro', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '01677',
        Observacoes: 'ROTA BAIXADA',
        previsao_entrega_atualizada: '2026-07-03',
        PD: '9001',
        Cod: 'ABC',
      },
    ];
    const key = linhaCarradaKey(linhas[0]!);
    const bl = computarBaselines(linhas);
    const simLocal = new Map<string, SimEntry>([
      [key, { dataProducao: '2026-07-14', dataEntrega: '2026-07-15' }],
    ]);
    const invalidas = listarCarradasComDatasPassadas(
      [{ cod: '01677', carrada: 'ROTA BAIXADA' }],
      simLocal,
      bl,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-14',
      linhas
    );
    expect(invalidas).toHaveLength(0);
  });
});

describe('listarProdutosSetorCalendario', () => {
  const sim = new Map<string, SimEntry>();
  const baseline = new Map<string, CarradaBaseline>();

  it('agrega códigos do setor com qtde pendente no calendário', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '01677',
        Observacoes: 'ROTA',
        'Setor de Producao': 'Cadeiras',
        data_producao: '2026-08-20',
        'Qtde Pendente Real': 5,
        Cod: 'PA 100',
        'Descricao do produto': 'Cadeira A',
        PD: '9001',
      },
      {
        RM: '01678',
        Observacoes: 'ROTA 2',
        'Setor de Producao': 'Cadeiras',
        data_producao: '2026-08-21',
        'Qtde Pendente Real': 3,
        Cod: 'PA 100',
        'Descricao do produto': 'Cadeira A',
        PD: '9002',
      },
      {
        RM: '01679',
        Observacoes: 'ROTA 3',
        'Setor de Producao': 'Balcões',
        data_producao: '2026-08-20',
        'Qtde Pendente Real': 10,
        Cod: 'PA 200',
        'Descricao do produto': 'Balcão X',
        PD: '9003',
      },
    ];
    const bl = computarBaselines(linhas);
    const produtos = listarProdutosSetorCalendario(linhas, 'Cadeiras', sim, bl);
    expect(produtos).toHaveLength(1);
    expect(produtos[0]).toMatchObject({ codigo: 'PA 100', qtdePendente: 8 });
  });
});

describe('listarCarradasComDatasPassadas — itens especiais', () => {
  const sim = new Map<string, SimEntry>();
  const baseline = new Map<string, CarradaBaseline>();

  it('desmembra carradas especiais em itens de pedido', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '—',
        Observacoes: '3-Entrega em Grande Teresina',
        id_pedido: 'p1',
        PD: '49104',
        Cliente: 'Cliente A',
        Cod: 'PA 100',
        'Descricao do produto': 'Produto A',
        previsao_entrega_atualizada: '2026-07-03',
        'Qtde Pendente Real': 2,
      },
      {
        RM: '—',
        Observacoes: '3-Entrega em Grande Teresina',
        id_pedido: 'p2',
        PD: '49345',
        Cliente: 'Cliente B',
        Cod: 'PA 200',
        'Descricao do produto': 'Produto B',
        previsao_entrega_atualizada: '2026-07-03',
        'Qtde Pendente Real': 1,
      },
    ];
    const carradas = [{ cod: '—', carrada: '3-Entrega em Grande Teresina' }];
    const invalidas = listarCarradasComDatasPassadas(
      carradas,
      sim,
      baseline,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-14',
      linhas
    );
    expect(invalidas).toHaveLength(2);
    expect(invalidas.every((i) => i.idPedido)).toBe(true);
    expect(invalidas.map((i) => i.pedido).sort()).toEqual(['49104', '49345']);
  });

  it('exclui itens Inserir em Romaneio', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '—',
        Observacoes: '4-Inserir em Romaneio',
        tipoF: 'Inserir em Romaneio',
        id_pedido: 'rom1',
        PD: '47494',
        Cliente: 'Cliente X',
        Cod: 'PA 5445',
        'Descricao do produto': 'Produto',
        previsao_entrega_atualizada: '2026-07-03',
        'Qtde Pendente Real': 2,
      },
    ];
    const invalidas = listarCarradasComDatasPassadas(
      [{ cod: '—', carrada: '4-Inserir em Romaneio' }],
      sim,
      baseline,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-14',
      linhas
    );
    expect(invalidas).toHaveLength(0);
  });

  it('exclui carradas em formação (EM CONSTRUÇÃO)', () => {
    const keyFormacao = '01712\x1eROTA SÃO LUIS - EM CONSTRUÇÃO';
    const keyNormal = '01700\x1eROTA BELEM 04.2';
    const bl = new Map([
      [
        keyFormacao,
        {
          dataProducao: '2026-07-10',
          dataEntrega: '2026-07-15',
          dataProducaoDivergente: false,
          dataEntregaDivergente: false,
        },
      ],
      [
        keyNormal,
        {
          dataProducao: '2026-07-10',
          dataEntrega: '2026-07-12',
          dataProducaoDivergente: false,
          dataEntregaDivergente: false,
        },
      ],
    ]);
    const invalidas = listarCarradasComDatasPassadas(
      [
        { cod: '01712', carrada: 'ROTA SÃO LUIS - EM CONSTRUÇÃO' },
        { cod: '01700', carrada: 'ROTA BELEM 04.2' },
      ],
      sim,
      bl,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-20'
    );
    expect(invalidas).toHaveLength(1);
    expect(invalidas[0]?.carrada).toBe('ROTA BELEM 04.2');
  });

  it('propaga badges de Status/Card nos itens de pedido', () => {
    const linhas: Record<string, unknown>[] = [
      {
        RM: '—',
        Observacoes: '1-Retirada na So Aço',
        id_pedido: 'p48418a',
        PD: '48418',
        Cliente: 'PAPEL NORTE',
        Cod: 'PA 5430',
        'Descricao do produto': 'Armario',
        Status: 'Atrasado',
        Card: 'Card',
        'Valor Faturado Entrega Futura + IPI do item do Pedido': 0,
        previsao_entrega_atualizada: '2026-07-17',
        'Qtde Pendente Real': 10,
      },
    ];
    const invalidas = listarCarradasComDatasPassadas(
      [{ cod: '—', carrada: '1-Retirada na So Aço' }],
      sim,
      baseline,
      (c) => `${c.cod}\x1e${c.carrada}`,
      '2026-07-20',
      linhas
    );
    expect(invalidas).toHaveLength(1);
    expect(invalidas[0]).toMatchObject({
      statusPrazo: 'Atrasado',
      card: 'Card',
      pedido: '48418',
    });
  });
});

describe('atualizarEstadoLinhaCorrigirDatas', () => {
  it('marca concluida quando datas passam a ser válidas', () => {
    const snap = {
      key: 'item:10',
      cod: 'C1',
      carrada: '1-Retirada',
      dataProducao: '2026-07-01',
      dataEntrega: '2026-07-02',
      producaoPassada: true,
      entregaPassada: true,
      idPedido: '10',
      pedido: '48418',
    };
    const sim = new Map<string, SimEntry>([
      ['item:10', { dataProducao: '2026-07-20', dataEntrega: '2026-07-25' }],
    ]);
    const atual = atualizarEstadoLinhaCorrigirDatas(snap, sim, new Map(), undefined, '2026-07-14');
    expect(atual.concluida).toBe(true);
    expect(atual.producaoPassada).toBe(false);
    expect(atual.entregaPassada).toBe(false);
    expect(atual.dataProducao).toBe('2026-07-20');
    expect(atual.dataEntrega).toBe('2026-07-25');
  });

  it('permanece pendente se ainda houver data vencida', () => {
    const snap = {
      key: 'c1\x1ecarr',
      cod: 'C1',
      carrada: 'Carrada A',
      dataProducao: '2026-07-01',
      dataEntrega: '2026-07-02',
      producaoPassada: true,
      entregaPassada: true,
    };
    const sim = new Map<string, SimEntry>([
      ['c1\x1ecarr', { dataProducao: '2026-07-20', dataEntrega: '2026-07-10' }],
    ]);
    const atual = atualizarEstadoLinhaCorrigirDatas(snap, sim, new Map(), undefined, '2026-07-14');
    expect(atual.concluida).toBe(false);
    expect(atual.entregaPassada).toBe(true);
  });
});
