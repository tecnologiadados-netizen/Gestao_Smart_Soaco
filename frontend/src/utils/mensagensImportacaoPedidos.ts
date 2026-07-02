/** Detalhes exibidos no modal quando a importação é bloqueada antes de processar o arquivo. */
export type ImportacaoBloqueioDetalhe = {
  titulo?: string;
  motivo: string;
  itens?: { rotulo: string; valores: string[] };
  acoes: string[];
};

export function bloqueioImportacaoSycro(pds: string[]): ImportacaoBloqueioDetalhe {
  const lista = pds.map((p) => p.trim()).filter(Boolean);
  const plural = lista.length > 1;
  return {
    titulo: 'Upload bloqueado',
    motivo: plural
      ? 'O arquivo inclui pedidos que possuem card ativo na Comunicação Interna (Comunicação PD). Para esses pedidos, a previsão de entrega não pode ser alterada por importação no Gerenciador: o histórico, as notificações e o alinhamento com a equipe são registrados no card.'
      : 'O arquivo inclui um pedido que possui card ativo na Comunicação Interna (Comunicação PD). A previsão de entrega desse pedido não pode ser alterada por importação no Gerenciador: o histórico, as notificações e o alinhamento com a equipe são registrados no card.',
    itens: lista.length > 0 ? { rotulo: plural ? 'Pedidos no arquivo' : 'Pedido no arquivo', valores: lista } : undefined,
    acoes: [
      'Remova do XLSX todas as linhas desses pedidos e importe apenas os demais; ou',
      'Altere a previsão em Pedidos → Comunicação interna → Comunicação PD, abrindo o card de cada pedido listado acima.',
    ],
  };
}

export function bloqueioImportacaoValidacao(partes: string[]): ImportacaoBloqueioDetalhe {
  return {
    titulo: 'Upload bloqueado',
    motivo: 'O arquivo não atende às regras de importação de previsão. Corrija os pontos abaixo e envie o arquivo novamente.',
    itens: partes.length > 0 ? { rotulo: 'Problemas encontrados', valores: partes } : undefined,
    acoes: ['Ajuste o XLSX conforme as mensagens acima e tente importar de novo.'],
  };
}

export function bloqueioImportacaoCarrada(rotas: string[]): ImportacaoBloqueioDetalhe {
  return {
    titulo: 'Upload bloqueado',
    motivo:
      'Na mesma carrada (rota), todos os itens precisam ter a mesma data na coluna Nova previsão. O arquivo traz datas diferentes para a mesma rota.',
    itens: rotas.length > 0 ? { rotulo: 'Carradas com datas divergentes', valores: rotas } : undefined,
    acoes: [
      'Unifique a Nova previsão de todos os itens de cada carrada listada; ou',
      'Separe as linhas em arquivos distintos, um por data, se a intenção for datas diferentes.',
    ],
  };
}

export function bloqueioImportacaoDataAnteriorHoje(linhas: number[]): ImportacaoBloqueioDetalhe {
  const linhasStr = linhas.map(String);
  return {
    titulo: 'Upload bloqueado',
    motivo:
      'Não é permitido importar Nova previsão anterior à data de hoje quando ela é diferente da Previsão atual. Use a Comunicação PD ou o ajuste manual no Gerenciador se precisar registrar uma data passada com motivo.',
    itens: linhasStr.length > 0 ? { rotulo: 'Linhas do Excel', valores: linhasStr } : undefined,
    acoes: ['Informe uma data igual ou posterior a hoje na coluna Nova previsão, ou mantenha a Previsão atual (sem alteração).'],
  };
}

export function bloqueioImportacaoPrevisaoConfiavel(linhas: number[]): ImportacaoBloqueioDetalhe {
  return {
    titulo: 'Upload bloqueado',
    motivo: 'A coluna Previsão Confiável aceita apenas SIM ou NÃO em cada linha preenchida.',
    itens: linhas.length > 0 ? { rotulo: 'Linhas com valor inválido', valores: linhas.map(String) } : undefined,
    acoes: ['Preencha SIM (data confiável, aparece no histórico do card) ou NÃO (data provisória, não aparece no histórico da Comunicação Interna).'],
  };
}
