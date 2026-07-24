/**
 * Contas bancárias que entram no Caixa inicial / Caixa final da DFC.
 * FIDC ficam de fora; contas novas no Nomus não entram automaticamente.
 * Contas inativas (contabancaria.ativo <> 1 e IDs abaixo) são excluídas nos saldos.
 */
export const DFC_CONTAS_CAIXA_INICIAL_FINAL: readonly string[] = [
  // Só Aço Industrial
  'Caixa Só Aço - NELCIANE',
  'MOSAICO PAY (Finvest) - SÓ AÇO',
  'SÓ AÇO - BANCO SAFRA',
  'SÓ AÇO - BANCO SICOOB',
  'SÓ AÇO - BRADESCO',
  'SÓ AÇO - BRAVO',
  'SÓ AÇO - CAIXA PRINCIPAL',
  'SÓ AÇO - CAIXA SETOR DE COMPRAS',
  'Só Aço - Carradas',
  'SO ACO - CARTOES',
  'SO ACO - MOSAICOPAY',
  'SÓ AÇO - PAGME IP',
  'SÓ AÇO - SAFRA CONTA VINCULADA 1',
  'SÓ AÇO - SAFRA CONTA VINCULADA 2',
  'SÓ AÇO - SAFRA CONTA VINCULADA 3',
  'SÓ AÇO - TESOURARIA',
  'SÓ AÇO INDUSTRIAL BB',
  'SÓ AÇO INDUSTRIAL BNB',
  'SÓ AÇO INDUSTRIAL SANTANDER',
  'SÓ AÇO SANTANDER - CONTA GARANTIA',
  'SÓ AÇO UNICRED',
  // Só Móveis
  'SÓ MÓVEIS - BANCO SAFRA',
  'SÓ MÓVEIS - BRADESCO',
  'SÓ MÓVEIS - BRAVO',
  'SÓ MÓVEIS - CAIXA PRINCIPAL',
  'SO MOVEIS - CARTOES',
  'SÓ MÓVEIS - PAGME IP',
  'SÓ MÓVEIS LTDA BB',
  'SÓ MÓVEIS LTDA SANTANDER',
  'SÓ MÓVEIS SAFRA CONTA VINCULADA 1',
  'SÓ MÓVEIS SAFRA CONTA VINCULADA 2',
  'SÓ MÓVEIS SAFRA CONTA VINCULADA 3',
  'SÓ MÓVEIS UNICRED',
  // Só Refrigeração (saldos virão do Shop9 — nomes da planilha de caixas)
  'CAIXA BALCAO SO MOVEIS - SO REF',
  'CAIXA BALCÃO SO REFRIGERAÇÃO',
  'CAIXA BOLETO SO REFRIGERAÇÃO',
  'CAIXA CARTÕES SO REFRIGERAÇÃO',
  'CAIXA ECONOMICA-SO REFRIGERA',
  'CAIXA FICTICIO SO REFRIGERAÇÃO',
  'CAIXA PRINCIPAL SO REFRIGERAÇÃO',
  'SO REFRIGERAÇÃO - PAGME IP',
  'CAIXA DE SANGRIA',
  'SO REFRIGERACAO-PAGBANK',
  // R N Marques (saldos virão do Shop9)
  'RN MARQUES-BB',
  'RN MARQUES-PAGBANK',
];

/**
 * Contas cujo saldo ainda não vem do Nomus (LF) — placeholders na grade DFC
 * filtrados por idEmpresa (3 = Refrigeração, 4 = RN Marques). IDs sintéticos negativos.
 */
export type DfcContaCaixaShop9Placeholder = {
  idContaBancaria: number;
  nomeContaBancaria: string;
  idEmpresa: number;
};

export const DFC_CONTAS_CAIXA_SHOP9_PLACEHOLDERS: readonly DfcContaCaixaShop9Placeholder[] = [
  // Só Refrigeração (idEmpresa 3)
  { idContaBancaria: -3101, nomeContaBancaria: 'CAIXA BALCAO SO MOVEIS - SO REF', idEmpresa: 3 },
  { idContaBancaria: -3102, nomeContaBancaria: 'CAIXA BALCÃO SO REFRIGERAÇÃO', idEmpresa: 3 },
  { idContaBancaria: -3103, nomeContaBancaria: 'CAIXA BOLETO SO REFRIGERAÇÃO', idEmpresa: 3 },
  { idContaBancaria: -3104, nomeContaBancaria: 'CAIXA CARTÕES SO REFRIGERAÇÃO', idEmpresa: 3 },
  { idContaBancaria: -3105, nomeContaBancaria: 'CAIXA ECONOMICA-SO REFRIGERA', idEmpresa: 3 },
  { idContaBancaria: -3106, nomeContaBancaria: 'CAIXA FICTICIO SO REFRIGERAÇÃO', idEmpresa: 3 },
  { idContaBancaria: -3107, nomeContaBancaria: 'CAIXA PRINCIPAL SO REFRIGERAÇÃO', idEmpresa: 3 },
  { idContaBancaria: -3108, nomeContaBancaria: 'SO REFRIGERAÇÃO - PAGME IP', idEmpresa: 3 },
  { idContaBancaria: -3109, nomeContaBancaria: 'CAIXA DE SANGRIA', idEmpresa: 3 },
  { idContaBancaria: -3110, nomeContaBancaria: 'SO REFRIGERACAO-PAGBANK', idEmpresa: 3 },
  // R N Marques (idEmpresa 4)
  { idContaBancaria: -4101, nomeContaBancaria: 'RN MARQUES-BB', idEmpresa: 4 },
  { idContaBancaria: -4102, nomeContaBancaria: 'RN MARQUES-PAGBANK', idEmpresa: 4 },
];

/** Contas FIDC explicitamente excluídas do caixa inicial/final. */
export const DFC_CONTAS_CAIXA_EXCLUIDAS_FIDC: readonly string[] = [
  'RAIZES FUNDO - FIDC',
  'SL PAR - FIDC',
  'SÓ AÇO - AMB FIDC',
  'SO ACO FLUXASSET - ALFA FIDC',
];

/**
 * IDs Nomus (contabancaria) inativos — nunca entram no caixa inicial/final,
 * mesmo se houver homônimo ativo com o mesmo nome.
 */
export const DFC_IDS_CONTAS_BANCARIAS_INATIVAS: readonly number[] = [
  2, // teste
  10, // SÓ MÓVEIS LTDA ITAÚ
  11, // SÓ MÓVEIS LTDA CAIXA ECONÔMICA FEDERAL
  12, // SÓ MÓVEIS LTDA BANCO DO NORDESTE
  17, // SÓ AÇO BB - CONTA GARANTIA
  18, // SÓ AÇO ITAÚ - CONTA GARANTIA
  24, // SÓ MÓVEIS - VENDAS PEÇAS
  25, // SÓ MÓVEIS - VENDAS PRINCIPAL
  27, // SÓ MÓVEIS - CAIXA PRINCIPAL (inativa; ativa = 102)
  34, // SÓ MÓVEIS - TESOURARIA
  36, // SÓ AÇO - SANTANDER DESCONTADO
  38, // Só Aço - Caixa MF (inativa; ativa = 78)
  47, // Caixa Sangria
  48, // SÓ MÓVEIS LTDA BANPARÁ
  49, // Caixa RH
  51, // Recebimentos na loja
  56, // Só Aço - Caixa Karol
  60, // BNBCOBRANCASSOACO
  61, // BNBCOBRANÇASOMOVEIS
  65, // Motorista teste
  77, // ALFA FIDC - DESCONTO DUPLICATA
  79, // SÓ AÇO - PREMIUM FIDC
  81, // SÓ AÇO - CONTATO FIDC
];

/** Nomes excluídos do caixa inicial/final (inativas + exclusões manuais). */
export const DFC_NOMES_CONTAS_BANCARIAS_INATIVAS: readonly string[] = [
  'teste',
  'SÓ MÓVEIS LTDA ITAÚ',
  'SÓ MÓVEIS LTDA CAIXA ECONÔMICA FEDERAL',
  'SÓ MÓVEIS LTDA BANCO DO NORDESTE',
  'SÓ AÇO BB - CONTA GARANTIA',
  'SÓ AÇO ITAÚ - CONTA GARANTIA',
  'SÓ MÓVEIS - VENDAS PEÇAS',
  'SÓ MÓVEIS - VENDAS PRINCIPAL',
  'SÓ AÇO - SANTANDER DESCONTADO',
  'Caixa Sangria',
  'SÓ MÓVEIS LTDA BANPARÁ',
  'Caixa RH',
  'Recebimentos na loja',
  'Só Aço - Caixa Karol',
  'BNBCOBRANCASSOACO',
  'BNBCOBRANÇASOMOVEIS',
  'Motorista teste',
  'ALFA FIDC - DESCONTO DUPLICATA',
  'SÓ AÇO - PREMIUM FIDC',
  'SÓ AÇO - CONTATO FIDC',
  'SÓ MÓVEIS - TESOURARIA',
  'RECEBIMENTOS LOJA - NELCIANE',
  'SO ACO - PAGBANK',
  'SÓ MÓVEIS - OUTROS RECEBIMENTOS',
];

const ALLOW_SET = new Set(DFC_CONTAS_CAIXA_INICIAL_FINAL.map((n) => n.trim()));
const INATIVAS_ID_SET = new Set(DFC_IDS_CONTAS_BANCARIAS_INATIVAS);
const INATIVAS_NOME_SET = new Set(DFC_NOMES_CONTAS_BANCARIAS_INATIVAS.map((n) => n.trim()));

export function ehContaBancariaInativaDfc(idContaBancaria: number, nomeContaBancaria?: string): boolean {
  if (INATIVAS_ID_SET.has(idContaBancaria)) return true;
  const nome = nomeContaBancaria?.trim();
  if (nome && INATIVAS_NOME_SET.has(nome)) return true;
  return false;
}

/**
 * Sem filtro de UI → allowlist (planilha sem FIDC).
 * Com filtro de UI → interseção com a allowlist (nunca amplia além dela).
 */
export function resolverContasCaixaInicialFinal(filtroUsuario: string[]): string[] {
  const base =
    filtroUsuario.length === 0
      ? [...DFC_CONTAS_CAIXA_INICIAL_FINAL]
      : filtroUsuario.map((n) => n.trim()).filter((n) => n && ALLOW_SET.has(n));
  return base.filter((n) => !INATIVAS_NOME_SET.has(n.trim()));
}
