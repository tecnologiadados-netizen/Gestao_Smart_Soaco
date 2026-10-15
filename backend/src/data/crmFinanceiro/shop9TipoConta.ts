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

/** Formas usadas no contas a pagar (o Tipo_Conta do Shop9 quase não aparece em aberto). */
const SHOP9_FORMAS_DIARIO_EXTRA: { id: string; nome: string }[] = [
  { id: 'PIX', nome: 'PIX' },
  { id: 'TB', nome: 'Transferência bancária' },
  { id: 'B', nome: 'Boleto Bancário' },
  { id: 'D', nome: 'Dinheiro' },
  { id: 'DBT', nome: 'Dinheiro/Transferência' },
  { id: 'CC', nome: 'Cartão de Crédito' },
  { id: 'CD', nome: 'Cartão de Débito' },
  { id: 'DC', nome: 'Débito em conta' },
  { id: 'CR', nome: 'Crédito em conta' },
  { id: 'CH', nome: 'Cheque' },
  { id: 'N', nome: 'Conta bancária' },
  { id: 'GU', nome: 'Guia' },
  { id: 'C', nome: 'Carteira' },
  { id: 'T', nome: 'Carnê' },
  { id: 'O', nome: 'Outro' },
];

function chaveNomeForma(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR');
}

/** Opções do ajuste em massa do Diário. Tipo_Conta operacional (troco/crédito) fica de fora. */
export function formasPagamentoShop9Diario(): { id: string; nome: string }[] {
  const porNome = new Map<string, { id: string; nome: string }>();
  for (const forma of SHOP9_FORMAS_DIARIO_EXTRA) {
    porNome.set(chaveNomeForma(forma.nome), forma);
  }
  for (const [id, nome] of Object.entries(SHOP9_TIPO_CONTA_LEGENDA)) {
    if ((SHOP9_TIPO_CONTA_EXCLUIR_CRM as readonly string[]).includes(id)) continue;
    const chave = chaveNomeForma(nome);
    if (!porNome.has(chave)) porNome.set(chave, { id, nome });
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function formaPagamentoShop9Diario(codigo: string | null | undefined): { id: string; nome: string } | null {
  const bruto = (codigo ?? '').trim();
  if (!bruto) return null;
  const id = bruto.toUpperCase();
  const extra = SHOP9_FORMAS_DIARIO_EXTRA.find(
    (f) => f.id.toUpperCase() === id || chaveNomeForma(f.nome) === chaveNomeForma(bruto),
  );
  if (extra) return extra;
  const nomeTipo = SHOP9_TIPO_CONTA_LEGENDA[id];
  if (nomeTipo) return { id, nome: nomeTipo };
  return { id: bruto, nome: bruto };
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
