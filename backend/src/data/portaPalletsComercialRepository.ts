/**
 * Indicadores comerciais de porta-pallets (venda, não faturamento).
 *
 * Família de produto 95 (Porta palete) e todas as ramificações: 95.1 a 95.6
 * e os níveis abaixo (95.1.1, 95.4.11, …). O código da árvore é familiaproduto.classificacao.
 * Proposta e pedido saem do mesmo recorte, para a grade mensal e o detalhe baterem.
 */
import { formatNomusErroConexao, isNomusEnabled, queryNomus } from '../config/nomusDb.js';

/** Família 95 e qualquer descendente (95.1, 95.4.11, …). Não pega 950 nem 96. */
const SQL_FAMILIA_PORTA_PALETE = `(TRIM(fp.classificacao) = '95' OR TRIM(fp.classificacao) LIKE '95.%')`;
const SQL_JOIN_FAMILIA = `JOIN familiaproduto fp ON fp.id = pr.idFamiliaProduto AND ${SQL_FAMILIA_PORTA_PALETE}`;
/** Sem parâmetro de empresa, o painel continua na Só Aço. */
const EMPRESA_PADRAO = 1;
const SQL_EMPRESAS = '__EMPRESAS__';
const ID_TIPO_PEDIDO_ESTOQUE = 5;
const ID_ATRIBUTO_REQ_LOJA = 313;
const MES_INICIO = '2018-01';
/**
 * Data real de criação do cadastro = linha "Criação" do Histórico de modificações do Nomus
 * (primeira entrada em pessoahistorico). Não usar dataConquista ("Data do início do relacionamento").
 * pessoa.dataCriacao é o fallback quando o histórico não existe (cadastros mais novos sem registro).
 */
const SQL_CADASTRO_PESSOA = `
cadastro_pessoa AS (
  SELECT idEntidade AS idPessoa, MIN(dataModificacao) AS dataCriacaoHistorico
  FROM pessoahistorico
  GROUP BY idEntidade
)`;

const SQL_DATA_CADASTRO = `DATE_FORMAT(COALESCE(cp.dataCriacaoHistorico, pec.dataCriacao), '%Y-%m-%d')`;

const SQL_VENDA = `
venda AS (
  SELECT
    p.id AS idPedido,
    p.nome AS codigoPedido,
    DATE_FORMAT(p.dataEmissao, '%Y-%m-%d') AS dataEmissao,
    DATE_FORMAT(p.dataEmissao, '%Y-%m') AS mes,
    CASE WHEN p.idCliente IS NULL THEN -p.id ELSE p.idCliente END AS idCliente,
    COALESCE(NULLIF(TRIM(pec.nomeRazaoSocial), ''), NULLIF(TRIM(pec.nome), ''), '—') AS cliente,
    COALESCE(CAST(pec.id AS CHAR), '') AS codigoCliente,
    ${SQL_DATA_CADASTRO} AS dataCadastroCliente,
    ip.id AS idItem,
    CASE WHEN ip.idItemProposta IS NULL THEN 0 ELSE 1 END AS deProposta,
    prpv.nome AS codigoPropostaItem,
    p.idEmpresa AS idEmpresa,
    COALESCE(NULLIF(TRIM(emp.nomeFantasia), ''), NULLIF(TRIM(emp.nome), ''), 'Não informado') AS empresa,
    COALESCE(NULLIF(TRIM(vr.nome), ''), 'Não informado') AS vendedor,
    COALESCE(NULLIF(TRIM(alo1.opcao), ''), 'Não informado') AS subgrupo1,
    COALESCE(NULLIF(TRIM(m.UF), ''), NULLIF(TRIM(pec.uf), ''), 'Não informado') AS uf,
    COALESCE(NULLIF(TRIM(m.nome), ''), 'Não informado') AS cidade,
    TRIM(fp.classificacao) AS classificacaoFamilia,
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
  ${SQL_JOIN_FAMILIA}
  LEFT JOIN pessoa pec ON pec.id = p.idCliente
  LEFT JOIN cadastro_pessoa cp ON cp.idPessoa = pec.id
  LEFT JOIN pessoa vr ON vr.id = COALESCE(p.idVendedor, p.idRepresentante)
  LEFT JOIN municipio m ON m.id = pec.idMunicipio
  LEFT JOIN empresa emp ON emp.id = p.idEmpresa
  LEFT JOIN atributoprodutovalor apv1 ON apv1.idProduto = pr.id AND apv1.idAtributo = 398
  LEFT JOIN atributolistaopcao alo1 ON alo1.id = apv1.idListaOpcao
  LEFT JOIN movimento_liquido ml ON ml.idItemPedido = ip.id
  LEFT JOIN itemproposta ipv ON ipv.id = ip.idItemProposta
  LEFT JOIN proposta prpv ON prpv.id = ipv.idProposta
  WHERE p.idEmpresa IN (${SQL_EMPRESAS})
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
  ${SQL_JOIN_FAMILIA}
  WHERE p.idEmpresa IN (${SQL_EMPRESAS})
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
  DATE_FORMAT(ped.dataEmissao, '%Y-%m-%d') AS dataEmissao,
  prp.idEmpresa AS idEmpresa,
  COALESCE(NULLIF(TRIM(vr.nome), ''), 'Não informado') AS vendedor,
  COALESCE(NULLIF(TRIM(alo1.opcao), ''), 'Não informado') AS subgrupo1,
  COALESCE(NULLIF(TRIM(m.UF), ''), NULLIF(TRIM(pec.uf), ''), 'Não informado') AS uf,
  COALESCE(NULLIF(TRIM(m.nome), ''), 'Não informado') AS cidade,
  TRIM(fp.classificacao) AS classificacaoFamilia
FROM itempedido ipe
JOIN itemproposta ip ON ip.id = ipe.idItemProposta
JOIN proposta prp ON prp.id = ip.idProposta
JOIN produto pr ON pr.id = ip.idProduto
${SQL_JOIN_FAMILIA}
JOIN pedido ped ON ped.id = ipe.idPedido
LEFT JOIN pessoa pec ON pec.id = prp.idCliente
LEFT JOIN pessoa vr ON vr.id = COALESCE(prp.idVendedor, prp.idRepresentante)
LEFT JOIN municipio m ON m.id = pec.idMunicipio
LEFT JOIN atributoprodutovalor apv1 ON apv1.idProduto = pr.id AND apv1.idAtributo = 398
LEFT JOIN atributolistaopcao alo1 ON alo1.id = apv1.idListaOpcao
WHERE prp.idEmpresa IN (${SQL_EMPRESAS})`;

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
    COALESCE(CAST(pec.id AS CHAR), '') AS codigoCliente,
    ${SQL_DATA_CADASTRO} AS dataCadastroCliente,
    prp.idEmpresa AS idEmpresa,
    COALESCE(NULLIF(TRIM(emp.nomeFantasia), ''), NULLIF(TRIM(emp.nome), ''), 'Não informado') AS empresa,
    COALESCE(NULLIF(TRIM(vr.nome), ''), 'Não informado') AS vendedor,
    COALESCE(NULLIF(TRIM(alo1.opcao), ''), 'Não informado') AS subgrupo1,
    COALESCE(NULLIF(TRIM(m.UF), ''), NULLIF(TRIM(pec.uf), ''), 'Não informado') AS uf,
    COALESCE(NULLIF(TRIM(m.nome), ''), 'Não informado') AS cidade,
    TRIM(fp.classificacao) AS classificacaoFamilia,
    ip.id AS idItem,
    pr.nome AS codigoProduto,
    pr.descricao AS descricaoProduto,
    ROUND(COALESCE(ip.valorTotalComDesconto, 0), 2) AS valor,
    ip.status AS statusItem,
    COALESCE(mr.nome, '') AS motivoRejeicao,
    LEFT(TRIM(COALESCE(prp.observacao, '')), 400) AS observacaoProposta,
    COALESCE(pd.codigosPedido, '') AS codigosPedido,
    pd.dataPrimeiroPedido AS dataPrimeiroPedido
  FROM itemproposta ip
  JOIN proposta prp ON prp.id = ip.idProposta
  JOIN produto pr ON pr.id = ip.idProduto
  ${SQL_JOIN_FAMILIA}
  LEFT JOIN pessoa pec ON pec.id = prp.idCliente
  LEFT JOIN cadastro_pessoa cp ON cp.idPessoa = pec.id
  LEFT JOIN pessoa vr ON vr.id = COALESCE(prp.idVendedor, prp.idRepresentante)
  LEFT JOIN municipio m ON m.id = pec.idMunicipio
  LEFT JOIN empresa emp ON emp.id = prp.idEmpresa
  LEFT JOIN atributoprodutovalor apv1 ON apv1.idProduto = pr.id AND apv1.idAtributo = 398
  LEFT JOIN atributolistaopcao alo1 ON alo1.id = apv1.idListaOpcao
  LEFT JOIN motivorejeicaoitemproposta mr ON mr.id = ip.idRejeicao
  LEFT JOIN pedido_do_item pd ON pd.idItemProposta = ip.id
  WHERE prp.idEmpresa IN (${SQL_EMPRESAS})
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
  codigoCliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valor: number;
  statusItem: number;
  statusLabel: string;
  motivoRejeicao: string;
  /** Observação da proposta no Nomus (até 400 caracteres); identifica opções alternativas do mesmo projeto. */
  observacaoProposta: string;
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
  codigoCliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
  primeiraCompra: boolean;
  pedidoDeProposta: boolean;
  /** Propostas ligadas ao pedido (todos os itens de porta-pallet do pedido), separadas por vírgula. */
  propostasVinculadas: string;
}

export interface LinhaClienteMes {
  idCliente: number;
  cliente: string;
  codigoCliente: string;
  /** Data de criação do cadastro (histórico Criação / dataCriacao). */
  dataCadastroCliente: string;
  /** Pedidos do recorte/mês que entram no indicador, separados por vírgula. */
  codigosPedido: string;
  /** Datas de emissão desses pedidos (ISO), na mesma ordem. */
  datasPedido: string;
  /** Propostas vinculadas a esses pedidos, separadas por vírgula. */
  codigosProposta: string;
  /** Datas de abertura dessas propostas (ISO), na mesma ordem. */
  datasProposta: string;
  /** Mesma regra de cliente novo do funil (clienteNovo), no recorte do detalhe. */
  novo: boolean;
  qtdPedidos: number;
  valor: number;
}

export interface LinhaClienteFunil {
  idCliente: number;
  cliente: string;
  codigoCliente: string;
  dataCadastro: string;
  /** Primeira proposta do cliente no recorte. */
  primeiroContato: string;
  /** Primeiro pedido do cliente na empresa, de qualquer produto ('' = nunca comprou). */
  primeiroPedidoEmpresa: string;
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

export interface ItemPedidoGerado {
  idItem: number;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
}

export interface LinhaPedidoGerado {
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  cliente: string;
  codigoCliente: string;
  propostasOrigem: string;
  valorVendido: number;
  contaNaVenda: boolean;
  /** Preenchido só no detalhe do funil, para o modal de itens. A soma é o valor vendido. */
  itens?: ItemPedidoGerado[];
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
  idCliente: number;
  cliente: string;
  codigoCliente: string;
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
  /** Mesmas datas um ano antes, mês a mês (para o gráfico ano x ano). null se cair antes de 2018. */
  anoAnterior: { desde: string; ate: string; meses: MesPortaPallets[] } | null;
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
  propostas: LinhaPropostaItem[];
  pedidos: LinhaPedidoItem[];
  vinculos: VinculoPropostaPedido[];
  /** Primeiro pedido do cliente nas empresas do filtro, de qualquer produto (ISO). */
  primeiroPedidoEmpresa: Map<number, string>;
};

type CacheBruto = {
  at: number;
  propostasRaw: Record<string, unknown>[];
  pedidosRaw: Record<string, unknown>[];
  vinculosRaw: Record<string, unknown>[];
  /** Chave `idCliente:idEmpresa` → data do primeiro pedido nessa empresa. */
  primeiroPorEmpresa: Map<string, string>;
  familias: NoFamiliaPortaPalete[];
};

let cache: CacheBruto | null = null;
let carregando: Promise<CacheBruto> | null = null;
const CACHE_MS = 60_000;

export interface NoFamiliaPortaPalete {
  id: number;
  classificacao: string;
  nome: string;
  filhos: NoFamiliaPortaPalete[];
}

export interface FiltrosPortaPallets {
  /** null = todas as empresas que têm porta-palete. */
  empresas: number[] | null;
  vendedores: string[];
  subgrupos: string[];
  ufs: string[];
  cidades: string[];
  /** Códigos da árvore (95, 95.4, 95.4.11). Vazio = família 95 inteira. */
  familias: string[];
}

export interface OpcaoEmpresaPortaPalete {
  id: number;
  nome: string;
  valor: number;
}

export interface OpcaoComValorPortaPalete {
  nome: string;
  valor: number;
}

export interface OpcaoCidadePortaPalete {
  nome: string;
  uf: string;
  valor: number;
}

export type OpcaoVendedorPortaPalete = OpcaoComValorPortaPalete;

export interface OpcoesPortaPallets {
  empresas: OpcaoEmpresaPortaPalete[];
  vendedores: OpcaoVendedorPortaPalete[];
  subgrupos: string[];
  ufs: OpcaoComValorPortaPalete[];
  cidades: OpcaoCidadePortaPalete[];
  familias: NoFamiliaPortaPalete[];
  erro?: string;
}

const FILTROS_PADRAO: FiltrosPortaPallets = {
  empresas: [EMPRESA_PADRAO],
  vendedores: [],
  subgrupos: [],
  ufs: [],
  cidades: [],
  familias: [],
};

function listaPipe(v: string | undefined): string[] {
  if (!v?.trim()) return [];
  return v.split('|').map((s) => s.trim()).filter(Boolean);
}

/** Lê os filtros da query. Sem `empresas`, fica a Só Aço. `empresas=todas` tira o recorte. */
export function filtrosPortaPalletsDeQuery(q: {
  empresas?: string;
  vendedores?: string;
  subgrupos?: string;
  ufs?: string;
  cidades?: string;
  familias?: string;
}): FiltrosPortaPallets {
  const emp = q.empresas?.trim();
  let empresas: number[] | null;
  if (emp == null || emp === '') empresas = [EMPRESA_PADRAO];
  else if (emp === 'todas') empresas = null;
  else {
    const ids = [
      ...new Set(
        emp
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ];
    empresas = ids.length ? ids : [EMPRESA_PADRAO];
  }
  const familiasBrutas = listaPipe(q.familias);
  const familias =
    familiasBrutas.length === 1 && familiasBrutas[0] === 'nenhuma'
      ? ['nenhuma']
      : familiasBrutas.filter((c) => c === '95' || /^95\.\d+(\.\d+)*$/.test(c));
  return {
    empresas,
    vendedores: listaPipe(q.vendedores),
    subgrupos: listaPipe(q.subgrupos),
    ufs: listaPipe(q.ufs),
    cidades: listaPipe(q.cidades),
    familias,
  };
}

/** O item entra se o código é a raiz marcada ou um descendente (95.4 cobre 95.4.11; 95 não cobre 950). */
export function familiaCobre(classificacao: string, raizes: string[]): boolean {
  if (raizes.length === 0) return true;
  const cod = classificacao.trim();
  return raizes.some((r) => cod === r || cod.startsWith(`${r}.`));
}

export function compararClassificacaoFamilia(a: string, b: string): number {
  const pa = a.split('.').map((p) => Number(p));
  const pb = b.split('.').map((p) => Number(p));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export function montarArvoreFamilia(
  rows: { id: number; classificacao: string; nome: string }[]
): NoFamiliaPortaPalete[] {
  const nos = rows.map((r) => ({
    id: r.id,
    classificacao: r.classificacao.trim(),
    nome: r.nome.trim(),
    filhos: [] as NoFamiliaPortaPalete[],
  }));
  const porCodigo = new Map(nos.map((n) => [n.classificacao, n]));
  const raizes: NoFamiliaPortaPalete[] = [];
  for (const n of nos) {
    const ponto = n.classificacao.lastIndexOf('.');
    const pai = ponto > 0 ? porCodigo.get(n.classificacao.slice(0, ponto)) : undefined;
    if (pai) pai.filhos.push(n);
    else raizes.push(n);
  }
  const ordenar = (lista: NoFamiliaPortaPalete[]) => {
    lista.sort((a, b) => compararClassificacaoFamilia(a.classificacao, b.classificacao));
    for (const n of lista) ordenar(n.filhos);
  };
  ordenar(raizes);
  return raizes;
}

/** Mantém só os ramos que têm venda no contexto. O pai fica quando algum filho permanece. */
function podarArvoreFamilia(nos: NoFamiliaPortaPalete[], presentes: Set<string>): NoFamiliaPortaPalete[] {
  const tem = (no: NoFamiliaPortaPalete): boolean => {
    for (const cod of presentes) {
      if (cod === no.classificacao || cod.startsWith(`${no.classificacao}.`)) return true;
    }
    return no.filhos.some(tem);
  };
  const out: NoFamiliaPortaPalete[] = [];
  for (const no of nos) {
    if (!tem(no)) continue;
    out.push({ ...no, filhos: podarArvoreFamilia(no.filhos, presentes) });
  }
  return out;
}

type DimensaoFiltro = 'empresas' | 'vendedores' | 'subgrupos' | 'ufs' | 'cidades' | 'familias';

/** Tira uma dimensão para a lista dela continuar mostrando as outras opções do mesmo contexto. */
function semDimensao(filtros: FiltrosPortaPallets, omit: DimensaoFiltro): FiltrosPortaPallets {
  if (omit === 'empresas') return { ...filtros, empresas: null };
  if (omit === 'vendedores') return { ...filtros, vendedores: [] };
  if (omit === 'subgrupos') return { ...filtros, subgrupos: [] };
  if (omit === 'ufs') return { ...filtros, ufs: [] };
  if (omit === 'cidades') return { ...filtros, cidades: [] };
  return { ...filtros, familias: [] };
}

function passaFiltro(row: Record<string, unknown>, filtros: FiltrosPortaPallets): boolean {
  if (filtros.empresas && !filtros.empresas.includes(num(row.idEmpresa))) return false;
  if (filtros.vendedores.length && !filtros.vendedores.includes(str(row.vendedor))) return false;
  if (filtros.subgrupos.length && !filtros.subgrupos.includes(str(row.subgrupo1))) return false;
  if (filtros.ufs.length && !filtros.ufs.includes(str(row.uf))) return false;
  if (filtros.cidades.length && !filtros.cidades.includes(str(row.cidade))) return false;
  if (!familiaCobre(str(row.classificacaoFamilia), filtros.familias)) return false;
  return true;
}

function mapaPrimeiro(porEmpresa: Map<string, string>, empresas: number[] | null): Map<number, string> {
  const out = new Map<number, string>();
  const permitidas = empresas ? new Set(empresas) : null;
  for (const [chave, data] of porEmpresa) {
    const sep = chave.indexOf(':');
    const id = Number(chave.slice(0, sep));
    const emp = Number(chave.slice(sep + 1));
    if (!data || !Number.isInteger(id) || (permitidas && !permitidas.has(emp))) continue;
    const atual = out.get(id);
    if (!atual || data < atual) out.set(id, data);
  }
  return out;
}

function materializar(bruto: CacheBruto, filtros: FiltrosPortaPallets): CacheBase {
  const propostasRaw = bruto.propostasRaw.filter((r) => passaFiltro(r, filtros));
  const pedidosRaw = bruto.pedidosRaw.filter((r) => passaFiltro(r, filtros));
  const vinculosRaw = bruto.vinculosRaw.filter((r) => passaFiltro(r, filtros));
  const primeiroPedidoEmpresa = mapaPrimeiro(bruto.primeiroPorEmpresa, filtros.empresas);
  const pedidos = enriquecerPedidos(pedidosRaw, primeiroPedidoEmpresa);
  const vinculos = vinculosValidos(vinculosRaw, pedidos);
  return {
    propostas: enriquecerPropostas(propostasSoComPedidosValidos(propostasRaw, vinculos)),
    pedidos,
    vinculos,
    primeiroPedidoEmpresa,
  };
}

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

/** Início do recorte em ISO: aceita 'AAAA-MM' (dia 01) ou 'AAAA-MM-DD'. */
function inicioRecorte(desde: string): string {
  return desde.length === 7 ? `${desde}-01` : desde;
}

/** Fim do recorte em ISO: aceita 'AAAA-MM' (inclui o mês todo) ou 'AAAA-MM-DD'. */
function fimRecorte(ate: string): string {
  return ate.length === 7 ? `${ate}-31` : ate;
}

/** Data ISO (AAAA-MM-DD) dentro do recorte; desde/ate podem ser mês ou dia. */
function dataNoRecorte(data: string, desde: string, ate: string): boolean {
  if (!data) return false;
  const d = data.slice(0, 10);
  return d >= inicioRecorte(desde) && d <= fimRecorte(ate);
}

/** Interseção do mês com o recorte (meses das pontas ficam parciais). */
function recorteDoMes(mes: string, desde: string, ate: string): { desde: string; ate: string } {
  const ini = inicioRecorte(desde);
  const fim = fimRecorte(ate);
  const mesIni = `${mes}-01`;
  const mesFim = `${mes}-31`;
  return { desde: mesIni > ini ? mesIni : ini, ate: mesFim < fim ? mesFim : fim };
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
    codigoCliente: str(row.codigoCliente),
    dataCadastroCliente: str(row.dataCadastroCliente),
    codigoProduto: str(row.codigoProduto),
    descricaoProduto: str(row.descricaoProduto),
    valor: round2(num(row.valor)),
    statusItem: num(row.statusItem),
    statusLabel: rotuloStatusProposta(num(row.statusItem)),
    motivoRejeicao: str(row.motivoRejeicao),
    observacaoProposta: str(row.observacaoProposta).replace(/\s+/g, ' ').trim(),
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

/**
 * primeiraCompra = o pedido de porta-pallet do mês é a primeira compra do cliente NA EMPRESA:
 * nenhum pedido de qualquer produto antes do primeiro pedido de porta-pallet.
 */
function enriquecerPedidos(rows: Record<string, unknown>[], primeiroPedidoEmpresa: Map<number, string>): LinhaPedidoItem[] {
  const primeiraData = new Map<number, string>();
  const pedidosDeProposta = new Set<number>();
  const propostasDoPedido = new Map<number, Set<string>>();
  for (const row of rows) {
    const id = num(row.idCliente);
    const data = str(row.dataEmissao);
    const atual = primeiraData.get(id);
    if (!atual || data < atual) primeiraData.set(id, data);
    const idPedido = num(row.idPedido);
    if (num(row.deProposta) === 1) pedidosDeProposta.add(idPedido);
    const codigo = str(row.codigoPropostaItem).trim();
    if (codigo) {
      const set = propostasDoPedido.get(idPedido) ?? new Set<string>();
      set.add(codigo);
      propostasDoPedido.set(idPedido, set);
    }
  }
  const primeiraMes = new Map<number, string>();
  for (const [id, data] of primeiraData) {
    const empresa = primeiroPedidoEmpresa.get(id);
    if (id > 0 && (!empresa || empresa >= data)) primeiraMes.set(id, data.slice(0, 7));
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
      codigoCliente: str(row.codigoCliente),
      dataCadastroCliente: str(row.dataCadastroCliente),
      codigoProduto: str(row.codigoProduto),
      descricaoProduto: str(row.descricaoProduto),
      valorVendido: round2(num(row.valorVendido)),
      primeiraCompra: primeiraMes.get(idCliente) === mes,
      pedidoDeProposta: pedidosDeProposta.has(num(row.idPedido)),
      propostasVinculadas: [...(propostasDoPedido.get(num(row.idPedido)) ?? [])].sort().join(', '),
    };
  });
}

/**
 * Vínculo proposta → pedido só vale se o pedido entra na venda (mesma regra do card): fora pedido de estoque,
 * requisição de loja e pedido cujos itens de porta-pallet foram todos cancelados.
 */
export function vinculosValidos(
  vinculosRaw: Record<string, unknown>[],
  pedidos: LinhaPedidoItem[]
): VinculoPropostaPedido[] {
  const pedidosVenda = new Set(pedidos.map((p) => p.idPedido));
  return vinculosRaw
    .map((row) => ({
      idProposta: num(row.idProposta),
      idPedido: num(row.idPedido),
      codigoPedido: str(row.codigoPedido),
      dataEmissao: str(row.dataEmissao),
    }))
    .filter((v) => pedidosVenda.has(v.idPedido));
}

/** Pedidos e data do 1º pedido do item da proposta considerando só os pedidos válidos (que entram na venda). */
function propostasSoComPedidosValidos(
  rows: Record<string, unknown>[],
  vinculos: VinculoPropostaPedido[]
): Record<string, unknown>[] {
  const dataPorCodigo = new Map(vinculos.map((v) => [v.codigoPedido, v.dataEmissao]));
  return rows.map((row) => {
    const codigos = str(row.codigosPedido)
      .split(', ')
      .filter((c) => c && dataPorCodigo.has(c));
    const datas = codigos.map((c) => dataPorCodigo.get(c) ?? '').filter(Boolean).sort();
    return { ...row, codigosPedido: codigos.join(', '), dataPrimeiroPedido: datas[0] ?? '' };
  });
}

function sqlEmpresas(ids: number[]): string {
  const limpos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  return (limpos.length ? limpos : [EMPRESA_PADRAO]).join(',');
}

function aplicarEmpresas(sql: string, ids: number[]): string {
  return sql.replaceAll(SQL_EMPRESAS, sqlEmpresas(ids));
}

async function idsEmpresasPortaPalete(): Promise<number[]> {
  const [rows] = await queryNomus<Record<string, unknown>[]>(
    `SELECT DISTINCT idEmpresa FROM (
       SELECT p.idEmpresa AS idEmpresa
       FROM itempedido ip
       JOIN pedido p ON p.id = ip.idPedido
       JOIN produto pr ON pr.id = ip.idProduto
       ${SQL_JOIN_FAMILIA}
       UNION
       SELECT prp.idEmpresa AS idEmpresa
       FROM itemproposta ip
       JOIN proposta prp ON prp.id = ip.idProposta
       JOIN produto pr ON pr.id = ip.idProduto
       ${SQL_JOIN_FAMILIA}
     ) e
     WHERE idEmpresa IS NOT NULL`
  );
  const ids = [...new Set(rows.map((r) => num(r.idEmpresa)).filter((id) => id > 0))];
  return ids.length ? ids : [EMPRESA_PADRAO];
}

async function carregarBase(refresh: boolean): Promise<CacheBruto> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  if (!refresh && carregando) return carregando;
  if (!isNomusEnabled()) throw new Error('NOMUS_DB_URL não configurado');

  const promessa = (async () => {
    const empresas = await idsEmpresasPortaPalete();
    const com = (sql: string) => aplicarEmpresas(sql, empresas);
    const [propostasRaw] = await queryNomus<Record<string, unknown>[]>(
      com(
        `WITH ${SQL_CADASTRO_PESSOA}, ${SQL_PROPOSTA}
         SELECT idItem, idProposta, codigoProposta, dataAbertura, mes, idCliente, cliente, codigoCliente, dataCadastroCliente,
                idEmpresa, empresa, vendedor, subgrupo1, uf, cidade, classificacaoFamilia,
                codigoProduto, descricaoProduto,
                valor, statusItem, motivoRejeicao, observacaoProposta, codigosPedido, dataPrimeiroPedido
         FROM proposta_item`
      )
    );
    const [pedidosRaw] = await queryNomus<Record<string, unknown>[]>(
      com(
        `WITH ${SQL_CADASTRO_PESSOA}, ${SQL_MOVIMENTO}, ${SQL_VENDA}
         SELECT idItem, idPedido, codigoPedido, dataEmissao, mes, idCliente, cliente, codigoCliente, dataCadastroCliente, deProposta,
                codigoPropostaItem,
                idEmpresa, empresa, vendedor, subgrupo1, uf, cidade, classificacaoFamilia,
                codigoProduto, descricaoProduto, valorVendido
         FROM venda`
      )
    );
    const [vinculosRaw] = await queryNomus<Record<string, unknown>[]>(com(SQL_VINCULO_PROPOSTA_PEDIDO));
    const [primeiroPedidoRaw] = await queryNomus<Record<string, unknown>[]>(
      com(
        `SELECT p.idCliente, p.idEmpresa, DATE_FORMAT(MIN(p.dataEmissao), '%Y-%m-%d') AS primeiroPedido
         FROM pedido p
         WHERE p.idEmpresa IN (${SQL_EMPRESAS})
           AND p.idCliente IS NOT NULL
           AND p.idTipoPedido <> ${ID_TIPO_PEDIDO_ESTOQUE}
           AND EXISTS (SELECT 1 FROM itempedido ip WHERE ip.idPedido = p.id AND ip.status <> 6)
         GROUP BY p.idCliente, p.idEmpresa`
      )
    );
    const [familiasRaw] = await queryNomus<Record<string, unknown>[]>(
      `SELECT id, TRIM(classificacao) AS classificacao, nome
       FROM familiaproduto
       WHERE TRIM(classificacao) = '95' OR TRIM(classificacao) LIKE '95.%'`
    );
    const primeiroPorEmpresa = new Map<string, string>();
    for (const row of primeiroPedidoRaw) {
      const id = num(row.idCliente);
      const emp = num(row.idEmpresa);
      const data = str(row.primeiroPedido);
      if (id > 0 && emp > 0 && data) primeiroPorEmpresa.set(`${id}:${emp}`, data);
    }
    cache = {
      at: Date.now(),
      propostasRaw,
      pedidosRaw,
      vinculosRaw,
      primeiroPorEmpresa,
      familias: montarArvoreFamilia(
        familiasRaw.map((row) => ({
          id: num(row.id),
          classificacao: str(row.classificacao),
          nome: str(row.nome),
        }))
      ),
    };
    return cache;
  })();

  if (!refresh) carregando = promessa;
  try {
    return await promessa;
  } finally {
    if (carregando === promessa) carregando = null;
  }
}

async function baseFiltrada(refresh: boolean, filtros?: FiltrosPortaPallets): Promise<CacheBase> {
  return materializar(await carregarBase(refresh), filtros ?? FILTROS_PADRAO);
}

function empresasPorValor(rows: Record<string, unknown>[]): OpcaoEmpresaPortaPalete[] {
  const soma = new Map<number, OpcaoEmpresaPortaPalete>();
  for (const row of rows) {
    const id = num(row.idEmpresa);
    if (id <= 0) continue;
    const atual = soma.get(id) ?? { id, nome: str(row.empresa) || `Empresa ${id}`, valor: 0 };
    const nome = str(row.empresa);
    if (nome) atual.nome = nome;
    atual.valor += num(row.valorVendido);
    soma.set(id, atual);
  }
  return [...soma.values()]
    .map((e) => ({ ...e, valor: round2(e.valor) }))
    .filter((e) => e.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id);
}

/** Soma o valor vendido de cada rótulo e ordena do maior para o menor. */
function opcoesPorValor(rows: Record<string, unknown>[], campo: string): OpcaoComValorPortaPalete[] {
  const soma = new Map<string, number>();
  for (const row of rows) {
    const nome = str(row[campo]);
    if (!nome || nome === 'Não informado') continue;
    soma.set(nome, (soma.get(nome) ?? 0) + num(row.valorVendido));
  }
  return [...soma.entries()]
    .map(([nome, valor]) => ({ nome, valor: round2(valor) }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function cidadesPorValor(rows: Record<string, unknown>[]): OpcaoCidadePortaPalete[] {
  const soma = new Map<string, OpcaoCidadePortaPalete>();
  for (const row of rows) {
    const nome = str(row.cidade);
    if (!nome || nome === 'Não informado') continue;
    const uf = str(row.uf);
    const chave = `${uf}\0${nome}`;
    const atual = soma.get(chave) ?? { nome, uf, valor: 0 };
    atual.valor += num(row.valorVendido);
    soma.set(chave, atual);
  }
  return [...soma.values()]
    .map((c) => ({ ...c, valor: round2(c.valor) }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR') || a.uf.localeCompare(b.uf, 'pt-BR'));
}

function distintos(rows: Record<string, unknown>[], campo: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = str(row[campo]);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function obterPortaPalletsOpcoes(
  refresh = false,
  recorte?: RecortePortaPallets,
  filtros?: FiltrosPortaPallets
): Promise<OpcoesPortaPallets> {
  try {
    const bruto = await carregarBase(refresh);
    const { desde, ate } = recorteEfetivo(recorte);
    const aplicados = filtros ?? FILTROS_PADRAO;
    const pedidosNoPeriodo = bruto.pedidosRaw.filter((row) => dataNoRecorte(str(row.dataEmissao), desde, ate));
    const noContexto = (omit: DimensaoFiltro) =>
      pedidosNoPeriodo.filter((row) => passaFiltro(row, semDimensao(aplicados, omit)));
    const familiasCtx = noContexto('familias');
    const codigosFamilia = new Set<string>();
    for (const row of familiasCtx) {
      const cod = str(row.classificacaoFamilia);
      if (cod) codigosFamilia.add(cod);
    }
    return {
      empresas: empresasPorValor(noContexto('empresas')),
      vendedores: opcoesPorValor(noContexto('vendedores'), 'vendedor'),
      subgrupos: distintos(noContexto('subgrupos'), 'subgrupo1').filter((nome) => nome !== 'Não informado'),
      ufs: opcoesPorValor(noContexto('ufs'), 'uf'),
      cidades: cidadesPorValor(noContexto('cidades')),
      familias: podarArvoreFamilia(bruto.familias, codigosFamilia),
    };
  } catch (err) {
    return {
      empresas: [],
      vendedores: [],
      subgrupos: [],
      ufs: [],
      cidades: [],
      familias: [],
      erro: formatNomusErroConexao(err),
    };
  }
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
  for (const mes of mesesDoRecorte(desde.slice(0, 7), ate.slice(0, 7))) {
    porMes.set(mes, vazio(mes));
    dias.set(mes, { soma: 0, qtd: 0 });
  }

  const propostasVistas = new Set<string>();
  for (const item of propostas) {
    const alvo = porMes.get(item.mes);
    if (!alvo || !dataNoRecorte(item.dataAbertura, desde, ate)) continue;
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
    if (!alvo || !dataNoRecorte(item.dataEmissao, desde, ate)) continue;
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
    if (porMes.has(item.mes) && dataNoRecorte(item.dataEmissao, desde, ate)) clientesPeriodo.add(item.idCliente);
  }
  total.qtdClientes = clientesPeriodo.size;
  return { meses, totais: fecharMes(total, somaDias, qtdPares) };
}

function clientesDoMes(
  pedidos: LinhaPedidoItem[],
  propostas: LinhaPropostaItem[],
  desde: string,
  ate: string,
  soPrimeira: boolean
): LinhaClienteMes[] {
  const aberturaProposta = new Map<string, string>();
  for (const p of propostas) {
    const atual = aberturaProposta.get(p.codigoProposta);
    if (!atual || p.dataAbertura < atual) aberturaProposta.set(p.codigoProposta, p.dataAbertura);
  }

  type Acc = {
    idCliente: number;
    cliente: string;
    codigoCliente: string;
    dataCadastroCliente: string;
    pedidos: Map<number, { codigo: string; data: string }>;
    propostas: Map<string, string>;
    novo: boolean;
    valor: number;
  };
  const map = new Map<number, Acc>();
  for (const item of pedidos) {
    if (!dataNoRecorte(item.dataEmissao, desde, ate)) continue;
    if (soPrimeira && !item.primeiraCompra) continue;
    const atual = map.get(item.idCliente) ?? {
      idCliente: item.idCliente,
      cliente: item.cliente,
      codigoCliente: item.codigoCliente,
      dataCadastroCliente: item.dataCadastroCliente,
      pedidos: new Map(),
      propostas: new Map(),
      novo: false,
      valor: 0,
    };
    atual.valor += item.valorVendido;
    if (item.primeiraCompra) atual.novo = true;
    if (!atual.dataCadastroCliente && item.dataCadastroCliente) atual.dataCadastroCliente = item.dataCadastroCliente;
    const pedidoAtual = atual.pedidos.get(item.idPedido);
    if (!pedidoAtual || item.dataEmissao < pedidoAtual.data) {
      atual.pedidos.set(item.idPedido, { codigo: item.codigoPedido, data: item.dataEmissao });
    }
    for (const codigo of item.propostasVinculadas.split(', ').filter(Boolean)) {
      const data = aberturaProposta.get(codigo) ?? '';
      const prev = atual.propostas.get(codigo);
      if (prev == null || (data && (!prev || data < prev))) atual.propostas.set(codigo, data);
    }
    map.set(item.idCliente, atual);
  }

  return [...map.values()]
    .map((a) => {
      const pedidosOrd = [...a.pedidos.values()].sort(
        (x, y) => x.data.localeCompare(y.data) || x.codigo.localeCompare(y.codigo)
      );
      const propsOrd = [...a.propostas.entries()].sort(
        (x, y) => (x[1] || '9999-99-99').localeCompare(y[1] || '9999-99-99') || x[0].localeCompare(y[0])
      );
      return {
        idCliente: a.idCliente,
        cliente: a.cliente,
        codigoCliente: a.codigoCliente,
        dataCadastroCliente: a.dataCadastroCliente,
        codigosPedido: pedidosOrd.map((p) => p.codigo).join(', '),
        datasPedido: pedidosOrd.map((p) => p.data).join(', '),
        codigosProposta: propsOrd.map(([c]) => c).join(', '),
        datasProposta: propsOrd.map(([, d]) => d).join(', '),
        novo: a.novo,
        qtdPedidos: a.pedidos.size,
        valor: round2(a.valor),
      };
    })
    .sort((a, b) => b.valor - a.valor || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

function conversoesDoMes(propostas: LinhaPropostaItem[], desde: string, ate: string, soConvertidas: boolean): LinhaConversaoMes[] {
  const map = new Map<number, LinhaConversaoMes>();
  for (const item of propostas) {
    if (!dataNoRecorte(item.dataAbertura, desde, ate)) continue;
    const atual = map.get(item.idProposta) ?? {
      idProposta: item.idProposta,
      codigoProposta: item.codigoProposta,
      dataAbertura: item.dataAbertura,
      idCliente: item.idCliente,
      cliente: item.cliente,
      codigoCliente: item.codigoCliente,
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
 * Cliente novo = nunca comprou nada da empresa até o contato: nenhum pedido de qualquer produto
 * (pedido de estoque e item cancelado não contam) antes da data do contato.
 */
export function clienteNovo(idCliente: number, contato: string, primeiroPedidoEmpresa: string): boolean {
  if (idCliente <= 0 || !contato) return false;
  return !primeiroPedidoEmpresa || primeiroPedidoEmpresa >= contato;
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
  primeiroPedidoEmpresa: Map<number, string> = new Map()
): LinhaClienteFunil[] {
  const primeiraPropostaRecorte = new Map<number, string>();
  const cadastro = new Map<number, string>();
  for (const item of propostas) {
    if (item.dataCadastroCliente && !cadastro.has(item.idCliente)) cadastro.set(item.idCliente, item.dataCadastroCliente);
    if (!dataNoRecorte(item.dataAbertura, desde, ate)) continue;
    const atual = primeiraPropostaRecorte.get(item.idCliente);
    if (!atual || item.dataAbertura < atual) primeiraPropostaRecorte.set(item.idCliente, item.dataAbertura);
  }

  type Acc = { cliente: string; codigoCliente: string; propostas: Set<number>; pedidos: Set<number>; valor: number };
  const porCliente = new Map<number, Acc>();
  const acc = (id: number, cliente: string, codigoCliente: string): Acc => {
    const atual = porCliente.get(id) ?? { cliente, codigoCliente, propostas: new Set(), pedidos: new Set(), valor: 0 };
    porCliente.set(id, atual);
    return atual;
  };
  const clienteDaProposta = new Map<number, number>();
  for (const item of propostas) {
    if (!dataNoRecorte(item.dataAbertura, desde, ate)) continue;
    acc(item.idCliente, item.cliente, item.codigoCliente).propostas.add(item.idProposta);
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
      const contato = primeiraPropostaRecorte.get(idCliente) ?? '';
      const dataCadastro = idCliente > 0 ? (cadastro.get(idCliente) ?? '') : '';
      const pedidoEmpresa = idCliente > 0 ? (primeiroPedidoEmpresa.get(idCliente) ?? '') : '';
      return {
        idCliente,
        cliente: linha.cliente,
        codigoCliente: linha.codigoCliente,
        dataCadastro,
        primeiroContato: contato,
        primeiroPedidoEmpresa: pedidoEmpresa,
        novo: clienteNovo(idCliente, contato, pedidoEmpresa),
        qtdPropostas: linha.propostas.size,
        qtdPedidos: linha.pedidos.size,
        valorVendido: round2(linha.valor),
      };
    })
    .sort((a, b) => b.valorVendido - a.valorVendido || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

function pedidosDoRecorte(pedidos: LinhaPedidoItem[], desde: string, ate: string, deProposta?: boolean): LinhaPedidoItem[] {
  return pedidos.filter(
    (r) => dataNoRecorte(r.dataEmissao, desde, ate) && (deProposta == null || r.pedidoDeProposta === deProposta)
  );
}

/** Pedidos gerados pelas propostas abertas no recorte, mesmo que o pedido seja de mês posterior. */
export function pedidosGeradosPelasPropostas(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[],
  vinculos: VinculoPropostaPedido[],
  desde: string,
  ate: string,
  /** Inclui os itens de porta-pallet. A soma deles é o valor vendido da linha. */
  comItens = false
): LinhaPedidoGerado[] {
  const propostasRecorte = new Map<number, { codigo: string; cliente: string; codigoCliente: string }>();
  for (const item of propostas) {
    if (!dataNoRecorte(item.dataAbertura, desde, ate)) continue;
    propostasRecorte.set(item.idProposta, {
      codigo: item.codigoProposta,
      cliente: item.cliente,
      codigoCliente: item.codigoCliente,
    });
  }
  const itensPorPedido = new Map<number, ItemPedidoGerado[]>();
  for (const item of pedidos) {
    const lista = itensPorPedido.get(item.idPedido) ?? [];
    lista.push({
      idItem: item.idItem,
      codigoProduto: item.codigoProduto,
      descricaoProduto: item.descricaoProduto,
      valorVendido: item.valorVendido,
    });
    itensPorPedido.set(item.idPedido, lista);
  }

  const porPedido = new Map<number, LinhaPedidoGerado & { origens: Set<string> }>();
  for (const v of vinculos) {
    const origem = propostasRecorte.get(v.idProposta);
    if (!origem) continue;
    const atual = porPedido.get(v.idPedido) ?? {
      idPedido: v.idPedido,
      codigoPedido: v.codigoPedido,
      dataEmissao: v.dataEmissao,
      cliente: origem.cliente,
      codigoCliente: origem.codigoCliente,
      propostasOrigem: '',
      valorVendido: round2((itensPorPedido.get(v.idPedido) ?? []).reduce((s, i) => s + i.valorVendido, 0)),
      contaNaVenda: itensPorPedido.has(v.idPedido),
      origens: new Set<string>(),
      ...(comItens
        ? {
            itens: [...(itensPorPedido.get(v.idPedido) ?? [])].sort(
              (a, b) => a.codigoProduto.localeCompare(b.codigoProduto, 'pt-BR') || a.idItem - b.idItem
            ),
          }
        : {}),
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
    if (!dataNoRecorte(g.dataEmissao, desde, ate)) geradosForaDoPeriodo += 1;
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
  ate: string,
  primeiroPedidoEmpresa: Map<number, string> = new Map()
): FunilPortaPallets {
  const clientes = clientesDoFunil(propostas, pedidos, vinculos, desde, ate, primeiroPedidoEmpresa);
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

const DATA_INICIO = `${MES_INICIO}-01`;

function dataValida(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`));
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const dia = new Date(Date.UTC(a!, m!, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

/** Recorte em datas ISO (AAAA-MM-DD). Aceita dia ou mês na entrada; limita a jan/2018 → hoje. */
function recorteEfetivo(recorte?: RecortePortaPallets): { desde: string; ate: string } {
  const hoje = hojeIso();
  const ateIn = recorte?.ate;
  const desdeIn = recorte?.desde;
  let ate = dataValida(ateIn) ? ateIn : mesValido(ateIn) ? ultimoDiaDoMes(ateIn) : hoje;
  let desde = dataValida(desdeIn) ? desdeIn : mesValido(desdeIn) ? `${desdeIn}-01` : DATA_INICIO;
  if (ate > hoje) ate = hoje;
  if (ate < DATA_INICIO) ate = DATA_INICIO;
  if (desde < DATA_INICIO) desde = DATA_INICIO;
  if (desde > ate) desde = ate;
  return { desde, ate };
}

/** Mesma data no ano anterior; 29/02 vira 28/02. */
function menosUmAno(data: string): string {
  const [a, m, dia] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a! - 1, m!, 0)).getUTCDate();
  return `${a! - 1}-${String(m).padStart(2, '0')}-${String(Math.min(dia!, ultimo)).padStart(2, '0')}`;
}

function montarMensal(
  base: CacheBase,
  desde: string,
  ate: string
): { meses: MesPortaPallets[]; totais: MesPortaPallets; funil: FunilPortaPallets } {
  const { meses: mesesBase, totais: totaisBase } = agregarMeses(base.propostas, base.pedidos, ate, desde);
  const funil = montarFunil(
    base.propostas,
    base.pedidos,
    base.vinculos,
    totaisBase,
    desde,
    ate,
    base.primeiroPedidoEmpresa
  );
  const meses = mesesBase.map((m) => {
    const r = recorteDoMes(m.mes, desde, ate);
    const gerados = pedidosGeradosPelasPropostas(base.propostas, base.pedidos, base.vinculos, r.desde, r.ate);
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
  return { meses, totais, funil };
}

export interface AuditoriaMensalPortaPallets {
  desde: string;
  ate: string;
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  /** clienteNovo segue o funil do recorte inteiro (clientesDoFunil). */
  propostas: Array<LinhaConversaoMes & { mes: string; clienteNovo: boolean; dataCadastroCliente: string }>;
  pedidosGerados: Array<LinhaPedidoGerado & { mes: string }>;
  clientes: Array<LinhaClienteMes & { mes: string; primeiraCompra: boolean }>;
  erro?: string;
}

/** Linhas de cada mês da Auditoria mensal, com as mesmas funções dos modais de cada célula. */
export async function obterPortaPalletsAuditoriaMensal(
  refresh = false,
  recorte?: RecortePortaPallets,
  filtros?: FiltrosPortaPallets
): Promise<AuditoriaMensalPortaPallets> {
  const { desde, ate } = recorteEfetivo(recorte);
  try {
    const base = await baseFiltrada(refresh, filtros);
    const { meses, totais } = montarMensal(base, desde, ate);
    const ordem = [...meses].sort((a, b) => b.mes.localeCompare(a.mes)).map((m) => m.mes);
    const clientesFunil = new Map(
      clientesDoFunil(base.propostas, base.pedidos, base.vinculos, desde, ate, base.primeiroPedidoEmpresa).map(
        (c) => [c.idCliente, c]
      )
    );
    const propostas: AuditoriaMensalPortaPallets['propostas'] = [];
    const pedidosGerados: AuditoriaMensalPortaPallets['pedidosGerados'] = [];
    const clientes: AuditoriaMensalPortaPallets['clientes'] = [];
    for (const mes of ordem) {
      const rm = recorteDoMes(mes, desde, ate);
      for (const r of conversoesDoMes(base.propostas, rm.desde, rm.ate, false)) {
        const c = clientesFunil.get(r.idCliente);
        propostas.push({ mes, ...r, clienteNovo: c?.novo ?? false, dataCadastroCliente: c?.dataCadastro ?? '' });
      }
      for (const r of pedidosGeradosPelasPropostas(base.propostas, base.pedidos, base.vinculos, rm.desde, rm.ate)) {
        pedidosGerados.push({ mes, ...r });
      }
      const primeira = new Set(
        clientesDoMes(base.pedidos, base.propostas, rm.desde, rm.ate, true).map((c) => c.idCliente)
      );
      for (const r of clientesDoMes(base.pedidos, base.propostas, rm.desde, rm.ate, false)) {
        clientes.push({ mes, ...r, primeiraCompra: primeira.has(r.idCliente) });
      }
    }
    return { desde, ate, meses, totais, propostas, pedidosGerados, clientes };
  } catch (err) {
    const vazioTotal = fecharMes(vazio('total'), 0, 0);
    return {
      desde,
      ate,
      meses: [],
      totais: vazioTotal,
      propostas: [],
      pedidosGerados: [],
      clientes: [],
      erro: formatNomusErroConexao(err),
    };
  }
}

export async function obterPortaPalletsMensal(
  refresh = false,
  recorte?: RecortePortaPallets,
  filtros?: FiltrosPortaPallets
): Promise<PortaPalletsMensal> {
  const { desde, ate } = recorteEfetivo(recorte);
  try {
    const base = await baseFiltrada(refresh, filtros);
    const antDesde = menosUmAno(desde);
    const antAte = menosUmAno(ate);
    const anoAnterior =
      antAte < DATA_INICIO
        ? null
        : {
            desde: antDesde < DATA_INICIO ? DATA_INICIO : antDesde,
            ate: antAte,
            meses: montarMensal(base, antDesde < DATA_INICIO ? DATA_INICIO : antDesde, antAte).meses,
          };
    return { grupo: 'Família 95 — Porta palete', desde, ate, ...montarMensal(base, desde, ate), anoAnterior };
  } catch (err) {
    const vazioTotal = fecharMes(vazio('total'), 0, 0);
    return {
      grupo: 'Família 95 — Porta palete',
      desde,
      ate,
      meses: [],
      totais: vazioTotal,
      funil: funilVazio(),
      anoAnterior: null,
      erro: formatNomusErroConexao(err),
    };
  }
}

export async function obterPortaPalletsDetalhe(
  mes: string,
  indicador: IndicadorPortaPallets,
  refresh = false,
  recorte?: RecortePortaPallets,
  filtros?: FiltrosPortaPallets
): Promise<DetalhePortaPallets & { erro?: string }> {
  const unico = mesValido(mes) ? mes : '';
  const temRecorte = [recorte?.desde, recorte?.ate].some((v) => mesValido(v) || dataValida(v));
  if (!unico && !temRecorte) {
    return { indicador: 'propostas', rows: [], erro: 'Mês inválido.' };
  }
  const efetivo = recorteEfetivo(recorte);
  const { desde, ate } = unico
    ? temRecorte
      ? recorteDoMes(unico, efetivo.desde, efetivo.ate)
      : { desde: unico, ate: unico }
    : efetivo;
  try {
    const base = await baseFiltrada(refresh, filtros);
    if (indicador === 'propostas') {
      return { indicador, rows: base.propostas.filter((r) => dataNoRecorte(r.dataAbertura, desde, ate)) };
    }
    if (indicador === 'pedidos') {
      return { indicador, rows: pedidosDoRecorte(base.pedidos, desde, ate) };
    }
    if (indicador === 'pedidos_gerados') {
      return {
        indicador,
        rows: pedidosGeradosPelasPropostas(base.propostas, base.pedidos, base.vinculos, desde, ate, true),
      };
    }
    if (indicador === 'clientes' || indicador === 'primeira') {
      return {
        indicador,
        rows: clientesDoMes(base.pedidos, base.propostas, desde, ate, indicador === 'primeira'),
      };
    }
    if (
      indicador === 'clientes_total' ||
      indicador === 'clientes_com_pedido' ||
      indicador === 'clientes_novos' ||
      indicador === 'novos_com_pedido'
    ) {
      const clientes = clientesDoFunil(
        base.propostas,
        base.pedidos,
        base.vinculos,
        desde,
        ate,
        base.primeiroPedidoEmpresa
      );
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

export async function obterPortaPalletsDadosAbertos(
  refresh = false,
  filtros?: FiltrosPortaPallets
): Promise<{
  propostas: LinhaPropostaItem[];
  pedidos: LinhaPedidoItem[];
  erro?: string;
}> {
  try {
    const base = await baseFiltrada(refresh, filtros);
    const ate = mesAtual();
    return {
      propostas: base.propostas.filter((r) => r.mes >= MES_INICIO && r.mes <= ate),
      pedidos: base.pedidos.filter((r) => r.mes >= MES_INICIO && r.mes <= ate),
    };
  } catch (err) {
    return { propostas: [], pedidos: [], erro: formatNomusErroConexao(err) };
  }
}
