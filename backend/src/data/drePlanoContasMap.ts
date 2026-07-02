/**
 * Mapeia nome/id do plano financeiro Nomus (contafinanceiro) → pathKey da árvore DRE.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  lerDreRelacaoPcOverrides,
  mapaShop9OrdemParaPathKeyManual,
  type DreRelacaoPcOverrides,
} from './dreRelacaoPcOverrides.js';

type DreNo = {
  pathKey: string;
  nome: string;
  tipo: string;
  codigo: string;
  children?: DreNo[];
};

type PlanoAtivo = { id: number; nome: string; classificacao?: string };

export type DreContaSaida = {
  pathKey: string;
  codigo: string;
  nome: string;
  tipo: 'A' | 'S';
};

/** Raízes de seção da DRE que recebem saídas SOACO (filhas analíticas). */
const CODIGOS_BASE_SAIDAS = ['4', '6', '8', '10', '11', '13', '14', '15', '17', '19.1'];

/** Filhas preenchidas só por rateio (sem lançamento direto). */
const CODIGOS_DRE_SOMENTE_MODELO = new Set(['13.1.12.1', '13.1.12.2', '13.1.12.3', '13.1.12.4']);

/** Sintéticas que agregam saídas Nomus/Shop9 no pai (rateio no frontend). */
const CODIGOS_DRE_AGREGACAO_SAIDAS = new Set(['13.1.12']);

const ALIASES_NOMUS_PARA_DRE: Record<string, string> = {
  'energia eletrica': 'Energia elétrica',
  'salarios - operacional': 'Salários operacional',
  'salarios operacional': 'Salários operacional',
  'alimentacao hora extra': 'Alimentação (Vale refeição)',
  'bonificacao - operacional': 'Bonificação Operacional',
  'horas extras': 'Horas Extras - Operacional',
  'horas extras - operacional': 'Horas Extras - Operacional',
  'horas extras - administrativo': 'Horas Extras - Administrativo',
  'alugueis de equipamentos producao': 'Aluguel de Equipamentos Produção',
  'servicos terceirizados de producao': 'Serviços Terceirizados de Produção',
  'analises e inspecoes tecnicas': 'Análises e Inspeções Próximas',
  'epi': 'EPIs',
  'epis': 'EPIs',
  'fretes e carretos': 'Fretes e carretos',
  'fretes - mercadorias': 'Fretes - Intercompany',
  'servicos de manutencao industrial': 'Manutenção Industrial',
  'materiais de manutencao industrial': 'Manutenção Industrial',
  'materiais manutencao mecanica': 'Assessoria Manutenção Mecânica',
  'servicos manutencao mecanica': 'Serviços Manutenção Mecânica',
  'materiais manutencao eletrico': 'Assessoria Manutenção Elétrica',
  'materiais manutencao hidraulico': 'Materiais Manutenção Hidráulica',
  'pecas e ferramentas': 'Peças, Ferramentas, Pneus',
  'calibracao de instrumentos': 'Calibração de Instrumentos',
  'salarios logistica': 'Salários Logística',
  'salarios - logistica': 'Salários Logística',
  '13o salario - logistica': '13º Salário - Logística',
  'ferias - logistica': 'Provisão Férias',
  'despesas de viagens op': 'Despesas de Viagens OP',
  'despesas de viagem op': 'Despesas de Viagens OP',
  'ipva e licenciamentos': 'IPVA e Licenciamento',
  'combustiveis e lubrificantes': 'Combustíveis e Lubrificantes',
  'multas de transito': 'Multas de Trânsito',
  'servicos de manutencao de veiculos': 'Serviços manutenção de veículos',
  'materiais de manutencao de veiculos': 'Materiais de manut. de veículos',
  'pro-labore': 'Pró-labore',
  'pro labore': 'Pró-labore',
  'pro-labore so aco': 'Pró-labore',
  'pro labore so aco': 'Pró-labore',
  'pro-labore so metais': 'Pró-labore',
  'pro-labore so moveis': 'Pró-labore',
  'pro-labore so perfil': 'Pró-labore',
  'pro-labore so refrigeracao': 'Pró-labore',
  'pro labore rn marques': 'Pró-labore',
  'fgts multa rescisoria': 'FGTS multa rescisória',
  'alugueis': 'Aluguel',
  'agua e tratamento de efluentes': 'Água e Tratamento de Efluentes',
  'materiais de manutencao predial': 'Materiais manutenção Predial',
  'servicos de manutencao predial': 'Serviços manutenção Predial',
  'alimentacao para eventos': 'Alimentação para eventos',
  'cartorios': 'Cartórios e Notários',
  'taxas de legalizacao': 'Taxas de Legalização',
  'taxas de legislacao': 'Taxas de Legalização',
  'laudos ambientais': 'Laudos ambientais',
  'passagens aereas': 'Passagens aéreas',
  'material de escritorio': 'Material de escritório',
  'manutencao licenca de software': 'Manutenção/Licença de softwares',
  'software gestao': 'Software Gestão',
  'telefonia celular': 'Telefone celular',
  'higienizacao e detetizacao': 'Higienização e Esterilização',
  'programa de formacao profissional': 'Programa de Formação Profissional',
  'anuncios e publicacoes': 'Propagandas e anúncios - Atividades Empresas',
  'aluguel de maquineta de cartao': 'Aluguel de Máquina de Cartão',
  'comissao sobre vendas': 'Comissão sobre vendas',
  'assessoria juridica': 'Assessoria Jurídica',
  'despesas legais e judiciais': 'Despesas legais e judiciais',
  'assessoria de marketing e publicidade': 'Assessoria de marketing e publicidade',
  'material de marketing e publicidade': 'Materiais de Marketing e Publicidade',
  'assessoria contabil': 'Assessoria Contábil',
  'juros de emprestimos e financiamentos': 'Empréstimos e financiamentos - CD + Juros',
  'juros e taxas de antecipacao de recebiveis': 'Antecipação de recebíveis - taxas e juros',
  'tarifas bancarias': 'Tarifas Bancárias',
  'juros e encargos por atraso': 'Juros sobre atrasos de pagamentos',
  'distribuicao de lucro a socios': 'Retirada de Lucros',
  'icms s/vendas': 'ICMS s/ vendas',
  'icms s/ vendas': 'ICMS s/ vendas',
  'pis': 'PIS',
  'pis s/vendas': 'PIS',
  'cofins s/ vendas': 'Cofins s/ vendas',
  'simples nacional': 'Imposto – Simples Nacional',
  'imposto - simples nacional': 'Imposto – Simples Nacional',
  'imposto simples nacional': 'Imposto – Simples Nacional',
  'fornecedor - materia prima': 'CPV Só Aço',
  'cpv': 'CPV Só Aço',
  'cmv': 'CMV Só Móveis',
  'cotac': 'ICMS s/ vendas',
  'fecop': 'ICMS s/ vendas',
  'funef': 'ICMS s/ vendas',
  'icms antecipado': 'Guia Antecipação',
  'icms difal': 'ICMS Difal Uso e Consumo',
  'icms difal uso e consumo': 'ICMS Difal Uso e Consumo',
  'icms diferencial': 'ICMS Difal Uso e Consumo',
  'icms difer. ativo imobilizado': 'ICMS Difal Uso e Consumo',
  'ipi s/vendas': 'IPI',
  'ipi s/ vendas': 'IPI',
  'iss s/vendas': 'ISS',
  'iss s/ vendas': 'ISS',
  'cofins s/vendas': 'Cofins s/ vendas',
  'pis importacao': 'PIS Importação',
  'pis sobre importacao': 'PIS Importação',
  'icms substituicao tributaria': 'ICMS Substituição Tributária',
  'icms st': 'ICMS ST',
  'impostos retencao': 'Impostos Retenção',
  'impostos retencao na fonte': 'Impostos Retenção',
  'diferenciais': '(-) Diferenciais',
};

/** Classificação Nomus (1.3.x impostos s/ vendas) → código analítico DRE (4.x). */
const NOMUS_CLASS_IMPOSTOS_PARA_DRE_CODIGO: Record<string, string> = {
  '1.3.1': '4.1',
  '1.3.2': '4.1',
  '1.3.3': '4.1',
  '1.3.4': '4.14',
  '1.3.5': '4.4',
  '1.3.6': '4.3',
  '1.3.7': '4.5',
  '1.3.8': '4.8',
  '1.3.9': '4.7',
  '1.3.10': '4.11',
  '1.3.11': '4.10',
  '1.3.12': '4.1',
};

export function normalizarNomePlano(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function codigoPermitidoSaidas(codigo: string): boolean {
  const c = codigo.trim();
  return CODIGOS_BASE_SAIDAS.some((b) => c === b || c.startsWith(`${b}.`));
}

function caminhosArquivo(rel: string): string[] {
  return [
    join(process.cwd(), rel),
    join(process.cwd(), '..', rel),
    join(process.cwd(), 'dist', '..', rel),
  ];
}

function lerJson<T>(rel: string): T | null {
  for (const p of caminhosArquivo(rel)) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as T;
  }
  return null;
}

function carregarArvoreDre(): DreNo[] {
  const raw = lerJson<{ roots: DreNo[] }>('frontend/src/pages/financeiro/dre/estruturaDreArvore.json');
  return raw?.roots ?? [];
}

function carregarPlanosNomus(): PlanoAtivo[] {
  return lerJson<PlanoAtivo[]>('frontend/src/pages/financeiro/dfc/planoContasAtivoDfc.json') ?? [];
}

let mapNomeParaPathKey: Map<string, string> | null = null;
let mapIdParaPathKey: Map<number, string> | null = null;
let mapPathKeyParaIds: Map<string, number[]> | null = null;
let mapPathKeyParaIdsBase: Map<string, number[]> | null = null;
let mapIdParaPathKeyBase: Map<number, string> | null = null;
let mapCodigoDreParaPathKey: Map<string, string> | null = null;
let aliasesDinamicosNomus: Record<string, string> | null = null;
let overridesCarregados: DreRelacaoPcOverrides | null = null;
let shop9ManualOrdemParaPathKey: Map<number, string> | null = null;
let shop9ExcluidosPorPathKey: Map<string, Set<number>> | null = null;

function buildAliasesDinamicosNomus(roots: DreNo[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of carregarPlanosNomus()) {
    if (!p.nome?.trim()) continue;
    const cls = String(p.classificacao ?? '').trim();
    const codDre = NOMUS_CLASS_IMPOSTOS_PARA_DRE_CODIGO[cls];
    if (codDre) {
      const secao4 = roots.find((r) => r.codigo === '4');
      const noFilho = secao4?.children?.find((c) => c.codigo === codDre);
      if (noFilho?.nome) {
        out[normalizarNomePlano(p.nome)] = noFilho.nome;
        continue;
      }
    }
    const alias = ALIASES_NOMUS_PARA_DRE[normalizarNomePlano(p.nome)];
    if (alias) out[normalizarNomePlano(p.nome)] = alias;
  }
  return out;
}

function resolverAliasNomePlano(nome: string): string {
  const norm = normalizarNomePlano(nome);
  if (!aliasesDinamicosNomus) aliasesDinamicosNomus = {};
  return (
    aliasesDinamicosNomus[norm] ??
    ALIASES_NOMUS_PARA_DRE[norm] ??
    nome
  );
}

/** Fallback por palavras-chave (nomes Shop9 que não batem exato com a árvore). */
function resolverPathKeyImpostosPorPalavra(nomeNorm: string): string | null {
  if (!nomeNorm || nomeNorm.includes('impostos sobre vendas')) return null;
  const hit = (cod: string) => mapCodigoDreParaPathKey?.get(cod) ?? null;
  if (nomeNorm.includes('simples')) return hit('4.14');
  if (nomeNorm.includes('cofins')) return hit('4.7');
  if (nomeNorm.includes('pis') && nomeNorm.includes('import')) return hit('4.9');
  if (nomeNorm.includes('pis')) return hit('4.8');
  if (nomeNorm.includes('funrural')) return hit('4.12');
  if (nomeNorm.includes('senar')) return hit('4.13');
  if (nomeNorm.includes('iss')) return hit('4.10');
  if (nomeNorm.includes('ipi')) return hit('4.11');
  if (nomeNorm.includes('retenc')) return hit('4.15');
  if (nomeNorm.includes('diferencial') || nomeNorm === 'diferenciais') return hit('4.16');
  if (nomeNorm.includes('substitu') || (nomeNorm.includes('icms') && nomeNorm.includes('st'))) {
    if (nomeNorm.includes('substitu')) return hit('4.3');
    if (/\bicms\s+st\b/.test(nomeNorm) || nomeNorm.endsWith(' icms st')) return hit('4.2');
  }
  if (nomeNorm.includes('antecip') || nomeNorm.includes('guia')) return hit('4.4');
  if (nomeNorm.includes('difal') || nomeNorm.includes('difer')) return hit('4.5');
  if (nomeNorm.includes('icms')) return hit('4.1');
  return null;
}

function buildMaps(): { byNome: Map<string, string>; byId: Map<number, string> } {
  const byNome = new Map<string, string>();
  const roots = carregarArvoreDre();
  aliasesDinamicosNomus = buildAliasesDinamicosNomus(roots);

  const codigoParaPathKey = new Map<string, string>();
  function walk(nodes: DreNo[]): void {
    for (const n of nodes) {
      if (n.tipo === 'A' && codigoPermitidoSaidas(n.codigo) && !CODIGOS_DRE_SOMENTE_MODELO.has(n.codigo)) {
        byNome.set(normalizarNomePlano(n.nome), n.pathKey);
        codigoParaPathKey.set(n.codigo, n.pathKey);
      } else if (n.tipo === 'S' && CODIGOS_DRE_AGREGACAO_SAIDAS.has(n.codigo)) {
        byNome.set(normalizarNomePlano(n.nome), n.pathKey);
        codigoParaPathKey.set(n.codigo, n.pathKey);
      }
      if (n.children?.length) walk(n.children);
    }
  }
  walk(roots);
  mapCodigoDreParaPathKey = codigoParaPathKey;

  const byId = new Map<number, string>();
  for (const p of carregarPlanosNomus()) {
    if (p.id <= 0 || !p.nome) continue;
    const nomeDre = resolverAliasNomePlano(p.nome);
    const pk = byNome.get(normalizarNomePlano(nomeDre));
    if (pk) byId.set(p.id, pk);
    const cls = String(p.classificacao ?? '').trim();
    const codDre = NOMUS_CLASS_IMPOSTOS_PARA_DRE_CODIGO[cls];
    if (codDre && !pk) {
      const pkCls = codigoParaPathKey.get(codDre);
      if (pkCls) byId.set(p.id, pkCls);
    }
  }

  return { byNome, byId };
}

function aplicarOverridesNomus(
  byId: Map<number, string>,
  overrides: DreRelacaoPcOverrides,
): Map<string, number[]> {
  for (const [pk, ids] of Object.entries(overrides.nomusIdsExcluidos)) {
    for (const id of ids) {
      if (byId.get(id) === pk) byId.delete(id);
    }
  }
  for (const [pk, ids] of Object.entries(overrides.nomusIdsAdicionais)) {
    for (const id of ids) byId.set(id, pk);
  }
  const byPathKey = new Map<string, number[]>();
  for (const [id, pk] of byId) {
    const cur = byPathKey.get(pk) ?? [];
    cur.push(id);
    byPathKey.set(pk, cur);
  }
  for (const cur of byPathKey.values()) cur.sort((a, b) => a - b);
  return byPathKey;
}

function carregarOverrides(): DreRelacaoPcOverrides {
  if (!overridesCarregados) overridesCarregados = lerDreRelacaoPcOverrides();
  return overridesCarregados;
}

function ensureMaps(): void {
  if (mapNomeParaPathKey && mapIdParaPathKey && mapPathKeyParaIds && mapPathKeyParaIdsBase) return;
  const { byNome, byId } = buildMaps();
  mapNomeParaPathKey = byNome;
  const byIdBase = new Map(byId);
  const byPathKeyBase = new Map<string, number[]>();
  for (const [id, pk] of byIdBase) {
    const cur = byPathKeyBase.get(pk) ?? [];
    cur.push(id);
    byPathKeyBase.set(pk, cur);
  }
  for (const cur of byPathKeyBase.values()) cur.sort((a, b) => a - b);
  mapPathKeyParaIdsBase = byPathKeyBase;
  mapIdParaPathKeyBase = byIdBase;

  const overrides = carregarOverrides();
  mapPathKeyParaIds = aplicarOverridesNomus(byId, overrides);
  mapIdParaPathKey = byId;
  shop9ManualOrdemParaPathKey = mapaShop9OrdemParaPathKeyManual(overrides);
  shop9ExcluidosPorPathKey = new Map(
    Object.entries(overrides.shop9OrdensExcluidos).map(([pk, ordens]) => [pk, new Set(ordens)]),
  );
}

export function invalidarMapasDrePlanoContas(): void {
  mapNomeParaPathKey = null;
  mapIdParaPathKey = null;
  mapPathKeyParaIds = null;
  mapPathKeyParaIdsBase = null;
  mapIdParaPathKeyBase = null;
  mapCodigoDreParaPathKey = null;
  aliasesDinamicosNomus = null;
  overridesCarregados = null;
  shop9ManualOrdemParaPathKey = null;
  shop9ExcluidosPorPathKey = null;
}

function resolverPathKeyInterno(
  idContaFinanceiro: unknown,
  nomePlanoFinanceiro: unknown,
  byId: Map<number, string>,
): string | null {
  // idContaFinanceiro tem prioridade sobre nomePlanoFinanceiro: o detalhe da DRE
  // filtra por ids da conta analítica; se o nome do lançamento apontar para outro
  // nó (ex.: folha sintética), a grade deve seguir o id para manter grade == modal.
  const id = Number(idContaFinanceiro);
  if (Number.isFinite(id) && id > 0) {
    const idInt = Math.trunc(id);
    const porId = byId.get(idInt);
    if (porId) return porId;
    const plano = carregarPlanosNomus().find((p) => p.id === idInt);
    if (plano?.classificacao) {
      const codDre = NOMUS_CLASS_IMPOSTOS_PARA_DRE_CODIGO[String(plano.classificacao).trim()];
      if (codDre) return mapCodigoDreParaPathKey?.get(codDre) ?? null;
    }
  }

  const nome = String(nomePlanoFinanceiro ?? '').trim();
  if (nome) {
    const dreNome = resolverAliasNomePlano(nome);
    const hit = mapNomeParaPathKey!.get(normalizarNomePlano(dreNome));
    if (hit) return hit;
    const hitRaw = mapNomeParaPathKey!.get(normalizarNomePlano(nome));
    if (hitRaw) return hitRaw;
    const porPalavra = resolverPathKeyImpostosPorPalavra(normalizarNomePlano(nome));
    if (porPalavra) return porPalavra;
  }
  return null;
}

/** Resolve pathKey DRE sem overrides manuais (Nomus/Shop9 automático). */
export function resolverPathKeyDreSaidasBase(
  idContaFinanceiro: unknown,
  nomePlanoFinanceiro: unknown,
): string | null {
  ensureMaps();
  return resolverPathKeyInterno(idContaFinanceiro, nomePlanoFinanceiro, mapIdParaPathKeyBase!);
}

/** Resolve pathKey DRE a partir do plano Nomus (nome e/ou id), com overrides. */
export function resolverPathKeyDreSaidas(
  idContaFinanceiro: unknown,
  nomePlanoFinanceiro: unknown,
): string | null {
  ensureMaps();
  return resolverPathKeyInterno(idContaFinanceiro, nomePlanoFinanceiro, mapIdParaPathKey!);
}

/**
 * Resolve pathKey para agregação de saídas na grade DRE.
 * Usa o mapa efetivo id→pathKey (mesmos ids do modal de detalhe) antes do fallback por nome.
 */
export function resolverPathKeyAgregacaoSaidas(
  idContaFinanceiro: unknown,
  nomePlanoFinanceiro: unknown,
): string | null {
  ensureMaps();
  const id = Number(idContaFinanceiro);
  if (Number.isFinite(id) && id > 0) {
    const pk = mapIdParaPathKey!.get(Math.trunc(id));
    if (pk) return pk;
  }
  return resolverPathKeyInterno(idContaFinanceiro, nomePlanoFinanceiro, mapIdParaPathKey!);
}

/** Resolve pathKey DRE para lançamentos Shop9 (Ordem_Plano_Contas3), com overrides manuais. */
export function resolverPathKeyDreSaidasShop9(
  ordemPlanoContas3: unknown,
  nomePlanoFinanceiro: unknown,
): string | null {
  ensureMaps();
  const ordem = Math.trunc(Number(ordemPlanoContas3));
  if (Number.isFinite(ordem) && ordem > 0) {
    const manual = shop9ManualOrdemParaPathKey!.get(ordem);
    if (manual) return manual;
    const autoPk = resolverPathKeyDreSaidasBase(ordem, nomePlanoFinanceiro);
    if (autoPk) {
      const excl = shop9ExcluidosPorPathKey!.get(autoPk);
      if (excl?.has(ordem)) return null;
      return autoPk;
    }
  }
  return resolverPathKeyDreSaidas(ordemPlanoContas3, nomePlanoFinanceiro);
}

export function listarPathKeysSaidasPermitidos(): string[] {
  ensureMaps();
  return [...new Set(mapNomeParaPathKey!.values())];
}

export function listarContasSaidasDre(): DreContaSaida[] {
  const roots = carregarArvoreDre();
  const out: DreContaSaida[] = [];
  function walk(nodes: DreNo[]): void {
    for (const n of nodes) {
      if (n.tipo === 'A' && codigoPermitidoSaidas(n.codigo) && !CODIGOS_DRE_SOMENTE_MODELO.has(n.codigo)) {
        out.push({ pathKey: n.pathKey, codigo: n.codigo, nome: n.nome, tipo: 'A' });
      } else if (n.tipo === 'S' && CODIGOS_DRE_AGREGACAO_SAIDAS.has(n.codigo)) {
        out.push({ pathKey: n.pathKey, codigo: n.codigo, nome: n.nome, tipo: 'S' });
      }
      if (n.children?.length) walk(n.children);
    }
  }
  walk(roots);
  return out;
}

function mapaPathKeyParaIds(map: Map<string, number[]>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [pk, ids] of map) out[pk] = [...ids];
  return out;
}

/** ids Nomus automáticos (sem overrides manuais). */
export function mapaIdsContaPorPathKeyDreBase(): Record<string, number[]> {
  ensureMaps();
  return mapaPathKeyParaIds(mapPathKeyParaIdsBase!);
}

/** ids Nomus efetivos (automático + overrides). */
export function mapaIdsContaPorPathKeyDreEfetivo(): Record<string, number[]> {
  ensureMaps();
  return mapaPathKeyParaIds(mapPathKeyParaIds!);
}

/** ids Nomus (contafinanceiro) mapeados para cada pathKey analítico da DRE. */
export function mapaIdsContaPorPathKeyDre(): Record<string, number[]> {
  return mapaIdsContaPorPathKeyDreEfetivo();
}

export function listarIdsContaPorPathKeyDre(pathKey: string): number[] {
  ensureMaps();
  return [...(mapPathKeyParaIds!.get(pathKey) ?? [])].sort((a, b) => a - b);
}

/** pathKey analítico da árvore DRE a partir do código (ex.: 10.1.7). */
export function pathKeyDrePorCodigo(codigo: string): string | null {
  ensureMaps();
  const c = codigo.trim();
  if (!c) return null;
  return mapCodigoDreParaPathKey?.get(c) ?? null;
}
