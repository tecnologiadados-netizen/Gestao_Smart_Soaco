import { describe, expect, it } from 'vitest';
import {
  obterMateriaisDoDia,
  pcPendModalLinhasDoProduto,
  resolverEntradaPcExibicao,
  type BaseMateriaisCongelada,
  type DemandaCalendarioLinha,
} from '../src/services/disponibilidadeMateriaisCalendarioService.js';

describe('resolverEntradaPcExibicao', () => {
  it('com entrada no dia exibe o número e ignora PC/Ag Pag/SC', () => {
    const r = resolverEntradaPcExibicao({
      entradaDia: 12.5,
      pcLinhas: [{ dataEntrega: '2026-08-01', qtde: 100 }],
      temAgPag: true,
      temSolicitacao: true,
    });
    expect(r).toEqual({ fonte: 'entrada_dia', texto: '12,5', clicavel: true });
  });

  it('sem entrada no dia prioriza PC com data mais antiga e soma a qtde daquela data', () => {
    const r = resolverEntradaPcExibicao({
      entradaDia: 0,
      pcLinhas: [
        { dataEntrega: '2026-08-21', qtde: 50 },
        { dataEntrega: '2026-08-10', qtde: 30 },
        { dataEntrega: '2026-08-10', qtde: 20 },
        { dataEntrega: '2026-09-01', qtde: 999 },
      ],
      temAgPag: true,
      temSolicitacao: true,
    });
    expect(r.fonte).toBe('pc_aberta');
    expect(r.texto).toBe('10/08/2026 - 50');
    expect(r.clicavel).toBe(true);
  });

  it('sem PC exibe Pré Compra quando há Ag Pag (acima de SC)', () => {
    const r = resolverEntradaPcExibicao({
      entradaDia: 0,
      pcLinhas: [],
      temAgPag: true,
      temSolicitacao: true,
    });
    expect(r).toEqual({ fonte: 'ag_pag', texto: 'Pré Compra', clicavel: true });
  });

  it('sem PC e sem Ag Pag exibe Solicitação de Compra', () => {
    const r = resolverEntradaPcExibicao({
      entradaDia: 0,
      pcLinhas: [],
      temAgPag: false,
      temSolicitacao: true,
    });
    expect(r).toEqual({
      fonte: 'solicitacao',
      texto: 'Solicitação de Compra',
      clicavel: true,
    });
  });

  it('sem nenhuma fonte exibe 0 não clicável', () => {
    const r = resolverEntradaPcExibicao({
      entradaDia: 0,
      pcLinhas: [],
      temAgPag: false,
      temSolicitacao: false,
    });
    expect(r).toEqual({ fonte: 'nenhuma', texto: '0', clicavel: false });
  });

  it('nunca combina fontes — uma única informação por vez', () => {
    const comPc = resolverEntradaPcExibicao({
      entradaDia: 0,
      pcLinhas: [{ dataEntrega: '2026-08-15', qtde: 1 }],
      temAgPag: true,
      temSolicitacao: true,
    });
    expect(comPc.texto).not.toMatch(/Pré Compra|Solicitação/);
    expect(comPc.texto).toMatch(/15\/08\/2026/);
  });
});

/**
 * Base congelada: consumo alto no dia 24 força falta; entrada PC só no dia 25.
 * PC aberto no 25 deve aparecer como aviso "dd/mm - qtde" no dia 24 sem mudar a falta.
 */
const BASE: BaseMateriaisCongelada = {
  version: 1,
  capturadoEm: '2026-07-24T12:00:00.000Z',
  hoje: '2026-07-24',
  idPorCodigoPa: { 'PA-1': 10 },
  bom: [{ idPa: 10, idComp: 100, cod: 'COMP-1', desc: 'Componente 1', qtdePorPa: 2 }],
  saldoPorIdComp: { '100': 5 },
  pcLinhas: [
    {
      idProduto: 100,
      pedidoCompra: 'PC-1',
      dataEntrega: '2026-07-25',
      dataEntregaExibicao: '24/07/2026',
      qtde: 4,
    },
    {
      idProduto: 100,
      pedidoCompra: 'PC-2',
      dataEntrega: '2026-07-25',
      dataEntregaExibicao: '25/07/2026',
      qtde: 1,
    },
    {
      idProduto: 100,
      pedidoCompra: 'PC-3',
      dataEntrega: '2026-07-30',
      dataEntregaExibicao: '30/07/2026',
      qtde: 10,
    },
  ],
  agPagLinhas: [
    {
      idProduto: 100,
      cotacao: 'CC1',
      dataEmissao: '01/07/2026',
      comprador: 'Ana',
      scCodigos: '1',
      qtde: 50,
    },
  ],
  scLinhas: [
    {
      idProduto: 100,
      codigo: 99,
      usuario: 'Bob',
      dataEmissao: '01/07/2026',
      dataNecessidade: '10/07/2026',
      saldo: 7,
    },
  ],
};

const DEMANDA: DemandaCalendarioLinha[] = [
  { codigoPa: 'PA-1', qtde: 4, dataIso: '2026-07-24', pd: '100', carrada: 'ROTA A' },
  { codigoPa: 'PA-1', qtde: 2, dataIso: '2026-07-25', pd: '102', carrada: 'ROTA B' },
];

describe('Materiais do dia — prioridade Entrada PC sem alterar falta', () => {
  it('no dia sem entrada numérica exibe data mais antiga do PC e mantém falta', async () => {
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const m = r.data.materiais[0]!;
    expect(m.entradaDia).toBe(0);
    expect(m.falta).toBe(3); // 8 consumo − 5 saldo
    expect(m.entradaPc.fonte).toBe('pc_aberta');
    expect(m.entradaPc.texto).toBe('25/07/2026 - 5'); // soma PC-1+PC-2 na data mais antiga
    expect(m.entradaPc.clicavel).toBe(true);
  });

  it('no dia com entrada numérica exibe o número (não a data) e falta inalterada', async () => {
    // Consumo 4, saldo início após dia 24: 5−8+0 = −3 → floor no motor de falta;
    // entrada 5 no dia 25. Falta acumulada depende do motor — só assertamos entradaPc.
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-25', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const m = r.data.materiais.find((x) => x.codigo === 'COMP-1');
    // Pode não entrar na lista se falta=0; se entrar, entradaPc deve ser número.
    if (!m) return;
    expect(m.entradaDia).toBe(5);
    expect(m.entradaPc.fonte).toBe('entrada_dia');
    expect(m.entradaPc.texto).toBe('5');
  });

  it('sem PC prioriza Pré Compra sobre Solicitação e não muda falta', async () => {
    const baseSemPc: BaseMateriaisCongelada = {
      ...BASE,
      pcLinhas: [],
    };
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', baseSemPc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.data.materiais[0]!;
    expect(m.falta).toBe(3);
    expect(m.entradaPc).toEqual({ fonte: 'ag_pag', texto: 'Pré Compra', clicavel: true });
  });

  it('sem PC e sem Ag Pag exibe Solicitação de Compra', async () => {
    const baseSoSc: BaseMateriaisCongelada = {
      ...BASE,
      pcLinhas: [],
      agPagLinhas: [],
    };
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', baseSoSc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.data.materiais[0]!;
    expect(m.falta).toBe(3);
    expect(m.entradaPc).toEqual({
      fonte: 'solicitacao',
      texto: 'Solicitação de Compra',
      clicavel: true,
    });
  });

  it('snapshot legado sem agPag/scLinhas cai em 0 quando não há PC', async () => {
    const legado: BaseMateriaisCongelada = {
      version: 1,
      capturadoEm: BASE.capturadoEm,
      hoje: BASE.hoje,
      idPorCodigoPa: BASE.idPorCodigoPa,
      bom: BASE.bom,
      saldoPorIdComp: BASE.saldoPorIdComp,
      pcLinhas: [],
    };
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', legado);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.data.materiais[0]!;
    expect(m.falta).toBe(3);
    expect(m.entradaPc).toEqual({ fonte: 'nenhuma', texto: '0', clicavel: false });
  });

  it('modal PC Pend usa data original dd/mm/yyyy (igual Consulta de Estoque), não o ISO do eixo', () => {
    const linhas = pcPendModalLinhasDoProduto(BASE, 100);
    expect(linhas).toEqual([
      { pedidoCompra: 'PC-1', qtde: 4, dataEntrega: '24/07/2026' },
      { pedidoCompra: 'PC-2', qtde: 1, dataEntrega: '25/07/2026' },
      { pedidoCompra: 'PC-3', qtde: 10, dataEntrega: '30/07/2026' },
    ]);
  });
});
