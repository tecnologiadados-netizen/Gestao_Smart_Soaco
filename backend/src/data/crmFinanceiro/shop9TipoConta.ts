/** Legenda Shop9 de `Financeiro_Contas.Tipo_Conta` (varchar 1). */
const SHOP9_TIPO_CONTA_LEGENDA: Record<string, string> = {
  C: 'Carteira',
  T: 'Carnê',
  B: 'Boleto Bancário',
  O: 'Outro',
  D: 'Dinheiro',
  A: 'Gerar crédito',
  R: 'Troco',
  N: 'Conta bancária',
  H: 'Troco na entrada',
};

/** Tipos operacionais (não são condição de venda a cliente). */
export const SHOP9_TIPO_CONTA_EXCLUIR_CRM = ['A', 'R', 'H', 'J'] as const;

export function sqlShop9ExcluirTipoOperacional(alias = 'fc'): string {
  const lista = SHOP9_TIPO_CONTA_EXCLUIR_CRM.map((c) => `'${c}'`).join(', ');
  return `AND UPPER(LTRIM(RTRIM(ISNULL(${alias}.Tipo_Conta, '')))) NOT IN (${lista})`;
}

export function nomeShop9TipoConta(codigo: string | null | undefined): string {
  const c = (codigo ?? '').trim().toUpperCase();
  if (!c) return 'Receber';
  return SHOP9_TIPO_CONTA_LEGENDA[c] ?? c;
}

export function sqlShop9TipoContaNome(alias = 'fc'): string {
  const col = `UPPER(LTRIM(RTRIM(ISNULL(${alias}.Tipo_Conta, ''))))`;
  const whens = Object.entries(SHOP9_TIPO_CONTA_LEGENDA)
    .map(([codigo, nome]) => `WHEN '${codigo}' THEN '${nome.replace(/'/g, "''")}'`)
    .join('\n      ');
  return `CASE ${col}
      ${whens}
      WHEN '' THEN 'Receber'
      ELSE ${col}
    END`;
}

/** Administradora do cartão (Visa 12x, etc.) — 1:1 com Cartao_Ordem_Administradora. */
export const SHOP9_ADMINISTRADORA_JOIN = `
  LEFT JOIN Administradoras_Cartao ac ON ac.Ordem = fc.Cartao_Ordem_Administradora
`;

/**
 * Fatia da barra: cartão Shop9 → mesma forma do Nomus (Cartão de Crédito);
 * senão Tipo_Conta (Dinheiro, Boleto Bancário…).
 */
export function sqlShop9CondicaoNome(fcAlias = 'fc', acAlias = 'ac'): string {
  return `CASE
      WHEN ISNULL(${fcAlias}.Cartao_Ordem_Administradora, 0) > 0
        AND LTRIM(RTRIM(ISNULL(${acAlias}.Nome, ''))) <> ''
      THEN 'Cartão de Crédito'
      ELSE ${sqlShop9TipoContaNome(fcAlias)}
    END`;
}

/** Grade: nome da administradora + parcela (VISA 12X · 1/12). */
export function nomeShop9Condicao(opts: {
  tipoConta?: string | null;
  administradora?: string | null;
  parcela?: string | null;
}): string {
  const adm = (opts.administradora ?? '').trim();
  if (adm) {
    const parc = (opts.parcela ?? '').trim();
    return parc ? `${adm} · ${parc}` : adm;
  }
  return nomeShop9TipoConta(opts.tipoConta);
}
