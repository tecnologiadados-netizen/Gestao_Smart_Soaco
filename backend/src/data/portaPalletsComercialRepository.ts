/**
 * Indicadores comerciais de porta-pallets (venda, não faturamento).
 *
 * Grupo de produto Nomus "Porta Paletes" (id 64): acessórios e produto acabado.
 * Proposta e pedido saem do mesmo recorte, para a grade mensal e o detalhe baterem.
 */
import { formatNomusErroConexao, isNomusEnabled, queryNomus } from '../config/nomusDb.js';

const ID_GRUPO = 64;
const ID_EMPRESA = 1;
const ID_TIPO_PEDIDO_ESTOQUE = 5;
const ID_ATRIBUTO_REQ_LOJA = 313;
const MES_INICIO = '2018-01';
/** Distância máxima, em dias, entre a criação do cadastro e o primeiro contato para o cliente contar como novo. */
export const JANELA_CLIENTE_NOVO_DIAS = 7;

const SQL_VENDA = `
venda AS (
  SELECT
    p.id AS idPedido,
    p.nome AS codigoPedido,
    DATE_FORMAT(p.dataEmissao, '%Y-%m-%d') AS dataEmissao,
    DATE_FORMAT(p.dataEmissao, '%Y-%m') AS mes,
    CASE WHEN p.idCliente IS NULL THEN -p.id ELSE p.idCliente END AS idCliente,
    COALESCE(NULLIF(TRIM(pec.nomeRazaoSocial), ''), NULLIF(TRIM(pec.nome), ''), '—') AS cliente,
    DATE_FORMAT(pec.dataCriacao, '%Y-%m-%d') AS dataCadastroCliente,
    ip.id AS idItem,
    CASE WHEN ip.idItemProposta IS NULL THEN 0 ELSE 1 END AS deProposta,
    pr.nome AS codigoProduto,
    pr.descricao AS descricaoProduto,
    ROUND(
      CASE
        WHEN ip.status = 5 AND ip.encerrado = 1
          THEN COALESCE(ml.qtdeLiquida, 0) * (ip.valorTotalComDesconto / NULLIF(ip.qtde, 0))
        ELSE ip.valorTotalComDesconto
      END,
      2
    ) AS valorVendido
  FROM itempedido ip
  JOIN pedido p ON p.id = ip.idPedido
  JOIN produto pr ON pr.id = ip.idProduto
  LEFT JOIN pessoa pec ON pec.id = p.idCliente
  LEFT JOIN movimento_liquido ml ON ml.idItemPedido = ip.id
  WHERE p.idEmpresa = ${ID_EMPRESA}
    AND pr.idGrupoProduto = ${ID_GRUPO}
    AND p.idTipoPedido <> ${ID_TIPO_PEDIDO_ESTOQUE}
    AND ip.status <> 6
    AND NOT EXISTS (
      SELECT 1
      FROM atributopedidovalor apv
      JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idPedido = p.id
        AND apv.idAtributo = ${ID_ATRIBUTO_REQ_LOJA}
        AND alo.opcao = 'Sim'
    )
)`;

const SQL_MOVIMENTO = `
movimento_liquido AS (
  SELECT
    ide.idItemPedidoVenda AS idItemPedido,
    SUM(
      CASE
        WHEN tm.id IN (6, 21, 27, 45, 54, 59, 62, 64, 74, 83, 92, 93, 108) THEN ide.qtde
        WHEN tm.id IN (52, 55) THEN -ide.qtde
        ELSE 0
      END
    ) AS qtdeLiquida
  FROM itemdocumentoestoque_itempedidovenda ide
  JOIN itemdocumentoestoque idoc ON idoc.id = ide.idItemDocumentoEstoque
  JOIN documentoestoque de ON de.id = idoc.idDocumentoEstoque
  JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
  JOIN itempedido ip ON ip.id = ide.idItemPedidoVenda
  JOIN pedido p ON p.id = ip.idPedido
  JOIN produto pr ON pr.id = ip.idProduto
  WHERE pr.idGrupoProduto = ${ID_GRUPO}
    AND p.idEmpresa = ${ID_EMPRESA}
    AND p.idTipoPedido <> ${ID_TIPO_PEDIDO_ESTOQUE}
    AND NOT EXISTS (
      SELECT 1
      FROM nfe n
      WHERE n.idDocumentoEstoque = de.id
        AND n.dataHoraCancelamento IS NOT NULL
    )
  GROUP BY ide.idItemPedidoVenda
)`;

const SQL_VINCULO_PROPOSTA_PEDIDO = `
SELECT DISTINCT
  ip.idProposta,
  ped.id AS idPedido,
  ped.nome AS codigoPedido,
  DATE_FORMAT(ped.dataEmissao, '%Y-%m-%d') AS dataEmissao
FROM itempedido ipe
JOIN itemproposta ip ON ip.id = ipe.idItemProposta
JOIN proposta prp ON prp.id = ip.idProposta
JOIN produto pr ON pr.id = ip.idProduto
JOIN pedido ped ON ped.id = ipe.idPedido
WHERE prp.idEmpresa = ${ID_EMPRESA}
  AND pr.idGrupoProduto = ${ID_GRUPO}`;

const SQL_PROPOSTA = `
pedido_do_item AS (
  SELECT
    ipe.idItemProposta,
    GROUP_CONCAT(DISTINCT ped.nome ORDER BY ped.dataEmissao, ped.id SEPARATOR ', ') AS codigosPedido,
    DATE_FORMAT(MIN(ped.dataEmissao), '%Y-%m-%d') AS dataPrimeiroPedido
  FROM itempedido ipe
  JOIN pedido ped ON ped.id = ipe.idPedido
  WHERE ipe.idItemProposta IS NOT NULL
  GROUP BY ipe.idItemProposta
),
proposta_item AS (
  SELECT
    prp.id AS idProposta,
    prp.nome AS codigoProposta,
    DATE_FORMAT(prp.dataAbertura, '%Y-%m-%d') AS dataAbertura,
    DATE_FORMAT(prp.dataAbertura, '%Y-%m') AS mes,
    CASE WHEN prp.idCliente IS NULL THEN -(1000000000 + prp.id) ELSE prp.idCliente END AS idCliente,
    COALESCE(NULLIF(TRIM(pec.nomeRazaoSocial), ''), NULLIF(TRIM(pec.nome), ''), '—') AS cliente,
    DATE_FORMAT(pec.dataCriacao, '%Y-%m-%d') AS dataCadastroCliente,
    ip.id AS idItem,
    pr.nome AS codigoProduto,
    pr.descricao AS descricaoProduto,
    ROUND(COALESCE(ip.valorTotalComDesconto, 0), 2) AS valor,
    ip.status AS statusItem,
    COALESCE(mr.nome, '') AS motivoRejeicao,
    COALESCE(pd.codigosPedido, '') AS codigosPedido,
    pd.dataPrimeiroPedido AS dataPrimeiroPedido
  FROM itemproposta ip
  JOIN proposta prp ON prp.id = ip.idProposta
  JOIN produto pr ON pr.id = ip.idProduto
  LEFT JOIN pessoa pec ON pec.id = prp.idCliente
  LEFT JOIN motivorejeicaoitemproposta mr ON mr.id = ip.idRejeicao
  LEFT JOIN pedido_do_item pd ON pd.idItemProposta = ip.id
  WHERE prp.idEmpresa = ${ID_EMPRESA}
    AND pr.idGrupoProduto = ${ID_GRUPO}
    AND prp.dataAbertura < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
)`;

export type IndicadorPortaPallets =
  | 'propostas'
  | 'pedidos'
  | 'clientes'
  | 'primeira'
  | 'conversao'
  | 'tempo'
  | 'pedidos_gerados'
  | 'clientes_com_pedido'
  | 'clientes_total'
  | 'clientes_novos'
  | 'novos_com_pedido';

export interface LinhaPropostaItem {
  idItem: number;
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  mes: string;
  idCliente: number;
  cliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valor: number;
  statusItem: number;
  statusLabel: string;
  motivoRejeicao: string;
  codigosPedido: string;
  dataPrimeiroPedido: string;
  propostaConvertida: boolean;
  dias: number | null;
}

export interface LinhaPedidoItem {
  idItem: number;
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  mes: string;
  idCliente: number;
  cliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
  primeiraCompra: boolean;
  pedidoDeProposta: boolean;
}

export interface LinhaClienteMes {
  idCliente: number;
  cliente: string;
  qtdPedidos: number;
  valor: number;
}

export interface LinhaClienteFunil {
  idCliente: number;
  cliente: string;
  dataCadastro: string;
  primeiroContato: string;
  diasCadastroAteContato: number | null;
  novo: boolean;
  qtdPropostas: number;
  qtdPedidos: number;
  valorVendido: number;
}

export interface VinculoPropostaPedido {
  idProposta: number;
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
}

export interface LinhaPedidoGerado {
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  cliente: string;
  propostasOrigem: string;
  valorVendido: number;
  contaNaVenda: boolean;
}

/** Diferença entre os pedidos do card Valor vendido (emitidos no recorte) e os do funil (gerados pelas propostas do recorte). */
export interface ConciliacaoPedidos {
  pedidosCard: number;
  pedidosFunil: number;
  /** No card e fora do funil: pedido sem item ligado a proposta. */
  semProposta: number;
  /** No card e fora do funil: pedido de proposta aberta antes do recorte. */
  propostaAnterior: number;
  /** No funil e fora do card: pedido gerado que não entra na venda (ex.: item cancelado). */
  geradosForaDaVenda: number;
  /** No funil e fora do card: pedido gerado emitido depois do recorte. */
  geradosForaDoPeriodo: number;
}

export interface FunilPortaPallets {
  propostas: number;
  valorPropostas: number;
  convertidas: number;
  pedidosGerados: number;
  valorPedidosGerados: number;
  conciliacao: ConciliacaoPedidos;
  tempoMedioDias: number | null;
  clientesTotal: number;
  clientesComPedido: number;
  clientesNovos: number;
  novosComPedido: number;
}

export interface LinhaConversaoMes {
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  cliente: string;
  valor: number;
  convertida: boolean;
  codigosPedido: string;
  dataPrimeiroPedido: string;
  dias: number | null;
}

export interface MesPortaPallets {
  mes: string;
  qtdPropostas: number;
  valorPropostas: number;
  qtdConvertidas: number;
  /** Pedidos gerados pelas propostas abertas no mês (mesma regra do funil). */
  qtdPedidosGerados: number;
  valorPedidosGerados: number;
  qtdPedidos: number;
  valorVendido: number;
  qtdClientes: number;
  qtdPrimeiraCompra: number;
  ticketMedio: number | null;
  taxaConversao: number | null;
  tempoMedioDias: number | null;
}

export interface PortaPalletsMensal {
  grupo: string;
  desde: string;
  ate: string;
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  funil: FunilPortaPallets;
  erro?: string;
}

export type DetalhePortaPallets =
  | { indicador: 'propostas'; rows: LinhaPropostaItem[] }
  | { indicador: 'pedidos'; rows: LinhaPedidoItem[] }
  | { indicador: 'pedidos_gerados'; rows: LinhaPedidoGerado[] }
  | { indicador: 'clientes' | 'primeira'; rows: LinhaClienteMes[] }
  | { indicador: 'conversao' | 'tempo'; rows: LinhaConversaoMes[] }
  | {
      indicador: 'clientes_total' | 'clientes_com_pedido' | 'clientes_novos' | 'novos_com_pedido';
      rows: LinhaClienteFunil[];
    };

type CacheBase = {
  at: number;
  propostas: LinhaPropostaItem[];
  pedidos: LinhaPedidoItem[];
  vinculos: VinculoPropostaPedido[];
};

let cache: CacheBase | null = null;
const CACHE_MS = 60_000;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function rotuloStatusProposta(status: number): string {
  switch (status) {
    case 2:
      return 'Em aberto';
    case 6:
      return 'Pedido gerado';
    case 7:
      return 'Rejeitado';
    default:
      return `Status ${status}`;
  }
}

function diasEntre(inicio: string, fim: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return null;
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function mesAtual(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function mesValido(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}$/.test(v);
}

function limitarMes(v: string, min: string, max: string): string {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function mesesDoRecorte(desde: string, ate: string): string[] {
  const ini = limitarMes(mesValido(desde) ? desde : MES_INICIO, MES_INICIO, ate);
  const fim = limitarMes(mesValido(ate) ? ate : mesAtual(), ini, mesAtual());
  const [anoIni, mesIni] = ini.split('-').map(Number);
  const [anoFim, mesFim] = fim.split('-').map(Number);
  const out: string[] = [];
  for (let y = anoIni ?? 2018; y <= (anoFim ?? 2018); y++) {
    const primeiro = y === anoIni ? (mesIni ?? 1) : 1;
    const ultimo = y === anoFim ? (mesFim ?? 12) : 12;
    for (let m = primeiro; m <= ultimo; m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

function mesNoRecorte(mes: string, desde: string, ate: string): boolean {
  return mes >= desde && mes <= ate;
}

function mapProposta(row: Record<string, unknown>, diasPorProposta: Map<number, number | null>, convertidas: Set<number>): LinhaPropostaItem {
  const idProposta = num(row.idProposta);
  return {
    idItem: num(row.idItem),
    idProposta,
    codigoProposta: str(row.codigoProposta),
    dataAbertura: str(row.dataAbertura),
    mes: str(row.mes),
    idCliente: num(row.idCliente),
    cliente: str(row.cliente) || '—',
    dataCadastroCliente: str(row.dataCadastroCliente),
    codigoProduto: str(row.codigoProduto),
    descricaoProduto: str(row.descricaoProduto),
    valor: round2(num(row.valor)),
    statusItem: num(row.statusItem),
    statusLabel: rotuloStatusProposta(num(row.statusItem)),
    motivoRejeicao: str(row.motivoRejeicao),
    codigosPedido: str(row.codigosPedido),
    dataPrimeiroPedido: str(row.dataPrimeiroPedido),
    propostaConvertida: convertidas.has(idProposta),
    dias: diasPorProposta.get(idProposta) ?? null,
  };
}

function enriquecerPropostas(rows: Record<string, unknown>[]): LinhaPropostaItem[] {
  const primeiraData = new Map<number, string>();
  const convertidas = new Set<number>();
  for (const row of rows) {
    const id = num(row.idProposta);
    const dataPedido = str(row.dataPrimeiroPedido);
    if (!dataPedido) continue;
    convertidas.add(id);
    const atual = primeiraData.get(id);
    if (!atual || dataPedido < atual) primeiraData.set(id, dataPedido);
  }
  const diasPorProposta = new Map<number, number | null>();
  const abertura = new Map<number, string>();
  for (const row of rows) abertura.set(num(row.idProposta), str(row.dataAbertura));
  for (const [id, dataPedido] of primeiraData) {
    diasPorProposta.set(id, diasEntre(abertura.get(id) ?? '', dataPedido));
  }
  return rows.map((row) => mapProposta(row, diasPorProposta, convertidas));
}

function enriquecerPedidos(rows: Record<string, unknown>[]): LinhaPedidoItem[] {
  const primeira = new Map<number, string>();
  const pedidosDeProposta = new Set<number>();
  for (const row of rows) {
    const id = num(row.idCliente);
    const mes = str(row.mes);
    const atual = primeira.get(id);
    if (!atual || mes < atual) primeira.set(id, mes);
    if (num(row.deProposta) === 1) pedidosDeProposta.add(num(row.idPedido));
  }
  return rows.map((row) => {
    const idCliente = num(row.idCliente);
    const mes = str(row.mes);
    return {
      idItem: num(row.idItem),
      idPedido: num(row.idPedido),
      codigoPedido: str(row.codigoPedido),
      dataEmissao: str(row.dataEmissao),
      mes,
      idCliente,
      cliente: str(row.cliente) || '—',
      dataCadastroCliente: str(row.dataCadastroCliente),
      codigoProduto: str(row.codigoProduto),
      descricaoProduto: str(row.descricaoProduto),
      valorVendido: round2(num(row.valorVendido)),
      primeiraCompra: primeira.get(idCliente) === mes,
      pedidoDeProposta: pedidosDeProposta.has(num(row.idPedido)),
    };
  });
}

async function carregarBase(refresh: boolean): Promise<CacheBase> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  if (!isNomusEnabled()) throw new Error('NOMUS_DB_URL não configurado');

  const [propostasRaw] = await queryNomus<Record<string, unknown>[]>(
    `WITH ${SQL_PROPOSTA}
     SELECT idItem, idProposta, codigoProposta, dataAbertura, mes, idCliente, cliente, dataCadastroCliente,
            codigoProduto, descricaoProduto,
            valor, statusItem, motivoRejeicao, codigosPedido, dataPrimeiroPedido
     FROM proposta_item`
  );
  const [pedidosRaw] = await queryNomus<Record<string, unknown>[]>(
    `WITH ${SQL_MOVIMENTO}, ${SQL_VENDA}
     SELECT idItem, idPedido, codigoPedido, dataEmissao, mes, idCliente, cliente, dataCadastroCliente, deProposta,
            codigoProduto, descricaoProduto, valorVendido
     FROM venda`
  );
  const [vinculosRaw] = await queryNomus<Record<string, unknown>[]>(SQL_VINCULO_PROPOSTA_PEDIDO);
  cache = {
    at: Date.now(),
    propostas: enriquecerPropostas(propostasRaw),
    pedidos: enriquecerPedidos(pedidosRaw),
    vinculos: vinculosRaw.map((row) => ({
      idProposta: num(row.idProposta),
      idPedido: num(row.idPedido),
      codigoPedido: str(row.codigoPedido),
      dataEmissao: str(row.dataEmissao),
    })),
  };
  return cache;
}

function vazio(mes: string): MesPortaPallets {
  return {
    mes,
    qtdPropostas: 0,
    valorPropostas: 0,
    qtdConvertidas: 0,
    qtdPedidosGerados: 0,
    valorPedidosGerados: 0,
    qtdPedidos: 0,
    valorVendido: 0,
    qtdClientes: 0,
    qtdPrimeiraCompra: 0,
    ticketMedio: null,
    taxaConversao: null,
    tempoMedioDias: null,
  };
}

function fecharMes(mes: MesPortaPallets, somaDias: number, qtdPares: number): MesPortaPallets {
  const valorPropostas = round2(mes.valorPropostas);
  const valorVendido = round2(mes.valorVendido);
  return {
    ...mes,
    valorPropostas,
    valorVendido,
    ticketMedio: mes.qtdPedidos > 0 ? round2(valorVendido / mes.qtdPedidos) : null,
    taxaConversao: mes.qtdPropostas > 0 ? mes.qtdConvertidas / mes.qtdPropostas : null,
    tempoMedioDias: qtdPares > 0 ? round1(somaDias / qtdPares) : null,
  };
}

export function agregarMeses(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[],
  ate: string,
  desde = MES_INICIO
): {
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
} {
  const porMes = new Map<string, MesPortaPallets>();
  const dias = new Map<string, { soma: number; qtd: number }>();
  for (const mes of mesesDoRecorte(desde, ate)) {
    porMes.set(mes, vazio(mes));
    dias.set(mes, { soma: 0, qtd: 0 });
  }

  const propostasVistas = new Set<string>();
  for (const item of propostas) {
    const alvo = porMes.get(item.mes);
    if (!alvo) continue;
    alvo.valorPropostas += item.valor;
    const chave = `${item.mes}|${item.idProposta}`;
    if (propostasVistas.has(chave)) continue;
    propostasVistas.add(chave);
    alvo.qtdPropostas += 1;
    if (item.propostaConvertida) {
      alvo.qtdConvertidas += 1;
      if (item.dias != null) {
        const acc = dias.get(item.mes)!;
        acc.soma += item.dias;
        acc.qtd += 1;
      }
    }
  }

  const pedidosVistos = new Set<string>();
  const clientesVistos = new Set<string>();
  const primeiraVista = new Set<string>();
  for (const item of pedidos) {
    const alvo = porMes.get(item.mes);
    if (!alvo) continue;
    alvo.valorVendido += item.valorVendido;
    const chavePedido = `${item.mes}|${item.idPedido}`;
    if (!pedidosVistos.has(chavePedido)) {
      pedidosVistos.add(chavePedido);
      alvo.qtdPedidos += 1;
    }
    const chaveCliente = `${item.mes}|${item.idCliente}`;
    if (!clientesVistos.has(chaveCliente)) {
      clientesVistos.add(chaveCliente);
      alvo.qtdClientes += 1;
      if (item.primeiraCompra && !primeiraVista.has(chaveCliente)) {
        primeiraVista.add(chaveCliente);
        alvo.qtdPrimeiraCompra += 1;
      }
    }
  }

  const meses = [...porMes.values()].map((mes) => {
    const acc = dias.get(mes.mes) ?? { soma: 0, qtd: 0 };
    return fecharMes(mes, acc.soma, acc.qtd);
  });

  const total = vazio('total');
  let somaDias = 0;
  let qtdPares = 0;
  const clientesPeriodo = new Set<number>();
  for (const mes of meses) {
    total.qtdPropostas += mes.qtdPropostas;
    total.valorPropostas += mes.valorPropostas;
    total.qtdConvertidas += mes.qtdConvertidas;
    total.qtdPedidos += mes.qtdPedidos;
    total.valorVendido += mes.valorVendido;
    total.qtdPrimeiraCompra += mes.qtdPrimeiraCompra;
    const acc = dias.get(mes.mes);
    if (acc) {
      somaDias += acc.soma;
      qtdPares += acc.qtd;
    }
  }
  for (const item of pedidos) {
    if (porMes.has(item.mes)) clientesPeriodo.add(item.idCliente);
  }
  total.qtdClientes = clientesPeriodo.size;
  return { meses, totais: fecharMes(total, somaDias, qtdPares) };
}

function clientesDoMes(pedidos: LinhaPedidoItem[], desde: string, ate: string, soPrimeira: boolean): LinhaClienteMes[] {
  const map = new Map<number, LinhaClienteMes>();
  for (const item of pedidos) {
    if (!mesNoRecorte(item.mes, desde, ate)) continue;
    if (soPrimeira && !item.primeiraCompra) continue;
    const atual = map.get(item.idCliente) ?? {
      idCliente: item.idCliente,
      cliente: item.cliente,
      qtdPedidos: 0,
      valor: 0,
    };
    atual.valor += item.valorVendido;
    map.set(item.idCliente, atual);
  }
  const pedidosPorCliente = new Map<number, Set<number>>();
  for (const item of pedidos) {
    if (!mesNoRecorte(item.mes, desde, ate)) continue;
    if (soPrimeira && !item.primeiraCompra) continue;
    const set = pedidosPorCliente.get(item.idCliente) ?? new Set<number>();
    set.add(item.idPedido);
    pedidosPorCliente.set(item.idCliente, set);
  }
  for (const [id, linha] of map) {
    linha.qtdPedidos = pedidosPorCliente.get(id)?.size ?? 0;
    linha.valor = round2(linha.valor);
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

function conversoesDoMes(propostas: LinhaPropostaItem[], desde: string, ate: string, soConvertidas: boolean): LinhaConversaoMes[] {
  const map = new Map<number, LinhaConversaoMes>();
  for (const item of propostas) {
    if (!mesNoRecorte(item.mes, desde, ate)) continue;
    const atual = map.get(item.idProposta) ?? {
      idProposta: item.idProposta,
      codigoProposta: item.codigoProposta,
      dataAbertura: item.dataAbertura,
      cliente: item.cliente,
      valor: 0,
      convertida: item.propostaConvertida,
      codigosPedido: '',
      dataPrimeiroPedido: item.dataPrimeiroPedido,
      dias: item.dias,
    };
    atual.valor += item.valor;
    if (item.codigosPedido) {
      const codigos = new Set(atual.codigosPedido.split(', ').filter(Boolean));
      for (const codigo of item.codigosPedido.split(', ')) if (codigo) codigos.add(codigo);
      atual.codigosPedido = [...codigos].join(', ');
    }
    if (item.dataPrimeiroPedido && (!atual.dataPrimeiroPedido || item.dataPrimeiroPedido < atual.dataPrimeiroPedido)) {
      atual.dataPrimeiroPedido = item.dataPrimeiroPedido;
    }
    map.set(item.idProposta, atual);
  }
  const rows = [...map.values()];
  for (const linha of rows) linha.valor = round2(linha.valor);
  const filtradas = soConvertidas ? rows.filter((r) => r.convertida) : rows;
  return filtradas.sort((a, b) => a.dataAbertura.localeCompare(b.dataAbertura) || a.codigoProposta.localeCompare(b.codigoProposta));
}

/**
 * Cliente novo: o cadastro (pessoa.dataCriacao) foi criado perto do primeiro contato de porta-pallet,
 * ou seja, o vendedor precisou cadastrar o cliente para atendê-lo. Esse primeiro contato precisa cair no recorte.
 * Sem data de cadastro (anteriores a abr/2018) ou sem cliente, não conta como novo.
 */
export function clienteNovo(
  dataCadastro: string,
  primeiroContato: string,
  desde: string,
  ate: string,
  janelaDias = JANELA_CLIENTE_NOVO_DIAS
): { novo: boolean; dias: number | null } {
  const dias = diasEntre(dataCadastro, primeiroContato);
  if (dias == null) return { novo: false, dias: null };
  const contatoNoRecorte = mesNoRecorte(primeiroContato.slice(0, 7), desde, ate);
  return { novo: contatoNoRecorte && Math.abs(dias) <= janelaDias, dias };
}

/**
 * Clientes das propostas abertas no recorte. Pedidos e valor contam só os pedidos gerados por essas propostas,
 * como no funil; pedido sem proposta ou de proposta anterior ao recorte não entra.
 */
export function clientesDoFunil(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[],
  vinculos: VinculoPropostaPedido[],
  desde: string,
  ate: string,
  janelaDias = JANELA_CLIENTE_NOVO_DIAS
): LinhaClienteFunil[] {
  const primeiroContato = new Map<number, string>();
  const cadastro = new Map<number, string>();
  const marcarContato = (id: number, data: string, dataCadastro: string) => {
    if (!data) return;
    const atual = primeiroContato.get(id);
    if (!atual || data < atual) primeiroContato.set(id, data);
    if (dataCadastro && !cadastro.has(id)) cadastro.set(id, dataCadastro);
  };
  for (const item of propostas) marcarContato(item.idCliente, item.dataAbertura, item.dataCadastroCliente);
  for (const item of pedidos) marcarContato(item.idCliente, item.dataEmissao, item.dataCadastroCliente);

  type Acc = { cliente: string; propostas: Set<number>; pedidos: Set<number>; valor: number };
  const porCliente = new Map<number, Acc>();
  const acc = (id: number, cliente: string): Acc => {
    const atual = porCliente.get(id) ?? { cliente, propostas: new Set(), pedidos: new Set(), valor: 0 };
    porCliente.set(id, atual);
    return atual;
  };
  const clienteDaProposta = new Map<number, number>();
  for (const item of propostas) {
    if (!mesNoRecorte(item.mes, desde, ate)) continue;
    acc(item.idCliente, item.cliente).propostas.add(item.idProposta);
    clienteDaProposta.set(item.idProposta, item.idCliente);
  }
  const valorPorPedido = new Map<number, number>();
  for (const item of pedidos) valorPorPedido.set(item.idPedido, (valorPorPedido.get(item.idPedido) ?? 0) + item.valorVendido);
  for (const v of vinculos) {
    const idCliente = clienteDaProposta.get(v.idProposta);
    if (idCliente == null) continue;
    const linha = porCliente.get(idCliente);
    if (!linha || linha.pedidos.has(v.idPedido)) continue;
    linha.pedidos.add(v.idPedido);
    linha.valor += valorPorPedido.get(v.idPedido) ?? 0;
  }

  return [...porCliente.entries()]
    .map(([idCliente, linha]) => {
      const contato = primeiroContato.get(idCliente) ?? '';
      const dataCadastro = idCliente > 0 ? (cadastro.get(idCliente) ?? '') : '';
      const { novo, dias } = clienteNovo(dataCadastro, contato, desde, ate, janelaDias);
      return {
        idCliente,
        cliente: linha.cliente,
        dataCadastro,
        primeiroContato: contato,
        diasCadastroAteContato: dias,
        novo,
        qtdPropostas: linha.propostas.size,
        qtdPedidos: linha.pedidos.size,
        valorVendido: round2(linha.valor),
      };
    })
    .sort((a, b) => b.valorVendido - a.valorVendido || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

function pedidosDoRecorte(pedidos: LinhaPedidoItem[], desde: string, ate: string, deProposta?: boolean): LinhaPedidoItem[] {
  return pedidos.filter(
    (r) => mesNoRecorte(r.mes, desde, ate) && (deProposta == null || r.pedidoDeProposta === deProposta)
  );
}

/** Pedidos gerados pelas propostas abertas no recorte, mesmo que o pedido seja de mês posterior. */
export function pedidosGeradosPelasPropostas(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[],
  vinculos: VinculoPropostaPedido[],
  desde: string,
  ate: string
): LinhaPedidoGerado[] {
  const propostasRecorte = new Map<number, { codigo: string; cliente: string }>();
  for (const item of propostas) {
    if (!mesNoRecorte(item.mes, desde, ate)) continue;
    propostasRecorte.set(item.idProposta, { codigo: item.codigoProposta, cliente: item.cliente });
  }
  const valorPorPedido = new Map<number, number>();
  for (const item of pedidos) valorPorPedido.set(item.idPedido, (valorPorPedido.get(item.idPedido) ?? 0) + item.valorVendido);

  const porPedido = new Map<number, LinhaPedidoGerado & { origens: Set<string> }>();
  for (const v of vinculos) {
    const origem = propostasRecorte.get(v.idProposta);
    if (!origem) continue;
    const atual = porPedido.get(v.idPedido) ?? {
      idPedido: v.idPedido,
      codigoPedido: v.codigoPedido,
      dataEmissao: v.dataEmissao,
      cliente: origem.cliente,
      propostasOrigem: '',
      valorVendido: round2(valorPorPedido.get(v.idPedido) ?? 0),
      contaNaVenda: valorPorPedido.has(v.idPedido),
      origens: new Set<string>(),
    };
    atual.origens.add(origem.codigo);
    porPedido.set(v.idPedido, atual);
  }
  return [...porPedido.values()]
    .map(({ origens, ...linha }) => ({ ...linha, propostasOrigem: [...origens].join(', ') }))
    .sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao) || a.codigoPedido.localeCompare(b.codigoPedido));
}

export function conciliarPedidos(
  pedidos: LinhaPedidoItem[],
  gerados: LinhaPedidoGerado[],
  desde: string,
  ate: string
): ConciliacaoPedidos {
  const card = new Map<number, boolean>();
  for (const item of pedidosDoRecorte(pedidos, desde, ate)) card.set(item.idPedido, item.pedidoDeProposta);
  const funil = new Set(gerados.map((g) => g.idPedido));
  let semProposta = 0;
  let propostaAnterior = 0;
  for (const [idPedido, deProposta] of card) {
    if (funil.has(idPedido)) continue;
    if (deProposta) propostaAnterior += 1;
    else semProposta += 1;
  }
  let geradosForaDaVenda = 0;
  let geradosForaDoPeriodo = 0;
  for (const g of gerados) {
    if (card.has(g.idPedido)) continue;
    if (!mesNoRecorte(g.dataEmissao.slice(0, 7), desde, ate)) geradosForaDoPeriodo += 1;
    else geradosForaDaVenda += 1;
  }
  return {
    pedidosCard: card.size,
    pedidosFunil: gerados.length,
    semProposta,
    propostaAnterior,
    geradosForaDaVenda,
    geradosForaDoPeriodo,
  };
}

export function montarFunil(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[],
  vinculos: VinculoPropostaPedido[],
  totais: MesPortaPallets,
  desde: string,
  ate: string
): FunilPortaPallets {
  const clientes = clientesDoFunil(propostas, pedidos, vinculos, desde, ate);
  const gerados = pedidosGeradosPelasPropostas(propostas, pedidos, vinculos, desde, ate);
  return {
    propostas: totais.qtdPropostas,
    valorPropostas: totais.valorPropostas,
    convertidas: totais.qtdConvertidas,
    pedidosGerados: gerados.length,
    valorPedidosGerados: round2(gerados.reduce((s, r) => s + r.valorVendido, 0)),
    conciliacao: conciliarPedidos(pedidos, gerados, desde, ate),
    tempoMedioDias: totais.tempoMedioDias,
    clientesTotal: clientes.length,
    clientesComPedido: clientes.filter((c) => c.qtdPedidos > 0).length,
    clientesNovos: clientes.filter((c) => c.novo).length,
    novosComPedido: clientes.filter((c) => c.novo && c.qtdPedidos > 0).length,
  };
}

function funilVazio(): FunilPortaPallets {
  return {
    propostas: 0,
    valorPropostas: 0,
    convertidas: 0,
    pedidosGerados: 0,
    valorPedidosGerados: 0,
    conciliacao: {
      pedidosCard: 0,
      pedidosFunil: 0,
      semProposta: 0,
      propostaAnterior: 0,
      geradosForaDaVenda: 0,
      geradosForaDoPeriodo: 0,
    },
    tempoMedioDias: null,
    clientesTotal: 0,
    clientesComPedido: 0,
    clientesNovos: 0,
    novosComPedido: 0,
  };
}

export type RecortePortaPallets = { desde?: string; ate?: string };

function recorteEfetivo(recorte?: RecortePortaPallets): { desde: string; ate: string } {
  const ateMax = mesAtual();
  const ate = limitarMes(mesValido(recorte?.ate) ? recorte!.ate! : ateMax, MES_INICIO, ateMax);
  const desde = limitarMes(mesValido(recorte?.desde) ? recorte!.desde! : MES_INICIO, MES_INICIO, ate);
  return { desde, ate };
}

export async function obterPortaPalletsMensal(
  refresh = false,
  recorte?: RecortePortaPallets
): Promise<PortaPalletsMensal> {
  const { desde, ate } = recorteEfetivo(recorte);
  try {
    const base = await carregarBase(refresh);
    const { meses: mesesBase, totais: totaisBase } = agregarMeses(base.propostas, base.pedidos, ate, desde);
    const funil = montarFunil(base.propostas, base.pedidos, base.vinculos, totaisBase, desde, ate);
    const meses = mesesBase.map((m) => {
      const gerados = pedidosGeradosPelasPropostas(base.propostas, base.pedidos, base.vinculos, m.mes, m.mes);
      return {
        ...m,
        qtdPedidosGerados: gerados.length,
        valorPedidosGerados: round2(gerados.reduce((s, r) => s + r.valorVendido, 0)),
      };
    });
    const totais = {
      ...totaisBase,
      qtdPedidosGerados: funil.pedidosGerados,
      valorPedidosGerados: funil.valorPedidosGerados,
    };
    return { grupo: 'Porta Paletes', desde, ate, meses, totais, funil };
  } catch (err) {
    const vazioTotal = fecharMes(vazio('total'), 0, 0);
    return {
      grupo: 'Porta Paletes',
      desde,
      ate,
      meses: [],
      totais: vazioTotal,
      funil: funilVazio(),
      erro: formatNomusErroConexao(err),
    };
  }
}

export async function obterPortaPalletsDetalhe(
  mes: string,
  indicador: IndicadorPortaPallets,
  refresh = false,
  recorte?: RecortePortaPallets
): Promise<DetalhePortaPallets & { erro?: string }> {
  const unico = mesValido(mes) ? mes : '';
  const { desde, ate } = unico
    ? { desde: unico, ate: unico }
    : recorteEfetivo(recorte);
  if (!unico && !mesValido(recorte?.desde) && !mesValido(recorte?.ate)) {
    return { indicador: 'propostas', rows: [], erro: 'Mês inválido.' };
  }
  try {
    const base = await carregarBase(refresh);
    if (indicador === 'propostas') {
      return { indicador, rows: base.propostas.filter((r) => mesNoRecorte(r.mes, desde, ate)) };
    }
    if (indicador === 'pedidos') {
      return { indicador, rows: pedidosDoRecorte(base.pedidos, desde, ate) };
    }
    if (indicador === 'pedidos_gerados') {
      return { indicador, rows: pedidosGeradosPelasPropostas(base.propostas, base.pedidos, base.vinculos, desde, ate) };
    }
    if (indicador === 'clientes' || indicador === 'primeira') {
      return { indicador, rows: clientesDoMes(base.pedidos, desde, ate, indicador === 'primeira') };
    }
    if (
      indicador === 'clientes_total' ||
      indicador === 'clientes_com_pedido' ||
      indicador === 'clientes_novos' ||
      indicador === 'novos_com_pedido'
    ) {
      const clientes = clientesDoFunil(base.propostas, base.pedidos, base.vinculos, desde, ate);
      const filtro: Record<typeof indicador, (c: LinhaClienteFunil) => boolean> = {
        clientes_total: () => true,
        clientes_com_pedido: (c) => c.qtdPedidos > 0,
        clientes_novos: (c) => c.novo,
        novos_com_pedido: (c) => c.novo && c.qtdPedidos > 0,
      };
      return { indicador, rows: clientes.filter(filtro[indicador]) };
    }
    return { indicador, rows: conversoesDoMes(base.propostas, desde, ate, indicador === 'tempo') };
  } catch (err) {
    return { indicador, rows: [], erro: formatNomusErroConexao(err) } as DetalhePortaPallets & { erro?: string };
  }
}

export async function obterPortaPalletsDadosAbertos(refresh = false): Promise<{
  propostas: LinhaPropostaItem[];
  pedidos: LinhaPedidoItem[];
  erro?: string;
}> {
  try {
    const base = await carregarBase(refresh);
    const ate = mesAtual();
    return {
      propostas: base.propostas.filter((r) => r.mes >= MES_INICIO && r.mes <= ate),
      pedidos: base.pedidos.filter((r) => r.mes >= MES_INICIO && r.mes <= ate),
    };
  } catch (err) {
    return { propostas: [], pedidos: [], erro: formatNomusErroConexao(err) };
  }
}
