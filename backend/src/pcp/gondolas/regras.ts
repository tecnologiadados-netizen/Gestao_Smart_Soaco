export type SetorGondola = 'Gôndolas' | 'Porta Paletes';

export type LinhaPlanilha = {
  codigo: string;
  descricaoPeca: string;
  quantidade: number;
  materiaPrima: string;
  medida01: string;
  medida02: string;
  pesoPeca: number;
  codigoNomus: string;
};

export type ComponenteDetalhe = {
  codigo: string;
  descricao: string;
  tipo: 'PI' | 'PP' | '';
  quantidade: number;
  quantidadeTotal: number;
  materiaPrima: string;
  medida01: string;
  medida02: string;
};

/** Casa `PI 2860.2` com `PI 2860`, como na planilha de inspiração. */
export function chaveFicha(codigo: string): string {
  let texto = codigo.toUpperCase().trim().replace(/\s+/g, ' ');
  const ponto = texto.indexOf('.');
  if (ponto !== -1) texto = texto.slice(0, ponto).trim();
  return texto;
}

export function classificarSetor(setor: string): SetorGondola | null {
  const s = setor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (s.includes('porta') && s.includes('palet')) return 'Porta Paletes';
  if (s.includes('gondol')) return 'Gôndolas';
  return null;
}

/**
 * Mesma leitura da programação de inspiração:
 * rota até 4 usa o saldo em aberto; rota 5 zera; as demais usam o romaneado.
 */
export function qtdePendenteReal(observacoes: string, pendente: number, qtdeRomaneada: number): number {
  const obs = observacoes.trim();
  const primeiro = obs.charAt(0).toUpperCase();
  const numero = primeiro === '' || primeiro === 'R' ? 999 : Number(primeiro);
  const rota = Number.isFinite(numero) ? numero : 999;
  if (rota <= 4) return pendente;
  if (rota === 5) return 0;
  return qtdeRomaneada;
}

export function tipoComponente(tipoNome: string): 'PI' | 'PP' | null {
  const nome = tipoNome.trim().toLowerCase();
  if (nome === 'produto intermediário' || nome === 'produto intermediario') return 'PI';
  if (nome === 'produto em processo') return 'PP';
  return null;
}

export function multiplicarPelaCarteira(quantidade: number, qtdeReal: number): number {
  if (!Number.isFinite(quantidade) || !Number.isFinite(qtdeReal)) return 0;
  return quantidade * qtdeReal;
}

export type OrigemFicha = 'nomus' | 'planilha' | 'nenhuma';

/** Nomus tem prioridade. A planilha só vale quando não há lista de produção. */
export function origemDaFicha(
  codigo: string,
  paisComListaNomus: string[],
  linhasPlanilha: { codigo: string }[]
): OrigemFicha {
  const alvo = codigo.toUpperCase().trim();
  const base = chaveFicha(codigo);
  if (!alvo) return 'nenhuma';
  const noNomus = paisComListaNomus.some((pai) => {
    const nome = pai.toUpperCase().trim();
    return nome === alvo || chaveFicha(nome) === base;
  });
  if (noNomus) return 'nomus';
  if (linhasPlanilha.some((linha) => chaveFicha(linha.codigo) === base)) return 'planilha';
  return 'nenhuma';
}

/** Verde na grade: lista de produção no Nomus ou, na falta dela, linha na planilha do setor. */
export function itemTemFicha(
  codigo: string,
  paisComListaNomus: string[],
  linhasPlanilha: { codigo: string }[]
): boolean {
  return origemDaFicha(codigo, paisComListaNomus, linhasPlanilha) !== 'nenhuma';
}

export function componentesDaPlanilha(
  linhas: LinhaPlanilha[],
  codigoItem: string,
  qtdeReal: number
): ComponenteDetalhe[] {
  const chave = chaveFicha(codigoItem);
  if (!chave) return [];
  return linhas
    .filter((linha) => chaveFicha(linha.codigo) === chave)
    .map((linha) => ({
      codigo: linha.codigoNomus,
      descricao: linha.descricaoPeca,
      tipo: '' as const,
      quantidade: linha.quantidade,
      quantidadeTotal: multiplicarPelaCarteira(linha.quantidade, qtdeReal),
      materiaPrima: linha.materiaPrima,
      medida01: linha.medida01,
      medida02: linha.medida02,
    }));
}
