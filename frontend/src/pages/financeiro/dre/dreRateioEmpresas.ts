import {
  DFC_EMPRESAS_TODAS,
  DFC_EMPRESA_OPCOES,
  DFC_ID_EMPRESA_ACO,
  DFC_ID_EMPRESA_MOVEIS,
  DFC_ID_EMPRESA_REFRIGERACAO,
  DFC_ID_EMPRESA_RN_MARQUES,
} from '../dfc/dfcEmpresas';

/** Configuração persistida do modal Rateio (várias origens). */
export const DRE_RATEIO_STORAGE_KEY = 'dre-rateio-v3';
const DRE_RATEIO_STORAGE_KEY_V2 = 'dre-rateio-v2';
/** @deprecated leitura legada */
export const DRE_RATEIO_PRO_LABORE_STORAGE_KEY = 'dre-rateio-pro-labore-v1';
const DRE_RATEIO_EMPRESAS_STORAGE_KEY_LEGADO = 'dre-rateio-empresas-v1';

export const CODIGO_PRO_LABORE_PADRAO = '13.1.12';
export const PATH_KEY_PRO_LABORE_PADRAO = 'D/10/0/12';
export const NOME_PRO_LABORE_PADRAO = 'Pró-labore';

export type DreRateioProLaborePct = Record<number, number>;

export type DreRateioOrigemPlanoContas = {
  tipo: 'plano_contas';
  codigo: string;
  pathKey: string;
  nome: string;
};

export type DreRateioOrigemFornecedores = {
  tipo: 'fornecedores';
  codigoConta: string;
  pathKeyConta: string;
  nomeConta: string;
  nomes: string[];
};

export type DreRateioOrigem = DreRateioOrigemPlanoContas | DreRateioOrigemFornecedores;

export type DreRateioRegra = {
  id: string;
  origem: DreRateioOrigem;
  percentuais: DreRateioProLaborePct;
};

export type DreRateioConfig = {
  regras: DreRateioRegra[];
};

/** @deprecated use DreRateioConfig */
export type DreRateioProLaboreConfig = DreRateioConfig;

/** @deprecated use DreRateioConfig */
export type DreRateioEmpresasConfig = DreRateioConfig;

export function criarIdRegraRateio(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function percentuaisPadrao(): DreRateioProLaborePct {
  return {
    [DFC_ID_EMPRESA_ACO]: 70,
    [DFC_ID_EMPRESA_MOVEIS]: 15,
    [DFC_ID_EMPRESA_REFRIGERACAO]: 5,
    [DFC_ID_EMPRESA_RN_MARQUES]: 10,
  };
}

export function origemProLaborePadrao(): DreRateioOrigemPlanoContas {
  return {
    tipo: 'plano_contas',
    codigo: CODIGO_PRO_LABORE_PADRAO,
    pathKey: PATH_KEY_PRO_LABORE_PADRAO,
    nome: NOME_PRO_LABORE_PADRAO,
  };
}

export function criarRegraRateio(
  origem: DreRateioOrigem,
  percentuais?: DreRateioProLaborePct,
): DreRateioRegra {
  return {
    id: criarIdRegraRateio(),
    origem,
    percentuais: normalizarPercentuaisRateio(percentuais ?? percentuaisPadrao()),
  };
}

export function regraProLaborePadrao(): DreRateioRegra {
  return criarRegraRateio(origemProLaborePadrao());
}

export const DRE_RATEIO_PADRAO: DreRateioConfig = {
  regras: [regraProLaborePadrao()],
};

/** @deprecated use DRE_RATEIO_PADRAO */
export const DRE_RATEIO_PRO_LABORE_PADRAO = DRE_RATEIO_PADRAO;

/** @deprecated use DRE_RATEIO_PADRAO */
export const DRE_RATEIO_EMPRESAS_PADRAO = DRE_RATEIO_PADRAO;

export function chaveOrigemRateio(origem: DreRateioOrigem): string {
  if (origem.tipo === 'plano_contas') {
    return `pc:${origem.pathKey}`;
  }
  const nomes = [...origem.nomes].map((n) => n.trim()).filter(Boolean).sort();
  return `ff:${origem.pathKeyConta}:${nomes.join('\t')}`;
}

export function labelOrigemRateio(origem: DreRateioOrigem): string {
  if (origem.tipo === 'plano_contas') {
    return `${origem.codigo} — ${origem.nome}`;
  }
  const qtd = origem.nomes.length;
  const nomes =
    qtd === 0
      ? 'nenhum fornecedor'
      : qtd === 1
        ? origem.nomes[0]!
        : `${qtd} fornecedores`;
  return `${origem.codigoConta} — ${origem.nomeConta} · ${nomes}`;
}

export function regrasFornecedor(config: DreRateioConfig | null | undefined): DreRateioRegra[] {
  if (!config?.regras?.length) return [];
  return config.regras.filter(
    (r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0,
  );
}

export function somaPercentuaisRateio(percentuais: DreRateioProLaborePct): number {
  return DFC_EMPRESAS_TODAS.reduce((s, id) => s + (percentuais[id] ?? 0), 0);
}

export function percentuaisRateioValidos(percentuais: DreRateioProLaborePct): boolean {
  return Math.abs(somaPercentuaisRateio(percentuais) - 100) < 0.05;
}

export function configRateioValida(config: DreRateioConfig): boolean {
  if (!config.regras.length) return false;
  return config.regras.every((r) => percentuaisRateioValidos(r.percentuais));
}

/** Ajusta centavos no maior percentual para fechar 100%. */
export function normalizarPercentuaisRateio(percentuais: DreRateioProLaborePct): DreRateioProLaborePct {
  const out: DreRateioProLaborePct = {};
  for (const id of DFC_EMPRESAS_TODAS) {
    out[id] = Math.round((percentuais[id] ?? 0) * 100) / 100;
  }
  const soma = somaPercentuaisRateio(out);
  const diff = Math.round((100 - soma) * 100) / 100;
  if (Math.abs(diff) >= 0.01) {
    let idxMax = 0;
    for (let i = 1; i < DFC_EMPRESAS_TODAS.length; i++) {
      if ((out[DFC_EMPRESAS_TODAS[i]!] ?? 0) > (out[DFC_EMPRESAS_TODAS[idxMax]!] ?? 0)) idxMax = i;
    }
    const idMax = DFC_EMPRESAS_TODAS[idxMax]!;
    out[idMax] = Math.round(((out[idMax] ?? 0) + diff) * 100) / 100;
  }
  return out;
}

function parseOrigem(raw: unknown): DreRateioOrigem {
  if (!raw || typeof raw !== 'object') return origemProLaborePadrao();
  const o = raw as Record<string, unknown>;
  if (o.tipo === 'fornecedores') {
    const nomes = Array.isArray(o.nomes)
      ? o.nomes.map((n) => String(n).trim()).filter(Boolean)
      : [];
    return {
      tipo: 'fornecedores',
      codigoConta: String(o.codigoConta ?? '13.1.1').trim() || '13.1.1',
      pathKeyConta: String(o.pathKeyConta ?? 'D/10/0/0').trim() || 'D/10/0/0',
      nomeConta: String(o.nomeConta ?? 'Salários').trim() || 'Salários',
      nomes,
    };
  }
  return {
    tipo: 'plano_contas',
    codigo: String(o.codigo ?? CODIGO_PRO_LABORE_PADRAO).trim() || CODIGO_PRO_LABORE_PADRAO,
    pathKey: String(o.pathKey ?? PATH_KEY_PRO_LABORE_PADRAO).trim() || PATH_KEY_PRO_LABORE_PADRAO,
    nome: String(o.nome ?? NOME_PRO_LABORE_PADRAO).trim() || NOME_PRO_LABORE_PADRAO,
  };
}

function parsePercentuais(raw: Record<string, number> | undefined): DreRateioProLaborePct {
  const percentuais = percentuaisPadrao();
  if (raw && typeof raw === 'object') {
    for (const id of DFC_EMPRESAS_TODAS) {
      const v = Number(raw[String(id)]);
      if (Number.isFinite(v) && v >= 0) percentuais[id] = Math.round(v * 100) / 100;
    }
  }
  return normalizarPercentuaisRateio(percentuais);
}

function parseRegra(raw: unknown): DreRateioRegra | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const origem = parseOrigem(o.origem);
  const percentuais = parsePercentuais(o.percentuais as Record<string, number> | undefined);
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : criarIdRegraRateio();
  return { id, origem, percentuais };
}

function normalizarConfig(config: DreRateioConfig): DreRateioConfig {
  const vistos = new Set<string>();
  const regras: DreRateioRegra[] = [];
  for (const r of config.regras) {
    const chave = chaveOrigemRateio(r.origem);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    regras.push({
      id: r.id || criarIdRegraRateio(),
      origem: r.origem,
      percentuais: normalizarPercentuaisRateio(r.percentuais),
    });
  }
  return { regras: regras.length > 0 ? regras : [regraProLaborePadrao()] };
}

function parseStoredConfig(raw: string): DreRateioConfig | null {
  try {
    const parsed = JSON.parse(raw) as {
      regras?: unknown[];
      percentuais?: Record<string, number>;
      origem?: unknown;
    };

    if (Array.isArray(parsed.regras) && parsed.regras.length > 0) {
      const regras = parsed.regras.map(parseRegra).filter((r): r is DreRateioRegra => r != null);
      if (regras.length > 0) return normalizarConfig({ regras });
    }

    // v2 — origem única
    if (parsed.origem) {
      return normalizarConfig({
        regras: [
          criarRegraRateio(parseOrigem(parsed.origem), parsePercentuais(parsed.percentuais)),
        ],
      });
    }

    // v1 — só percentuais
    if (parsed.percentuais) {
      return normalizarConfig({
        regras: [criarRegraRateio(origemProLaborePadrao(), parsePercentuais(parsed.percentuais))],
      });
    }

    return null;
  } catch {
    return null;
  }
}

export function carregarRateioConfig(): DreRateioConfig {
  if (typeof localStorage === 'undefined') {
    return { regras: [regraProLaborePadrao()] };
  }
  const raw =
    localStorage.getItem(DRE_RATEIO_STORAGE_KEY) ??
    localStorage.getItem(DRE_RATEIO_STORAGE_KEY_V2) ??
    localStorage.getItem(DRE_RATEIO_PRO_LABORE_STORAGE_KEY) ??
    localStorage.getItem(DRE_RATEIO_EMPRESAS_STORAGE_KEY_LEGADO);
  if (!raw) return { regras: [regraProLaborePadrao()] };
  return parseStoredConfig(raw) ?? { regras: [regraProLaborePadrao()] };
}

/** @deprecated use carregarRateioConfig */
export const carregarRateioProLaboreConfig = carregarRateioConfig;

/** @deprecated use carregarRateioConfig */
export const carregarRateioEmpresasConfig = carregarRateioConfig;

export function salvarRateioConfig(config: DreRateioConfig): void {
  if (typeof localStorage === 'undefined') return;
  const normalizado = normalizarConfig(config);
  localStorage.setItem(
    DRE_RATEIO_STORAGE_KEY,
    JSON.stringify({
      regras: normalizado.regras.map((r) => ({
        id: r.id,
        origem: r.origem,
        percentuais: normalizarPercentuaisRateio(r.percentuais),
      })),
    }),
  );
}

/** @deprecated use salvarRateioConfig */
export const salvarRateioProLaboreConfig = salvarRateioConfig;

/** @deprecated use salvarRateioConfig */
export const salvarRateioEmpresasConfig = salvarRateioConfig;

export function parsePercentualRateioInput(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export const DRE_RATEIO_PRO_LABORE_LINHAS = DFC_EMPRESA_OPCOES.map((o) => ({
  id: o.id,
  label: o.label,
}));

/** @deprecated use DRE_RATEIO_PRO_LABORE_LINHAS */
export const DRE_RATEIO_EMPRESAS_LINHAS = DRE_RATEIO_PRO_LABORE_LINHAS;
