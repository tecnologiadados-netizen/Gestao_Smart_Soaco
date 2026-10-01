import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';
import type { NavMenuEntry } from '../config/navigationMenu';
import type { ModuloRegistroTipo } from '@qualidade/lib/registros/constants';

type Pode = (codigo: CodigoPermissao) => boolean;

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

export const FOLHAS_QUALIDADE = [
  PERMISSOES.QUALIDADE_DOCUMENTOS,
  PERMISSOES.QUALIDADE_CALIBRACOES,
  ...FOLHAS_REGISTROS_QUALIDADE,
  ...FOLHAS_CONFIG_QUALIDADE,
] as const;

export const ACOES_QUALIDADE = [
  PERMISSOES.QUALIDADE_DOCUMENTOS_INATIVAR,
  PERMISSOES.QUALIDADE_DOCUMENTOS_EXCLUIR,
  PERMISSOES.QUALIDADE_CALIBRACOES_INATIVAR,
  PERMISSOES.QUALIDADE_CALIBRACOES_EXCLUIR,
  PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR,
  PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR,
  PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR,
  PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA,
  PERMISSOES.QUALIDADE_REGISTROS_IMPORTAR,
  PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR,
  PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR,
  PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR,
  PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR,
  PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR,
  PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR,
] as const;

const ACOES_POR_ALVO: Partial<Record<AlvoPermissaoQualidade, readonly CodigoPermissao[]>> = {
  documentos: [PERMISSOES.QUALIDADE_DOCUMENTOS_INATIVAR, PERMISSOES.QUALIDADE_DOCUMENTOS_EXCLUIR],
  calibracoes: [PERMISSOES.QUALIDADE_CALIBRACOES_INATIVAR, PERMISSOES.QUALIDADE_CALIBRACOES_EXCLUIR],
  rnc: [PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR],
  rcc: [PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR, PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA],
  'avaliacao-fornecedor': [PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR],
  setores: [PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR],
  categorias: [PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR],
  enderecamento: [PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR],
  reclamacoes: [PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR],
  causas: [PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR],
  servicos: [PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR],
};

export const PERMISSOES_ACESSO_QUALIDADE: CodigoPermissao[] = [
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_DOCUMENTOS,
  PERMISSOES.QUALIDADE_CALIBRACOES,
  PERMISSOES.QUALIDADE_REGISTROS,
  ...FOLHAS_REGISTROS_QUALIDADE,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  ...FOLHAS_CONFIG_QUALIDADE,
];

const PERMISSAO_POR_REGISTRO: Record<ModuloRegistroTipo, CodigoPermissao> = {
  rnc: PERMISSOES.QUALIDADE_REGISTROS_RNC,
  rcc: PERMISSOES.QUALIDADE_REGISTROS_RCC,
  'avaliacao-fornecedor': PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_FORNECEDOR,
};

export type OpcaoConfigQualidade =
  | 'setores'
  | 'categorias'
  | 'enderecamento'
  | 'reclamacoes'
  | 'causas'
  | 'servicos';

const PERMISSAO_POR_CONFIG: Record<OpcaoConfigQualidade, CodigoPermissao> = {
  setores: PERMISSOES.QUALIDADE_CONFIG_SETORES,
  categorias: PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS,
  enderecamento: PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO,
  reclamacoes: PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES,
  causas: PERMISSOES.QUALIDADE_CONFIG_CAUSAS,
  servicos: PERMISSOES.QUALIDADE_CONFIG_SERVICOS,
};

function isOpcaoConfigQualidade(alvo: string): alvo is OpcaoConfigQualidade {
  return alvo in PERMISSAO_POR_CONFIG;
}

export function temAcessoQualidade(pode: Pode): boolean {
  return PERMISSOES_ACESSO_QUALIDADE.some((codigo) => pode(codigo));
}

export function temDocumentosQualidade(pode: Pode): boolean {
  return pode(PERMISSOES.QUALIDADE_VER) || pode(PERMISSOES.QUALIDADE_DOCUMENTOS);
}

export function temCalibracoesQualidade(pode: Pode): boolean {
  return pode(PERMISSOES.QUALIDADE_VER) || pode(PERMISSOES.QUALIDADE_CALIBRACOES);
}

export function temRegistroQualidade(pode: Pode, tipo: ModuloRegistroTipo): boolean {
  return (
    pode(PERMISSOES.QUALIDADE_VER) ||
    pode(PERMISSOES.QUALIDADE_REGISTROS) ||
    pode(PERMISSAO_POR_REGISTRO[tipo])
  );
}

export function temAlgumRegistroQualidade(pode: Pode): boolean {
  return (
    pode(PERMISSOES.QUALIDADE_VER) ||
    pode(PERMISSOES.QUALIDADE_REGISTROS) ||
    FOLHAS_REGISTROS_QUALIDADE.some((codigo) => pode(codigo))
  );
}

export function tiposRegistroPermitidos(pode: Pode): ModuloRegistroTipo[] {
  return (Object.keys(PERMISSAO_POR_REGISTRO) as ModuloRegistroTipo[]).filter((tipo) =>
    temRegistroQualidade(pode, tipo)
  );
}

export function temConfigQualidade(pode: Pode, opcao: OpcaoConfigQualidade): boolean {
  return (
    pode(PERMISSOES.QUALIDADE_VER) ||
    pode(PERMISSOES.QUALIDADE_CONFIGURACOES) ||
    pode(PERMISSAO_POR_CONFIG[opcao])
  );
}

export function temAlgumaConfigQualidade(pode: Pode): boolean {
  return (
    pode(PERMISSOES.QUALIDADE_VER) ||
    pode(PERMISSOES.QUALIDADE_CONFIGURACOES) ||
    FOLHAS_CONFIG_QUALIDADE.some((codigo) => pode(codigo))
  );
}

function temTotalOu(pode: Pode, codigo: CodigoPermissao): boolean {
  return pode(PERMISSOES.QUALIDADE_VER) || pode(codigo);
}

export function temInativarDocumentosQualidade(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_DOCUMENTOS_INATIVAR);
}

export function temExcluirDocumentosQualidade(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_DOCUMENTOS_EXCLUIR);
}

export function temInativarCalibracoesQualidade(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_CALIBRACOES_INATIVAR);
}

export function temExcluirCalibracoesQualidade(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_CALIBRACOES_EXCLUIR);
}

export function temExcluirRegistroQualidade(pode: Pode, tipo: ModuloRegistroTipo): boolean {
  const mapa: Record<ModuloRegistroTipo, CodigoPermissao> = {
    rnc: PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR,
    rcc: PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR,
    'avaliacao-fornecedor': PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR,
  };
  return temTotalOu(pode, mapa[tipo]);
}

export function temAlertaCadastroRcc(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA);
}

export function temImportarRegistrosQualidade(pode: Pode): boolean {
  return temTotalOu(pode, PERMISSOES.QUALIDADE_REGISTROS_IMPORTAR);
}

export function temExcluirConfigQualidade(pode: Pode, opcao: OpcaoConfigQualidade): boolean {
  const mapa: Record<OpcaoConfigQualidade, CodigoPermissao> = {
    setores: PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR,
    categorias: PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR,
    enderecamento: PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR,
    reclamacoes: PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR,
    causas: PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR,
    servicos: PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR,
  };
  return temTotalOu(pode, mapa[opcao]);
}

export function buildQualidadeMenuForUser(pode: Pode): NavMenuEntry[] {
  const children: NavMenuEntry[] = [];
  if (temDocumentosQualidade(pode)) {
    children.push({ kind: 'link', to: '/qualidade/documentos', label: 'Documentos' });
  }
  if (temCalibracoesQualidade(pode)) {
    children.push({ kind: 'link', to: '/qualidade/calibracoes', label: 'Calibrações' });
  }
  if (temAlgumRegistroQualidade(pode)) {
    children.push({ kind: 'link', to: '/qualidade/registros', label: 'Registros' });
  }
  if (temAlgumaConfigQualidade(pode)) {
    children.push({ kind: 'link', to: '/qualidade/configuracoes', label: 'Configurações' });
  }
  if (children.length === 0) return [];
  return [{ kind: 'submenu', label: 'SGQ', children }];
}

export type AlvoPermissaoQualidade =
  | 'total'
  | 'documentos'
  | 'documentos-inativar'
  | 'documentos-excluir'
  | 'calibracoes'
  | 'calibracoes-inativar'
  | 'calibracoes-excluir'
  | 'registros'
  | 'registros-importar'
  | 'configuracoes'
  | ModuloRegistroTipo
  | 'rnc-excluir'
  | 'rcc-excluir'
  | 'rcc-alerta'
  | 'avaliacao-excluir'
  | OpcaoConfigQualidade
  | 'setores-excluir'
  | 'categorias-excluir'
  | 'enderecamento-excluir'
  | 'reclamacoes-excluir'
  | 'causas-excluir'
  | 'servicos-excluir';

function inclui(perms: readonly string[], codigo: string): boolean {
  return perms.includes(codigo);
}

function explicito(perms: readonly string[]): string[] {
  const total = inclui(perms, PERMISSOES.QUALIDADE_VER);
  const registros = total || inclui(perms, PERMISSOES.QUALIDADE_REGISTROS);
  const config = total || inclui(perms, PERMISSOES.QUALIDADE_CONFIGURACOES);
  const base = perms.filter((p) => !p.startsWith('qualidade.'));
  const folhas: string[] = [];
  if (total || inclui(perms, PERMISSOES.QUALIDADE_DOCUMENTOS)) folhas.push(PERMISSOES.QUALIDADE_DOCUMENTOS);
  if (total || inclui(perms, PERMISSOES.QUALIDADE_CALIBRACOES)) folhas.push(PERMISSOES.QUALIDADE_CALIBRACOES);
  for (const codigo of FOLHAS_REGISTROS_QUALIDADE) {
    if (registros || inclui(perms, codigo)) folhas.push(codigo);
  }
  for (const codigo of FOLHAS_CONFIG_QUALIDADE) {
    if (config || inclui(perms, codigo)) folhas.push(codigo);
  }
  for (const codigo of ACOES_QUALIDADE) {
    if (total || inclui(perms, codigo)) folhas.push(codigo);
  }
  return [...new Set([...base, ...folhas])];
}

function compactar(perms: string[]): string[] {
  const set = new Set(perms);
  const todosRegistros = FOLHAS_REGISTROS_QUALIDADE.every((c) => set.has(c));
  const todasConfig = FOLHAS_CONFIG_QUALIDADE.every((c) => set.has(c));
  const todasAcoes = ACOES_QUALIDADE.every((c) => set.has(c));
  if (todosRegistros) set.add(PERMISSOES.QUALIDADE_REGISTROS);
  else set.delete(PERMISSOES.QUALIDADE_REGISTROS);
  if (todasConfig) set.add(PERMISSOES.QUALIDADE_CONFIGURACOES);
  else set.delete(PERMISSOES.QUALIDADE_CONFIGURACOES);
  const tudo =
    set.has(PERMISSOES.QUALIDADE_DOCUMENTOS) &&
    set.has(PERMISSOES.QUALIDADE_CALIBRACOES) &&
    todosRegistros &&
    todasConfig &&
    todasAcoes;
  if (tudo) set.add(PERMISSOES.QUALIDADE_VER);
  else set.delete(PERMISSOES.QUALIDADE_VER);
  return [...set];
}

function semQualidade(perms: readonly string[]): string[] {
  return perms.filter((p) => !p.startsWith('qualidade.'));
}

const ACAO_PARA_CODIGO: Partial<Record<AlvoPermissaoQualidade, CodigoPermissao>> = {
  'documentos-inativar': PERMISSOES.QUALIDADE_DOCUMENTOS_INATIVAR,
  'documentos-excluir': PERMISSOES.QUALIDADE_DOCUMENTOS_EXCLUIR,
  'calibracoes-inativar': PERMISSOES.QUALIDADE_CALIBRACOES_INATIVAR,
  'calibracoes-excluir': PERMISSOES.QUALIDADE_CALIBRACOES_EXCLUIR,
  'rnc-excluir': PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR,
  'rcc-excluir': PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR,
  'avaliacao-excluir': PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR,
  'rcc-alerta': PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA,
  'registros-importar': PERMISSOES.QUALIDADE_REGISTROS_IMPORTAR,
  'setores-excluir': PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR,
  'categorias-excluir': PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR,
  'enderecamento-excluir': PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR,
  'reclamacoes-excluir': PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR,
  'causas-excluir': PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR,
  'servicos-excluir': PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR,
};

const PAI_DA_ACAO: Partial<Record<AlvoPermissaoQualidade, AlvoPermissaoQualidade>> = {
  'documentos-inativar': 'documentos',
  'documentos-excluir': 'documentos',
  'calibracoes-inativar': 'calibracoes',
  'calibracoes-excluir': 'calibracoes',
  'rnc-excluir': 'rnc',
  'rcc-excluir': 'rcc',
  'rcc-alerta': 'rcc',
  'avaliacao-excluir': 'avaliacao-fornecedor',
  'registros-importar': 'registros',
  'setores-excluir': 'setores',
  'categorias-excluir': 'categorias',
  'enderecamento-excluir': 'enderecamento',
  'reclamacoes-excluir': 'reclamacoes',
  'causas-excluir': 'causas',
  'servicos-excluir': 'servicos',
};

export function permissaoQualidadeMarcada(perms: readonly string[], alvo: AlvoPermissaoQualidade): boolean {
  const total = inclui(perms, PERMISSOES.QUALIDADE_VER);
  const acao = ACAO_PARA_CODIGO[alvo];
  if (acao) return total || inclui(perms, acao);
  if (alvo === 'total') {
    return (
      total ||
      (FOLHAS_QUALIDADE.every((c) => inclui(perms, c)) && ACOES_QUALIDADE.every((c) => inclui(perms, c)))
    );
  }
  if (alvo === 'documentos') return total || inclui(perms, PERMISSOES.QUALIDADE_DOCUMENTOS);
  if (alvo === 'calibracoes') return total || inclui(perms, PERMISSOES.QUALIDADE_CALIBRACOES);
  if (alvo === 'registros') {
    return (
      total ||
      inclui(perms, PERMISSOES.QUALIDADE_REGISTROS) ||
      FOLHAS_REGISTROS_QUALIDADE.every((c) => inclui(perms, c))
    );
  }
  if (alvo === 'configuracoes') {
    return (
      total ||
      inclui(perms, PERMISSOES.QUALIDADE_CONFIGURACOES) ||
      FOLHAS_CONFIG_QUALIDADE.every((c) => inclui(perms, c))
    );
  }
  if (alvo === 'rnc' || alvo === 'rcc' || alvo === 'avaliacao-fornecedor') {
    return temRegistroQualidade((c) => inclui(perms, c), alvo);
  }
  if (isOpcaoConfigQualidade(alvo)) {
    return temConfigQualidade((c) => inclui(perms, c), alvo);
  }
  return false;
}

function acoesDoAlvo(alvo: AlvoPermissaoQualidade): CodigoPermissao[] {
  if (alvo === 'registros') {
    return [
      PERMISSOES.QUALIDADE_REGISTROS_RNC_EXCLUIR,
      PERMISSOES.QUALIDADE_REGISTROS_RCC_EXCLUIR,
      PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_EXCLUIR,
      PERMISSOES.QUALIDADE_REGISTROS_RCC_ALERTA,
      PERMISSOES.QUALIDADE_REGISTROS_IMPORTAR,
    ];
  }
  if (alvo === 'configuracoes') {
    return [
      PERMISSOES.QUALIDADE_CONFIG_SETORES_EXCLUIR,
      PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS_EXCLUIR,
      PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO_EXCLUIR,
      PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES_EXCLUIR,
      PERMISSOES.QUALIDADE_CONFIG_CAUSAS_EXCLUIR,
      PERMISSOES.QUALIDADE_CONFIG_SERVICOS_EXCLUIR,
    ];
  }
  return [...(ACOES_POR_ALVO[alvo] ?? [])];
}

export function alternarPermissaoQualidade(perms: readonly string[], alvo: AlvoPermissaoQualidade): string[] {
  if (alvo === 'total') {
    if (permissaoQualidadeMarcada(perms, 'total')) return semQualidade(perms);
    return compactar([
      ...semQualidade(perms),
      PERMISSOES.QUALIDADE_VER,
      PERMISSOES.QUALIDADE_DOCUMENTOS,
      PERMISSOES.QUALIDADE_CALIBRACOES,
      PERMISSOES.QUALIDADE_REGISTROS,
      ...FOLHAS_REGISTROS_QUALIDADE,
      PERMISSOES.QUALIDADE_CONFIGURACOES,
      ...FOLHAS_CONFIG_QUALIDADE,
      ...ACOES_QUALIDADE,
    ]);
  }

  const atual = explicito(perms);
  const set = new Set(atual);
  const ligar = !permissaoQualidadeMarcada(perms, alvo);
  const acao = ACAO_PARA_CODIGO[alvo];

  const folhasDoAlvo = (): CodigoPermissao[] => {
    if (acao) return [acao];
    if (alvo === 'documentos') return [PERMISSOES.QUALIDADE_DOCUMENTOS];
    if (alvo === 'calibracoes') return [PERMISSOES.QUALIDADE_CALIBRACOES];
    if (alvo === 'registros') return [...FOLHAS_REGISTROS_QUALIDADE];
    if (alvo === 'configuracoes') return [...FOLHAS_CONFIG_QUALIDADE];
    if (alvo === 'rnc' || alvo === 'rcc' || alvo === 'avaliacao-fornecedor') {
      return [PERMISSAO_POR_REGISTRO[alvo]];
    }
    if (isOpcaoConfigQualidade(alvo)) return [PERMISSAO_POR_CONFIG[alvo]];
    return [];
  };

  for (const codigo of folhasDoAlvo()) {
    if (ligar) set.add(codigo);
    else set.delete(codigo);
  }
  if (ligar && acao) {
    const pai = PAI_DA_ACAO[alvo];
    if (pai === 'documentos') set.add(PERMISSOES.QUALIDADE_DOCUMENTOS);
    else if (pai === 'calibracoes') set.add(PERMISSOES.QUALIDADE_CALIBRACOES);
    else if (pai === 'registros') {
      for (const codigo of FOLHAS_REGISTROS_QUALIDADE) set.add(codigo);
    } else if (pai === 'rnc' || pai === 'rcc' || pai === 'avaliacao-fornecedor') {
      set.add(PERMISSAO_POR_REGISTRO[pai]);
    } else if (pai && pai in PERMISSAO_POR_CONFIG) {
      set.add(PERMISSAO_POR_CONFIG[pai as OpcaoConfigQualidade]);
    }
  }
  if (!ligar && !acao) {
    for (const codigo of acoesDoAlvo(alvo)) set.delete(codigo);
  }
  return compactar([...set]);
}

export function rotaInicialQualidade(pode: Pode): string | null {
  if (temDocumentosQualidade(pode)) return '/qualidade/documentos';
  if (temCalibracoesQualidade(pode)) return '/qualidade/calibracoes';
  if (temAlgumRegistroQualidade(pode)) return '/qualidade/registros';
  if (temAlgumaConfigQualidade(pode)) return '/qualidade/configuracoes';
  return null;
}
