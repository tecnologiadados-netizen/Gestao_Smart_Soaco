import type { ReactNode } from 'react';

export type TrechoDescricao = { texto: string; destaque: boolean };

export const MARCADOR_REPROGRAMADO =
  /(?:(?:REPROGRAMAD[OA]|REPROGRAMA[CÇ][AÃ]O|REPR\.?)\s*[-–—:]\s*VENC(?:IMENTO)?\.?\s*ORIGINAL:?\s+\d{2}[\/\.-]\d{2}[\/\.-]\d{2,4}|\bREP\s+\d{2}[\/\.-]\d{2}(?:[\/\.-]\d{2,4})?)/gi;

/** Separa "REPROGRAMADO - VENC ORIGINAL dd/mm/aaaa" e "REP dd/mm" do restante da descrição. */
export function trechosDescricaoReprogramada(texto: string | null | undefined): TrechoDescricao[] {
  const bruto = texto ?? '';
  if (!bruto) return [];
  const re = new RegExp(MARCADOR_REPROGRAMADO.source, 'gi');
  const partes: TrechoDescricao[] = [];
  let ultimo = 0;
  let achou = false;
  for (const m of bruto.matchAll(re)) {
    const indice = m.index ?? 0;
    achou = true;
    if (indice > ultimo) partes.push({ texto: bruto.slice(ultimo, indice), destaque: false });
    partes.push({ texto: m[0], destaque: true });
    ultimo = indice + m[0].length;
  }
  if (!achou) return [{ texto: bruto, destaque: false }];
  if (ultimo < bruto.length) partes.push({ texto: bruto.slice(ultimo), destaque: false });
  return partes;
}

export function temMarcadorReprogramado(texto: string | null | undefined): boolean {
  return new RegExp(MARCADOR_REPROGRAMADO.source, 'i').test(texto ?? '');
}

/**
 * Renderiza a descrição na grade do Diário Financeiro,
 * destacando em negrito e vermelho "REPROGRAMADO - VENC ORIGINAL dd/mm/aaaa" e "REP dd/mm".
 */
export function DescricaoReprogramadaGrade({
  texto,
  fallback = '—',
}: {
  texto: string | null | undefined;
  fallback?: ReactNode;
}) {
  const bruto = texto ?? '';
  if (!bruto.trim()) {
    return <span className="text-slate-400">{fallback}</span>;
  }
  const trechos = trechosDescricaoReprogramada(bruto);
  const temDestaque = trechos.some((t) => t.destaque);
  if (!temDestaque) {
    return <span>{bruto}</span>;
  }
  return (
    <span>
      {trechos.map((t, idx) =>
        t.destaque ? (
          <span
            key={idx}
            className="font-bold text-red-600 dark:text-red-400"
          >
            {t.texto}
          </span>
        ) : (
          <span key={idx}>{t.texto}</span>
        ),
      )}
    </span>
  );
}
