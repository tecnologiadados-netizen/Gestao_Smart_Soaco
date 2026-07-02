import type { EstoqueEmProcesso, QtdeProduzir } from './types';
import { somaQtdeRoteiros } from '../../utils/programacaoProducaoRoteiros';

export const ESTOQUE_PROCESSO_VAZIO: EstoqueEmProcesso = {
  perfiladeira: 0,
  corteDobra: 0,
  solda: 0,
  pintura: 0,
  montagem: 0,
};

export const QTDE_PRODUZIR_VAZIO: QtdeProduzir = {
  roteiros: [],
};

export function somaEstoqueProcesso(e?: EstoqueEmProcesso): number {
  if (!e) return 0;
  return e.perfiladeira + e.corteDobra + e.solda + e.pintura + e.montagem;
}

export function tooltipEstoqueProcesso(e?: EstoqueEmProcesso): string {
  const x = e ?? ESTOQUE_PROCESSO_VAZIO;
  return [
    `Perfiladeira: ${x.perfiladeira}`,
    `Corte e Dobra: ${x.corteDobra}`,
    `Solda: ${x.solda}`,
    `Pintura: ${x.pintura}`,
    `Montagem: ${x.montagem}`,
  ].join('\n');
}

export function somaQtdeProduzir(q?: QtdeProduzir): number {
  return somaQtdeRoteiros(q);
}

/** Campo numérico em branco na grade = zero. */
export function parseNumInputBranco(v: string): number {
  const t = v.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Exibe vazio quando zero ou nulo (edição com campo em branco). */
export function numInputDisplayBranco(n: number | null | undefined): string {
  if (n == null || n === 0) return '';
  return String(n);
}

export function tooltipQtdeProduzir(
  q?: QtdeProduzir,
  formatRoteiro?: (r: import('./types').RoteiroProducao) => string
): string {
  const x = q ?? QTDE_PRODUZIR_VAZIO;
  if (!x.roteiros.length) return '—';
  if (formatRoteiro) return x.roteiros.map(formatRoteiro).join('\n');
  return x.roteiros.map((r) => `${r.sequencia.join('→')}: ${r.qtde}`).join('\n');
}

export function formatNum(v: number | null | undefined, dec = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  });
}

/** Qtde MP = soma(Qtde produzir) × peso unitário. */
export function calcQtdeMpKg(linha: {
  qtde_produzir?: QtdeProduzir;
  peso_unitario_bobina?: number | null;
}): number {
  const q = somaQtdeProduzir(linha.qtde_produzir);
  const p = linha.peso_unitario_bobina;
  if (!q || p == null || Number.isNaN(p)) return 0;
  return q * p;
}

/** Estoque em PA (Nomus) + estoque em produção (usuário). */
export function somaEstoqueTotal(linha: {
  estoque_atual_componente: number;
  estoque_em_processo?: EstoqueEmProcesso;
}): number {
  return linha.estoque_atual_componente + somaEstoqueProcesso(linha.estoque_em_processo);
}

export function tooltipEstoqueTotal(linha: {
  estoque_atual_componente: number;
  estoque_em_processo?: EstoqueEmProcesso;
}): string {
  const pa = linha.estoque_atual_componente;
  const proc = somaEstoqueProcesso(linha.estoque_em_processo);
  return `Estoque em PA (Nomus): ${pa}\nEstoque em produção: ${proc}\nTotal: ${pa + proc}`;
}
