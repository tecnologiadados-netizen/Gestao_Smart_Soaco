import type { DreEstruturaNo } from './ArvoreContasDre';

export type DreReceitaDetalheEscopo =
  | 'grupo_direto'
  | 'grupo_indireto'
  | 'faturamento_direto'
  | 'faturamento_direto_moveis'
  | 'faturamento_indireto_bruto'
  | 'faturamento_indireto_liquido'
  | 'so_aco'
  | 'receita_vendas'
  | 'receita_bruta';

export type DreReceitaDetalheContexto = {
  escopo: DreReceitaDetalheEscopo;
  grupoProduto?: string;
};

/** Linhas da DRE alimentadas pelo SQL Nomus (receita de vendas / Só Aço). */
export function contextoDetalheReceitaVendas(node: DreEstruturaNo): DreReceitaDetalheContexto | null {
  if (node.tipo === 'T' || !node.codigo.startsWith('1.')) return null;

  const partes = node.codigo.split('.');
  const ultimo = Number(partes[partes.length - 1]);

  if (node.tipo === 'A' && partes[0] === '1' && partes[1] === '1' && ultimo >= 3) {
    return { escopo: 'grupo_direto', grupoProduto: node.nome };
  }
  if (node.tipo === 'A' && partes[0] === '1' && partes[1] === '3') {
    return { escopo: 'grupo_indireto', grupoProduto: node.nome };
  }
  if (node.codigo === '1.1.2') return { escopo: 'faturamento_direto' };
  if (node.codigo === '1.2') return { escopo: 'faturamento_indireto_bruto' };
  if (node.codigo === '1.3') return { escopo: 'faturamento_indireto_liquido' };
  if (node.codigo === '1.1.1') return { escopo: 'so_aco' };
  if (node.codigo === '1.4.1') return { escopo: 'faturamento_direto_moveis' };
  if (node.codigo === '1.4.2') return { escopo: 'faturamento_indireto_liquido' };
  if (node.codigo === '1.4') return { escopo: 'receita_vendas' };
  if (node.codigo === '1.1') return { escopo: 'receita_vendas' };
  if (node.codigo === '1') return { escopo: 'receita_bruta' };
  return null;
}

export function periodoReceitaParaIntervalo(
  periodo: string | undefined,
  granularidade: 'dia' | 'mes',
  dataInicio: string,
  dataFim: string,
): { dataInicio: string; dataFim: string } {
  if (!periodo) return { dataInicio, dataFim };
  if (granularidade === 'mes') {
    const m = /^(\d{4})-(\d{2})$/.exec(periodo);
    if (!m) return { dataInicio, dataFim };
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const ultimoDia = new Date(y, mo, 0).getDate();
    return {
      dataInicio: `${periodo}-01`,
      dataFim: `${periodo}-${String(ultimoDia).padStart(2, '0')}`,
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
    return { dataInicio: periodo, dataFim: periodo };
  }
  return { dataInicio, dataFim };
}
