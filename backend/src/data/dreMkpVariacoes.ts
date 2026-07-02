/** Percentual MKP por grupo — espelho do frontend (faturamento indireto líquido). */
export const DRE_MKP_VARIACOES: { grupoProduto: string; variacao: number }[] = [
  { grupoProduto: 'Gôndolas', variacao: 0 },
  { grupoProduto: 'Estufas', variacao: 0 },
  { grupoProduto: 'Máquina para serrar ossos', variacao: 0 },
  { grupoProduto: 'Outros', variacao: 0 },
  { grupoProduto: 'Fritadeira tacho', variacao: 0 },
  { grupoProduto: 'Porta Paletes', variacao: 0 },
  { grupoProduto: 'Balcão frigorífico sem tendal', variacao: 0 },
  { grupoProduto: 'Balcão', variacao: 0 },
  { grupoProduto: 'Cadeiras e similares', variacao: 32.34 },
  { grupoProduto: 'Fogão industrial', variacao: 27 },
  { grupoProduto: 'Fornos', variacao: 45.09 },
  { grupoProduto: 'Móveis de Aço', variacao: 16.26 },
  { grupoProduto: 'Móveis em melaminico', variacao: 28.17 },
  { grupoProduto: 'Resfriador industrial', variacao: 26.88 },
  { grupoProduto: 'Mesa para panificação', variacao: 38.43 },
  { grupoProduto: 'Câmaras', variacao: 36.61 },
  { grupoProduto: 'Checkout', variacao: 25.78 },
  { grupoProduto: 'Material comprado', variacao: 0 },
  { grupoProduto: 'Chapa bifeteira', variacao: 0 },
  { grupoProduto: 'Móveis escolares', variacao: 0 },
];

const ALIASES_GRUPO_NOMUS: Record<string, string> = {
  'material comprado': 'Material comprado',
  'moveis de aco': 'Móveis de Aço',
  'moveis escolares': 'Móveis escolares',
  'moveis em melaminico': 'Móveis em melaminico',
  camara: 'Câmaras',
  camaras: 'Câmaras',
  'maquina para serrar ossos': 'Máquina para serrar ossos',
  'fritadeira tacho': 'Fritadeira tacho',
  'porta paletes': 'Porta Paletes',
};

export function normalizarGrupoProduto(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function nomeGrupoProdutoDre(nomeNomus: string): string {
  const chave = normalizarGrupoProduto(nomeNomus);
  return ALIASES_GRUPO_NOMUS[chave] ?? nomeNomus.trim();
}

export function variacaoMkpPorGrupo(nome: string): number {
  const canonico = nomeGrupoProdutoDre(nome);
  const row = DRE_MKP_VARIACOES.find(
    (r) => normalizarGrupoProduto(r.grupoProduto) === normalizarGrupoProduto(canonico),
  );
  return row?.variacao ?? 0;
}

/** (valorUnitario - valorUnitario×MKP/100) × qtde */
export function calcularValorFaturamentoIndireto(
  valorUnitario: number,
  qtde: number,
  percMarkup: number,
): number {
  if (!Number.isFinite(valorUnitario) || !Number.isFinite(qtde)) return 0;
  const mkp = Number.isFinite(percMarkup) ? percMarkup : 0;
  return (valorUnitario - (valorUnitario * mkp) / 100) * qtde;
}
