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
  modelo?: string;
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
  modelo?: string;
  observacao?: string;
  /** Número da ordem em que a peça deste item já saiu. */
  ordemGerada?: string;
};

/**
 * Identidade da peça dentro de um item de pedido, para saber se já saiu em ordem.
 * PI/PP do Nomus pelo código exato; peça da planilha (sem tipo) pela descrição, MP e medidas.
 */
export function chavePeca(componente: Pick<
  ComponenteDetalhe,
  'codigo' | 'tipo' | 'descricao' | 'materiaPrima' | 'medida01' | 'medida02'
>): string {
  const codigo = componente.codigo.trim().toUpperCase().replace(/\s+/g, ' ');
  if (componente.tipo && codigo) return `${componente.tipo}|${codigo}`;
  return [
    'PLANILHA',
    codigo,
    componente.descricao.trim().toUpperCase().replace(/\s+/g, ' '),
    componente.materiaPrima.trim(),
    componente.medida01.trim(),
    componente.medida02.trim(),
  ].join('|');
}

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

/** Em quais fontes o código tem ficha: lista de produção do Nomus e/ou planilha do setor. */
export function fichasDoCodigo(
  codigo: string,
  paisComListaNomus: string[],
  linhasPlanilha: { codigo: string }[]
): { nomus: boolean; planilha: boolean } {
  const alvo = codigo.toUpperCase().trim();
  const base = chaveFicha(codigo);
  if (!alvo) return { nomus: false, planilha: false };
  const nomus = paisComListaNomus.some((pai) => {
    const nome = pai.toUpperCase().trim();
    return nome === alvo || chaveFicha(nome) === base;
  });
  const planilha = linhasPlanilha.some((linha) => chaveFicha(linha.codigo) === base);
  return { nomus, planilha };
}

/** Código do produto para guardar a escolha entre Nomus e planilha quando há as duas fichas. */
export function chavePreferenciaFicha(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Nomus tem prioridade. A planilha vale quando não há lista de produção,
 * ou quando o código tem as duas e o usuário escolheu ficar com a planilha.
 */
export function origemDaFicha(
  codigo: string,
  paisComListaNomus: string[],
  linhasPlanilha: { codigo: string }[],
  preferencia?: 'nomus' | 'planilha' | null
): OrigemFicha {
  const fichas = fichasDoCodigo(codigo, paisComListaNomus, linhasPlanilha);
  if (fichas.nomus && fichas.planilha) return preferencia === 'planilha' ? 'planilha' : 'nomus';
  if (fichas.nomus) return 'nomus';
  if (fichas.planilha) return 'planilha';
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
      modelo: linha.modelo ?? '',
    }));
}

export type PecaListaFilha = {
  codigoPai: string;
  codigo: string;
  descricao: string;
  tipo: 'PI' | 'PP';
  quantidade: number;
};

/** Junta os PI/PP da lista de cada componente, logo abaixo do componente. Não repete o que a lista do pai já trouxe. */
export function incluirPecasDasListasFilhas(
  componentes: ComponenteDetalhe[],
  filhos: PecaListaFilha[],
  qtdeReal: number
): ComponenteDetalhe[] {
  const filhosPorPai = new Map<string, PecaListaFilha[]>();
  for (const filho of filhos) {
    if (!filho.codigo.trim() || filho.codigo.toUpperCase() === filho.codigoPai.toUpperCase()) continue;
    const chavePai = filho.codigoPai.toUpperCase();
    const lista = filhosPorPai.get(chavePai) ?? [];
    lista.push(filho);
    filhosPorPai.set(chavePai, lista);
  }

  const jaNaListaPai = new Set(componentes.map((componente) => `${componente.tipo}|${componente.codigo.toUpperCase()}`));
  const saida: ComponenteDetalhe[] = [];
  const indiceExtra = new Map<string, number>();

  for (const componente of componentes) {
    saida.push({ ...componente });
    for (const filho of filhosPorPai.get(componente.codigo.toUpperCase()) ?? []) {
      const chave = `${filho.tipo}|${filho.codigo.toUpperCase()}`;
      if (jaNaListaPai.has(chave)) continue;
      const quantidade = filho.quantidade * componente.quantidade;
      const existente = indiceExtra.get(chave);
      if (existente != null) {
        const atual = saida[existente];
        if (!atual) continue;
        atual.quantidade += quantidade;
        atual.quantidadeTotal = multiplicarPelaCarteira(atual.quantidade, qtdeReal);
        continue;
      }
      indiceExtra.set(chave, saida.length);
      saida.push({
        codigo: filho.codigo,
        descricao: filho.descricao,
        tipo: filho.tipo,
        quantidade,
        quantidadeTotal: multiplicarPelaCarteira(quantidade, qtdeReal),
        materiaPrima: '',
        medida01: '',
        medida02: '',
      });
    }
  }

  return saida;
}
