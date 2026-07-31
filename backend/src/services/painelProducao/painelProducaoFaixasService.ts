import { prisma } from '../../config/prisma.js';
import { clearPainelProducaoCaches } from './painelProducaoCache.js';

export type FaixaDescontoInput = {
  media_min: number;
  media_max: number | null;
  percentual_desconto: number;
};

export type FaixaDesconto = FaixaDescontoInput & {
  id?: number;
  ordem: number;
};

export const FAIXAS_DESCONTO_PADRAO: FaixaDesconto[] = [
  { media_min: 0, media_max: 1.99, percentual_desconto: 0, ordem: 1 },
  { media_min: 2, media_max: 3.99, percentual_desconto: 20, ordem: 2 },
  { media_min: 4, media_max: 5, percentual_desconto: 30, ordem: 3 },
  { media_min: 5.01, media_max: null, percentual_desconto: 40, ordem: 4 },
];

function mesKey(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error('Mês inválido. Use o formato YYYY-MM.');
  }
  return `${mes}-01`;
}

function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function validarFaixasDesconto(faixas: FaixaDescontoInput[]): FaixaDesconto[] {
  if (!Array.isArray(faixas) || faixas.length === 0) {
    throw new Error('Cadastre ao menos uma faixa de desconto.');
  }
  if (faixas.length > 20) {
    throw new Error('O limite é de 20 faixas de desconto por mês.');
  }

  const normalizadas = faixas
    .map((faixa) => ({
      media_min: arredondar2(Number(faixa.media_min)),
      media_max:
        faixa.media_max == null ? null : arredondar2(Number(faixa.media_max)),
      percentual_desconto: arredondar2(Number(faixa.percentual_desconto)),
    }))
    .sort((a, b) => a.media_min - b.media_min);

  normalizadas.forEach((faixa, index) => {
    if (!Number.isFinite(faixa.media_min) || faixa.media_min < 0) {
      throw new Error(`Média inicial inválida na faixa ${index + 1}.`);
    }
    if (
      faixa.media_max != null &&
      (!Number.isFinite(faixa.media_max) || faixa.media_max < faixa.media_min)
    ) {
      throw new Error(`Média final inválida na faixa ${index + 1}.`);
    }
    if (
      !Number.isFinite(faixa.percentual_desconto) ||
      faixa.percentual_desconto < 0 ||
      faixa.percentual_desconto > 100
    ) {
      throw new Error(`O desconto da faixa ${index + 1} deve estar entre 0% e 100%.`);
    }
    if (faixa.media_max == null && index !== normalizadas.length - 1) {
      throw new Error('Somente a última faixa pode ficar sem média final.');
    }
  });

  if (normalizadas[0]!.media_min !== 0) {
    throw new Error('A primeira faixa deve começar na média 0.');
  }
  if (normalizadas.at(-1)!.media_max != null) {
    throw new Error('A última faixa deve ficar sem média final.');
  }

  for (let index = 1; index < normalizadas.length; index += 1) {
    const anterior = normalizadas[index - 1]!;
    const atual = normalizadas[index]!;
    const inicioEsperado = arredondar2((anterior.media_max ?? 0) + 0.01);
    if (atual.media_min !== inicioEsperado) {
      throw new Error(
        `As faixas devem ser contínuas: após ${anterior.media_max?.toFixed(2)} deve iniciar em ${inicioEsperado.toFixed(2)}.`,
      );
    }
  }

  return normalizadas.map((faixa, index) => ({ ...faixa, ordem: index + 1 }));
}

function mapFaixa(row: {
  id: number;
  mediaMin: number;
  mediaMax: number | null;
  percentualDesconto: number;
  ordem: number;
}): FaixaDesconto {
  return {
    id: row.id,
    media_min: row.mediaMin,
    media_max: row.mediaMax,
    percentual_desconto: row.percentualDesconto,
    ordem: row.ordem,
  };
}

export async function listarFaixasDesconto(mes: string): Promise<FaixaDesconto[]> {
  const rows = await prisma.painelProducaoFaixaDesconto.findMany({
    where: { mesAno: mesKey(mes) },
    orderBy: { ordem: 'asc' },
  });
  return rows.length > 0 ? rows.map(mapFaixa) : FAIXAS_DESCONTO_PADRAO.map((faixa) => ({ ...faixa }));
}

export async function salvarFaixasDesconto(
  mes: string,
  faixas: FaixaDescontoInput[],
): Promise<FaixaDesconto[]> {
  const key = mesKey(mes);
  const validadas = validarFaixasDesconto(faixas);

  await prisma.$transaction(async (tx) => {
    await tx.painelProducaoFaixaDesconto.deleteMany({ where: { mesAno: key } });
    await tx.painelProducaoFaixaDesconto.createMany({
      data: validadas.map((faixa) => ({
        mesAno: key,
        mediaMin: faixa.media_min,
        mediaMax: faixa.media_max,
        percentualDesconto: faixa.percentual_desconto,
        ordem: faixa.ordem,
      })),
    });
  });

  clearPainelProducaoCaches();
  return listarFaixasDesconto(mes);
}

export async function copiarFaixasParaMes(mesAno: string): Promise<void> {
  const anterior = await prisma.painelProducaoFaixaDesconto.findFirst({
    where: { mesAno: { lt: mesAno } },
    orderBy: [{ mesAno: 'desc' }, { ordem: 'asc' }],
    select: { mesAno: true },
  });
  const origem = anterior
    ? await prisma.painelProducaoFaixaDesconto.findMany({
        where: { mesAno: anterior.mesAno },
        orderBy: { ordem: 'asc' },
      })
    : [];
  const faixas =
    origem.length > 0
      ? origem.map((faixa) => ({
          mediaMin: faixa.mediaMin,
          mediaMax: faixa.mediaMax,
          percentualDesconto: faixa.percentualDesconto,
          ordem: faixa.ordem,
        }))
      : FAIXAS_DESCONTO_PADRAO.map((faixa) => ({
          mediaMin: faixa.media_min,
          mediaMax: faixa.media_max,
          percentualDesconto: faixa.percentual_desconto,
          ordem: faixa.ordem,
        }));

  await prisma.painelProducaoFaixaDesconto.createMany({
    data: faixas.map((faixa) => ({ mesAno, ...faixa })),
  });
}
