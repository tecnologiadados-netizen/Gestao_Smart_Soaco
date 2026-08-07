import { prisma } from '../../config/prisma.js';
import { getNomusPool, nomusQueryWithRetry } from '../../config/nomusDb.js';
import { getDashboard, getProducaoResumoApuracao, warmupPainelProducaoCaches } from './painelProducaoDashboardService.js';
import {
  getConsiderarPenalizacoes,
  getMetaNiveis,
  isSemMeta,
  listSetoresMeta,
  type MetaNiveis,
  type NivelMeta,
} from './painelProducaoTargetsService.js';
import {
  FAIXAS_DESCONTO_PADRAO,
  listarFaixasDesconto,
  type FaixaDescontoInput,
} from './painelProducaoFaixasService.js';
import { listarDescricoesNaoAbonadas } from '../../data/motivosSugestaoRepository.js';
import {
  SQL_PEDIDO_DATA_ATENDIMENTO,
  STATUS_ITEM_ATENDIDO_SQL,
  STATUS_ITEM_TERMINAL_SQL,
} from './painelProducaoPedidosAtendidosSql.js';
import { canonicalizeSetorPainel } from './painelProducaoConstants.js';

export const NIVEL_NAO_ATINGIDO = 'Não atingida';
/** Setores da área Produção — mesma regra indireta (parcelas por montagem). */
export const SETORES_PRODUCAO = [
  'Perfiladeiras',
  'Corte e Dobra',
  'Solda',
  'Pintura',
] as const;
export type SetorProducao = (typeof SETORES_PRODUCAO)[number];
export const SETOR_PERFILADEIRAS: SetorProducao = 'Perfiladeiras';
export const AREA_MONTAGEM = 'montagem' as const;
export const AREA_PRODUCAO = 'producao' as const;

export type ApuracaoArea = typeof AREA_MONTAGEM | typeof AREA_PRODUCAO;

const LABEL_NAO_ABONADO_MONTAGEM = 'Justificativas não abonadas para Montagem';
const LABEL_NAO_ABONADO_PRODUCAO = 'Justificativas não abonadas para Produção';

/** Valores unitários fixos da política para cada setor de produção. */
export const VALOR_UNITARIO_PRODUCAO: Record<NivelMeta, number> = {
  Bronze: 8.3,
  Prata: 16.6,
  Aço: 25,
};

export const MIN_SETORES_MONTAGEM_PERFILADEIRAS = 3;

export function isSetorProducao(setor: string): setor is SetorProducao {
  return (SETORES_PRODUCAO as readonly string[]).includes(setor);
}

export const APURACAO_DETALHE_TIPOS = [
  'pedidos_encerrados',
  'pedidos_com_alteracao',
  'alteracoes',
  'alteracoes_ruptura',
  'memorial_producao',
  'producao_realizada',
] as const;

export type ApuracaoDetalheTipo = (typeof APURACAO_DETALHE_TIPOS)[number];

type ItemEncerradoRow = {
  pd: string;
  id_pedido: number;
  id_produto: number;
  cliente: string | null;
  codigo_produto: string | null;
  descricao: string | null;
  status: number;
  data_encerramento: Date | string | null;
  quantidade: number | null;
  setor?: string | null;
};

type AjusteRow = {
  id: number;
  id_pedido: string;
  data_ajuste: Date;
  motivo: string;
  usuario: string;
  anexo_assinatura_path: string | null;
  anexo_assinatura_nome: string | null;
};

export type ApuracaoMetaSetor = {
  area: ApuracaoArea;
  setor: string;
  mes: string;
  pedidos_encerrados: number;
  pedidos_com_alteracao_nao_abonada: number;
  alteracoes_nao_abonadas: number;
  media_alteracoes_por_pedido: number;
  meta_quantitativa: number;
  producao_realizada: number;
  unidade: string;
  percentual_meta_quantitativa: number;
  percentual_penalizacao_qualitativa: number;
  meta_atingida: string;
  meta_nivel_atingido: number | null;
  valor_nivel: number;
  valor_a_pagar: number;
  niveis: Array<{ nivel: string; meta: number | null; valor: number | null; atingido: boolean }>;
  motivo_nao_abonado: string;
  cadastro_niveis_completo: boolean;
  considerar_penalizacoes?: boolean;
  /** Campos exclusivos das linhas da área produção. */
  setores_atingiram_meta?: number;
  distribuicao_niveis?: { Bronze: number; Prata: number; Aço: number };
  valor_bruto?: number;
  parcelas_penalizadas?: number;
  elegivel_minimo_setores?: boolean;
};

export type ApuracaoDetalheLinha = {
  pedido: string;
  cliente: string;
  codigo_produto: string;
  descricao: string;
  quantidade?: number | null;
  status?: string;
  data_encerramento?: string | null;
  data_alteracao?: string | null;
  motivo?: string;
  usuario?: string;
  anexo_assinatura_path?: string | null;
  anexo_assinatura_nome?: string | null;
};

export type ParcelaProducaoDetalhe = {
  setor_montagem: string;
  nivel: NivelMeta | null;
  valor_base: number;
  pedidos_com_ruptura: number;
  alteracoes_ruptura: number;
  media_ruptura: number;
  percentual_herdado: number;
  impacto_producao: boolean;
  desconto: number;
  parcela_final: number;
};

export type ApuracaoDetalhePayload = {
  mes: string;
  setor: string;
  tipo: ApuracaoDetalheTipo;
  titulo: string;
  total: number;
  linhas: ApuracaoDetalheLinha[];
  /** Memorial de cálculo dos setores de produção. */
  parcelas?: ParcelaProducaoDetalhe[];
  valor_bruto?: number;
  valor_a_pagar?: number;
  elegivel_minimo_setores?: boolean;
  min_setores?: number;
  setores_atingiram_meta?: number;
};

export function chavePedidoItem(id: string): string {
  const parts = String(id ?? '').trim().split('-');
  if (parts.length >= 3) {
    const pedido = parts[parts.length - 2]!.trim();
    const item = parts[parts.length - 1]!.trim();
    const numeroItem = Number.parseInt(item, 10);
    return `${pedido}-${Number.isNaN(numeroItem) ? item : numeroItem}`;
  }
  return parts.length === 2 ? parts.join('-').trim() : String(id ?? '').trim();
}

export function calcularPenalizacaoQualitativa(
  media: number,
  faixas: FaixaDescontoInput[] = FAIXAS_DESCONTO_PADRAO,
): number {
  const faixa = faixas.find(
    (item) => media >= item.media_min && (item.media_max == null || media <= item.media_max),
  );
  return faixa?.percentual_desconto ?? 0;
}

export function calcularMediaAlteracoes(
  alteracoes: number,
  pedidosComAlteracao: number,
): number {
  if (pedidosComAlteracao <= 0) return 0;
  return Math.round((alteracoes / pedidosComAlteracao) * 100) / 100;
}

export function calcularPercentualFinal(
  percentualQuantitativo: number,
  penalizacao: number,
): number {
  const quantitativoLimitado = Math.min(Math.max(percentualQuantitativo, 0), 100);
  return Math.round(quantitativoLimitado * (1 - penalizacao / 100) * 100) / 100;
}

const ORDEM_NIVEIS: NivelMeta[] = ['Bronze', 'Prata', 'Aço'];

/** Nível atingido = maior faixa cujo volume mínimo foi alcançado pela produção. */
export function identificarNivelAtingido(
  producaoRealizada: number,
  metas: Record<NivelMeta, number | null>,
): NivelMeta | null {
  let atingido: NivelMeta | null = null;
  for (const nivel of ORDEM_NIVEIS) {
    const meta = metas[nivel];
    if (meta == null || meta <= 0) continue;
    if (producaoRealizada >= meta) atingido = nivel;
  }
  return atingido;
}

/** Valor a pagar = valor fixo do nível atingido − penalização qualitativa. */
export function calcularValorAPagar(valorNivel: number, penalizacao: number): number {
  return Math.round(valorNivel * (1 - penalizacao / 100) * 100) / 100;
}

export function niveisCompletos(metas: Record<NivelMeta, number | null>): boolean {
  return ORDEM_NIVEIS.every((nivel) => {
    const meta = metas[nivel];
    return meta != null && meta > 0;
  });
}

/** Parcela de produção: integral se média de ruptura < 2; senão herda penalização da montagem. */
export function calcularParcelaProducao(
  nivel: NivelMeta | null,
  mediaRuptura: number,
  penalizacaoMontagem: number,
  considerarPenalizacoes = true,
): {
  valorBase: number;
  impactoProducao: boolean;
  percentualHerdado: number;
  desconto: number;
  parcelaFinal: number;
} {
  if (!nivel) {
    return {
      valorBase: 0,
      impactoProducao: false,
      percentualHerdado: 0,
      desconto: 0,
      parcelaFinal: 0,
    };
  }
  const valorBase = VALOR_UNITARIO_PRODUCAO[nivel];
  const impactoProducao = considerarPenalizacoes && mediaRuptura >= 2;
  const percentualHerdado = impactoProducao ? penalizacaoMontagem : 0;
  const parcelaFinal = calcularValorAPagar(valorBase, percentualHerdado);
  const desconto = Math.round((valorBase - parcelaFinal) * 100) / 100;
  return { valorBase, impactoProducao, percentualHerdado, desconto, parcelaFinal };
}

export function consolidarPerfiladeiras(
  parcelas: Array<{ nivel: NivelMeta | null; parcelaFinal: number; valorBase: number; impactoProducao: boolean }>,
): {
  setoresAtingiram: number;
  distribuicao: { Bronze: number; Prata: number; Aço: number };
  valorBruto: number;
  valorFinal: number;
  parcelasPenalizadas: number;
  elegivel: boolean;
} {
  const comNivel = parcelas.filter((p) => p.nivel != null);
  const distribuicao = { Bronze: 0, Prata: 0, Aço: 0 };
  for (const p of comNivel) {
    if (p.nivel) distribuicao[p.nivel] += 1;
  }
  const valorBruto = Math.round(comNivel.reduce((acc, p) => acc + p.valorBase, 0) * 100) / 100;
  const elegivel = comNivel.length >= MIN_SETORES_MONTAGEM_PERFILADEIRAS;
  const valorFinal = elegivel
    ? Math.round(comNivel.reduce((acc, p) => acc + p.parcelaFinal, 0) * 100) / 100
    : 0;
  const parcelasPenalizadas = comNivel.filter((p) => p.impactoProducao).length;
  return {
    setoresAtingiram: comNivel.length,
    distribuicao,
    valorBruto,
    valorFinal,
    parcelasPenalizadas,
    elegivel,
  };
}

function limitesMes(mes: string): { inicio: string; fim: string } {
  const [anoRaw, mesRaw] = mes.split('-');
  const ano = Number(anoRaw);
  const numeroMes = Number(mesRaw);
  if (!Number.isInteger(ano) || numeroMes < 1 || numeroMes > 12) {
    throw new Error('Mês inválido. Use o formato YYYY-MM.');
  }
  const proximoAno = numeroMes === 12 ? ano + 1 : ano;
  const proximoMes = numeroMes === 12 ? 1 : numeroMes + 1;
  return {
    inicio: `${anoRaw}-${mesRaw}-01 00:00:00`,
    fim: `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01 00:00:00`,
  };
}

function statusLabel(status: number): string {
  switch (status) {
    case 4:
      return 'Atendido totalmente';
    case 5:
      return 'Atendido com corte';
    default:
      return `Status ${status}`;
  }
}

function formatDateTimeBr(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR');
}

type SetorMontagemCadastro = {
  setor: string;
  niveisCompletos: boolean;
};

/**
 * A grade exibe todo setor ativo. A condição de níveis completos é usada
 * separadamente para decidir quais setores alimentam a área Produção.
 */
async function listarSetoresMontagemAtivos(mes: string): Promise<SetorMontagemCadastro[]> {
  const setores = await listSetoresMeta();
  const ativos: SetorMontagemCadastro[] = [];
  const mesDate = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1);
  for (const setor of setores) {
    if (await isSemMeta(setor, mesDate)) continue;
    const niveis = await getMetaNiveis(setor, mes);
    ativos.push({ setor, niveisCompletos: niveisCompletos(niveis.metas) });
  }
  return ativos.sort((a, b) => a.setor.localeCompare(b.setor, 'pt-BR'));
}

/** Cache curto do mês (dedupe entre grade + modais na mesma requisição / Atualizar). */
const itensMesInflight = new Map<string, Promise<Map<string, ItemEncerradoRow[]>>>();
const itensMesCache = new Map<string, { ts: number; data: Map<string, ItemEncerradoRow[]> }>();
const ITENS_MES_TTL_MS = 90_000;

export function clearApuracaoItensMesCache(): void {
  itensMesCache.clear();
  itensMesInflight.clear();
}

async function carregarItensEncerradosDoMes(
  mes: string,
): Promise<Map<string, ItemEncerradoRow[]>> {
  const cached = itensMesCache.get(mes);
  if (cached && Date.now() - cached.ts < ITENS_MES_TTL_MS) return cached.data;

  const existing = itensMesInflight.get(mes);
  if (existing) return existing;

  const promise = (async () => {
    const pool = getNomusPool();
    if (!pool) throw new Error('Conexão Nomus não configurada (NOMUS_DB_URL).');
    const { inicio, fim } = limitesMes(mes);

    // Uma query para todos os setores (em vez de N queries iguais filtrando setor).
    const sql = `
      SELECT
        TRIM(sp.opcao) AS setor,
        TRIM(pd.nome) AS pd,
        pd.id AS id_pedido,
        p.id AS id_produto,
        pe.nome AS cliente,
        p.nome AS codigo_produto,
        p.descricao AS descricao,
        ip.status AS status,
        ult.data_atendimento AS data_encerramento,
        ip.qtde AS quantidade
      FROM itempedido ip
      INNER JOIN pedido pd ON pd.id = ip.idPedido
      INNER JOIN produto p ON p.id = ip.idProduto
      LEFT JOIN pessoa pe ON pe.id = pd.idCliente
      INNER JOIN (
        SELECT apv.idProduto, alo.opcao
        FROM atributoprodutovalor apv
        INNER JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 679
      ) sp ON sp.idProduto = p.id
      INNER JOIN (
${SQL_PEDIDO_DATA_ATENDIMENTO}
      ) ult ON ult.id_pedido = pd.id
      WHERE pd.idEmpresa IN (1, 2)
        AND ip.status IN (${STATUS_ITEM_ATENDIDO_SQL})
        AND NOT EXISTS (
          SELECT 1
          FROM itempedido ipx
          WHERE ipx.idPedido = pd.id
            AND ipx.status NOT IN (${STATUS_ITEM_TERMINAL_SQL})
        )
        AND TRIM(sp.opcao) <> ''
      ORDER BY sp.opcao ASC, pd.nome ASC, p.nome ASC, ult.data_atendimento ASC
    `;

    const [rows] = await nomusQueryWithRetry<ItemEncerradoRow[]>(pool, sql, [inicio, fim]);
    const porSetor = new Map<string, ItemEncerradoRow[]>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const setor = canonicalizeSetorPainel(String(row.setor ?? '').trim());
      if (!setor) continue;
      const lista = porSetor.get(setor) ?? [];
      lista.push(row);
      porSetor.set(setor, lista);
    }
    itensMesCache.set(mes, { ts: Date.now(), data: porSetor });
    return porSetor;
  })().finally(() => {
    itensMesInflight.delete(mes);
  });

  itensMesInflight.set(mes, promise);
  return promise;
}

async function carregarItensEncerradosDoSetor(
  mes: string,
  setor: string,
): Promise<ItemEncerradoRow[]> {
  const porSetor = await carregarItensEncerradosDoMes(mes);
  return porSetor.get(canonicalizeSetorPainel(setor)) ?? [];
}

async function carregarAjustesPorMotivo(
  itens: ItemEncerradoRow[],
  motivos: string[],
): Promise<Array<{ ajuste: AjusteRow; item: ItemEncerradoRow }>> {
  const itemPorChave = new Map<string, ItemEncerradoRow>();
  for (const item of itens) {
    itemPorChave.set(`${item.id_pedido}-${item.id_produto}`, item);
  }
  if (itemPorChave.size === 0 || motivos.length === 0) return [];

  const ajustes = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { motivo: { in: motivos } },
    select: {
      id: true,
      id_pedido: true,
      data_ajuste: true,
      motivo: true,
      usuario: true,
      anexoAssinaturaPath: true,
      anexoAssinaturaNome: true,
    },
    orderBy: [{ data_ajuste: 'asc' }, { id: 'asc' }],
  });

  const vinculados: Array<{ ajuste: AjusteRow; item: ItemEncerradoRow }> = [];
  for (const ajuste of ajustes) {
    const item = itemPorChave.get(chavePedidoItem(ajuste.id_pedido));
    if (!item) continue;
    vinculados.push({
      ajuste: {
        id: ajuste.id,
        id_pedido: ajuste.id_pedido,
        data_ajuste: ajuste.data_ajuste,
        motivo: ajuste.motivo,
        usuario: ajuste.usuario,
        anexo_assinatura_path: ajuste.anexoAssinaturaPath ?? null,
        anexo_assinatura_nome: ajuste.anexoAssinaturaNome ?? null,
      },
      item,
    });
  }
  return vinculados;
}

function linhaPedidoProduto(item: ItemEncerradoRow): ApuracaoDetalheLinha {
  const qtde = Number(item.quantidade);
  return {
    pedido: String(item.pd ?? '').trim(),
    cliente: String(item.cliente ?? '').trim() || '—',
    codigo_produto: String(item.codigo_produto ?? '').trim() || '—',
    descricao: String(item.descricao ?? '').trim() || '—',
    quantidade: Number.isFinite(qtde) ? qtde : null,
    status: statusLabel(Number(item.status)),
    data_encerramento: formatDateTimeBr(item.data_encerramento),
  };
}

function ordenarLinhasPorPedido(linhas: ApuracaoDetalheLinha[]): ApuracaoDetalheLinha[] {
  return [...linhas].sort((a, b) => {
    const porPedido = a.pedido.localeCompare(b.pedido, 'pt-BR', { sensitivity: 'base' });
    if (porPedido !== 0) return porPedido;
    const porProduto = a.codigo_produto.localeCompare(b.codigo_produto, 'pt-BR', {
      sensitivity: 'base',
    });
    if (porProduto !== 0) return porProduto;
    return (a.data_alteracao ?? a.data_encerramento ?? '').localeCompare(
      b.data_alteracao ?? b.data_encerramento ?? '',
      'pt-BR',
    );
  });
}

type MontagemInterna = {
  resumo: ApuracaoMetaSetor;
  mediaRuptura: number;
  pedidosComRuptura: number;
  alteracoesRuptura: number;
};

async function apurarSetorMontagem(
  mes: string,
  setor: string,
  considerarPenalizacoes: boolean,
  faixasDesconto: FaixaDescontoInput[],
  motivosMontagem: string[],
  motivosProducao: string[],
  itensPrecarregados?: ItemEncerradoRow[],
): Promise<MontagemInterna> {
  const itens = itensPrecarregados ?? (await carregarItensEncerradosDoSetor(mes, setor));
  const pedidosEncerrados = new Set(itens.map((item) => item.pd)).size;

  const vinculadosEstimativa = await carregarAjustesPorMotivo(
    itens,
    motivosMontagem,
  );
  const pedidosComAlteracao = new Set(vinculadosEstimativa.map(({ item }) => item.pd)).size;
  const alteracoes = vinculadosEstimativa.length;
  const media = calcularMediaAlteracoes(alteracoes, pedidosComAlteracao);
  const penalizacao = considerarPenalizacoes
    ? calcularPenalizacaoQualitativa(media, faixasDesconto)
    : 0;

  const vinculadosRuptura = await carregarAjustesPorMotivo(itens, motivosProducao);
  const pedidosComRuptura = new Set(vinculadosRuptura.map(({ item }) => item.pd)).size;
  const alteracoesRuptura = vinculadosRuptura.length;
  const mediaRuptura = calcularMediaAlteracoes(alteracoesRuptura, pedidosComRuptura);

  const dashboard = await getProducaoResumoApuracao(setor, mes);
  const percentualQuantitativo = Number(dashboard.percentual_meta ?? 0);
  const producaoRealizada = Number(dashboard.producao ?? 0);

  const niveisCadastrados: MetaNiveis = await getMetaNiveis(setor, mes);
  const nivelAtingido = identificarNivelAtingido(producaoRealizada, niveisCadastrados.metas);
  const valorNivel = nivelAtingido ? niveisCadastrados.valores[nivelAtingido] ?? 0 : 0;

  return {
    resumo: {
      area: AREA_MONTAGEM,
      setor,
      mes,
      pedidos_encerrados: pedidosEncerrados,
      pedidos_com_alteracao_nao_abonada: pedidosComAlteracao,
      alteracoes_nao_abonadas: alteracoes,
      media_alteracoes_por_pedido: media,
      meta_quantitativa: Number(dashboard.meta ?? 0),
      producao_realizada: producaoRealizada,
      unidade: String(dashboard.unidade ?? 'un'),
      percentual_meta_quantitativa: percentualQuantitativo,
      percentual_penalizacao_qualitativa: penalizacao,
      meta_atingida: nivelAtingido ?? NIVEL_NAO_ATINGIDO,
      meta_nivel_atingido: nivelAtingido ? niveisCadastrados.metas[nivelAtingido] : null,
      valor_nivel: valorNivel,
      valor_a_pagar: calcularValorAPagar(valorNivel, penalizacao),
      niveis: ORDEM_NIVEIS.map((nivel) => ({
        nivel,
        meta: niveisCadastrados.metas[nivel],
        valor: niveisCadastrados.valores[nivel],
        atingido: nivel === nivelAtingido,
      })),
      motivo_nao_abonado: LABEL_NAO_ABONADO_MONTAGEM,
      cadastro_niveis_completo: niveisCompletos(niveisCadastrados.metas),
      considerar_penalizacoes: considerarPenalizacoes,
    },
    mediaRuptura,
    pedidosComRuptura,
    alteracoesRuptura,
  };
}

function montarParcelasProducao(montagens: MontagemInterna[]): ParcelaProducaoDetalhe[] {
  return montagens.map((m) => {
    const nivel =
      m.resumo.meta_atingida === NIVEL_NAO_ATINGIDO
        ? null
        : (m.resumo.meta_atingida as NivelMeta);
    const considerarPenalizacoes = m.resumo.considerar_penalizacoes !== false;
    const parcela = calcularParcelaProducao(
      nivel,
      m.mediaRuptura,
      m.resumo.percentual_penalizacao_qualitativa,
      considerarPenalizacoes,
    );
    return {
      setor_montagem: m.resumo.setor,
      nivel,
      valor_base: parcela.valorBase,
      pedidos_com_ruptura: m.pedidosComRuptura,
      alteracoes_ruptura: m.alteracoesRuptura,
      media_ruptura: m.mediaRuptura,
      percentual_herdado: parcela.percentualHerdado,
      impacto_producao: parcela.impactoProducao,
      desconto: parcela.desconto,
      parcela_final: parcela.parcelaFinal,
    };
  });
}

function resumoSetorProducao(
  mes: string,
  setor: SetorProducao,
  parcelas: ParcelaProducaoDetalhe[],
): ApuracaoMetaSetor {
  const consolidado = consolidarPerfiladeiras(
    parcelas.map((p) => ({
      nivel: p.nivel,
      parcelaFinal: p.parcela_final,
      valorBase: p.valor_base,
      impactoProducao: p.impacto_producao,
    })),
  );

  return {
    area: AREA_PRODUCAO,
    setor,
    mes,
    pedidos_encerrados: 0,
    pedidos_com_alteracao_nao_abonada: 0,
    alteracoes_nao_abonadas: 0,
    media_alteracoes_por_pedido: 0,
    meta_quantitativa: 0,
    producao_realizada: 0,
    unidade: 'parcelas',
    percentual_meta_quantitativa: 0,
    percentual_penalizacao_qualitativa: 0,
    meta_atingida: consolidado.elegivel
      ? `${consolidado.setoresAtingiram} setores`
      : NIVEL_NAO_ATINGIDO,
    meta_nivel_atingido: null,
    valor_nivel: consolidado.valorBruto,
    valor_a_pagar: consolidado.valorFinal,
    niveis: ORDEM_NIVEIS.map((nivel) => ({
      nivel,
      meta: consolidado.distribuicao[nivel],
      valor: VALOR_UNITARIO_PRODUCAO[nivel],
      atingido: consolidado.distribuicao[nivel] > 0,
    })),
    motivo_nao_abonado: LABEL_NAO_ABONADO_PRODUCAO,
    cadastro_niveis_completo: true,
    setores_atingiram_meta: consolidado.setoresAtingiram,
    distribuicao_niveis: consolidado.distribuicao,
    valor_bruto: consolidado.valorBruto,
    parcelas_penalizadas: consolidado.parcelasPenalizadas,
    elegivel_minimo_setores: consolidado.elegivel,
  };
}

export async function getApuracaoMetas(mes: string): Promise<ApuracaoMetaSetor[]> {
  const [faixasDesconto, motivosMontagem, motivosProducao] = await Promise.all([
    listarFaixasDesconto(mes),
    listarDescricoesNaoAbonadas('montagem'),
    listarDescricoesNaoAbonadas('producao'),
  ]);
  const setores = await listarSetoresMontagemAtivos(mes);

  // 1 query de itens + 1 aquecimento do histórico Nomus (evita stampede N setores).
  const [, itensPorSetor] = await Promise.all([
    warmupPainelProducaoCaches(mes),
    carregarItensEncerradosDoMes(mes),
  ]);

  const montagens = await Promise.all(
    setores.map(async ({ setor }) => {
      const considerar = await getConsiderarPenalizacoes(mes, setor);
      return apurarSetorMontagem(
        mes,
        setor,
        considerar,
        faixasDesconto,
        motivosMontagem,
        motivosProducao,
        itensPorSetor.get(canonicalizeSetorPainel(setor)) ?? [],
      );
    }),
  );
  const linhasMontagem = montagens.map((m) => m.resumo);
  const montagensElegiveis = montagens.filter((m) => m.resumo.cadastro_niveis_completo);
  const parcelas = montarParcelasProducao(montagensElegiveis);
  const linhasProducao = SETORES_PRODUCAO.map((setor) =>
    resumoSetorProducao(mes, setor, parcelas),
  );
  return [...linhasMontagem, ...linhasProducao];
}

/** @deprecated use getApuracaoMetas */
export async function getApuracaoMetaMoveisAco(mes: string): Promise<ApuracaoMetaSetor> {
  const todas = await getApuracaoMetas(mes);
  const moveis = todas.find((r) => r.setor === 'Móveis de aço' && r.area === AREA_MONTAGEM);
  if (!moveis) {
    throw new Error('Setor Móveis de aço não está ativo no período.');
  }
  return moveis;
}

export async function getApuracaoDetalhe(
  mes: string,
  tipo: ApuracaoDetalheTipo,
  setor: string,
): Promise<ApuracaoDetalhePayload> {
  if (tipo === 'producao_realizada') {
    const dashboard = (await getDashboard(setor, mes)) as {
      unidade?: string;
      producao?: number;
      pedidos_detalhe?: Array<{
        codigo_pedido: string;
        cliente: string;
        itens: Array<{ codigo: string; descricao: string }>;
      }>;
    };
    const unidade = String(dashboard.unidade ?? 'un');
    if (unidade !== 'pedidos') {
      return {
        mes,
        setor,
        tipo,
        titulo: 'Produção realizada',
        total: 0,
        linhas: [],
      };
    }
    const pedidos = dashboard.pedidos_detalhe ?? [];
    const linhas: ApuracaoDetalheLinha[] = [];
    for (const pedido of pedidos) {
      const itens = pedido.itens.length > 0 ? pedido.itens : [{ codigo: '—', descricao: '—' }];
      for (const item of itens) {
        linhas.push({
          pedido: pedido.codigo_pedido || '—',
          cliente: pedido.cliente || '—',
          codigo_produto: item.codigo || '—',
          descricao: item.descricao || '—',
          data_encerramento: formatDateTimeBr(
            (pedido as { data_atendimento?: Date | string | null }).data_atendimento ?? null,
          ),
        });
      }
    }
    return {
      mes,
      setor,
      tipo,
      titulo: 'Pedidos contabilizados na produção',
      total: pedidos.length,
      linhas: ordenarLinhasPorPedido(linhas),
    };
  }

  if (tipo === 'memorial_producao' || isSetorProducao(setor)) {
    const setorProducao = isSetorProducao(setor) ? setor : SETOR_PERFILADEIRAS;
    const [faixasDesconto, motivosMontagem, motivosProducao] = await Promise.all([
      listarFaixasDesconto(mes),
      listarDescricoesNaoAbonadas('montagem'),
      listarDescricoesNaoAbonadas('producao'),
    ]);
    const setores = await listarSetoresMontagemAtivos(mes);
    const elegiveis = setores.filter((s) => s.niveisCompletos);
    const [, itensPorSetor] = await Promise.all([
      warmupPainelProducaoCaches(mes),
      carregarItensEncerradosDoMes(mes),
    ]);
    const montagens = await Promise.all(
      elegiveis.map(async ({ setor: setorMontagem }) => {
        const considerar = await getConsiderarPenalizacoes(mes, setorMontagem);
        return apurarSetorMontagem(
          mes,
          setorMontagem,
          considerar,
          faixasDesconto,
          motivosMontagem,
          motivosProducao,
          itensPorSetor.get(canonicalizeSetorPainel(setorMontagem)) ?? [],
        );
      }),
    );
    const parcelas = montarParcelasProducao(montagens);
    const consolidado = consolidarPerfiladeiras(
      parcelas.map((p) => ({
        nivel: p.nivel,
        parcelaFinal: p.parcela_final,
        valorBase: p.valor_base,
        impactoProducao: p.impacto_producao,
      })),
    );
    return {
      mes,
      setor: setorProducao,
      tipo: 'memorial_producao',
      titulo: `Memorial de cálculo — ${setorProducao}`,
      total: parcelas.length,
      linhas: [],
      parcelas,
      valor_bruto: consolidado.valorBruto,
      valor_a_pagar: consolidado.valorFinal,
      elegivel_minimo_setores: consolidado.elegivel,
      min_setores: MIN_SETORES_MONTAGEM_PERFILADEIRAS,
      setores_atingiram_meta: consolidado.setoresAtingiram,
    };
  }

  const itens = await carregarItensEncerradosDoSetor(mes, setor);
  const motivos = await listarDescricoesNaoAbonadas(
    tipo === 'alteracoes_ruptura' ? 'producao' : 'montagem',
  );
  const vinculados = await carregarAjustesPorMotivo(itens, motivos);

  if (tipo === 'pedidos_encerrados') {
    const linhas = ordenarLinhasPorPedido(itens.map(linhaPedidoProduto));
    return {
      mes,
      setor,
      tipo,
      titulo: 'Pedidos atendidos no mês (doc. de saída)',
      total: new Set(itens.map((item) => item.pd)).size,
      linhas,
    };
  }

  if (tipo === 'pedidos_com_alteracao') {
    const vistos = new Set<string>();
    const linhas: ApuracaoDetalheLinha[] = [];
    for (const { item } of vinculados) {
      const chave = `${item.pd}::${item.id_produto}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      linhas.push(linhaPedidoProduto(item));
    }
    return {
      mes,
      setor,
      tipo,
      titulo: 'Pedidos com alteração não abonada',
      total: new Set(vinculados.map(({ item }) => item.pd)).size,
      linhas: ordenarLinhasPorPedido(linhas),
    };
  }

  const linhas = ordenarLinhasPorPedido(
    vinculados.map(({ ajuste, item }) => ({
      ...linhaPedidoProduto(item),
      data_alteracao: formatDateTimeBr(ajuste.data_ajuste),
      motivo: ajuste.motivo,
      usuario: ajuste.usuario,
      anexo_assinatura_path: ajuste.anexo_assinatura_path,
      anexo_assinatura_nome: ajuste.anexo_assinatura_nome,
    })),
  );

  return {
    mes,
    setor,
    tipo,
    titulo:
      tipo === 'alteracoes_ruptura'
        ? 'Alterações por ruptura de PP'
        : 'Alterações não abonadas',
    total: linhas.length,
    linhas,
  };
}

/** @deprecated use getApuracaoDetalhe */
export async function getApuracaoDetalheMoveisAco(
  mes: string,
  tipo: ApuracaoDetalheTipo,
): Promise<ApuracaoDetalhePayload> {
  return getApuracaoDetalhe(mes, tipo, 'Móveis de aço');
}
