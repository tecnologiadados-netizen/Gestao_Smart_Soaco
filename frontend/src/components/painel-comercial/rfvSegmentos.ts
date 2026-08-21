import { RFV_MATRIZ_LAYOUT, layoutSegmento } from './rfvMatrizLayout';

export type RfvSegmentoUi = {
  id: string;
  label: string;
  cor: string;
  textCor: string;
};

export const RFV_SEGMENTOS_UI: RfvSegmentoUi[] = RFV_MATRIZ_LAYOUT.filter((s) => s.celulas.length > 0).map(
  ({ id, label, cor, textCor }) => ({ id, label, cor, textCor })
);

export function segmentoUi(id: string): RfvSegmentoUi | undefined {
  const lay = layoutSegmento(id);
  if (!lay || !lay.celulas.length) return undefined;
  return { id: lay.id, label: lay.label, cor: lay.cor, textCor: lay.textCor };
}

export function labelSegmentoUi(id: string): string {
  return segmentoUi(id)?.label ?? layoutSegmento(id)?.label ?? id;
}
