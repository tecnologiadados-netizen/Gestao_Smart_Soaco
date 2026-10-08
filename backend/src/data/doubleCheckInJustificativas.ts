export const CAMPOS_JUSTIFICATIVA = ['valor_unitario', 'qtde', 'ipi', 'condicao_pagamento'] as const;
export type CampoJustificativa = (typeof CAMPOS_JUSTIFICATIVA)[number];

export type JustificativaSeed = {
  codigo: string;
  label: string;
  sortOrder: number;
  campos: readonly CampoJustificativa[];
};

/** Motivos da divergência NF × PC. "Outros" fica por último e vale para qualquer campo. */
export const JUSTIFICATIVA_SEED: readonly JustificativaSeed[] = [
  {
    codigo: 'arredondamento',
    label: 'Ajuste de arredondamento',
    sortOrder: 10,
    campos: ['valor_unitario'],
  },
  {
    codigo: 'diferenca_comercial',
    label: 'Diferença comercial negociada',
    sortOrder: 11,
    campos: ['valor_unitario'],
  },
  {
    codigo: 'preco_tabela_fornecedor',
    label: 'Preço de tabela do fornecedor',
    sortOrder: 12,
    campos: ['valor_unitario'],
  },
  {
    codigo: 'mesmo_codigo_itens',
    label: 'Mesmo código para itens diferentes',
    sortOrder: 13,
    campos: ['valor_unitario'],
  },
  {
    codigo: 'rateio_fechar_documento',
    label: 'Rateio para fechar o valor do documento',
    sortOrder: 14,
    campos: ['valor_unitario'],
  },
  {
    codigo: 'divergencia_por_ipi',
    label: 'Diferença causada pelo IPI',
    sortOrder: 15,
    campos: ['valor_unitario', 'ipi'],
  },
  {
    codigo: 'erro_cadastro_um',
    label: 'Erro de cadastro / conversão de UM',
    sortOrder: 16,
    campos: ['valor_unitario', 'qtde'],
  },
  {
    codigo: 'qtde_parcial',
    label: 'Quantidade parcial / saldo de PC',
    sortOrder: 20,
    campos: ['qtde'],
  },
  {
    codigo: 'peso_da_peca',
    label: 'Diferença de peso da peça',
    sortOrder: 21,
    campos: ['qtde'],
  },
  {
    codigo: 'nf_mais_de_um_pedido',
    label: 'NF faturada em mais de um pedido',
    sortOrder: 22,
    campos: ['qtde', 'ipi'],
  },
  {
    codigo: 'fornecedor_qtde_diferente',
    label: 'Fornecedor enviou quantidade diferente',
    sortOrder: 23,
    campos: ['qtde'],
  },
  {
    codigo: 'ipi_reflexo',
    label: 'IPI reflexo do valor ou da quantidade',
    sortOrder: 30,
    campos: ['ipi'],
  },
  {
    codigo: 'pedido_sem_ipi',
    label: 'Pedido sem IPI destacado',
    sortOrder: 31,
    campos: ['ipi'],
  },
  {
    codigo: 'tributacao_ipi',
    label: 'Frete / IPI / tributação',
    sortOrder: 32,
    campos: ['ipi', 'valor_unitario'],
  },
  {
    codigo: 'condicao_nao_cadastrada',
    label: 'Condição de pagamento não cadastrada',
    sortOrder: 40,
    campos: ['condicao_pagamento'],
  },
  {
    codigo: 'entrada_avulsa',
    label: 'Entrada avulsa (ajuste na entrada fiscal)',
    sortOrder: 41,
    campos: ['condicao_pagamento'],
  },
  {
    codigo: 'avista_lancamento_avulso',
    label: 'À vista com lançamento avulso (frete/boleto)',
    sortOrder: 42,
    campos: ['condicao_pagamento'],
  },
  {
    codigo: 'frete_lancado_na_entrada',
    label: 'Frete lançado na entrada (pedido sem o valor exato)',
    sortOrder: 44,
    campos: ['condicao_pagamento'],
  },
  {
    codigo: 'condicao_pagamento',
    label: 'Condição de pagamento divergente',
    sortOrder: 43,
    campos: ['condicao_pagamento'],
  },
  {
    codigo: 'divergencia_so_na_tela',
    label: 'Conferido: divergência só na tela',
    sortOrder: 80,
    campos: CAMPOS_JUSTIFICATIVA,
  },
  {
    codigo: 'outros',
    label: 'Outros',
    sortOrder: 90,
    campos: CAMPOS_JUSTIFICATIVA,
  },
];

const POR_CODIGO = new Map(JUSTIFICATIVA_SEED.map((s) => [s.codigo, s]));

export function camposDaJustificativa(codigo: string): CampoJustificativa[] {
  const seed = POR_CODIGO.get(codigo);
  if (!seed) return [...CAMPOS_JUSTIFICATIVA];
  return [...seed.campos];
}

export function justificativaAplicavelAoCampo(codigo: string, campo: string): boolean {
  return (camposDaJustificativa(codigo) as readonly string[]).includes(campo);
}

export function normalizarCamposJustificativa(valor: unknown): CampoJustificativa[] {
  const lista = Array.isArray(valor) ? valor : [];
  const vistos = new Set<string>();
  const out: CampoJustificativa[] = [];
  for (const item of lista) {
    const campo = String(item ?? '').trim();
    if (!(CAMPOS_JUSTIFICATIVA as readonly string[]).includes(campo) || vistos.has(campo)) continue;
    vistos.add(campo);
    out.push(campo as CampoJustificativa);
  }
  return out;
}

export function parseCamposJustificativaSalvos(raw: string | null | undefined): CampoJustificativa[] {
  if (!raw?.trim()) return [];
  try {
    return normalizarCamposJustificativa(JSON.parse(raw));
  } catch {
    return [];
  }
}
