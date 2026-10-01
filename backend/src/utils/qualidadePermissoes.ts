import { PERMISSOES, type CodigoPermissao } from '../config/permissoes.js';

export const FOLHAS_REGISTROS_QUALIDADE = [
  PERMISSOES.QUALIDADE_REGISTROS_RNC,
  PERMISSOES.QUALIDADE_REGISTROS_RCC,
  PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_FORNECEDOR,
] as const;

export const FOLHAS_CONFIG_QUALIDADE = [
  PERMISSOES.QUALIDADE_CONFIG_SETORES,
  PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS,
  PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO,
  PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES,
  PERMISSOES.QUALIDADE_CONFIG_CAUSAS,
  PERMISSOES.QUALIDADE_CONFIG_SERVICOS,
] as const;

export const PERMISSOES_ACESSO_QUALIDADE: CodigoPermissao[] = [
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_DOCUMENTOS,
  PERMISSOES.QUALIDADE_CALIBRACOES,
  PERMISSOES.QUALIDADE_REGISTROS,
  ...FOLHAS_REGISTROS_QUALIDADE,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  ...FOLHAS_CONFIG_QUALIDADE,
];

const PERMISSAO_POR_REGISTRO: Record<string, CodigoPermissao> = {
  rnc: PERMISSOES.QUALIDADE_REGISTROS_RNC,
  rcc: PERMISSOES.QUALIDADE_REGISTROS_RCC,
  'avaliacao-fornecedor': PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_FORNECEDOR,
};

export function temAcessoQualidade(perms: readonly string[]): boolean {
  return PERMISSOES_ACESSO_QUALIDADE.some((codigo) => perms.includes(codigo));
}

export function temDocumentosQualidade(perms: readonly string[]): boolean {
  return perms.includes(PERMISSOES.QUALIDADE_VER) || perms.includes(PERMISSOES.QUALIDADE_DOCUMENTOS);
}

export function temCalibracoesQualidade(perms: readonly string[]): boolean {
  return perms.includes(PERMISSOES.QUALIDADE_VER) || perms.includes(PERMISSOES.QUALIDADE_CALIBRACOES);
}

export function temRegistroQualidade(perms: readonly string[], tipo: string): boolean {
  const especifico = PERMISSAO_POR_REGISTRO[tipo];
  return (
    perms.includes(PERMISSOES.QUALIDADE_VER) ||
    perms.includes(PERMISSOES.QUALIDADE_REGISTROS) ||
    (especifico != null && perms.includes(especifico))
  );
}

export function temAlgumRegistroQualidade(perms: readonly string[]): boolean {
  return (
    perms.includes(PERMISSOES.QUALIDADE_VER) ||
    perms.includes(PERMISSOES.QUALIDADE_REGISTROS) ||
    FOLHAS_REGISTROS_QUALIDADE.some((codigo) => perms.includes(codigo))
  );
}

export function temConfigQualidade(
  perms: readonly string[],
  opcao: 'setores' | 'categorias' | 'enderecamento' | 'reclamacoes' | 'causas' | 'servicos'
): boolean {
  const mapa = {
    setores: PERMISSOES.QUALIDADE_CONFIG_SETORES,
    categorias: PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS,
    enderecamento: PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO,
    reclamacoes: PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES,
    causas: PERMISSOES.QUALIDADE_CONFIG_CAUSAS,
    servicos: PERMISSOES.QUALIDADE_CONFIG_SERVICOS,
  } as const;
  return (
    perms.includes(PERMISSOES.QUALIDADE_VER) ||
    perms.includes(PERMISSOES.QUALIDADE_CONFIGURACOES) ||
    perms.includes(mapa[opcao])
  );
}

export function temAlgumaConfigQualidade(perms: readonly string[]): boolean {
  return (
    perms.includes(PERMISSOES.QUALIDADE_VER) ||
    perms.includes(PERMISSOES.QUALIDADE_CONFIGURACOES) ||
    FOLHAS_CONFIG_QUALIDADE.some((codigo) => perms.includes(codigo))
  );
}

function temTotalOu(perms: readonly string[], codigo: CodigoPermissao): boolean {
  return perms.includes(PERMISSOES.QUALIDADE_VER) || perms.includes(codigo);
}

export function temInativarDocumentosQualidade(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_DOCUMENTOS_INATIVAR);
}

export function temExcluirDocumentosQualidade(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_DOCUMENTOS_EXCLUIR);
}

export function temInativarCalibracoesQualidade(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_CALIBRACOES_INATIVAR);
}

export function temExcluirCalibracoesQualidade(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_CALIBRACOES_EXCLUIR);
}

export function temExcluirRegistroQualidade(perms: readonly string[], tipo: string): boolean {
  const mapa: Record<string, CodigoPermissao> = {
    rnc: PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR,
    rcc: PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR,
    'avaliacao-fornecedor': PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR,
  };
  const codigo = mapa[tipo];
  return codigo != null && temTotalOu(perms, codigo);
}

export function temAlertaCadastroRcc(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA);
}

export function temImportarRegistrosQualidade(perms: readonly string[]): boolean {
  return temTotalOu(perms, PERMISSOES.QUALIDADE_REGISTROS_IMPORTAR);
}

export function temExcluirConfigQualidade(
  perms: readonly string[],
  opcao: 'setores' | 'categorias' | 'enderecamento' | 'reclamacoes' | 'causas' | 'servicos'
): boolean {
  const mapa = {
    setores: PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR,
    categorias: PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR,
    enderecamento: PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR,
    reclamacoes: PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR,
    causas: PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR,
    servicos: PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR,
  } as const;
  return temTotalOu(perms, mapa[opcao]);
}
