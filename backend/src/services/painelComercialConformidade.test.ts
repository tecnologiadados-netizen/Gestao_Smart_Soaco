import { describe, expect, it } from 'vitest';
import {
  analisarConformidade,
  arraysDiasIguais,
  DEFAULT_POLITICA_COMERCIAL,
  diasEsperadosParcelas,
  extrairDiasDaCondicao,
  faixaTicket,
  isRetiradaSoAco,
  mediaPrazoDias,
  prazoConcedidoNaoPior,
  prazoMedioParcelasConforme,
} from './painelComercialConformidade.js';

describe('painelComercialConformidade', () => {
  it('extrai dias do nome da condição', () => {
    expect(extrairDiasDaCondicao('30 + 45 + 60 DIAS')).toEqual([30, 45, 60]);
    expect(extrairDiasDaCondicao('20/30/40')).toEqual([20, 30, 40]);
  });

  it('extrai todas as parcelas longas (ex.: até 300 dias)', () => {
    const s = '(11x) Entrada/30/60/90/120/150/180/210/240/270/300';
    expect(extrairDiasDaCondicao(s)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
    expect(mediaPrazoDias(extrairDiasDaCondicao(s))).toBe(165);
  });

  it('extrai dias respeitando prazo inicial/final da política', () => {
    const p = { ...DEFAULT_POLITICA_COMERCIAL, diasCondicaoMin: 25, diasCondicaoMax: 90 };
    expect(extrairDiasDaCondicao('20/30/40', p)).toEqual([30, 40]);
    expect(extrairDiasDaCondicao('100 + 120', p)).toEqual([]);
  });

  it('faixa de ticket', () => {
    expect(faixaTicket(2500)).toBe('ate_3000');
    expect(faixaTicket(5000)).toBe('entre_3001_10000');
    expect(faixaTicket(15000)).toBe('acima_10000');
  });

  it('dias esperados por total', () => {
    expect(diasEsperadosParcelas(3000)).toEqual([20, 30, 40]);
    expect(diasEsperadosParcelas(8000)).toEqual([30, 45, 60]);
    expect(diasEsperadosParcelas(20000)).toEqual([30, 45, 60, 75]);
  });

  it('retirada Só Aço', () => {
    expect(isRetiradaSoAco('1-Retirada na So Aço')).toBe(true);
    expect(isRetiradaSoAco('2-Retirada na So Moveis')).toBe(false);
  });

  it('pedido conforme entrada e prazos', () => {
    const r = analisarConformidade({
      totalPedido: 5000,
      somaEntrada: 1500,
      formaPagamento: 'Boleto',
      nomeCondicao: '30 + 45 + 60',
      observacoesTipicas: '4-Inserir em Romaneio',
    });
    expect(r.entradaOk).toBe(true);
    expect(r.prazosOk).toBe(true);
    expect(r.status).toBe('ok');
  });

  it('cartão exclui política', () => {
    const r = analisarConformidade({
      totalPedido: 5000,
      somaEntrada: 0,
      formaPagamento: 'Cartão Visa',
      nomeCondicao: 'X',
      observacoesTipicas: '',
    });
    expect(r.status).toBe('excluido_politica');
  });

  it('arraysDiasIguais', () => {
    expect(arraysDiasIguais([30, 45, 60], [60, 30, 45])).toBe(true);
    expect(arraysDiasIguais([20, 30, 40], [30, 45, 60])).toBe(false);
  });

  it('mediaPrazoDias e prazoMedioParcelasConforme', () => {
    expect(mediaPrazoDias([30, 45, 60, 75])).toBe(52.5);
    expect(mediaPrazoDias([30, 60, 90])).toBe(60);
    expect(prazoMedioParcelasConforme([30, 60, 90], [30, 45, 60, 75])).toBe(false);
    expect(prazoMedioParcelasConforme([30, 45, 60, 75], [30, 45, 60, 75])).toBe(true);
    expect(prazoMedioParcelasConforme([20, 30, 40], [30, 45, 60, 75])).toBe(true);
  });

  it('prazo médio acima da referência: não conforme nos prazos (entrada ok)', () => {
    const r = analisarConformidade({
      totalPedido: 20_000,
      somaEntrada: 6000,
      formaPagamento: 'Boleto',
      nomeCondicao: '(3x) 30/60/90',
      observacoesTipicas: '4-Inserir em Romaneio',
    });
    expect(r.entradaOk).toBe(true);
    expect(r.prazosOk).toBe(false);
    expect(r.status).toBe('nao_conforme');
    expect(r.motivos.some((m) => m.includes('Prazo acima'))).toBe(true);
  });

  it('até limite faixa 1: exige à vista — parcelamento não conforme', () => {
    const r = analisarConformidade({
      totalPedido: 2500,
      somaEntrada: 750,
      formaPagamento: 'Boleto',
      nomeCondicao: '30 + 45 + 60',
      observacoesTipicas: '',
    });
    expect(r.prazosOk).toBe(false);
    expect(r.status).toBe('nao_conforme');
    expect(r.motivos.some((m) => m.includes('à vista'))).toBe(true);
  });

  it('à vista: conforme na entrada com qualquer % (valor alto)', () => {
    const r = analisarConformidade({
      totalPedido: 5000,
      somaEntrada: 100,
      formaPagamento: 'Boleto',
      nomeCondicao: 'A VISTA',
      observacoesTipicas: '',
    });
    expect(r.entradaOk).toBe(true);
    expect(r.prazosOk).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.motivos.some((m) => m.includes('Entrada'))).toBe(false);
  });

  it('à vista: conforme na entrada com 0% (valor baixo, faixa 1)', () => {
    const r = analisarConformidade({
      totalPedido: 244.2,
      somaEntrada: 0,
      formaPagamento: 'Transferência bancária',
      nomeCondicao: 'À Vista.',
      observacoesTipicas: '',
    });
    expect(r.entradaOk).toBe(true);
    expect(r.prazosOk).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.motivos.some((m) => m.includes('Entrada'))).toBe(false);
  });

  it('no limite faixa 1 (inclusive): parcelas ainda exigem à vista', () => {
    const r = analisarConformidade({
      totalPedido: 3000,
      somaEntrada: 900,
      formaPagamento: 'Boleto',
      nomeCondicao: '20 + 30 + 40',
      observacoesTipicas: '',
    });
    expect(r.status).toBe('nao_conforme');
    expect(r.motivos.some((m) => m.includes('à vista'))).toBe(true);
  });

  it('prazo médio igual ou abaixo: conforme mesmo com parcelas diferentes do pacote', () => {
    const igualMedia = analisarConformidade({
      totalPedido: 20_000,
      somaEntrada: 6000,
      formaPagamento: 'Boleto',
      nomeCondicao: '30 + 45 + 60 + 75',
      observacoesTipicas: '',
    });
    expect(igualMedia.prazosOk).toBe(true);
    expect(igualMedia.status).toBe('ok');

    const abaixo = analisarConformidade({
      totalPedido: 20_000,
      somaEntrada: 6000,
      formaPagamento: 'Boleto',
      nomeCondicao: '20 + 30 + 40',
      observacoesTipicas: '',
    });
    expect(abaixo.prazosOk).toBe(true);
    expect(abaixo.status).toBe('ok');
  });

  const politica306090 = {
    ...DEFAULT_POLITICA_COMERCIAL,
    limiteFaixa1Reais: 1,
    diasParcelasFaixa2: [30, 60, 90],
    diasParcelasFaixa3: [30, 60, 90],
  };

  it('prazo menor ou com menos parcelas que 30/60/90 conta como conforme', () => {
    const menosParcelas = analisarConformidade(
      {
        totalPedido: 20_000,
        somaEntrada: 6000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(menosParcelas.prazosOk).toBe(true);
    expect(menosParcelas.prazosBenignos).toBe(true);
    expect(menosParcelas.status).toBe('ok');

    const diasMenores = analisarConformidade(
      {
        totalPedido: 20_000,
        somaEntrada: 6000,
        formaPagamento: 'Boleto',
        nomeCondicao: '15/30/45',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(diasMenores.prazosOk).toBe(true);
    expect(diasMenores.prazosBenignos).toBe(true);
    expect(diasMenores.status).toBe('ok');
    expect(prazoConcedidoNaoPior([15, 30, 45], [30, 60, 90])).toBe(true);
  });

  it('parcela mais longa que a da mesma posição é não conforme', () => {
    const r = analisarConformidade(
      {
        totalPedido: 20_000,
        somaEntrada: 6000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/120',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(r.prazosOk).toBe(false);
    expect(r.prazosBenignos).toBe(false);
    expect(r.status).toBe('nao_conforme');
    expect(prazoConcedidoNaoPior([45, 50], [30, 60, 90])).toBe(false);
  });

  it('desconto até o teto é conforme; acima é não conforme', () => {
    const politica = { ...politica306090, pctDescontoMaximo: 0.05 };
    const menor = analisarConformidade(
      {
        totalPedido: 20_000,
        somaEntrada: 6000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/90',
        observacoesTipicas: '',
        valorTotal: 1000,
        valorDesconto: 20,
      },
      politica
    );
    expect(menor.descontoOk).toBe(true);
    expect(menor.status).toBe('ok');

    const acima = analisarConformidade(
      {
        totalPedido: 20_000,
        somaEntrada: 6000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/90',
        observacoesTipicas: '',
        valorTotal: 1000,
        valorDesconto: 80,
      },
      politica
    );
    expect(acima.descontoOk).toBe(false);
    expect(acima.status).toBe('nao_conforme');
    expect(acima.motivos.some((m) => m.includes('Desconto'))).toBe(true);
  });

  it('entrada acima da faixa conta como conforme; abaixo do piso não', () => {
    const acima = analisarConformidade(
      {
        totalPedido: 10_000,
        somaEntrada: 5860,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/90',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(acima.entradaOk).toBe(true);
    expect(acima.entradaBenigna).toBe(true);
    expect(acima.status).toBe('ok');
    expect(acima.motivos.some((m) => m.includes('benigno'))).toBe(true);

    const dentro = analisarConformidade(
      {
        totalPedido: 10_000,
        somaEntrada: 3000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/90',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(dentro.entradaOk).toBe(true);
    expect(dentro.entradaBenigna).toBe(false);
    expect(dentro.status).toBe('ok');

    const abaixo = analisarConformidade(
      {
        totalPedido: 10_000,
        somaEntrada: 2000,
        formaPagamento: 'Boleto',
        nomeCondicao: '30/60/90',
        observacoesTipicas: '',
      },
      politica306090
    );
    expect(abaixo.entradaOk).toBe(false);
    expect(abaixo.entradaBenigna).toBe(false);
    expect(abaixo.status).toBe('nao_conforme');
    expect(abaixo.motivos.some((m) => m.includes('abaixo do mínimo'))).toBe(true);
  });

  it('retirada Só Aço: desconto até 4% é conforme; acima não', () => {
    const base = {
      totalPedido: 20_000,
      somaEntrada: 6000,
      formaPagamento: 'Boleto',
      nomeCondicao: '30/60/90',
      observacoesTipicas: '1-Retirada na So Aço',
    };
    const dentro = analisarConformidade(
      { ...base, valorTotal: 1000, valorDesconto: 30 },
      politica306090
    );
    expect(dentro.status).toBe('ok');
    expect(dentro.motivos.some((m) => m.includes('conferir no ERP'))).toBe(false);

    const acima = analisarConformidade(
      { ...base, valorTotal: 1000, valorDesconto: 60 },
      politica306090
    );
    expect(acima.status).toBe('nao_conforme');
    expect(acima.motivos.some((m) => m.includes('retirada Só Aço'))).toBe(true);
  });
});
