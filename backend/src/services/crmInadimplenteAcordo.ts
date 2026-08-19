export type ReciboAcordoErp = {
  id: number;
  data: string;
  valor: number;
  criadoPorLogin: string | null;
  origem?: string | null;
  codigoConta?: string | null;
  formaPagamento?: string | null;
  contaBancaria?: string | null;
  comentarios?: string | null;
};

export type AcordoParcelaAcompanhamento = {
  n: number;
  tipo: string;
  data: string;
  valor: number;
  forma: string;
  valorRecebido: number;
  saldo: number;
};

export type AcordoAcompanhamentoDto = {
  valorOriginal: number;
  valorJuros: number;
  valorNegociado: number;
  valorRecebido: number;
  saldo: number;
  proximaParcela: string | null;
  parcelas: AcordoParcelaAcompanhamento[];
  recebimentos: ReciboAcordoErp[];
};

type MetaLike = {
  kind?: string;
  valorOriginal?: number;
  valorJuros?: number;
  valorNegociado?: number;
  parcelas?: { n?: number; tipo?: string; data?: string; valor?: number; forma?: string }[];
};

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseMetaAcordo(raw: string | null | undefined): MetaLike | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as MetaLike;
    if (o?.kind === 'negociacao' && typeof o.valorNegociado === 'number') return o;
  } catch {
    return null;
  }
  return null;
}

export function montarAcordoAcompanhamento(
  meta: MetaLike,
  recebimentos: ReciboAcordoErp[],
): AcordoAcompanhamentoDto {
  const valorNegociado = roundMoney(Number(meta.valorNegociado) || 0);
  const valorOriginal = roundMoney(Number(meta.valorOriginal) || 0);
  const valorJuros = roundMoney(Number(meta.valorJuros) || Math.max(0, valorNegociado - valorOriginal));
  const recs = [...recebimentos].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
  const valorRecebidoBruto = roundMoney(recs.reduce((s, r) => s + (Number(r.valor) || 0), 0));
  const valorRecebido = roundMoney(Math.min(valorRecebidoBruto, valorNegociado));
  const saldo = roundMoney(Math.max(0, valorNegociado - valorRecebido));

  const brutas = Array.isArray(meta.parcelas) ? meta.parcelas : [];
  let pool = valorRecebido;
  const parcelas: AcordoParcelaAcompanhamento[] = brutas.map((p, i) => {
    const valor = roundMoney(Number(p.valor) || 0);
    const aplicado = roundMoney(Math.min(valor, Math.max(0, pool)));
    pool = roundMoney(pool - aplicado);
    return {
      n: Number(p.n) || i + 1,
      tipo: p.tipo === 'entrada' ? 'entrada' : 'parcela',
      data: String(p.data ?? ''),
      valor,
      forma: String(p.forma ?? ''),
      valorRecebido: aplicado,
      saldo: roundMoney(valor - aplicado),
    };
  });
  const proxima = parcelas.find((p) => p.saldo > 0.009)?.data ?? null;

  return {
    valorOriginal,
    valorJuros,
    valorNegociado,
    valorRecebido,
    saldo,
    proximaParcela: proxima,
    parcelas,
    recebimentos: recs,
  };
}
