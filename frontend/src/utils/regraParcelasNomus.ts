/**
 * Mesma regra do Nomus em condicaopagamento.regra.
 * "30,60,90" divide o total em partes iguais, com vencimento na emissão + dias.
 * "0 50%,15 50%" aplica o percentual de cada parcela. O centavo que sobra fica na última.
 * Dia 0 é entrada e nasce como já paga quando ainda existe prazo à frente.
 */

export type ParcelaGeradaRegra = {
  dataVencimento: string;
  valor: number;
  paga: boolean;
};

type ItemRegra = { dias: number; percentual: number | null };

function interpretar(regra: string): ItemRegra[] | null {
  const texto = regra.trim();
  if (!texto) return null;
  const partes = texto
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const itens: ItemRegra[] = [];
  for (const parte of partes) {
    const m = parte.match(/^(\d+)\s*(?:(\d+(?:[.,]\d+)?)\s*%)?$/);
    if (!m) return null;
    const dias = Number(m[1]);
    const percentual = m[2] != null ? Number(m[2].replace(',', '.')) : null;
    if (!Number.isInteger(dias) || dias < 0 || dias > 9999) return null;
    if (percentual != null && (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100)) return null;
    itens.push({ dias, percentual });
  }
  if (itens.length === 0) return null;
  if (itens.some((i) => i.percentual != null) && itens.some((i) => i.percentual == null)) return null;
  return itens;
}

function somarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + dias));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function ajustarDia(ymd: string, permitidos: number[] | null | undefined): string {
  if (!permitidos || permitidos.length === 0) return ymd;
  let atual = ymd;
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = atual.split('-').map(Number);
    const semana = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
    if (permitidos.includes(semana)) return atual;
    atual = somarDias(atual, 1);
  }
  return ymd;
}

export function gerarParcelasDaRegra(params: {
  regra: string;
  dataBase: string;
  valorTotal: number;
  diasPermitidos?: number[] | null;
}): { parcelas: ParcelaGeradaRegra[] } | { erro: string } {
  const itens = interpretar(params.regra);
  if (!itens) return { erro: 'Regra inválida. Use os dias separados por vírgula, como 30,60,90.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dataBase)) {
    return { erro: 'Sem data de emissão para calcular o vencimento.' };
  }
  const totalCentavos = Math.round((params.valorTotal + Number.EPSILON) * 100);
  if (totalCentavos <= 0) return { erro: 'Sem total da nota para dividir as parcelas.' };

  const valores: number[] = [];
  if (itens.every((i) => i.percentual == null)) {
    const base = Math.floor(totalCentavos / itens.length);
    const resto = totalCentavos - base * itens.length;
    itens.forEach((_, i) => valores.push(base + (i === itens.length - 1 ? resto : 0)));
  } else {
    let soma = 0;
    itens.forEach((item, i) => {
      if (i === itens.length - 1) {
        valores.push(totalCentavos - soma);
        return;
      }
      const v = Math.round((totalCentavos * (item.percentual ?? 0)) / 100);
      valores.push(v);
      soma += v;
    });
  }

  const temPrazo = itens.some((i) => i.dias > 0);
  return {
    parcelas: itens.map((item, i) => ({
      dataVencimento: ajustarDia(somarDias(params.dataBase, item.dias), params.diasPermitidos),
      valor: valores[i]! / 100,
      paga: temPrazo && item.dias === 0,
    })),
  };
}
