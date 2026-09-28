export type UnidadePeriodicidade = "dias" | "meses" | "anos";

const DIAS_MES = 30;
const DIAS_ANO = 365;

export function diasParaPeriodicidade(dias: number): {
  unidade: UnidadePeriodicidade;
  quantidade: number;
} {
  if (!Number.isFinite(dias) || dias < 1) {
    return { unidade: "anos", quantidade: 1 };
  }
  if (dias % DIAS_ANO === 0) {
    return { unidade: "anos", quantidade: dias / DIAS_ANO };
  }
  if (dias % DIAS_MES === 0) {
    return { unidade: "meses", quantidade: dias / DIAS_MES };
  }
  return { unidade: "dias", quantidade: dias };
}

export function periodicidadeParaDias(
  quantidade: number,
  unidade: UnidadePeriodicidade
): number {
  const q = Math.max(1, Math.floor(quantidade));
  if (unidade === "anos") return q * DIAS_ANO;
  if (unidade === "meses") return q * DIAS_MES;
  return q;
}

export function rotuloPeriodicidade(dias: number): string {
  const { unidade, quantidade } = diasParaPeriodicidade(dias);
  if (unidade === "anos") {
    return quantidade === 1 ? "1 ano" : `${quantidade} anos`;
  }
  if (unidade === "meses") {
    return quantidade === 1 ? "1 mês" : `${quantidade} meses`;
  }
  return quantidade === 1 ? "1 dia" : `${quantidade} dias`;
}

export function frasePeriodicidade(
  quantidade: number,
  unidade: UnidadePeriodicidade
): string {
  const q = Number.isFinite(quantidade) && quantidade >= 1 ? Math.floor(quantidade) : 0;
  if (q < 1) return "Informe a quantidade.";
  if (unidade === "anos") {
    return q === 1
      ? "A calibração se repete a cada 1 ano."
      : `A calibração se repete a cada ${q} anos.`;
  }
  if (unidade === "meses") {
    return q === 1
      ? "A calibração se repete a cada 1 mês."
      : `A calibração se repete a cada ${q} meses.`;
  }
  return q === 1
    ? "A calibração se repete a cada 1 dia."
    : `A calibração se repete a cada ${q} dias.`;
}
