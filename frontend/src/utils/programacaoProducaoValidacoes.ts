import { formatNum } from '../components/programacao-producao/programacaoProducaoCalculos';
import type { LinhaProgramacaoProducao, ProgramacaoProducaoRecurso } from '../components/programacao-producao/types';
import {
  ordensProducaoNomusDaLinha,
  somaSaldoOpsSelecionadas,
} from './programacaoProducaoOpsNomus';
import { linhaTemQtdeProduzir, somaQtdePerfiladeiraRoteiros } from './programacaoProducaoRoteiros';
import { getCatalogoRecursosRuntime } from './programacaoProducaoCatalogoRuntime';

export function linhaTemSequenciaDefinida(linha: LinhaProgramacaoProducao): boolean {
  const n = linha.sequencia;
  return n != null && n > 0;
}

export function linhaTemQtdeProduzirDefinida(linha: LinhaProgramacaoProducao): boolean {
  return linhaTemQtdeProduzir(linha.qtde_produzir);
}

/** Sequência sem qtde ou qtde sem sequência. */
export function linhaInconsistenteSeqQtde(linha: LinhaProgramacaoProducao): boolean {
  const s = linhaTemSequenciaDefinida(linha);
  const q = linhaTemQtdeProduzirDefinida(linha);
  return (s && !q) || (!s && q);
}

export function linhasComInconsistenciaSeqQtde(
  linhas: LinhaProgramacaoProducao[]
): LinhaProgramacaoProducao[] {
  return linhas.filter(linhaInconsistenteSeqQtde);
}

export function mensagemInconsistenciaLinha(linha: LinhaProgramacaoProducao): string {
  const cod = linha.cod_componente;
  if (linhaTemSequenciaDefinida(linha) && !linhaTemQtdeProduzirDefinida(linha)) {
    return `${cod}: sequência informada sem qtde a produzir.`;
  }
  return `${cod}: qtde a produzir informada sem sequência.`;
}

export function textoOrdenacaoPdf(linha: LinhaProgramacaoProducao): string {
  return (
    linha.descricao_simplificada?.trim() ||
    linha.descricao_componente?.trim() ||
    linha.cod_componente ||
    ''
  );
}

/** PDF: só linhas com sequência; menor → maior; depois ordem alfabética (desc simpl). */
export function ordenarLinhasParaPdf(linhas: LinhaProgramacaoProducao[]): LinhaProgramacaoProducao[] {
  return linhas
    .filter(linhaTemSequenciaDefinida)
    .sort((a, b) => {
      const sa = a.sequencia ?? 0;
      const sb = b.sequencia ?? 0;
      if (sa !== sb) return sa - sb;
      return textoOrdenacaoPdf(a).localeCompare(textoOrdenacaoPdf(b), 'pt-BR', {
        sensitivity: 'base',
      });
    });
}

/** Conclusão: roteiros com recurso Perfiladeira exigem soma dos saldos das OPs ≥ qtde nesses roteiros. */
export function validarConclusaoPerfiladeiraOps(
  linhas: LinhaProgramacaoProducao[],
  recursos?: ProgramacaoProducaoRecurso[]
): string | null {
  const lista = recursos ?? getCatalogoRecursosRuntime() ?? [];
  for (const l of linhas) {
    const perf = somaQtdePerfiladeiraRoteiros(l.qtde_produzir, lista);
    if (perf <= 0) continue;
    const soma = somaSaldoOpsSelecionadas(ordensProducaoNomusDaLinha(l));
    if (soma + 1e-9 < perf) {
      return `${l.cod_componente}: qtde perfiladeira (${formatNum(perf)}) exige OP Nomus com saldo somado ≥ ${formatNum(perf)} (atual: ${formatNum(soma)}).`;
    }
  }
  return null;
}
