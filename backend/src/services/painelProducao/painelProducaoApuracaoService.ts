import { prisma } from '../../config/prisma.js';
import { getNomusPool, nomusQueryWithRetry } from '../../config/nomusDb.js';
import { getDashboard } from './painelProducaoDashboardService.js';
import { getMetaNiveis, type MetaNiveis, type NivelMeta } from './painelProducaoTargetsService.js';

const SETOR_VALIDACAO = 'Móveis de aço';
const MOTIVO_NAO_ABONADO_MONTAGEM =
  'Estimativa de entrega passada pela produção equivocada';
export const NIVEL_NAO_ATINGIDO = 'Não atingida';

export const APURACAO_DETALHE_TIPOS = [
  'pedidos_encerrados',
  'pedidos_com_alteracao',
  'alteracoes',
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
};

type AjusteRow = {
  id: number;
  id_pedido: string;
  data_ajuste: Date;
  motivo: string;
  usuario: string;
};

export type ApuracaoMetaSetor = {
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
};

export type ApuracaoDetalheLinha = {
  pedido: string;
  cliente: string;
  codigo_produto: string;
  descricao: string;
  status?: string;
  data_encerramento?: string | null;
  data_alteracao?: string | null;
  motivo?: string;
  usuario?: string;
};

export type ApuracaoDetalhePayload = {
  mes: string;
  setor: string;
  tipo: ApuracaoDetalheTipo;
  titulo: string;
  total: number;
  linhas: ApuracaoDetalheLinha[];
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

export function calcularPenalizacaoQualitativa(media: number): number {
  if (media > 5) return 40;
  if (media >= 4) return 30;
  if (media >= 2) return 20;
  return 0;
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

async function carregarItensEncerradosDoSetor(mes: string): Promise<ItemEncerradoRow[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus não configurada (NOMUS_DB_URL).');
  const { inicio, fim } = limitesMes(mes);

  const sql = `
    SELECT
      TRIM(pd.nome) AS pd,
      pd.id AS id_pedido,
      p.id AS id_produto,
      pe.nome AS cliente,
      p.nome AS codigo_produto,
      p.descricao AS descricao,
      ip.status AS status,
      ip.dataHoraEncerramento AS data_encerramento
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
    WHERE pd.idEmpresa IN (1, 2)
      AND ip.status IN (4, 5)
      AND TRIM(sp.opcao) = ?
      AND pd.id IN (
        SELECT DISTINCT ip2.idPedido
        FROM itempedido ip2
        INNER JOIN pedido pd2 ON pd2.id = ip2.idPedido
        WHERE pd2.idEmpresa IN (1, 2)
          AND ip2.status IN (4, 5)
          AND ip2.dataHoraEncerramento >= ?
          AND ip2.dataHoraEncerramento < ?
      )
    ORDER BY pd.nome ASC, p.nome ASC, ip.dataHoraEncerramento ASC
  `;

  const [rows] = await nomusQueryWithRetry<ItemEncerradoRow[]>(
    pool,
    sql,
    [SETOR_VALIDACAO, inicio, fim],
  );
  return Array.isArray(rows) ? rows : [];
}

async function carregarAjustesNaoAbonados(
  itens: ItemEncerradoRow[],
): Promise<Array<{ ajuste: AjusteRow; item: ItemEncerradoRow }>> {
  const itemPorChave = new Map<string, ItemEncerradoRow>();
  for (const item of itens) {
    itemPorChave.set(`${item.id_pedido}-${item.id_produto}`, item);
  }
  if (itemPorChave.size === 0) return [];

  const ajustes = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { motivo: MOTIVO_NAO_ABONADO_MONTAGEM },
    select: {
      id: true,
      id_pedido: true,
      data_ajuste: true,
      motivo: true,
      usuario: true,
    },
    orderBy: [{ data_ajuste: 'asc' }, { id: 'asc' }],
  });

  const vinculados: Array<{ ajuste: AjusteRow; item: ItemEncerradoRow }> = [];
  for (const ajuste of ajustes) {
    const item = itemPorChave.get(chavePedidoItem(ajuste.id_pedido));
    if (!item) continue;
    vinculados.push({ ajuste, item });
  }
  return vinculados;
}

function linhaPedidoProduto(item: ItemEncerradoRow): ApuracaoDetalheLinha {
  return {
    pedido: String(item.pd ?? '').trim(),
    cliente: String(item.cliente ?? '').trim() || '—',
    codigo_produto: String(item.codigo_produto ?? '').trim() || '—',
    descricao: String(item.descricao ?? '').trim() || '—',
    status: statusLabel(Number(item.status)),
    data_encerramento: formatDateTimeBr(item.data_encerramento),
  };
}

export async function getApuracaoMetaMoveisAco(
  mes: string,
): Promise<ApuracaoMetaSetor> {
  const itens = await carregarItensEncerradosDoSetor(mes);
  const pedidosEncerrados = new Set(itens.map((item) => item.pd)).size;
  const vinculados = await carregarAjustesNaoAbonados(itens);
  const pedidosComAlteracao = new Set(vinculados.map(({ item }) => item.pd)).size;
  const alteracoes = vinculados.length;
  const media = calcularMediaAlteracoes(alteracoes, pedidosComAlteracao);
  const penalizacao = calcularPenalizacaoQualitativa(media);

  const dashboard = (await getDashboard(SETOR_VALIDACAO, mes)) as {
    meta?: number;
    producao?: number;
    unidade?: string;
    percentual_meta?: number;
  };
  const percentualQuantitativo = Number(dashboard.percentual_meta ?? 0);
  const producaoRealizada = Number(dashboard.producao ?? 0);

  const niveisCadastrados: MetaNiveis = await getMetaNiveis(SETOR_VALIDACAO, mes);
  const nivelAtingido = identificarNivelAtingido(producaoRealizada, niveisCadastrados.metas);
  const valorNivel = nivelAtingido ? niveisCadastrados.valores[nivelAtingido] ?? 0 : 0;

  return {
    setor: SETOR_VALIDACAO,
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
    motivo_nao_abonado: MOTIVO_NAO_ABONADO_MONTAGEM,
  };
}

export async function getApuracaoDetalheMoveisAco(
  mes: string,
  tipo: ApuracaoDetalheTipo,
): Promise<ApuracaoDetalhePayload> {
  const itens = await carregarItensEncerradosDoSetor(mes);
  const vinculados = await carregarAjustesNaoAbonados(itens);

  if (tipo === 'pedidos_encerrados') {
    const linhas = itens.map(linhaPedidoProduto);
    return {
      mes,
      setor: SETOR_VALIDACAO,
      tipo,
      titulo: 'Pedidos encerrados no mês',
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
      setor: SETOR_VALIDACAO,
      tipo,
      titulo: 'Pedidos com alteração não abonada',
      total: new Set(vinculados.map(({ item }) => item.pd)).size,
      linhas,
    };
  }

  const linhas = vinculados.map(({ ajuste, item }) => ({
    ...linhaPedidoProduto(item),
    data_alteracao: formatDateTimeBr(ajuste.data_ajuste),
    motivo: ajuste.motivo,
    usuario: ajuste.usuario,
  }));

  return {
    mes,
    setor: SETOR_VALIDACAO,
    tipo,
    titulo: 'Alterações não abonadas',
    total: linhas.length,
    linhas,
  };
}
