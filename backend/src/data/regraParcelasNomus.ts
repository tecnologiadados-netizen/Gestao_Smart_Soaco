/**
 * Regra de parcelas do Nomus (condicaopagamento.regra).
 * "30,60,90" = três parcelas, dias a partir da data base, valor dividido igual.
 * "0 50%,15 50%" = entrada de 50% e o restante em 15 dias.
 * Se a condição restringe o vencimento a dias da semana, a data anda até o próximo dia permitido.
 */

export type ItemRegraParcela = { dias: number; percentual: number | null };

export type ParcelaGeradaRegra = {
  dataVencimento: string;
  valor: number;
  /** Entrada (0 dias) conta como já paga quando ainda há prazo à frente. */
  paga: boolean;
};

const SEMANA: Record<string, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
};

export function diasPermitidosNomus(restringirDiaSemana: unknown, diasRestritos: unknown): number[] | null {
  if (Number(restringirDiaSemana) !== 1) return null;
  try {
    const json = typeof diasRestritos === 'string' ? (JSON.parse(diasRestritos) as { diasDaSemana?: unknown }) : null;
    const lista = Array.isArray(json?.diasDaSemana) ? json.diasDaSemana : [];
    const dias = lista
      .map((d) => SEMANA[String(d).trim().toUpperCase()])
      .filter((n): n is number => n != null);
    return dias.length > 0 ? dias : [1, 2, 3, 4, 5];
  } catch {
    return [1, 2, 3, 4, 5];
  }
}

export function interpretarRegraParcelas(regra: string | null | undefined): ItemRegraParcela[] | null {
  const texto = String(regra ?? '').trim();
  if (!texto) return null;
  const partes = texto
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const itens: ItemRegraParcela[] = [];
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
  const comPercentual = itens.some((i) => i.percentual != null);
  if (comPercentual && itens.some((i) => i.percentual == null)) return null;
  return itens;
}

function somarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + dias));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function ajustarDiaPermitido(ymd: string, permitidos: number[] | null | undefined): string {
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
  const itens = interpretarRegraParcelas(params.regra);
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
      dataVencimento: ajustarDiaPermitido(somarDias(params.dataBase, item.dias), params.diasPermitidos),
      valor: valores[i]! / 100,
      paga: temPrazo && item.dias === 0,
    })),
  };
}
