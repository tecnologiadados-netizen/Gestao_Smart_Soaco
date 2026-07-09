/**
 * Pendências compras — produtos com SC e/ou Ag Pag por comprador (atributo 674).
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import {
  listarPrioridadesFixasPorComprador,
  prioridadesFixasParaMapa,
} from './pendenciasComprasPrioridadeFixaRepository.js';
import {
  anexarPrioridadeFixaNasLinhas,
  aplicarPrioridadesFixasPendenciasCompras,
} from '../utils/pendenciasComprasOrdenacao.js';
import {
  COLETAS_EXCLUIR_SETOR2_ALMOX,
  NOMUS_ATRIBUTO_COLETA,
  NOMUS_SETOR_ESTOQUE_PADRAO,
  PCP_ID_EMPRESA_SO_ACO,
  SQL_SETORES_ESTOQUE_VERIFICAR_PCP_IN,
  STATUS_COTACAO_AGPAG_SQL,
  TIPOS_PRODUTO_CONSULTA_SQL,
  SQL_COND_SETOR2_NAO_EXCLUIDO_POR_COLETA,
} from './sql/sqlComprasEstoqueFragments.js';

export type EstoqueExibicaoPendencias = 'saldo' | 'verificar_pcp' | 'nao_controlado';

const SQL_COLETAS_EXCLUIR_SETOR2_IN = COLETAS_EXCLUIR_SETOR2_ALMOX.map((c) =>
  `'${c.replace(/'/g, "''")}'`
).join(', ');

export type PendenciasComprasDestaques = {
  codigo: 'zerado_com_sc' | 'zerado_com_agpag' | 'necessidade_acima_40d' | null;
  agPag: 'menos_24h' | 'mais_24h' | null;
  pc: 'atrasado' | 'em_dia' | null;
};

export type PendenciasComprasLinha = {
  idProduto: number;
  codigo: string;
  descricao: string;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  solicitacao: number;
  agPag: number;
  pedidoCompra: number;
  estoqueAtual: number;
  /** Regra da coluna Estoque conforme estoque padrão (produtoempresa.idSetorEstoquePadrao). */
  estoqueExibicao: EstoqueExibicaoPendencias;
  nomeColeta: string;
  destaques: PendenciasComprasDestaques;
  /** Grupo de prioridade automática (coleta / necessidade — como na planilha Excel). */
  prioridadeAutomatica: number;
  /** Prioridade fixa manual do usuário (null = ordem automática). */
  prioridadeFixa: number | null;
  /** Posição na ordem automática do Nomus (0-based). */
  indiceOrdemAutomatica: number;
};

const SQL_OPCOES_COMPRADOR = `
Select Distinct Coalesce(alo.opcao, 'A Definir') As comprador
From atributoprodutovalor apv
Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
Where apv.idAtributo = 674
Order By comprador
`;

/** Compradores sem equipe ativa — não exibir no filtro. */
const COMPRADORES_PENDENCIAS_EXCLUIDOS = new Set(['Comprador 4', 'Comprador 5']);

const SQL_CONSULTAR = `
With sc_abertas As (
  Select
    sc.id,
    sc.idProduto,
    sc.quantidade - Coalesce(ate.qtdeAtendida, 0) As saldo,
    sc.dataEmissao,
    sc.dataNecessidade
  From solicitacaocompra sc
  Left Join (
    Select idSolicitacaoCompra, Sum(qtdeAtendida) As qtdeAtendida
    From solicitacaocompraitempedidocompra
    Group By idSolicitacaoCompra
  ) ate On ate.idSolicitacaoCompra = sc.id
  Where sc.status In (2, 6)
    And sc.lixeira Is Null
    And sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
),
produtos_filtrados As (
  Select Distinct
    p.id,
    p.nome As codigo,
    p.descricao,
    p.idTipoProduto,
    Coalesce(attr_coleta.opcao, 'A DEFINIR') As nomeColeta
  From produto p
  Left Join (
    Select apv.idProduto, alo.opcao
    From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = 674
  ) attr_comprador On attr_comprador.idProduto = p.id
  Left Join (
    Select apv.idProduto, alo.opcao
    From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
    Where apv.idAtributo = ${NOMUS_ATRIBUTO_COLETA}
  ) attr_coleta On attr_coleta.idProduto = p.id
  Where Coalesce(attr_comprador.opcao, 'A Definir') = ?
    And p.ativo = 1
    And (
      Exists (Select 1 From sc_abertas sc Where sc.idProduto = p.id)
      Or Exists (
        Select 1
        From itemcotacaocompra icc
        Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
        Where icc.idProduto = p.id
          And cc.status In (${STATUS_COTACAO_AGPAG_SQL})
      )
    )
),
coleta_min_necessidade As (
  Select
    pf.nomeColeta,
    Min(Cast(sc.dataNecessidade As Date)) As minDataNecessidadeColeta
  From sc_abertas sc
  Inner Join produtos_filtrados pf On pf.id = sc.idProduto
  Group By pf.nomeColeta
),
coleta_prioridade As (
  Select
    cmn.nomeColeta,
    cmn.minDataNecessidadeColeta,
    Dense_Rank() Over (
      Order By
        cmn.minDataNecessidadeColeta Asc,
        cmn.nomeColeta Asc
    ) As prioridadeAutomatica
  From coleta_min_necessidade cmn
)
Select
  pf.id As idProduto,
  pf.codigo,
  pf.descricao,
  pf.nomeColeta,
  Date_Format(sc_dates.dataEmissaoMin, '%d/%m/%Y') As dataEmissao,
  Date_Format(sc_dates.dataNecessidadeMin, '%d/%m/%Y') As dataNecessidade,
  sc_dates.todasNecessidadeAcima40d,
  Round(Coalesce(sc_liq.solicitacao, 0), 2) As solicitacao,
  Round(Coalesce(cot_agg.qtde, 0), 2) As agPag,
  Round(Coalesce(pc_agg.qtde, 0), 2) As pedidoCompra,
  Round(Coalesce(saldo_agg.saldo, 0), 2) As estoqueAtual,
  Case
    When Coalesce(est_pad.idSetorEstoquePadrao, 0) = ${NOMUS_SETOR_ESTOQUE_PADRAO.MATERIAL_SECUNDARIO} Then 'saldo'
    When est_pad.idSetorEstoquePadrao In (${SQL_SETORES_ESTOQUE_VERIFICAR_PCP_IN}) Then 'verificar_pcp'
    Else 'nao_controlado'
  End As estoqueExibicao,
  cot_recente.horasDesdeEmissao,
  pc_flags.pcAtrasado,
  cmn.minDataNecessidadeColeta,
  cp.prioridadeAutomatica,
  sc_ordem.scIdMin
From produtos_filtrados pf
Left Join (
  Select pe.idProduto, pe.idSetorEstoquePadrao
  From produtoempresa pe
  Where pe.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
) est_pad On est_pad.idProduto = pf.id
Left Join (
  Select Distinct pe.idProduto
  From produtoempresa pe
  Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
  Where pe.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO} And pese.idSetorEstoque = 2
) vinc_s2 On vinc_s2.idProduto = pf.id
Left Join (
  Select
    sc.idProduto,
    Min(Cast(sc.dataEmissao As Date)) As dataEmissaoMin,
    Min(Cast(sc.dataNecessidade As Date)) As dataNecessidadeMin,
    Case
      When Count(*) = 0 Then 0
      When Min(Cast(sc.dataNecessidade As Date)) > Date_Add(CurDate(), Interval 40 Day) Then 1
      Else 0
    End As todasNecessidadeAcima40d
  From sc_abertas sc
  Inner Join produtos_filtrados pf2 On pf2.id = sc.idProduto
  Group By sc.idProduto
) sc_dates On sc_dates.idProduto = pf.id
Left Join (
  Select sc.idProduto, Min(sc.id) As scIdMin
  From sc_abertas sc
  Inner Join produtos_filtrados pf4 On pf4.id = sc.idProduto
  Group By sc.idProduto
) sc_ordem On sc_ordem.idProduto = pf.id
Left Join coleta_min_necessidade cmn On cmn.nomeColeta = pf.nomeColeta
Left Join coleta_prioridade cp On cp.nomeColeta = pf.nomeColeta
Left Join (
  Select
    p2.id As idProduto,
    Greatest(
      0,
      Coalesce(sc_bruto.qtde_bruta, 0) - Coalesce(cot_agg2.qtde, 0)
    ) As solicitacao
  From produto p2
  Left Join (
    Select
      a3.idProduto,
      Sum((a3.quantidade) - Coalesce(ate.qtdeAtendida, 0)) As qtde_bruta
    From solicitacaocompra a3
    Left Join (
      Select idSolicitacaoCompra, Sum(qtdeAtendida) As qtdeAtendida
      From solicitacaocompraitempedidocompra
      Group By idSolicitacaoCompra
    ) ate On ate.idSolicitacaoCompra = a3.id
    Where a3.status In (2, 6) And a3.lixeira Is Null And a3.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
    Group By a3.idProduto
  ) sc_bruto On sc_bruto.idProduto = p2.id
  Left Join (
    Select icc.idProduto, Sum(icc.qtde) As qtde
    From itemcotacaocompra icc
    Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
    Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
    Group By icc.idProduto
  ) cot_agg2 On cot_agg2.idProduto = p2.id
) sc_liq On sc_liq.idProduto = pf.id
Left Join (
  Select icc.idProduto, Sum(icc.qtde) As qtde
  From itemcotacaocompra icc
  Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
  Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
  Group By icc.idProduto
) cot_agg On cot_agg.idProduto = pf.id
Left Join (
  Select
    ipc.idProduto,
    Sum(ipc.qtde - IfNull(ipc.qtdeAtendida, 0)) As qtde
  From itempedidocompra ipc
  Where ipc.status In (2, 3, 4)
    And (ipc.qtde - IfNull(ipc.qtdeAtendida, 0)) > 0
  Group By ipc.idProduto
) pc_agg On pc_agg.idProduto = pf.id
Left Join (
  With ultimo_saldo_setor As (
    Select
      sep.idProduto,
      sep.idSetorEstoque,
      pf2.idTipoProduto,
      se.consideraComoSaldoDisponivel,
      Coalesce(attr_coleta2.opcao, '') As coleta,
      Case When sep.saldoSetorFinal <= 0 Then 0 Else sep.saldoSetorFinal End As saldo,
      Row_Number() Over (
        Partition By sep.idProduto, sep.idSetorEstoque
        Order By sep.dataMovimentacao Desc, sep.id Desc
      ) As rn
    From saldoestoque_produto sep
    Inner Join setorestoque se On se.id = sep.idSetorEstoque
    Inner Join produtos_filtrados pf2 On pf2.id = sep.idProduto
    Left Join (
      Select apv.idProduto, alo.opcao
      From atributoprodutovalor apv
      Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
      Where apv.idAtributo = ${NOMUS_ATRIBUTO_COLETA}
    ) attr_coleta2 On attr_coleta2.idProduto = sep.idProduto
    Where se.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
  ),
  vinculo_setor2 As (
    Select Distinct pe.idProduto
    From produtoempresa pe
    Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
    Inner Join produtos_filtrados pf3 On pf3.id = pe.idProduto
    Where pe.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO} And pese.idSetorEstoque = 2
  ),
  saldo_por_setor As (
    Select us.idProduto, us.saldo
    From ultimo_saldo_setor us
    Left Join vinculo_setor2 v2 On v2.idProduto = us.idProduto
    Where us.rn = 1
      And (
        (us.idTipoProduto = 8 And us.idSetorEstoque = 5)
        Or (us.idTipoProduto = 15 And us.idSetorEstoque = 24)
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Not Null
          And us.idSetorEstoque = 2
          And ${SQL_COND_SETOR2_NAO_EXCLUIDO_POR_COLETA}
        )
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And v2.idProduto Is Null
          And us.consideraComoSaldoDisponivel = 1
          And Exists (
            Select 1
            From produtoempresa pe2
            Inner Join produtoempresa_setorestoque pese2 On pese2.idProdutoEmpresa = pe2.id
            Where pe2.idProduto = us.idProduto
              And pe2.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
              And pese2.idSetorEstoque = us.idSetorEstoque
          )
        )
        Or (
          us.idTipoProduto In (${TIPOS_PRODUTO_CONSULTA_SQL})
          And us.idTipoProduto Not In (8, 15)
          And us.idSetorEstoque In (5, 24)
        )
      )
  )
  Select idProduto, Sum(saldo) As saldo
  From saldo_por_setor
  Group By idProduto
) saldo_agg On saldo_agg.idProduto = pf.id
Left Join (
  Select
    icc.idProduto,
    Max(TimestampDiff(Hour, cc.dataEmissao, Now())) As horasDesdeEmissao
  From itemcotacaocompra icc
  Inner Join cotacaocompra cc On cc.id = icc.idCotacaoCompra
  Where cc.status In (${STATUS_COTACAO_AGPAG_SQL})
  Group By icc.idProduto
) cot_recente On cot_recente.idProduto = pf.id
Left Join (
  Select
    ipc.idProduto,
    Max(
      Case
        When ipc.dataEntrega Is Not Null
          And scn.minNecessidade Is Not Null
          And Cast(ipc.dataEntrega As Date) > scn.minNecessidade
        Then 1
        Else 0
      End
    ) As pcAtrasado
  From itempedidocompra ipc
  Left Join (
    Select idProduto, Min(Cast(dataNecessidade As Date)) As minNecessidade
    From sc_abertas
    Group By idProduto
  ) scn On scn.idProduto = ipc.idProduto
  Where ipc.status In (2, 3, 4)
    And (ipc.qtde - IfNull(ipc.qtdeAtendida, 0)) > 0
  Group By ipc.idProduto
) pc_flags On pc_flags.idProduto = pf.id
Where Coalesce(sc_liq.solicitacao, 0) > 0
   Or Coalesce(cot_agg.qtde, 0) > 0
Order By
  Coalesce(cp.prioridadeAutomatica, 9999) Asc,
  pf.nomeColeta Asc,
  Coalesce(sc_dates.dataNecessidadeMin, '9999-12-31') Asc,
  Coalesce(sc_ordem.scIdMin, 999999999) Asc,
  pf.codigo Asc
`;

function parseEstoqueExibicao(valor: unknown): EstoqueExibicaoPendencias {
  const s = String(valor ?? '').trim();
  if (s === 'verificar_pcp' || s === 'nao_controlado') return s;
  return 'saldo';
}

function montarDestaques(row: Record<string, unknown>): PendenciasComprasDestaques {
  const exibeSaldo = parseEstoqueExibicao(row.estoqueExibicao) === 'saldo';
  const estoque = Number(row.estoqueAtual ?? 0);
  const solicitacao = Number(row.solicitacao ?? 0);
  const agPag = Number(row.agPag ?? 0);
  const pedidoCompra = Number(row.pedidoCompra ?? 0);
  const horas = row.horasDesdeEmissao != null ? Number(row.horasDesdeEmissao) : null;
  const pcAtrasado = Number(row.pcAtrasado ?? 0) === 1;
  const todasAcima40 = Number(row.todasNecessidadeAcima40d ?? 0) === 1;

  let codigo: PendenciasComprasDestaques['codigo'] = null;
  if (exibeSaldo && estoque <= 0 && agPag > 0) codigo = 'zerado_com_agpag';
  else if (exibeSaldo && estoque <= 0 && solicitacao > 0) codigo = 'zerado_com_sc';
  else if (todasAcima40 && solicitacao > 0) codigo = 'necessidade_acima_40d';

  let agPagDestaque: PendenciasComprasDestaques['agPag'] = null;
  if (agPag > 0 && horas != null) {
    agPagDestaque = horas < 24 ? 'menos_24h' : 'mais_24h';
  }

  let pc: PendenciasComprasDestaques['pc'] = null;
  if (pedidoCompra > 0) {
    pc = pcAtrasado ? 'atrasado' : 'em_dia';
  }

  return { codigo, agPag: agPagDestaque, pc };
}

export async function listarOpcoesCompradorPendencias(): Promise<{
  data: string[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = (await pool.query(SQL_OPCOES_COMPRADOR)) as [Record<string, unknown>[], unknown];
    const data = (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.comprador ?? '').trim())
      .filter((c) => Boolean(c) && !COMPRADORES_PENDENCIAS_EXCLUIDOS.has(c));
    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

export async function consultarPendenciasCompras(
  comprador: string
): Promise<{
  data: PendenciasComprasLinha[];
  erro?: string;
}> {
  const compradorTrim = comprador.trim();
  if (!compradorTrim) return { data: [], erro: 'Informe o comprador.' };
  if (COMPRADORES_PENDENCIAS_EXCLUIDOS.has(compradorTrim)) {
    return { data: [], erro: 'Comprador não disponível.' };
  }

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = (await pool.query(SQL_CONSULTAR, [compradorTrim])) as [
      Record<string, unknown>[],
      unknown,
    ];

    const linhasBase = (Array.isArray(rows) ? rows : []).map((r, indiceOrdemAutomatica) => {
      const solicitacao = Number(r.solicitacao ?? 0);
      const agPag = Number(r.agPag ?? 0);
      /** Datas só quando há saldo real em Solicitação (não quando já virou Ag Pag ou PC). */
      const exibirDatasSc = solicitacao > 0;
      return {
        idProduto: Number(r.idProduto ?? 0),
        codigo: String(r.codigo ?? ''),
        descricao: String(r.descricao ?? ''),
        dataEmissao: exibirDatasSc && r.dataEmissao ? String(r.dataEmissao) : null,
        dataNecessidade: exibirDatasSc && r.dataNecessidade ? String(r.dataNecessidade) : null,
        solicitacao,
        agPag,
        pedidoCompra: Number(r.pedidoCompra ?? 0),
        estoqueAtual: Number(r.estoqueAtual ?? 0),
        estoqueExibicao: parseEstoqueExibicao(r.estoqueExibicao),
        nomeColeta: String(r.nomeColeta ?? ''),
        destaques: montarDestaques(r),
        prioridadeAutomatica: Number(r.prioridadeAutomatica ?? 9999),
        indiceOrdemAutomatica,
      };
    });

    const prioridadesRows = await listarPrioridadesFixasPorComprador(compradorTrim);
    const prioridadesMap = prioridadesFixasParaMapa(prioridadesRows);
    const reordenadas = aplicarPrioridadesFixasPendenciasCompras(linhasBase, prioridadesMap);
    const data = anexarPrioridadeFixaNasLinhas(reordenadas, prioridadesMap);

    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}

export type PendenciasSaldoSetorDetalheRow = {
  idSetor: number;
  setor: string;
  saldo: number;
  setorPrincipal: boolean;
};

const SQL_SALDO_SETORES_HABILITADOS = `
With setores_habilitados As (
  Select
    pese.idSetorEstoque As idSetor,
    se.nome As setor
  From produtoempresa pe
  Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
  Inner Join setorestoque se On se.id = pese.idSetorEstoque And se.idEmpresa = pe.idEmpresa
  Where pe.idProduto = ? And pe.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
),
setor_padrao As (
  Select Coalesce(pe.idSetorEstoquePadrao, 0) As idSetorPadrao
  From produtoempresa pe
  Where pe.idProduto = ? And pe.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
  Limit 1
),
ultimo_saldo As (
  Select
    sep.idSetorEstoque,
    Case When sep.saldoSetorFinal <= 0 Then 0 Else sep.saldoSetorFinal End As saldo,
    Row_Number() Over (
      Partition By sep.idSetorEstoque
      Order By sep.dataMovimentacao Desc, sep.id Desc
    ) As rn
  From saldoestoque_produto sep
  Where sep.idProduto = ?
)
Select
  sh.idSetor,
  sh.setor,
  Coalesce(us.saldo, 0) As saldo,
  Case When sh.idSetor = sp.idSetorPadrao Then 1 Else 0 End As setorPrincipal
From setores_habilitados sh
Cross Join setor_padrao sp
Left Join ultimo_saldo us On us.idSetorEstoque = sh.idSetor And us.rn = 1
Order By
  Case When sh.idSetor = sp.idSetorPadrao Then 0 Else 1 End,
  sh.setor Asc
`;

export async function listarSaldoSetoresHabilitadosPendencias(
  idProduto: number
): Promise<{ data: PendenciasSaldoSetorDetalheRow[]; erro?: string }> {
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { data: [], erro: 'idProduto inválido.' };
  }

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { data: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = (await pool.query(SQL_SALDO_SETORES_HABILITADOS, [
      idProduto,
      idProduto,
      idProduto,
    ])) as [Record<string, unknown>[], unknown];

    const data = (Array.isArray(rows) ? rows : []).map((r) => ({
      idSetor: Number(r.idSetor ?? 0),
      setor: String(r.setor ?? '').trim(),
      saldo: Number(r.saldo ?? 0),
      setorPrincipal: Number(r.setorPrincipal ?? 0) === 1,
    }));

    return { data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: [], erro: msg };
  }
}
