import {
  getField,
  getNumber,
  linhaCarradaKey,
  linhaCodCarrada,
  simItemKey,
  carradaKey,
  hojeISO,
  toISODate,
  valorEfetivo,
  valorEfetivoItem,
  previsaoAtualDaLinha,
  type CarradaBaseline,
  type CarradaDataInvalida,
  type PedidoAlterado,
  type SimEntry,
} from './simulacaoCarradas';
import { isCarradaOrdemFinal } from './sequenciamentoCarradasUtils';
import { isCarradaEmFormacao } from '../../utils/rotaCarrada';
import { statusBadgeFieldsFromRow } from '../../utils/statusPedidoBadges';
import { itemPrevisaoConfiavelEscolhida } from './confirmacaoMotivosUtils';

/** Linha da grade única do modal Concluir (datas + motivos). */
export type LinhaConclusao = {
  key: string;
  idPedido?: string;
  pedido: string;
  cliente: string;
  codigo: string;
  descricao: string;
  carrada: string;
  /** Data de emissão do PD (ISO), quando disponível no snapshot. */
  dataEmissao?: string;
  dataProducao: string;
  dataEntrega: string;
  producaoPassada: boolean;
  entregaPassada: boolean;
  previsaoPassada?: boolean;
  previsaoAtual?: string;
  /** Datas válidas (≥ hoje e entrega ≥ produção). */
  datasOk: boolean;
  qtdePendenteReal: number;
  exigeMotivo: boolean;
  statusPrazo?: string;
  card?: '' | 'Card' | 'Disponível';
  faturado?: boolean;
};

export type MontarLinhasConclusaoOpts = {
  /** Simulação atual — preenche datas efetivas em linhas só-motivo. */
  sim?: Map<string, SimEntry>;
  baseline?: Map<string, CarradaBaseline>;
};

/** Flags de datas para linha do modal Concluir. */
export function calcularFlagsDatasLinha(
  dataProducao: string,
  dataEntrega: string,
  hoje: string = hojeISO()
): {
  producaoPassada: boolean;
  entregaPassada: boolean;
  datasOk: boolean;
} {
  const producaoPassada = !!dataProducao && dataProducao < hoje;
  const entregaPassada = !!dataEntrega && dataEntrega < hoje;
  const ordemOk = !dataProducao || !dataEntrega || dataEntrega >= dataProducao;
  const datasOk =
    !!dataProducao &&
    dataProducao >= hoje &&
    !!dataEntrega &&
    dataEntrega >= hoje &&
    ordemOk;
  return { producaoPassada, entregaPassada, datasOk };
}

function simKeyPedidoAlterado(p: PedidoAlterado): string {
  if (p.chaveSim) return p.chaveSim;
  if (isCarradaOrdemFinal(p.rota)) return simItemKey(p.idPedido);
  return carradaKey(p.cod || '—', p.rota);
}

function emissaoDaLinha(row: Record<string, unknown> | undefined): string {
  if (!row) return '';
  return toISODate(getField(row, ['Emissao', 'emissao']));
}

function rowPorIdPedido(
  linhasSnapshot: Record<string, unknown>[],
  idPedido: string | undefined
): Record<string, unknown> | undefined {
  if (!idPedido) return undefined;
  return linhasSnapshot.find((r) => getField(r, ['id_pedido', 'idChave']) === idPedido);
}

/** Datas efetivas da simulação (item especial ou carrada agregada). */
export function datasEfetivasPedidoAlterado(
  ped: PedidoAlterado,
  linhasSnapshot: Record<string, unknown>[],
  sim?: Map<string, SimEntry>,
  baseline?: Map<string, CarradaBaseline>
): { dataProducao: string; dataEntrega: string } {
  let dataProducao = '';
  let dataEntrega = ped.previsaoNova || '';
  if (!sim) return { dataProducao, dataEntrega };

  const row = rowPorIdPedido(linhasSnapshot, ped.idPedido);
  if (isCarradaOrdemFinal(ped.rota)) {
    if (row) {
      dataProducao = valorEfetivoItem(sim, row, 'dataProducao');
      const ent = valorEfetivoItem(sim, row, 'dataEntrega');
      if (ent) dataEntrega = ent;
    } else {
      const s = sim.get(simItemKey(ped.idPedido));
      if (s?.dataProducao) dataProducao = s.dataProducao;
      if (s?.dataEntrega) dataEntrega = s.dataEntrega;
    }
    return { dataProducao, dataEntrega };
  }

  const key = simKeyPedidoAlterado(ped);
  const bl = baseline ?? new Map<string, CarradaBaseline>();
  dataProducao = valorEfetivo(sim, bl, key, 'dataProducao');
  const ent = valorEfetivo(sim, bl, key, 'dataEntrega');
  if (ent) dataEntrega = ent;
  return { dataProducao, dataEntrega };
}

function linhaFromInvalidaItem(
  inv: CarradaDataInvalida,
  ped: PedidoAlterado | undefined,
  dataEmissao = ''
): LinhaConclusao {
  return {
    key: inv.key,
    idPedido: inv.idPedido,
    pedido: inv.pedido ?? ped?.pd ?? '—',
    cliente: inv.cliente ?? ped?.cliente ?? '',
    codigo: inv.codigoProduto || inv.cod || ped?.cod || '—',
    descricao: inv.descricaoProduto || ped?.descricao || '',
    carrada: inv.carrada,
    dataEmissao,
    dataProducao: inv.dataProducao,
    dataEntrega: inv.dataEntrega,
    producaoPassada: !!inv.producaoPassada,
    entregaPassada: !!inv.entregaPassada,
    previsaoPassada: inv.previsaoPassada,
    previsaoAtual: inv.previsaoAtual,
    datasOk: !!inv.concluida,
    qtdePendenteReal: ped?.qtdePendenteReal ?? inv.qtdePendenteReal ?? 0,
    exigeMotivo: !!inv.idPedido || !!ped,
    statusPrazo: inv.statusPrazo,
    card: inv.card,
    faturado: inv.faturado,
  };
}

/**
 * Carrada agregada (ROTA …) sem idPedido → explode nos itens do snapshot
 * para Motivo/Qtde por pedido (evita linha “—” com qtde 0).
 */
function expandirItensDaCarrada(
  inv: CarradaDataInvalida,
  linhasSnapshot: Record<string, unknown>[],
  pedById: Map<string, PedidoAlterado>
): LinhaConclusao[] {
  const out: LinhaConclusao[] = [];
  for (const row of linhasSnapshot) {
    const { carrada } = linhaCodCarrada(row);
    if (isCarradaOrdemFinal(carrada) || isCarradaEmFormacao(carrada)) continue;
    if (linhaCarradaKey(row) !== inv.key) continue;
    const idPedido = getField(row, ['id_pedido', 'idChave']);
    if (!idPedido) continue;
    const qtde = getNumber(row, ['Qtde Pendente Real', 'qtde pendente real']);
    if (qtde === 0) continue;
    const ped = pedById.get(idPedido);
    const badges = statusBadgeFieldsFromRow(row);
    out.push({
      key: inv.key,
      idPedido,
      pedido: getField(row, ['PD', 'pd']) || ped?.pd || '—',
      cliente: getField(row, ['Cliente', 'cliente']) || ped?.cliente || '',
      codigo: getField(row, ['Cod', 'cod']) || ped?.cod || '—',
      descricao:
        getField(row, ['Descricao do produto', 'Descrição do produto']) || ped?.descricao || '',
      carrada: inv.carrada,
      dataEmissao: emissaoDaLinha(row),
      dataProducao: inv.dataProducao,
      dataEntrega: inv.dataEntrega,
      producaoPassada: !!inv.producaoPassada,
      entregaPassada: !!inv.entregaPassada,
      previsaoPassada: inv.previsaoPassada,
      previsaoAtual: inv.previsaoAtual,
      datasOk: !!inv.concluida,
      qtdePendenteReal: ped?.qtdePendenteReal ?? qtde,
      exigeMotivo: true,
      statusPrazo: badges.statusPrazo,
      card: badges.card,
      faturado: badges.faturado,
    });
  }
  return out;
}

/**
 * Ordenação padrão do modal Concluir: produção → carrada → pedido → descrição.
 */
export function compararLinhasConclusao(a: LinhaConclusao, b: LinhaConclusao): number {
  const prodA = a.dataProducao || '9999-12-31';
  const prodB = b.dataProducao || '9999-12-31';
  if (prodA !== prodB) return prodA.localeCompare(prodB);
  const carr = a.carrada.localeCompare(b.carrada, 'pt-BR', { sensitivity: 'base' });
  if (carr !== 0) return carr;
  const pd = a.pedido.localeCompare(b.pedido, 'pt-BR', { numeric: true });
  if (pd !== 0) return pd;
  return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Une datas vencidas + pedidos com previsão alterada numa grade plana.
 * Carradas agregadas (sem idPedido) são expandidas nos itens do snapshot.
 * Com `opts.sim`, linhas só-motivo recebem as datas efetivas da simulação.
 */
export function montarLinhasConclusao(
  invalidas: CarradaDataInvalida[],
  pedidosEntrega: PedidoAlterado[],
  linhasSnapshot: Record<string, unknown>[] = [],
  opts?: MontarLinhasConclusaoOpts
): LinhaConclusao[] {
  const pedById = new Map(pedidosEntrega.map((p) => [p.idPedido, p]));
  const usados = new Set<string>();
  const out: LinhaConclusao[] = [];

  for (const inv of invalidas) {
    if (inv.idPedido) {
      usados.add(inv.idPedido);
      const row = rowPorIdPedido(linhasSnapshot, inv.idPedido);
      out.push(linhaFromInvalidaItem(inv, pedById.get(inv.idPedido), emissaoDaLinha(row)));
      continue;
    }

    const filhos = expandirItensDaCarrada(inv, linhasSnapshot, pedById);
    if (filhos.length > 0) {
      for (const f of filhos) {
        if (f.idPedido) usados.add(f.idPedido);
        out.push(f);
      }
      continue;
    }

    out.push(linhaFromInvalidaItem(inv, undefined));
  }

  for (const ped of pedidosEntrega) {
    if (usados.has(ped.idPedido)) continue;
    const row = rowPorIdPedido(linhasSnapshot, ped.idPedido);
    const { dataProducao, dataEntrega } = datasEfetivasPedidoAlterado(
      ped,
      linhasSnapshot,
      opts?.sim,
      opts?.baseline
    );
    const flags = calcularFlagsDatasLinha(dataProducao, dataEntrega);
    out.push({
      key: simKeyPedidoAlterado(ped),
      idPedido: ped.idPedido,
      pedido: ped.pd,
      cliente: ped.cliente,
      codigo: ped.cod || '—',
      descricao: ped.descricao || '',
      carrada: ped.rota,
      dataEmissao: emissaoDaLinha(row),
      dataProducao,
      dataEntrega,
      producaoPassada: flags.producaoPassada,
      entregaPassada: flags.entregaPassada,
      datasOk: flags.datasOk,
      qtdePendenteReal: ped.qtdePendenteReal,
      exigeMotivo: true,
    });
  }

  return out;
}

/** Item cuja única alteração é a escolha de "Previsão confiável" (sem mudança de entrega). */
export type ItemConfiavelSo = {
  idPedido: string;
  confiavel: boolean;
  /** Previsão efetiva enviada ao Gerenciador na confirmação (`confirmacao_data`). */
  previsao: string;
  /** Rota/carrada da linha (override por rota no ajuste). */
  rota: string;
  /** PD para identificar a linha em mensagens de erro. */
  pd: string;
};

/**
 * Pedidos com escolha de "Previsão confiável" divergente do snapshot e SEM mudança
 * de entrega (o lote rejeita data igual — vão pelo endpoint unitário com
 * `confirmacao_data`).
 *
 * Regras:
 * - Carradas em formação ficam de fora: datas não são gerenciadas nesta tela e a
 *   previsão antiga da linha poderia conflitar com a produção do Gerenciador.
 * - Carrada normal usa a data efetiva da carrada (sim/baseline), igual à grade;
 *   carrada especial (ordem final) usa a data efetiva do item.
 */
export function computarIdsConfiavelSo(
  previsaoConfiavelPorId: Record<string, boolean | null>,
  idsEntrega: Set<string>,
  linhasSnapshot: Record<string, unknown>[],
  sim: Map<string, SimEntry>,
  baseline: Map<string, CarradaBaseline>
): ItemConfiavelSo[] {
  const out: ItemConfiavelSo[] = [];
  for (const [idPedido, valor] of Object.entries(previsaoConfiavelPorId)) {
    if (valor !== true && valor !== false) continue;
    if (idsEntrega.has(idPedido)) continue;
    const row = rowPorIdPedido(linhasSnapshot, idPedido);
    if (!row) continue;
    if (row['previsao_atual_confiavel'] === valor) continue;
    const { carrada } = linhaCodCarrada(row);
    if (isCarradaEmFormacao(carrada)) continue;
    const previsao = isCarradaOrdemFinal(carrada)
      ? valorEfetivoItem(sim, row, 'dataEntrega') || previsaoAtualDaLinha(row)
      : valorEfetivo(sim, baseline, linhaCarradaKey(row), 'dataEntrega') ||
        previsaoAtualDaLinha(row);
    if (!previsao) continue;
    out.push({
      idPedido,
      confiavel: valor,
      previsao,
      rota: carrada,
      pd: getField(row, ['PD', 'pd']) || idPedido,
    });
  }
  return out;
}

/** Linha pronta para o filtro Concluídos (datas ok + motivo/confiável quando exigidos). */
export function linhaConclusaoPronta(
  l: LinhaConclusao,
  motivoPorId: Record<string, string>,
  previsaoConfiavelPorId: Record<string, boolean | null>
): boolean {
  if (!l.datasOk) return false;
  if (!l.exigeMotivo || !l.idPedido) return true;
  return (
    !!motivoPorId[l.idPedido]?.trim() &&
    itemPrevisaoConfiavelEscolhida(l.idPedido, previsaoConfiavelPorId)
  );
}
