/**
 * Schema do Excel "ORGÂNICO DEFINITIVO GRUPO SÓ AÇO MODELO"
 * Aba: SÓ AÇO
 *
 * Análise automática: colunas com fórmulas vs colunas de entrada de dados.
 * Índices: 0-based (para arrays) e letra Excel (A, B, ...).
 */

/** Coluna com fórmula: índice, letra, cabeçalho e fórmula exata */
export interface ColunaFormula {
  /** Índice 0-based (para arrays) */
  index: number;
  /** Letra da coluna no Excel (A, B, ..., AA, AB, ...) */
  letter: string;
  /** Nome do cabeçalho na planilha */
  header: string;
  /** Fórmula exata (padrão da linha 2, adaptar N para outras linhas) */
  formula: string;
}

/** Coluna de entrada de dados (sem fórmula) */
export interface ColunaInput {
  index: number;
  letter: string;
  header: string;
}

// =============================================================================
// COLUNAS COM FÓRMULAS (19 colunas)
// =============================================================================

export const ORGANICO_COLUNAS_FORMULA: ColunaFormula[] = [
  { index: 41, letter: "AP", header: "$$ (valor diário)", formula: "=AO2*AN2" },
  { index: 42, letter: "AQ", header: "$$ ( consid. 21 Dias Uts )", formula: "=AP2*21" },
  { index: 43, letter: "AR", header: "Desconto VT", formula: "=IF(AQ2>0,BB2*6%,0)" },
  { index: 47, letter: "AV", header: "$ Semanal", formula: "=AT2*AU2" },
  { index: 48, letter: "AW", header: "$$ ( consid. 4 Semanas Uts )", formula: "=AV2*4" },
  { index: 51, letter: "AZ", header: "$$ ( consid. 21 Dias Uts ).", formula: "=AY2*21" },
  { index: 52, letter: "BA", header: "TOTAL MÊS ( VT + VA + GASO )", formula: "='SÓ AÇO'!$AZ2+'SÓ AÇO'!$AW2+'SÓ AÇO'!$AQ2" },
  {
    index: 54,
    letter: "BC",
    header: "FAIXA SALARIAL",
    formula:
      "=IFERROR(IF('SÓ AÇO'!$BB2<1593.78,\"CTPS - abaixo do minimo\",IF('SÓ AÇO'!$BB2=1593.78,\"CTPS - Minimo\",IF('SÓ AÇO'!$BB2>5000,\"CTPS - Acima de 5k\",IF('SÓ AÇO'!$BB2>4000,\"CTPS - 4,01K até 5k\",IF('SÓ AÇO'!$BB2>3000,\"CTPS - 3,01k até 4k\",IF('SÓ AÇO'!$BB2>2000,\"CTPS - 2,01k até 3k\",IF('SÓ AÇO'!$BB2>1593.78,\"CTPS - Minimo até 2k\",))))))),\"\")",
  },
  { index: 57, letter: "BF", header: "INCRE $$", formula: "=IFERROR(1621*BE2,\"-\")" },
  { index: 60, letter: "BI", header: "INCRE $$2", formula: "=IFERROR('SÓ AÇO'!$BB2*BH2,\"-\")" },
  { index: 63, letter: "BL", header: "INCRE $$5", formula: "=IFERROR(BB2*BK2,\"-\")" },
  { index: 66, letter: "BO", header: "INCRE $$6", formula: "=65*BN2" },
  { index: 69, letter: "BR", header: "INCRE $$7", formula: "=IFERROR('SÓ AÇO'!$BB2*BQ2,\"-\")" },
  { index: 70, letter: "BS", header: "TOTAL INCRE $$8", formula: '=IFERROR(BL2+BI2+BF2,"-")' },
  { index: 71, letter: "BT", header: "SOMENTE SALÁRIO", formula: "='SÓ AÇO'!$BR2+'SÓ AÇO'!$BB2" },
  { index: 73, letter: "BV", header: "SALÁRIO + ADENDO", formula: "='SÓ AÇO'!$BT2+'SÓ AÇO'!$BU2" },
  { index: 74, letter: "BW", header: "SALÁRIO + ADENDO + ADICIONAIS", formula: "='SÓ AÇO'!$BV2+'SÓ AÇO'!$BS2" },
  { index: 75, letter: "BX", header: "CUSTO TOTAL - GERAL - CR MÊS", formula: "=('SÓ AÇO'!$BW2+'SÓ AÇO'!$BA2) - AR2" },
];

// =============================================================================
// COLUNAS DE ENTRADA (sem fórmula - 69 colunas)
// =============================================================================

export const ORGANICO_COLUNAS_INPUT: ColunaInput[] = [
  { index: 0, letter: "A", header: "ID" },
  { index: 1, letter: "B", header: "NOME" },
  { index: 2, letter: "C", header: "CPF" },
  { index: 3, letter: "D", header: "RG" },
  { index: 4, letter: "E", header: "CNH - CATEGORIA" },
  { index: 5, letter: "F", header: "NUMERO - CNH" },
  { index: 6, letter: "G", header: "CARGA HORÁRIA MENSAL" },
  { index: 7, letter: "H", header: "TURNO" },
  { index: 8, letter: "I", header: "ESCALA DE TRABALHO" },
  { index: 9, letter: "J", header: "SEXO" },
  { index: 10, letter: "K", header: "ADMISSÃO" },
  { index: 11, letter: "L", header: "TEMPO DE EMPRESA" },
  { index: 12, letter: "M", header: "CARGO" },
  { index: 13, letter: "N", header: "ÁREA" },
  { index: 14, letter: "O", header: "SETOR" },
  { index: 15, letter: "P", header: "GESTOR IMEDIATO" },
  { index: 16, letter: "Q", header: "GESTOR MEDIATO" },
  { index: 17, letter: "R", header: "DIRETORIA" },
  { index: 18, letter: "S", header: "PIS" },
  { index: 19, letter: "T", header: "Nascimento" },
  { index: 20, letter: "U", header: "Idade" },
  { index: 21, letter: "V", header: "Grau Instrução" },
  { index: 22, letter: "W", header: "Curso Graduação" },
  { index: 23, letter: "X", header: "Período" },
  { index: 24, letter: "Y", header: "Ano previsto para Formatura" },
  { index: 25, letter: "Z", header: "Especialidade/MBA?" },
  { index: 26, letter: "AA", header: "CBO" },
  { index: 27, letter: "AB", header: "Vínculo" },
  { index: 28, letter: "AC", header: "Número de filhos" },
  { index: 29, letter: "AD", header: "Número de dependentes" },
  { index: 30, letter: "AE", header: "Telefone" },
  { index: 31, letter: "AF", header: "Telefone Emergencial" },
  { index: 32, letter: "AG", header: "Tamanho Calçado" },
  { index: 33, letter: "AH", header: "Tamanho Camisa" },
  { index: 34, letter: "AI", header: "Tamanho Calça" },
  { index: 35, letter: "AJ", header: "EPIs LOCUS" },
  { index: 36, letter: "AK", header: "EPIs ESCOPO" },
  { index: 37, letter: "AL", header: "PCD" },
  { index: 38, letter: "AM", header: "Vale Transporte" },
  { index: 39, letter: "AN", header: "QTD( 2 ou 4 )" },
  { index: 40, letter: "AO", header: "Valor (Vale)" },
  { index: 44, letter: "AS", header: "Auxílio Combustível" },
  { index: 45, letter: "AT", header: "Quant de litros ( semanal )" },
  { index: 46, letter: "AU", header: "Valor do litro" },
  { index: 49, letter: "AX", header: "Auxílio Quentinha" },
  { index: 50, letter: "AY", header: "$ Dia" },
  { index: 53, letter: "BB", header: "CTPS" },
  { index: 55, letter: "BD", header: "Insalubridade ( REF - SALÁRIO MINIMO )" },
  { index: 56, letter: "BE", header: "INCRE %" },
  { index: 58, letter: "BG", header: "Periculosidade ( REF - SALÁRIO FUNCIONÁRIO )" },
  { index: 59, letter: "BH", header: "INCRE %2" },
  { index: 61, letter: "BJ", header: "Adicional noturno" },
  { index: 62, letter: "BK", header: "INCRE %4" },
  { index: 64, letter: "BM", header: "Salário Familia" },
  { index: 65, letter: "BN", header: "QTD Filhos" },
  { index: 67, letter: "BP", header: "Cargo Confiança" },
  { index: 68, letter: "BQ", header: "Percentual %" },
  { index: 72, letter: "BU", header: "Adendo" },
  { index: 76, letter: "BY", header: "AGENCIA" },
  { index: 77, letter: "BZ", header: "CONTA" },
  { index: 78, letter: "CA", header: "BANCO" },
  { index: 79, letter: "CB", header: "CHAVE PIX" },
  { index: 80, letter: "CC", header: "CASO NÃO TENHA PIX" },
  { index: 81, letter: "CD", header: "ONBOARDING" },
  { index: 82, letter: "CE", header: "MODAL GESTÃO DE HORAS" },
  { index: 83, letter: "CF", header: "SITUAÇÃO TRABALHISTA" },
  { index: 84, letter: "CG", header: "STATUS FUNCIONÁRIO" },
  { index: 85, letter: "CH", header: "ESTABILIDADE" },
  { index: 86, letter: "CI", header: "DETALHAMENTO ARQUIVO" },
];

// =============================================================================
// MAPEAMENTO RÁPIDO
// =============================================================================

/** Conjunto de índices de colunas com fórmula (para checagem O(1)) */
export const ORGANICO_INDICES_FORMULA = new Set(
  ORGANICO_COLUNAS_FORMULA.map((c) => c.index)
);

/** Verifica se a coluna no índice dado possui fórmula */
export function isColunaFormula(index: number): boolean {
  return ORGANICO_INDICES_FORMULA.has(index);
}

/** Tempo de empresa e idade: texto calculado no app (anos, meses e dias), não pela planilha. */
export const ORGANICO_INDICES_TEMPO_IDADE = new Set<number>([11, 20]);

/**
 * Campos Sim/Não (benefícios e adicionais). Fonte única — alinhada a COLUNAS_TEXTO_PRESERVAR.
 * NÃO incluir colunas numéricas: 45 (litros/semana), 50 ($ Dia quentinha), 56/59/62/68 (INCRE %), 65 (QTD filhos).
 */
export const ORGANICO_COLUNAS_SIM_NAO = [
  37, // PCD
  38, // Vale Transporte
  44, // Auxílio Combustível
  49, // Auxílio Quentinha
  55, // Insalubridade
  58, // Periculosidade
  61, // Adicional noturno
  64, // Salário Família (flag)
  67, // Cargo Confiança
] as const;

export const ORGANICO_INDICES_SIM_NAO = new Set<number>(ORGANICO_COLUNAS_SIM_NAO);

/** Listas suspensas Sim/Não na exportação Excel (aba benefícios). */
export const ORGANICO_COLUNAS_BENEFICIOS_SIM_NAO_EXCEL = [38, 44, 49] as const;

/** Falha cedo se Sim/Não e numérico colidirem (evita reintroduzir o bug de sobrescrever litros / $ Dia). */
const ORGANICO_COLUNAS_NUNCA_SIM_NAO = [45, 46, 50, 56, 59, 62, 65, 68] as const;
for (const idx of ORGANICO_COLUNAS_NUNCA_SIM_NAO) {
  if (ORGANICO_INDICES_SIM_NAO.has(idx)) {
    throw new Error(`ORGANICO_INDICES_SIM_NAO não pode incluir coluna numérica (índice ${idx}).`);
  }
}

/** Fórmulas Excel + tempo/idade automáticos (somente leitura no modal / não digitável na exportação bruta). */
export function isColunaDerivadaSistema(index: number): boolean {
  return isColunaFormula(index) || ORGANICO_INDICES_TEMPO_IDADE.has(index);
}

/** Retorna a fórmula da coluna (se existir) */
export function getFormulaColuna(index: number): string | null {
  return ORGANICO_COLUNAS_FORMULA.find((c) => c.index === index)?.formula ?? null;
}

/**
 * Fórmulas em sintaxe Excel (IF, IFERROR) para exportação.
 * Template usa linha 2; adaptar para cada linha com adaptarFormulaParaLinha().
 */
export const FORMULAS_EXPORT: Record<number, string> = {
  41: "=AO2*AN2",
  42: "=AP2*21",
  43: "=IF(AQ2>0,BB2*6%,0)",
  47: "=AT2*AU2",
  48: "=AV2*4",
  51: "=AY2*21",
  52: "=AZ2+AW2+AQ2",
  54: '=IFERROR(IF(BB2<1593.78,"CTPS - abaixo do minimo",IF(BB2=1593.78,"CTPS - Minimo",IF(BB2>5000,"CTPS - Acima de 5k",IF(BB2>4000,"CTPS - 4,01K até 5k",IF(BB2>3000,"CTPS - 3,01k até 4k",IF(BB2>2000,"CTPS - 2,01k até 3k",IF(BB2>1593.78,"CTPS - Minimo até 2k",""))))))),"")',
  57: '=IFERROR(1621*BE2,"-")',
  60: '=IFERROR(BB2*BH2,"-")',
  63: '=IFERROR(BB2*BK2,"-")',
  66: "=65*BN2",
  69: '=IFERROR(BB2*BQ2,"-")',
  70: '=IFERROR(BL2+BI2+BF2,"-")',
  71: "=BR2+BB2",
  73: "=BT2+BU2",
  74: "=BV2+BS2",
  75: "=(BW2+BA2)-AR2",
};

/** Adapta fórmula da linha 2 para a linha N (ex: AN2 -> AN5) */
export function adaptarFormulaParaLinha(formula: string, rowNum: number): string {
  return formula.replace(/([A-Z]+)2\b/g, `$1${rowNum}`);
}

/** Fallback seguro caso o estilo do modelo não possa ser carregado. */
export const NUMFMT_MOEDA_BR = '[$R$-416]#,##0.00';

/**
 * Colunas com fórmulas que retornam valores monetários (exclui FAIXA SALARIAL que retorna texto).
 */
export const COLUNAS_FORMULA_MOEDA = new Set([
  41, 42, 43, 47, 48, 51, 52, 57, 60, 63, 66, 69, 70, 71, 73, 74, 75,
]);

/**
 * Colunas numéricas que alimentam fórmulas. Quando vazias, devem ser exportadas
 * como 0 para evitar #VALOR! no Excel (célula vazia em operação matemática).
 */
export const COLUNAS_NUMERICAS_VAZIO_ZERO = new Set([
  28, 29, 39, 40, 45, 46, 50, 53, 56, 59, 62, 65, 68, 72,
]);

/** Colunas que devem ser exportadas sempre como texto (não converter para número). */
export const COLUNAS_TEXTO_PRESERVAR = new Set([
  3, 4, 5, 6, // RG, CNH, Nº CNH, CARGA HORÁRIA (evita notação científica e perda de zeros)
  7, 8, 10, 11, // TURNO, ESCALA DE TRABALHO, ADMISSÃO, TEMPO DE EMPRESA
  15, 16, 17, 21, // GESTOR IMEDIATO/MEDIATO, DIRETORIA, Grau Instrução (evita "3º grau" → 3)
  18, // PIS
  30, 31, // Telefone, Telefone Emergencial
  76, 77, 78, 79, 80, // AGENCIA, CONTA, BANCO, CHAVE PIX, CASO NÃO TENHA PIX
  36, 37, 44, 49, 55, 58, 61, 64, 67, // benefícios Sim/Não
]);

/** Coluna CPF - índice 2. */
export const COLUNA_CPF = 2;

/**
 * No Excel, força formato texto (@) para a célula não reinterpretar como número.
 * Deve cobrir COLUNAS_TEXTO_PRESERVAR + CPF.
 */
export const COLUNAS_EXCEL_NUMFMT_TEXTO = new Set<number>([COLUNA_CPF, ...COLUNAS_TEXTO_PRESERVAR]);

/** Colunas percentuais (INCRE %, INCRE %2, INCRE %4, Percentual %). Valores 0-100 devem ser convertidos para 0-1 no Excel. */
export const COLUNAS_PERCENTUAL = new Set([56, 59, 62, 68]);

/** Colunas de moeda (dados de entrada, não fórmula). Aplicar numFmt R$. */
export const COLUNAS_MOEDA_DADOS = new Set([53, 72]); // CTPS, Adendo

/** Colunas de data. Formatar como DD/MM/YYYY (padrão brasileiro). */
export const COLUNAS_DATA = new Set([10, 19]); // ADMISSÃO, Nascimento
