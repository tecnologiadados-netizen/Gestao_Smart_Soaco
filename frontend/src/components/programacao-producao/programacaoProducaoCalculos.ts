import type { EstoqueEmProcesso, LinhaProgramacaoProducao, QtdeProduzir } from './types';
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

/** Base de estoque dos derivados: 2 = Estoque Total (PA + produção). */
export const CALC_ESTOQUE_V = 2;

function usaEstoqueTotal(linha: { calc_estoque_v?: number }): boolean {
  return (linha.calc_estoque_v ?? 1) >= 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Saldo projetado = Estoque Total − Empenho (programações novas). */
export function calcSaldoProjetado(linha: LinhaProgramacaoProducao): number | null {
  if (!usaEstoqueTotal(linha)) return linha.saldo_projetado;
  return round2(somaEstoqueTotal(linha) - linha.empenho_componente);
}

/** Qtde MP Faltante = déficit de componente × peso unitário da bobina. */
export function calcKgBobinaNecessario(linha: LinhaProgramacaoProducao): number | null {
  if (!usaEstoqueTotal(linha)) return linha.kg_bobina_necessario;
  const peso = linha.peso_unitario_bobina;
  if (peso == null || Number.isNaN(peso)) return null;
  const deficit = Math.max(linha.empenho_componente - somaEstoqueTotal(linha), 0);
  return round2(deficit * peso);
}

/** Cobertura em meses = saldo projetado ÷ venda média. */
export function calcCoberturaMeses(linha: LinhaProgramacaoProducao): number | null {
  if (!usaEstoqueTotal(linha)) return linha.cobertura_meses;
  const vm = linha.venda_media_componente;
  if (!vm) return null;
  const saldo = calcSaldoProjetado(linha);
  if (saldo == null) return null;
  return round2(saldo / vm);
}

export function tooltipEstoqueTotal(linha: {
  estoque_atual_componente: number;
  estoque_em_processo?: EstoqueEmProcesso;
}): string {
  const pa = linha.estoque_atual_componente;
  const proc = somaEstoqueProcesso(linha.estoque_em_processo);
  return `Estoque em PA (Nomus): ${pa}\nEstoque em produção: ${proc}\nTotal: ${pa + proc}`;
}
