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
  | 'calibracoes'
  | 'registros'
  | 'configuracoes'
  | ModuloRegistroTipo
  | OpcaoConfigQualidade;

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
  return [...new Set([...base, ...folhas])];
}

function compactar(perms: string[]): string[] {
  const set = new Set(perms);
  const todosRegistros = FOLHAS_REGISTROS_QUALIDADE.every((c) => set.has(c));
  const todasConfig = FOLHAS_CONFIG_QUALIDADE.every((c) => set.has(c));
  if (todosRegistros) set.add(PERMISSOES.QUALIDADE_REGISTROS);
  else set.delete(PERMISSOES.QUALIDADE_REGISTROS);
  if (todasConfig) set.add(PERMISSOES.QUALIDADE_CONFIGURACOES);
  else set.delete(PERMISSOES.QUALIDADE_CONFIGURACOES);
  const tudo =
    set.has(PERMISSOES.QUALIDADE_DOCUMENTOS) &&
    set.has(PERMISSOES.QUALIDADE_CALIBRACOES) &&
    todosRegistros &&
    todasConfig;
  if (tudo) set.add(PERMISSOES.QUALIDADE_VER);
  else set.delete(PERMISSOES.QUALIDADE_VER);
  return [...set];
}

function semQualidade(perms: readonly string[]): string[] {
  return perms.filter((p) => !p.startsWith('qualidade.'));
}

export function permissaoQualidadeMarcada(perms: readonly string[], alvo: AlvoPermissaoQualidade): boolean {
  const total = inclui(perms, PERMISSOES.QUALIDADE_VER);
  if (alvo === 'total') {
    return total || FOLHAS_QUALIDADE.every((c) => inclui(perms, c));
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
  return temConfigQualidade((c) => inclui(perms, c), alvo);
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
    ]);
  }

  const atual = explicito(perms);
  const set = new Set(atual);
  const ligar = !permissaoQualidadeMarcada(perms, alvo);

  const folhasDoAlvo = (): CodigoPermissao[] => {
    if (alvo === 'documentos') return [PERMISSOES.QUALIDADE_DOCUMENTOS];
    if (alvo === 'calibracoes') return [PERMISSOES.QUALIDADE_CALIBRACOES];
    if (alvo === 'registros') return [...FOLHAS_REGISTROS_QUALIDADE];
    if (alvo === 'configuracoes') return [...FOLHAS_CONFIG_QUALIDADE];
    if (alvo === 'rnc' || alvo === 'rcc' || alvo === 'avaliacao-fornecedor') {
      return [PERMISSAO_POR_REGISTRO[alvo]];
    }
    return [PERMISSAO_POR_CONFIG[alvo]];
  };

  for (const codigo of folhasDoAlvo()) {
    if (ligar) set.add(codigo);
    else set.delete(codigo);
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
