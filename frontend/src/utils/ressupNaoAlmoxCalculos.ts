import type { EstoqueEmProducaoNaoAlmox, RessupNaoAlmoxEstoqueSetor, RessupNaoAlmoxRowUserInputs } from '../api/ressupNaoAlmox';
import { SETOR_ALMOX_SECUNDARIO } from './ressupNaoAlmoxColetas';

export const ESTOQUE_PROCESSO_VAZIO: EstoqueEmProducaoNaoAlmox = {
  chaoFabrica: 0,
  marcenaria: 0,
};

export function somaEstoqueProcesso(
  v?: EstoqueEmProducaoNaoAlmox,
  fundivel = false,
  excluirMarcenaria = false
): number {
  const e = v ?? ESTOQUE_PROCESSO_VAZIO;
  if (fundivel) {
    let total =
      (Number(e.chaoFabrica) || 0) +
      (Number(e.chaoFabricaComPintura) || 0);
    if (!excluirMarcenaria) {
      total += (Number(e.marcenaria) || 0) + (Number(e.marcenariaComPintura) || 0);
    }
    return total;
  }
  let total = Number(e.chaoFabrica) || 0;
  if (!excluirMarcenaria) total += Number(e.marcenaria) || 0;
  return total;
}

export function normalizarEstoqueProcesso(
  v?: EstoqueEmProducaoNaoAlmox
): EstoqueEmProducaoNaoAlmox {
  const base = v ?? ESTOQUE_PROCESSO_VAZIO;
  return {
    chaoFabrica: Number(base.chaoFabrica) || 0,
    marcenaria: Number(base.marcenaria) || 0,
    chaoFabricaComPintura: Number(base.chaoFabricaComPintura) || 0,
    marcenariaComPintura: Number(base.marcenariaComPintura) || 0,
  };
}

export function somaSetoresErp(setores: RessupNaoAlmoxEstoqueSetor[]): number {
  return setores.reduce((s, x) => s + (Number.isFinite(x.saldo) ? x.saldo : 0), 0);
}

/** Saldo do setor 2 (almox secundário), excluindo linha PA. */
export function saldoSetor2FromSetores(setores: RessupNaoAlmoxEstoqueSetor[]): number {
  return setores
    .filter((s) => s.tipo !== 'PA' && s.id_setor === SETOR_ALMOX_SECUNDARIO)
    .reduce((acc, x) => acc + (Number.isFinite(x.saldo) ? x.saldo : 0), 0);
}

/** Soma setores MPP (exclui linha PA / explosão BOM). Opcionalmente exclui setor 2 do card MPP. */
export function saldoMppFromSetores(
  setores: RessupNaoAlmoxEstoqueSetor[],
  excluirSetor2 = false
): number {
  return setores
    .filter(
      (s) =>
        s.tipo !== 'PA' && (!excluirSetor2 || s.id_setor !== SETOR_ALMOX_SECUNDARIO)
    )
    .reduce((acc, x) => acc + (Number.isFinite(x.saldo) ? x.saldo : 0), 0);
}

export function temEstoqueProducaoManual(
  inputs?: RessupNaoAlmoxRowUserInputs,
  fundivel = false,
  excluirMarcenaria = false
): boolean {
  return somaEstoqueProcesso(inputs?.estoqueEmProducao, fundivel, excluirMarcenaria) > 0;
}

export function calcEstoqueTotalNaoAlmox(
  setores: RessupNaoAlmoxEstoqueSetor[],
  setoresPintado: RessupNaoAlmoxEstoqueSetor[],
  processo?: EstoqueEmProducaoNaoAlmox,
  fundivel = false,
  excluirMarcenaria = false
): number {
  return (
    somaSetoresErp(setores) +
    somaSetoresErp(setoresPintado) +
    somaEstoqueProcesso(processo, fundivel, excluirMarcenaria)
  );
}

/** Total aplicado pelo usuário no modal (ERP + produção manual). */
export function estoqueTotalFromInputs(inputs?: RessupNaoAlmoxRowUserInputs): number | null {
  if (inputs?.estoqueTotal != null && Number.isFinite(inputs.estoqueTotal)) {
    return inputs.estoqueTotal;
  }
  return null;
}

/** Valor exibido na grade: total aplicado, ou ERP pré-carregado, ou null (pendente). */
export function estoqueExibicaoGrade(inputs?: RessupNaoAlmoxRowUserInputs): number | null {
  const aplicado = estoqueTotalFromInputs(inputs);
  if (aplicado != null) return aplicado;
  if (inputs?.estoqueTotalErp != null && Number.isFinite(inputs.estoqueTotalErp)) {
    return inputs.estoqueTotalErp;
  }
  return null;
}

export function formatNum(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function parseNumInputBranco(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
