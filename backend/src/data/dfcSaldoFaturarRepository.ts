/**
 * Saldo a faturar (parcelas de PD) para a DFC — consulta Nomus + previsão do Gerenciador de Pedidos.
 */

import { getNomusPool } from '../config/nomusDb.js';
import { getPrevisaoPorPedidoIdMap } from './pedidosRepository.js';
import {
  pcpEntregaFuturaNfeStatusSqlInList,
  pcpEntregaFuturaSqlInList,
} from '../config/pcpEntregaFutura.js';
import { ajustarDataProjVencFimSemana, formatSqlDateYmd } from './dfcDateUtils.js';

const SQL_SALDO_FATURAR_BASE = `
select
    pd.idEmpresa,
    pd.id as idPedido,
    tpd.nome as 'Tipo Pedido',
    pp.id as idParcela,
    pd.nome,
    pd.dataEmissao,
 	pp.dataVencimento,
 	DATEDIFF(pp.dataVencimento,pd.dataEmissao) as parc,
    upper(pe.nome) as 'Cliente',
    aloreq.opcao as 'Requisicao de loja do grupo?',
    case 
        when (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Retirada%'
        or (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Entrega%'
        then 'PI'
        else ifnull(m.uf, mc.uf)
    end as 'UF',
    case 
        when (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Retirada%'
        or (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Entrega%'
        then 'Teresina'
        else ifnull(m.nome, mc.nome)
    end as 'Municipio de entrega',
    fp.nome as 'Forma de Pagamento',
    cp.nome as 'Condicao de pagamento do pedido de venda',
    case 
        when fp.nome like 'Cart%' then 0 
        else cast(replace(left(cp.regra, 2),',','') AS UNSIGNED) 
    end as regra,
    sum(round(ip.valorTotalComDesconto * ifnull(t.aliquotaIPI / 100, 0), 2) + ifnull(ip.valorTotalComDesconto, 0))
    as 'Valor Total com desconto + IPI do item PD',
    sum(
        (
            (
                round(ip.valorTotalComDesconto * ifnull(t.aliquotaIPI / 100, 0), 2)
                + ifnull(ip.valorTotalComDesconto, 0)
            ) / ip.qtde
        ) * ((ip.qtde - ip.qtdeAtendida) + coalesce(devol.qtdDevolvida, 0))
    ) as 'Valor Pendente',
    emp.opcao as 'Venda por qual empresa?',
    vr.nome as 'Vendedor/Representante',
    AVG(adt.valorAdiantamento) as 'Valor Adiantamento',
    sum(
        ((ip.qtde - ip.qtdeAtendida) + coalesce(devol.qtdDevolvida, 0))
        *
        (
            (
                round(ip.valorTotalComDesconto * ifnull(t.aliquotaIPI / 100, 0), 2)
                + ifnull(ip.valorTotalComDesconto, 0)
            ) / ip.qtde
        )
    ) as 'Saldo a Faturar Real',
    qp.qtdeParcelas
	from itempedido ip
	left join produto p on p.id = ip.idProduto
	left join pedido pd on pd.id = ip.idPedido
	left join tipopedido tpd on tpd.id = pd.idTipoPedido
	left join pessoa pe on pe.id = pd.idCliente
	left join grupoproduto gp on gp.id = p.idGrupoProduto
	left join tipoproduto tp on tp.id = p.idTipoProduto
	left join tributacao t on t.idItemPedido = ip.id
	left join 
	(select 
	id,
	idEntidadeOrigem,
	dataVencimento,
	idFormaPagamento,
	geraAdiantamento,
	valor 
	from parcelapagamento p 
	where p.discriminador = 'Pedido' and geraAdiantamento <> 1 )
	pp on pp.idEntidadeOrigem = pd.id
	left join 
	(select 
	idEntidadeOrigem,
	count(p.id) as qtdeParcelas
	from parcelapagamento p 
	where p.discriminador = 'Pedido' and geraAdiantamento <> 1
	group BY 
	p.idEntidadeOrigem )
	qp on qp.idEntidadeOrigem = pd.id
	left join (
	    select
	        apv.idProduto,
	        alo.opcao
	    from atributoprodutovalor apv
	    left join atributolistaopcao alo on alo.id = apv.idListaOpcao
	    where apv.idAtributo = 587
	) sr on sr.idProduto = p.id
	left join (
	    select 
	        pd.id,
	        aloreq.opcao
	    from pedido pd
	    left join atributopedidovalor apvreq on apvreq.idPedido = pd.id
	    left join atributolistaopcao aloreq on aloreq.id = apvreq.idListaOpcao 
	    where apvreq.idAtributo = 313
	) aloreq on aloreq.id = pd.id
	left join (
	    select 
	        pd.id,
	        aloret.opcao
	    from pedido pd
	    left join atributopedidovalor apvret on apvret.idPedido = pd.id
	    left join atributolistaopcao aloret on aloret.id = apvret.idListaOpcao 
	    where apvret.idAtributo = 360
	) aloret on aloret.id = pd.id
	left join (
	    select 
	        pd.id,
	        aloent.opcao
	    from pedido pd
	    left join atributopedidovalor apvent on apvent.idPedido = pd.id
	    left join atributolistaopcao aloent on aloent.id = apvent.idListaOpcao
	    where apvent.idAtributo = 300
	) aloent on aloent.id = pd.id
	left join condicaopagamento cp on cp.id = pd.idCondicaoPagamento
	left join endereco ed on ed.id = pd.idEnderecoLocalEntrega
	left join municipio m on ed.idMunicipio = m.id
	left join municipio mc on mc.id = pe.idMunicipio
	left join formapagamento fp on fp.id = pd.idFormaPagamento 
	left join (
	    select
	        ideipv.idItemPedidoVenda,
	        sum(ifnull(ide.valorTotalComDesconto, 0)) as valorTotalComDesconto,
	        sum(ifnull(t.valorIPI, 0)) as valorIPI
	    from itemdocumentoestoque_itempedidovenda ideipv
	    left join itemdocumentoestoque ide on ide.id = ideipv.idItemDocumentoEstoque
	    left join documentoestoque de_nf on de_nf.id = ide.idDocumentoSaida
	    left join nfe nfe_nf on nfe_nf.idDocumentoEstoque = de_nf.id
	    left join tributacao t on t.idItemPedido = ideipv.idItemPedidoVenda
	    where de_nf.idTipoMovimentacao in (${pcpEntregaFuturaSqlInList()})
	      and nfe_nf.status in (${pcpEntregaFuturaNfeStatusSqlInList()})
	    group by ideipv.idItemPedidoVenda
	) nfef on nfef.idItemPedidoVenda = ip.id
	left join (
	    select 
	        p.id,
	        p.nome,
	        sum(pg.valor) as valorAdiantamento
	    from parcelapagamento pg
	    left join pedido p on p.id = pg.idEntidadeOrigem
	    where geraAdiantamento = 1
	      and p.dataEmissao >= '2024-01-01'
	      and discriminador = 'Pedido'
	    group by 
	        p.id,
	        p.nome
	) adt on adt.id = pd.id
	left join (
	    select 
	        apv.idPedido,
	        alo.opcao
	    from atributopedidovalor apv 
	    left join atributolistaopcao alo on alo.id = apv.idListaOpcao 
	    where apv.idAtributo = 591
	) me on me.idPedido = pd.id
	left join (
	    select 
	        apev.idPedido,
	        alo.opcao
	    from atributopedidovalor apev
	    left join atributolistaopcao alo on alo.id = apev.idListaOpcao 
	    where apev.idAtributo = 592
	) emp on emp.idPedido = pd.id
	
	left join pessoa vr on vr.id = coalesce(pd.idVendedor, pd.idRepresentante)
	left join (
	    select
	        ip.id as idPedidoVenda,
	        sum(coalesce(ide.qtde, 0)) as qtdDevolvida
	    from itemdocumentoestoque ide
	    left join itemdocumentoestoque_itempedidovenda ideipv 
	        on ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao 
	    left join itempedido ip on ip.id = ideipv.idItemPedidoVenda 
	    left join tipomovimentacao tm on ide.idTipoMovimentacao = tm.id
	    where tm.id in (52, 55)
	      and ide.idItemOrigemDevolucao is not null
	      and ip.status in (2,3)
	    group by ip.id
	) devol on devol.idPedidoVenda = ip.id
	where ip.status in (2,3)
	  and qp.qtdeParcelas is not null and cp.nome not like '%Assist%'
	  and pe.id not in (12408,759,6990)
	  and (
	        pd.idEmpresa <> 2
	        or (
	            pd.idEmpresa = 2
	            and (
	                case 
	                    when me.opcao = 'Retirada na Só Móveis' then '2-Retirada na So Moveis'
	                    when me.opcao = 'Retirada na Só Aço' then '1-Retirada na So Aço'
	                    when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then '5-Requisicao'
	                    when ifnull(m.nome, mc.nome) in ('Timon','Teresina','Nazaria','Demerval Lobão','Curralinhos') and aloreq.opcao = 'Não' then '3-Entrega em Grande Teresina'
	                    else '4-Inserir em Romaneio'
	                end
	            ) not in (
	                '2-Retirada na So Moveis',
	                '1-Retirada na So Aço',
	                '3-Entrega em Grande Teresina',
	                '5-Requisicao'
	            )
	        )
	    )
	group by
	    pd.nome,
	       pp.id
`.trim();

/** Carga completa (projeção DFC / cache) — sem paginação. */
const LIMIT_ROWS = 8000;
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function formatYmdFromSqlDate(v: unknown): string | null {
  return formatSqlDateYmd(v);
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

export interface DfcSaldoFaturarLinha {
  idEmpresa: number;
  idPedido: number;
  tipoPedido: string | null;
  idParcela: number | null;
  pd: string | null;
  dataEmissao: string | null;
  dataPrevisao: string | null;
  dataVencimento: string | null;
  parc: number | null;
  cliente: string | null;
  requisicaoLojaGrupo: string | null;
  uf: string | null;
  municipioEntrega: string | null;
  formaPagamento: string | null;
  condicaoPagamento: string | null;
  regra: number | null;
  valorTotalComDescontoIpi: number;
  valorPendente: number;
  vendaPorEmpresa: string | null;
  vendedorRepresentante: string | null;
  valorAdiantamento: number | null;
  saldoFaturarReal: number;
  qtdeParcelas: number | null;
  dataProjVenc: string | null;
}

/** Cache curto para reutilizar saldo a faturar na DFC e no modal. */
let cacheSaldoFaturarLinhas: {
  expiresAt: number;
  idEmpresasKey: string;
  linhas: DfcSaldoFaturarLinha[];
} | null = null;
const CACHE_SALDO_FATURAR_MS = 90_000;
/** pd.idEmpresa no Nomus (1=Só Aço, 2=Só Móveis, 3=Refrigeração, 4=RN Marques). */
const ID_EMPRESAS_SALDO_FATURAR = new Set([1, 2, 3, 4]);

function normalizarIdsEmpresasSaldo(ids?: number[]): number[] {
  const raw = ids?.length ? ids : [1, 2];
  const out = raw.filter((n) => ID_EMPRESAS_SALDO_FATURAR.has(n));
  return out.length > 0 ? [...new Set(out)] : [1, 2];
}

function cacheKeyEmpresas(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(',');
}

/**
 * Data Proj Venc: se condição contém "Faturamento" → previsão; senão previsão + parc (dias).
 */
export function calcularDataProjVenc(
  linha: Pick<DfcSaldoFaturarLinha, 'dataPrevisao' | 'parc' | 'condicaoPagamento'>,
): string | null {
  const previsao = linha.dataPrevisao?.slice(0, 10);
  if (!previsao) return null;
  const cond = (linha.condicaoPagamento ?? '').toLowerCase();
  if (cond.includes('faturamento')) return previsao;
  const dias = linha.parc ?? 0;
  if (dias <= 0) return previsao;
  const d = new Date(`${previsao}T12:00:00`);
  if (Number.isNaN(d.getTime())) return previsao;
  d.setDate(d.getDate() + Math.round(dias));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface FiltrosDfcSaldoFaturar {
  idEmpresas?: number[];
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  dataVencimentoInicio?: string;
  dataVencimentoFim?: string;
  dataPrevisaoInicio?: string;
  dataPrevisaoFim?: string;
  pd?: string;
  cliente?: string;
  uf?: string;
  tipoPedido?: string;
  /** Paginação do modal (1-based). Omitir = carga completa até LIMIT_ROWS. */
  page?: number;
  limit?: number;
}

function mapRow(r: Record<string, unknown>, previsaoPorPedido: Map<number, string>): DfcSaldoFaturarLinha {
  const idPedido = toNum(r.idPedido ?? r['idPedido']);
  const base = {
    idEmpresa: toNum(r.idEmpresa ?? r['idEmpresa']),
    idPedido,
    tipoPedido: pickStr(r, 'Tipo Pedido', 'tipo pedido'),
    idParcela: r.idParcela != null ? toNum(r.idParcela) : null,
    pd: pickStr(r, 'nome', 'PD'),
    dataEmissao: formatYmdFromSqlDate(r.dataEmissao ?? r['dataEmissao']),
    dataPrevisao: previsaoPorPedido.get(idPedido) ?? null,
    dataVencimento: formatYmdFromSqlDate(r.dataVencimento ?? r['dataVencimento']),
    parc: r.parc != null ? toNum(r.parc) : null,
    cliente: pickStr(r, 'Cliente', 'cliente'),
    requisicaoLojaGrupo: pickStr(r, 'Requisicao de loja do grupo?', 'requisicao de loja do grupo?'),
    uf: pickStr(r, 'UF', 'uf'),
    municipioEntrega: pickStr(r, 'Municipio de entrega', 'municipio de entrega'),
    formaPagamento: pickStr(r, 'Forma de Pagamento', 'forma de pagamento'),
    condicaoPagamento: pickStr(r, 'Condicao de pagamento do pedido de venda', 'condicao de pagamento do pedido de venda'),
    regra: r.regra != null ? toNum(r.regra) : null,
    valorTotalComDescontoIpi: toNum(r['Valor Total com desconto + IPI do item PD']),
    valorPendente: toNum(r['Valor Pendente']),
    vendaPorEmpresa: pickStr(r, 'Venda por qual empresa?', 'venda por qual empresa?'),
    vendedorRepresentante: pickStr(r, 'Vendedor/Representante', 'vendedor/representante'),
    valorAdiantamento: r['Valor Adiantamento'] != null ? toNum(r['Valor Adiantamento']) : null,
    saldoFaturarReal: toNum(r['Saldo a Faturar Real']),
    qtdeParcelas: r.qtdeParcelas != null ? toNum(r.qtdeParcelas) : null,
  };
  return { ...base, dataProjVenc: calcularDataProjVenc(base) };
}

/** Saldo a faturar rateado por parcela (coluna «Saldo a faturar / parcelas» do modal). */
export function valorSaldoFaturarPorParcela(row: DfcSaldoFaturarLinha): number | null {
  const parcelas = row.qtdeParcelas;
  if (parcelas == null || parcelas <= 0) return null;
  return row.saldoFaturarReal / parcelas;
}

function hojeYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function enrichLinhasComPrevisao(
  linhas: DfcSaldoFaturarLinha[],
  previsaoMap: Map<number, string>,
): DfcSaldoFaturarLinha[] {
  return linhas.map((l) => {
    if (l.dataPrevisao) return l;
    const prev = previsaoMap.get(l.idPedido);
    if (!prev) return l;
    const comPrev = { ...l, dataPrevisao: prev };
    return { ...comPrev, dataProjVenc: calcularDataProjVenc(comPrev) };
  });
}

async function carregarLinhasSaldoFaturarBase(idEmpresas: number[]): Promise<DfcSaldoFaturarLinha[]> {
  const key = cacheKeyEmpresas(idEmpresas);
  const now = Date.now();
  if (cacheSaldoFaturarLinhas && cacheSaldoFaturarLinhas.expiresAt > now && cacheSaldoFaturarLinhas.idEmpresasKey === key) {
    return cacheSaldoFaturarLinhas.linhas;
  }
  const [{ linhas: raw }, previsaoMap] = await Promise.all([
    queryDfcSaldoFaturar({ idEmpresas }, { skipPrevisao: true }),
    getPrevisaoPorPedidoIdMap(),
  ]);
  const linhas = enrichLinhasComPrevisao(raw, previsaoMap);
  cacheSaldoFaturarLinhas = { expiresAt: now + CACHE_SALDO_FATURAR_MS, idEmpresasKey: key, linhas };
  return linhas;
}

/** Data Proj Venc efetiva na linha 1.1.3 (fim de semana → terça seguinte). */
export function dataProjVencEfetivaDfc(
  row: Pick<DfcSaldoFaturarLinha, 'dataProjVenc' | 'dataPrevisao' | 'parc' | 'condicaoPagamento'>,
): string | null {
  const raw = row.dataProjVenc ?? calcularDataProjVenc(row);
  if (!raw) return null;
  return ajustarDataProjVencFimSemana(raw);
}

export function bucketDataProjVenc(
  row: DfcSaldoFaturarLinha,
  granularidade: 'dia' | 'mes',
): string | null {
  const proj = dataProjVencEfetivaDfc(row);
  if (!proj) return null;
  return granularidade === 'mes' ? proj.slice(0, 7) : proj;
}

function linhaEntraProjecaoReceitas(
  row: DfcSaldoFaturarLinha,
  opts: {
    hoje: string;
    dataInicio: string;
    dataFim: string;
    idEmpresaSet: Set<number>;
    periodo?: string;
    granularidade: 'dia' | 'mes';
  },
): boolean {
  if (!opts.idEmpresaSet.has(row.idEmpresa)) return false;
  const proj = dataProjVencEfetivaDfc(row);
  if (!proj) return false;
  if (proj < opts.hoje) return false;
  if (proj < opts.dataInicio || proj > opts.dataFim) return false;
  if (valorSaldoFaturarPorParcela(row) == null) return false;
  if (opts.periodo != null && bucketDataProjVenc(row, opts.granularidade) !== opts.periodo) return false;
  return true;
}

/** pd.idEmpresa da projeção de receitas (saldo a faturar) — exclusivamente Só Aço. */
const ID_EMPRESA_PROJECAO_RECEITAS = 1;

export async function queryDfcProjecaoReceitasPorPeriodo(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
}): Promise<{ porPeriodo: Record<string, number>; erro?: string }> {
  void params.idEmpresas;
  const idEmpresas = [ID_EMPRESA_PROJECAO_RECEITAS];
  const idEmpresaSet = new Set(idEmpresas);
  const hoje = hojeYmdLocal();
  try {
    const linhas = await carregarLinhasSaldoFaturarBase(idEmpresas);
    const porPeriodo: Record<string, number> = {};
    const baseOpts = {
      hoje,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      idEmpresaSet,
      granularidade: params.granularidade,
    };
    for (const row of linhas) {
      if (!linhaEntraProjecaoReceitas(row, baseOpts)) continue;
      const bucket = bucketDataProjVenc(row, params.granularidade);
      if (!bucket) continue;
      const valor = valorSaldoFaturarPorParcela(row)!;
      porPeriodo[bucket] = (porPeriodo[bucket] ?? 0) + valor;
    }
    return { porPeriodo };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { porPeriodo: {}, erro: msg };
  }
}

/** Parcelas que compõem a linha «Projeção de Receitas» (detalhe ao clicar na árvore). */
export async function queryDfcProjecaoReceitasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
  /** Bucket YYYY-MM ou YYYY-MM-DD; omitir = todos os períodos do filtro. */
  periodo?: string;
}): Promise<{ linhas: DfcSaldoFaturarLinha[]; erro?: string }> {
  void params.idEmpresas;
  const idEmpresas = [ID_EMPRESA_PROJECAO_RECEITAS];
  const idEmpresaSet = new Set(idEmpresas);
  const hoje = hojeYmdLocal();
  try {
    const todas = await carregarLinhasSaldoFaturarBase(idEmpresas);
    const linhas = todas.filter((row) =>
      linhaEntraProjecaoReceitas(row, {
        hoje,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        idEmpresaSet,
        granularidade: params.granularidade,
        periodo: params.periodo?.trim() || undefined,
      }),
    );
    linhas.sort((a, b) => {
      const da = dataProjVencEfetivaDfc(a) ?? '';
      const db = dataProjVencEfetivaDfc(b) ?? '';
      if (da !== db) return da.localeCompare(db);
      return (a.pd ?? '').localeCompare(b.pd ?? '');
    });
    const linhasComProjEfetiva = linhas.map((row) => {
      const efetiva = dataProjVencEfetivaDfc(row);
      return efetiva && efetiva !== row.dataProjVenc ? { ...row, dataProjVenc: efetiva } : row;
    });
    return { linhas: linhasComProjEfetiva };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { linhas: [], erro: msg };
  }
}

function passaFiltroPrevisao(
  linha: DfcSaldoFaturarLinha,
  dataPrevisaoInicio?: string,
  dataPrevisaoFim?: string,
): boolean {
  if (!dataPrevisaoInicio && !dataPrevisaoFim) return true;
  const p = linha.dataPrevisao;
  if (!p) return false;
  if (dataPrevisaoInicio && p < dataPrevisaoInicio) return false;
  if (dataPrevisaoFim && p > dataPrevisaoFim) return false;
  return true;
}

export async function queryDfcSaldoFaturar(
  filtros: FiltrosDfcSaldoFaturar = {},
  opts: { skipPrevisao?: boolean } = {},
): Promise<{
  linhas: DfcSaldoFaturarLinha[];
  truncado?: boolean;
  hasMore?: boolean;
  page?: number;
  limit?: number;
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'NOMUS_DB_URL não configurado' };

  const idEmpresas = new Set<number>(normalizarIdsEmpresasSaldo(filtros.idEmpresas));
  if (idEmpresas.size === 0) {
    return { linhas: [], erro: 'Selecione ao menos uma empresa (1 ou 2).' };
  }

  const extraWhere: string[] = [];
  const args: unknown[] = [];
  const empIn = [...idEmpresas].join(',');
  extraWhere.push(`pd.idEmpresa IN (${empIn})`);

  const paginar = filtros.page != null || filtros.limit != null;
  const page = Math.max(1, filtros.page ?? 1);
  const limit = paginar
    ? Math.min(MAX_PAGE_LIMIT, Math.max(1, filtros.limit ?? DEFAULT_PAGE_LIMIT))
    : LIMIT_ROWS + 1;
  const offset = paginar ? (page - 1) * limit : 0;

  if (filtros.dataEmissaoInicio) {
    extraWhere.push('DATE(pd.dataEmissao) >= ?');
    args.push(filtros.dataEmissaoInicio);
  }
  if (filtros.dataEmissaoFim) {
    extraWhere.push('DATE(pd.dataEmissao) <= ?');
    args.push(filtros.dataEmissaoFim);
  }
  if (filtros.dataVencimentoInicio) {
    extraWhere.push('DATE(pp.dataVencimento) >= ?');
    args.push(filtros.dataVencimentoInicio);
  }
  if (filtros.dataVencimentoFim) {
    extraWhere.push('DATE(pp.dataVencimento) <= ?');
    args.push(filtros.dataVencimentoFim);
  }
  if (filtros.pd?.trim()) {
    extraWhere.push('pd.nome LIKE ?');
    args.push(`%${escapeLike(filtros.pd.trim())}%`);
  }
  if (filtros.cliente?.trim()) {
    extraWhere.push('upper(pe.nome) LIKE ?');
    args.push(`%${escapeLike(filtros.cliente.trim().toUpperCase())}%`);
  }
  if (filtros.uf?.trim()) {
    extraWhere.push(
      `(case 
        when (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Retirada%'
        or (
            case 
                when me.opcao = 'Retirada na Só Móveis' then 'Retirada na So Moveis'
                when me.opcao = 'Retirada na Só Aço' then 'Retirada na So Aço'
                when ifnull(m.nome, mc.nome) = 'Teresina' and aloreq.opcao = 'Sim' then 'Requisicao'
                when ifnull(m.nome, mc.nome) in ('Timon', 'Teresina', 'Nazaria', 'Demerval Lobão') and aloreq.opcao = 'Não' then 'Entrega em Grande Teresina'
                else 'Inserir em Romaneio'
            end
        ) like '%Entrega%'
        then 'PI'
        else ifnull(m.uf, mc.uf)
    end) LIKE ?`,
    );
    args.push(`%${escapeLike(filtros.uf.trim().toUpperCase())}%`);
  }
  if (filtros.tipoPedido?.trim()) {
    extraWhere.push('tpd.nome LIKE ?');
    args.push(`%${escapeLike(filtros.tipoPedido.trim())}%`);
  }

  let sql = SQL_SALDO_FATURAR_BASE;
  if (extraWhere.length > 0) {
    sql += ` AND ${extraWhere.join(' AND ')}`;
  }
  sql += ` ORDER BY pd.nome, pp.id LIMIT ${limit + 1} OFFSET ${offset}`;

  try {
    const previsaoPromise = opts.skipPrevisao
      ? Promise.resolve(new Map<number, string>())
      : getPrevisaoPorPedidoIdMap();
    const [[rows], mapaPrevisao] = await Promise.all([pool.query(sql, args), previsaoPromise]);
    const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const truncado = paginar ? hasMore : list.length > LIMIT_ROWS;

    const idsPedido = [...new Set(slice.map((r) => toNum(r.idPedido ?? r['idPedido'])).filter((n) => n > 0))];
    const previsaoPorPedido = new Map<number, string>();
    if (!opts.skipPrevisao) {
      for (const id of idsPedido) {
        const ymd = mapaPrevisao.get(id);
        if (ymd) previsaoPorPedido.set(id, ymd);
      }
    }

    let linhas = slice
      .map((r) => mapRow(r, previsaoPorPedido))
      .filter((l) => idEmpresas.has(l.idEmpresa));
    linhas = linhas.filter((l) =>
      passaFiltroPrevisao(l, filtros.dataPrevisaoInicio, filtros.dataPrevisaoFim),
    );

    const key = cacheKeyEmpresas([...idEmpresas]);
    if (!filtros.dataEmissaoInicio && !filtros.dataEmissaoFim && !filtros.pd?.trim() && !filtros.cliente?.trim()) {
      cacheSaldoFaturarLinhas = { expiresAt: Date.now() + CACHE_SALDO_FATURAR_MS, idEmpresasKey: key, linhas };
    }

    return {
      linhas,
      truncado: truncado || undefined,
      hasMore: paginar ? hasMore : undefined,
      page: paginar ? page : undefined,
      limit: paginar ? limit : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcSaldoFaturarRepository] queryDfcSaldoFaturar:', msg);
    return { linhas: [], erro: msg };
  }
}
