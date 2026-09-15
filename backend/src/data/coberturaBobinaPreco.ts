/**
 * Padronização de preço de bobinas no painel Cobertura de Estoque.
 * Mesma chave dimensional da precificação (engenharia / DRE), usando o preço cheio
 * da última entrada qualificada do painel (não o custo com tributos da precificação).
 */

/** Expressão SQL da chave dimensional (coluna `p.descricao`). */
export const SQL_CHAVE_DIMENSIONAL_BOBINA = `
Replace(
  Case
    When Upper(p.descricao) Like 'BOBINA%X%MM%' Then
      Case
        When Length(p.descricao) - Length(Replace(Upper(p.descricao), 'X', '')) = 1
          Then Concat(
            Trim(SubString_Index(Upper(p.descricao), 'X', 1)),
            SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2)
          )
        Else Concat(
          Left(Upper(p.descricao), Length(SubString_Index(p.descricao, 'X', 2))),
          SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2)
        )
      End
    Else ''
  End,
  'BOBINA INTEIRA',
  'BOBINA SLITADA'
)`.trim();

/** Produto é bobina dimensional (exclui etiquetas), espelhando o filtro da precificação. */
export function isBobinaDimensionalPrecificacao(descricao: string | null | undefined): boolean {
  const upper = String(descricao ?? '').toUpperCase();
  const normalizado = upper.replace(/INOX/g, 'INO');
  if (normalizado.includes('ETIQUETA')) return false;
  // LIKE 'BOBINA%X%MM%'
  const m = /^BOBINA[\s\S]*X[\s\S]*MM[\s\S]*$/i.exec(upper);
  return m != null;
}

/**
 * Chave dimensional a partir da descrição (espessura × largura / padrão),
 * com BOBINA INTEIRA → BOBINA SLITADA. String vazia se não for bobina elegível.
 */
export function chaveDimensionalBobina(descricao: string | null | undefined): string {
  if (!isBobinaDimensionalPrecificacao(descricao)) return '';
  const d = String(descricao ?? '');
  const upper = d.toUpperCase();
  const qtdX = upper.length - upper.replace(/X/g, '').length;
  let chave: string;
  if (qtdX === 1) {
    const antesX = upper.split('X')[0] ?? '';
    const idxMm = upper.indexOf('MM');
    const aposMm = idxMm >= 0 ? upper.slice(idxMm + 2) : '';
    chave = `${antesX.trim()}${aposMm}`;
  } else {
    // Até o 2º X (inclusive), como Left(..., Length(SubString_Index(descricao, 'X', 2)))
    let seen = 0;
    let cut = d.length;
    for (let i = 0; i < d.length; i++) {
      if (d[i] === 'X' || d[i] === 'x') {
        seen += 1;
        if (seen === 2) {
          cut = i + 1;
          break;
        }
      }
    }
    const leftPart = upper.slice(0, cut);
    const idxMm = upper.indexOf('MM');
    const aposMm = idxMm >= 0 ? upper.slice(idxMm + 2) : '';
    chave = `${leftPart}${aposMm}`;
  }
  return chave.replace(/BOBINA INTEIRA/g, 'BOBINA SLITADA');
}

/** Aplica média por chave dimensional sobre o mapa de preços (mutável). */
export function aplicarMediaPrecoBobinaPorChave(
  precoPorId: Map<number, number>,
  descricaoPorId: Map<number, string>,
  mediaPorChave: Map<string, number>
): void {
  for (const [id, descricao] of descricaoPorId) {
    const chave = chaveDimensionalBobina(descricao);
    if (!chave) continue;
    const media = mediaPorChave.get(chave);
    if (media == null || !(media > 0)) continue;
    precoPorId.set(id, media);
  }
}
