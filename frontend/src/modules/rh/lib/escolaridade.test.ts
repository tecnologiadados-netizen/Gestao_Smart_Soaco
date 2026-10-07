import { describe, expect, it } from "vitest";
import { classificarEscolaridade, montarEscolaridade } from "./escolaridade";

describe("classificar escolaridade", () => {
  it.each([
    ["", "nao_informado"],
    ["ANALFABETO", "sem_instrucao"],
    ["NAO ALFABETIZADO", "sem_instrucao"],
    ["ENSINO FUNDAMENTAL INCOMPLETO", "fundamental_incompleto"],
    ["ENSINO FUNDAMENTAL", "fundamental_completo"],
    ["ENSINO FUNDAMENTAL COMPLETO", "fundamental_completo"],
    ["ENSINO MÉDIO INCOMPLETO", "medio_incompleto"],
    ["ENSINO TÉCNICO INCOMPLETO", "medio_incompleto"],
    ["TEC DE REFRIGERAÇÃO E CLIMATIZAÇÃO _ EM ANDAMENTO", "medio_incompleto"],
    ["ENSINO MÉDIO COMPLETO", "medio_completo"],
    ["ENSINO MEDIO COMPLETO", "medio_completo"],
    ["ENSINO MEDIO", "medio_completo"],
    ["TÉCNICO SEG DO TRABALHO", "medio_completo"],
    ["ENSINO SUPERIOR INCOMPLETO", "superior_incompleto"],
    ["SUPERIOR INCOMPLETO", "superior_incompleto"],
    ["ENSINO SUPERIOR EM ANDAMENTO", "superior_incompleto"],
    ["SUPERIOR COMPLETO", "superior_completo"],
    ["ENSINO SUPERIOR COMPLETO", "superior_completo"],
    ["PÓS GRADUAÇÃO", "pos_graduacao"],
  ])("%s → %s", (raw, nivel) => {
    expect(classificarEscolaridade(raw)).toBe(nivel);
  });
});

describe("montar escolaridade", () => {
  it("calcula a taxa de educação básica sobre todos os ativos do gênero", () => {
    const resumo = montarEscolaridade([
      { grau: "ENSINO MÉDIO COMPLETO", genero: "masculino" },
      { grau: "SUPERIOR COMPLETO", genero: "masculino" },
      { grau: "ENSINO FUNDAMENTAL INCOMPLETO", genero: "masculino" },
      { grau: "", genero: "masculino" },
      { grau: "PÓS GRADUAÇÃO", genero: "feminino" },
      { grau: "ENSINO MÉDIO INCOMPLETO", genero: "feminino" },
    ]);

    expect(resumo.homensTotal).toBe(4);
    expect(resumo.mulheresTotal).toBe(2);
    expect(resumo.basica.homens).toBe(2);
    expect(resumo.basica.homensPct).toBe(50);
    expect(resumo.basica.mulheres).toBe(1);
    expect(resumo.basica.mulheresPct).toBe(50);
    expect(resumo.niveis.find((nivel) => nivel.id === "medio_completo")?.homensPct).toBe(25);
    expect(resumo.niveis.find((nivel) => nivel.id === "nao_informado")?.homens).toBe(1);
  });

  it("calcula a média salarial só de quem tem salário informado", () => {
    const resumo = montarEscolaridade([
      { grau: "ENSINO MÉDIO COMPLETO", genero: "masculino", salario: 3000 },
      { grau: "ENSINO MÉDIO COMPLETO", genero: "masculino", salario: 5000 },
      { grau: "ENSINO MÉDIO COMPLETO", genero: "masculino", salario: 0 },
      { grau: "ENSINO MÉDIO COMPLETO", genero: "feminino", salario: 4000 },
    ]);
    const medio = resumo.niveis.find((nivel) => nivel.id === "medio_completo");
    expect(medio?.homens).toBe(3);
    expect(medio?.homensComSalario).toBe(2);
    expect(medio?.homensMedia).toBe(4000);
    expect(medio?.mulheresMedia).toBe(4000);
  });
});
