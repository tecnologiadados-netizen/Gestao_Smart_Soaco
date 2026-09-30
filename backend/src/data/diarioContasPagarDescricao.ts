/**
 * Texto gravado na primeira reprogramação de vencimento.
 * Shop9: Financeiro_Contas.Descricao é varchar(80). O prefixo fica inteiro;
 * a descrição antiga é abreviada para caber com o sentido preservado.
 * Nomus não recebe limite.
 */
import { formatSqlDateYmd } from './dfcDateUtils.js';

/** varchar(80) de Financeiro_Contas.Descricao. */
export const SHOP9_DESCRICAO_MAX = 80;

const MARCA = '\u0001';

/** Frases mais longas primeiro. A marca protege a sigla na retirada de conectores. */
const ABREVIACOES: readonly [string, string][] = [
  ['energia eletrica', 'ENERG'],
  ['notas fiscais', 'NFs'],
  ['nota fiscal', 'NF'],
  ['transferencias', 'TRANSF'],
  ['transferencia', 'TRANSF'],
  ['fornecedores', 'FORN'],
  ['fornecedor', 'FORN'],
  ['distribuidora', 'DIST'],
  ['mercadorias', 'MERC'],
  ['mercadoria', 'MERC'],
  ['vencimentos', 'VENC'],
  ['vencimento', 'VENC'],
  ['pagamentos', 'PGTO'],
  ['pagamento', 'PGTO'],
  ['duplicatas', 'DUP'],
  ['duplicata', 'DUP'],
  ['descontos', 'DESC'],
  ['desconto', 'DESC'],
  ['documentos', 'DOC'],
  ['documento', 'DOC'],
  ['materiais', 'MAT'],
  ['material', 'MAT'],
  ['produtos', 'PROD'],
  ['produto', 'PROD'],
  ['parcelas', 'PARC'],
  ['parcela', 'PARC'],
  ['servicos', 'SERV'],
  ['servico', 'SERV'],
  ['empresas', 'EMP'],
  ['empresa', 'EMP'],
  ['telefones', 'TEL'],
  ['telefone', 'TEL'],
  ['impostos', 'IMP'],
  ['imposto', 'IMP'],
  ['industrias', 'IND'],
  ['industria', 'IND'],
  ['comercios', 'COM'],
  ['comercio', 'COM'],
  ['boletos', 'BOL'],
  ['boleto', 'BOL'],
  ['faturas', 'FAT'],
  ['fatura', 'FAT'],
  ['compras', 'COMP'],
  ['compra', 'COMP'],
  ['fretes', 'FRT'],
  ['frete', 'FRT'],
  ['depositos', 'DEP'],
  ['deposito', 'DEP'],
  ['bancarios', 'BANC'],
  ['bancario', 'BANC'],
  ['alugueis', 'ALUG'],
  ['aluguel', 'ALUG'],
  ['limitada', 'LTDA'],
  ['contas', 'CTA'],
  ['conta', 'CTA'],
  ['numeros', 'N'],
  ['numero', 'N'],
  ['referente a', 'REF'],
  ['referente', 'REF'],
];

const CONECTORES = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'a',
  'o',
  'para',
  'com',
  'em',
  'no',
  'na',
  'nos',
  'nas',
]);

function foldLower(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàãâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòõôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

function ehLetraOuNumero(ch: string | undefined): boolean {
  return !!ch && /[0-9a-z]/i.test(ch);
}

function substituirFrase(texto: string, frase: string, para: string): string {
  const folded = foldLower(texto);
  const alvo = foldLower(frase);
  let out = '';
  let i = 0;
  while (i < texto.length) {
    const idx = folded.indexOf(alvo, i);
    if (idx < 0) {
      out += texto.slice(i);
      break;
    }
    const antes = idx === 0 || !ehLetraOuNumero(folded[idx - 1]);
    const fim = idx + alvo.length;
    const depois = fim >= folded.length || !ehLetraOuNumero(folded[fim]);
    if (!antes || !depois) {
      out += texto.slice(i, idx + 1);
      i = idx + 1;
      continue;
    }
    out += texto.slice(i, idx) + MARCA + para;
    i = fim;
  }
  return out;
}

function aplicarAbreviacoes(texto: string): string {
  let atual = texto;
  for (const [de, para] of ABREVIACOES) {
    atual = substituirFrase(atual, de, para);
  }
  return atual.replace(/\s+/g, ' ').trim();
}

function tirarConectores(texto: string): string {
  return texto
    .split(/\s+/)
    .filter((palavra) => {
      if (palavra.startsWith(MARCA)) return true;
      return !CONECTORES.has(foldLower(palavra));
    })
    .join(' ');
}

function limpar(texto: string): string {
  return texto.replaceAll(MARCA, '').replace(/\s+/g, ' ').trim();
}

function ymdParaBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function cortarNoUltimoEspaco(resto: string, orcamento: number): string {
  let corte = resto.slice(0, orcamento).trimEnd();
  const espaco = corte.lastIndexOf(' ');
  if (espaco > 0) corte = corte.slice(0, espaco);
  return corte.trimEnd();
}

function caber(prefixo: string, resto: string, max: number): string {
  const completo = `${prefixo}${resto}`;
  if (completo.length <= max) return completo;
  const limiteResto = max - prefixo.length;
  const reticencias = '...';
  if (limiteResto <= reticencias.length) return prefixo.slice(0, max);
  const corte = cortarNoUltimoEspaco(resto, limiteResto - reticencias.length);
  return `${prefixo}${corte}${reticencias}`;
}

/**
 * Null quando a descrição já foi marcada.
 * Sem `max`, devolve o texto inteiro (Nomus).
 * Com `max`, abrevia só a descrição antiga até caber (Shop9 = 80).
 */
export function descricaoPrimeiraReprogramacao(
  descricaoAtual: unknown,
  vencimentoAtual: unknown,
  max?: number,
): string | null {
  const atual = descricaoAtual == null ? '' : String(descricaoAtual).trim();
  if (/reprogramado/i.test(atual)) return null;
  const ymd = formatSqlDateYmd(vencimentoAtual);
  if (!ymd) return null;
  const prefixo = `REPROGRAMADO - VENC ORIGINAL ${ymdParaBr(ymd)} - `;
  const semResto = prefixo.slice(0, -3);
  if (!atual) return semResto.length <= (max ?? semResto.length) ? semResto : semResto.slice(0, max);
  if (max == null) return `${prefixo}${atual}`;

  const direto = `${prefixo}${atual}`;
  if (direto.length <= max) return direto;

  const abreviado = aplicarAbreviacoes(atual);
  const comAbrev = limpar(`${prefixo}${abreviado}`);
  if (comAbrev.length <= max) return comAbrev;

  const semConector = limpar(tirarConectores(abreviado));
  const comConector = `${prefixo}${semConector}`;
  if (comConector.length <= max) return comConector;

  return caber(prefixo, semConector, max);
}
