import { describe, expect, it } from "vitest";
import { ORGANICO_IDX } from "@rh/pages/Organico/organico-derive";
import { buildDashboardFromOrganico, deriveTurnoverFromPeople } from "@rh/lib/dashboard-from-organico";
import {
  colaboradorAtivoNaData,
  formatDiaMmmAno,
  indexarSalariosTrajetoria,
  mesesNoPeriodo,
  parseSalarioDescricao,
  periodoDoAno,
  periodoDoMes,
  periodoPadraoExecutivo,
  salarioVigente,
  salarioVigenteDaMatricula,
} from "@rh/lib/dashboard-periodo";

function linha(partial: Partial<Record<number, string | number>>): { values: (string | number)[] } {
  const values: (string | number)[] = Array.from({ length: 90 }, () => "");
  values[ORGANICO_IDX.MATRICULA] = "10";
  values[ORGANICO_IDX.NOME] = "Ana";
  values[ORGANICO_IDX.ADMISSAO] = "01/01/2024";
  values[ORGANICO_IDX.STATUS] = "Ativo";
  values[ORGANICO_IDX.CTPS] = 3000;
  values[ORGANICO_IDX.SETOR] = "Corte";
  for (const [idx, value] of Object.entries(partial)) values[Number(idx)] = value;
  return { values };
}

describe("salário vigente da trajetória", () => {
  const hoje = new Date(2026, 9, 5);
  const eventos = [
    { dataIso: "2024-01-01", valor: 2000 },
    { dataIso: "2025-06-01", valor: 3500 },
  ];

  it("no dia de hoje usa a CTPS atual, mesmo com reajuste antigo na trajetória", () => {
    expect(salarioVigente(eventos, new Date(2026, 9, 5), 4000, hoje)).toBe(4000);
  });

  it("antes do reajuste usa o salário anterior", () => {
    expect(salarioVigente(eventos, new Date(2025, 4, 31), 4000, hoje)).toBe(2000);
  });

  it("depois do reajuste e antes de hoje usa o valor da trajetória", () => {
    expect(salarioVigente(eventos, new Date(2025, 6, 1), 4000, hoje)).toBe(3500);
  });

  it("não aplica um reajuste que ainda não tinha acontecido", () => {
    expect(salarioVigente([{ dataIso: "2025-08-01", valor: 5000 }], new Date(2025, 0, 10), 5000, hoje)).toBe(0);
  });

  it("sem trajetória, cai na CTPS atual", () => {
    expect(salarioVigente([], new Date(2024, 2, 1), 1800, hoje)).toBe(1800);
  });

  it("lê o valor em R$ por mês", () => {
    const index = indexarSalariosTrajetoria([
      { colaboradorMatricula: "00010", dataEvento: "2024-01-01", descricao: "R$ 1.593,78 por mês" },
    ]);
    expect(parseSalarioDescricao("R$ 1.593,78 por mês")).toBeCloseTo(1593.78);
    expect(salarioVigenteDaMatricula(index, "10", new Date(2024, 5, 1), 4000, hoje)).toBeCloseTo(1593.78);
  });
});

describe("período do painel", () => {
  it("formata o dia como dd/mmm/yyyy", () => {
    expect(formatDiaMmmAno(new Date(2026, 9, 5))).toBe("05/out/2026");
  });

  it("o ano inteiro vai até hoje quando o ano ainda não acabou", () => {
    const hoje = new Date(2026, 9, 5);
    expect(periodoDoAno(2025, hoje)).toEqual({
      inicio: new Date(2025, 0, 1),
      fim: new Date(2025, 11, 31),
    });
    expect(periodoDoAno(2026, hoje)).toEqual({
      inicio: new Date(2026, 0, 1),
      fim: hoje,
    });
    expect(periodoDoAno(2027, hoje)).toBeNull();
  });

  it("o mês inteiro vai até hoje quando o mês ainda não acabou", () => {
    const hoje = new Date(2026, 9, 5);
    expect(periodoDoMes(2026, 8, hoje)).toEqual({
      inicio: new Date(2026, 8, 1),
      fim: new Date(2026, 8, 30),
    });
    expect(periodoDoMes(2026, 9, hoje)).toEqual({
      inicio: new Date(2026, 9, 1),
      fim: hoje,
    });
    expect(periodoDoMes(2026, 10, hoje)).toBeNull();
  });

  it("abre nos últimos 12 meses, até hoje", () => {
    const periodo = periodoPadraoExecutivo(new Date(2026, 9, 5));
    expect(periodo.inicio).toEqual(new Date(2025, 10, 1));
    expect(periodo.fim).toEqual(new Date(2026, 9, 5));
    expect(mesesNoPeriodo(periodo.inicio, periodo.fim)).toHaveLength(12);
  });

  it("no quadro de hoje conta quem já está ativo mesmo com admissão futura", () => {
    const admissao = new Date(2026, 9, 13);
    const hoje = new Date(2026, 9, 9);
    expect(
      colaboradorAtivoNaData({ admissao, demissao: null, statusDesligado: false }, hoje),
    ).toBe(false);
    expect(
      colaboradorAtivoNaData(
        { admissao, demissao: null, statusDesligado: false },
        hoje,
        { contarAdmissaoFutura: true },
      ),
    ).toBe(true);
  });

  it("considera ativo quem ainda não tinha sido desligado na data", () => {
    const demissao = new Date(2025, 5, 10);
    expect(
      colaboradorAtivoNaData({ admissao: new Date(2024, 0, 1), demissao, statusDesligado: true }, new Date(2025, 4, 31)),
    ).toBe(true);
    expect(
      colaboradorAtivoNaData({ admissao: new Date(2024, 0, 1), demissao, statusDesligado: true }, new Date(2025, 5, 10)),
    ).toBe(false);
  });
});

describe("dashboard no período", () => {
  it("soma a folha do fechamento com o salário da época e lista o mês a mês", () => {
    const hoje = new Date(2026, 9, 5);
    const dashboard = buildDashboardFromOrganico(
      [linha({ [ORGANICO_IDX.CTPS]: 4000 })],
      {},
      {
        inicio: new Date(2025, 4, 1),
        fim: new Date(2025, 6, 31),
        hoje,
        salarioNaData: (_matricula, asOf, ctpsAtual) =>
          salarioVigente(
            [
              { dataIso: "2024-01-01", valor: 2000 },
              { dataIso: "2025-06-01", valor: 3500 },
            ],
            asOf,
            ctpsAtual,
            hoje,
          ),
      },
    );

    expect(dashboard.custoFolhaMensal).toBe(3500);
    expect(dashboard.totalColaboradores).toBe(1);
    expect(dashboard.folhaMensal.map((p) => p.value)).toEqual([2000, 3500, 3500]);
    expect(dashboard.turnoverData).toHaveLength(3);
  });

  it("com a base de custo total, a folha e a média usam essa coluna", () => {
    const hoje = new Date(2026, 9, 9);
    const dashboard = buildDashboardFromOrganico(
      [linha({ [ORGANICO_IDX.CTPS]: 2000, [ORGANICO_IDX.CUSTO_TOTAL_GERAL_MES]: 3500 })],
      {},
      { inicio: hoje, fim: hoje, hoje, baseCusto: "custoTotal" },
    );
    expect(dashboard.custoFolhaMensal).toBe(3500);
    expect(dashboard.mediaSalarialCtps).toBe(3500);
  });

  it("marca o ano anterior ao histórico de demissões como aproximado", () => {
    const hoje = new Date(2026, 9, 5);
    const quemFicou = linha({ [ORGANICO_IDX.MATRICULA]: "10", [ORGANICO_IDX.ADMISSAO]: "01/01/2020" });
    const quemSaiu = linha({
      [ORGANICO_IDX.MATRICULA]: "11",
      [ORGANICO_IDX.NOME]: "Bia",
      [ORGANICO_IDX.STATUS]: "Desligado",
      [ORGANICO_IDX.ADMISSAO]: "01/01/2018",
    });
    const antigo = linha({
      [ORGANICO_IDX.MATRICULA]: "12",
      [ORGANICO_IDX.NOME]: "Caio",
      [ORGANICO_IDX.STATUS]: "Desligado",
      [ORGANICO_IDX.ADMISSAO]: "01/01/2008",
    });
    const dashboard = buildDashboardFromOrganico([quemFicou, quemSaiu, antigo], {
      "11": "15/01/2025",
      "12": "15/06/2009",
    }, {
      inicio: new Date(2024, 10, 1),
      fim: new Date(2026, 6, 31),
      hoje,
    });
    const nov2024 = dashboard.folhaMensal.find((p) => p.year === 2024 && p.month === "Nov");
    const jul2026 = dashboard.folhaMensal.find((p) => p.year === 2026 && p.month === "Jul");
    expect(nov2024?.ativosAproximado).toBe(true);
    expect(jul2026?.ativosAproximado).toBe(false);
  });

  it("desligamento por falecimento não entra no turnover do mês", () => {
    const serie = deriveTurnoverFromPeople(
      [
        {
          admissao: "2010-01-18",
          demissao: "2026-09-23",
          motivoDemissao: "Rescisão do contrato de trabalho por falecimento",
          setor: "BALCÃO",
        },
        {
          admissao: "2023-11-16",
          demissao: "2026-09-08",
          motivoDemissao: "Pedido de Demissão",
          setor: "VENDAS - COMERCIAL",
        },
      ],
      new Date(2026, 8, 30),
      null,
      { inicio: new Date(2026, 8, 1), fim: new Date(2026, 8, 30) },
    );
    const setembro = serie.turnoverData.find((ponto) => ponto.year === 2026 && ponto.month === "Set");
    expect(setembro?.demissoesMes).toBe(1);
  });
});
