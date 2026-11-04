/**
 * Solicitações de compra pendentes (status Liberada ou Atendida parcialmente),
 * uma linha por solicitação, priorizadas como na planilha SQL_Itens_SC.
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import {
  NOMUS_ATRIBUTO_COLETA,
  NOMUS_ATRIBUTO_COMPRADOR,
  PCP_ID_EMPRESA_SO_ACO,
} from './sql/sqlComprasEstoqueFragments.js';
import { listarOpcoesCompradorPendencias } from './pendenciasComprasRepository.js';
import { priorizarSolicitacoesCompra } from '../utils/solicitacoesCompraPrioridade.js';

/** Compradores sem equipe ativa — mesma exclusão de Pendências compras. */
const COMPRADORES_EXCLUIDOS = new Set(['Comprador 4', 'Comprador 5']);

export type SituacaoPrazoSolicitacao = 'atrasada' | 'hoje' | 'proxima' | 'no_prazo' | 'sem_data';

export type SolicitacaoCompraRotinaLinha = {
  idSolicitacao: number;
  idProduto: number;
  codigo: string;
  descricao: string;
  nomeColeta: string;
  comprador: string;
  saldo: number;
  status: string;
  dataNecessidade: string | null;
  dataEmissao: string | null;
  diasEmAberto: number | null;
  diasAteNecessidade: number | null;
  situacaoPrazo: SituacaoPrazoSolicitacao;
  cotacoes: string;
  prioridade: number;
  necessidadeColeta: string | null;
};

export type SolicitacoesCompraRotinaConsulta = {
  linhas: SolicitacaoCompraRotinaLinha[];
  total: number;
  totalGeral: number;
  contagens: Record<string, number>;
  compradores: string[];
};

const SQL_LISTAR = `
Select
  sc.id As idSolicitacao,
  sc.idProduto,
  Coalesce(p.nome, '') As codigo,
  Coalesce(p.descricao, '') As descricao,
  Coalesce(col.opcao, 'A DEFINIR') As nomeColeta,
  Coalesce(cpr.opcao, 'A Definir') As comprador,
  Round(IfNull(sc.quantidade, 0) - IfNull(ate.qtdeAtendida, 0), 4) As saldo,
  Case sc.status
    When 2 Then 'Atendida parcialmente'
    When 6 Then 'Liberada'
    Else 'Avaliar'
  End As statusNome,
  Date_Format(sc.dataNecessidade, '%Y-%m-%d') As dataNecessidade,
  Date_Format(sc.dataEmissao, '%Y-%m-%d') As dataEmissao,
  DateDiff(CurDate(), Cast(sc.dataEmissao As Date)) As diasEmAberto,
  Case
    When sc.dataNecessidade Is Null Then Null
    Else DateDiff(Cast(sc.dataNecessidade As Date), CurDate())
  End As diasAteNecessidade,
  Case
    When sc.dataNecessidade Is Null Then 'sem_data'
    When Cast(sc.dataNecessidade As Date) < CurDate() Then 'atrasada'
    When Cast(sc.dataNecessidade As Date) = CurDate() Then 'hoje'
    When Cast(sc.dataNecessidade As Date) <= Date_Add(CurDate(), Interval 7 Day) Then 'proxima'
    Else 'no_prazo'
  End As situacaoPrazo,
  Coalesce(cot.cotacoes, '') As cotacoes
From solicitacaocompra sc
Left Join produto p On p.id = sc.idProduto
Left Join (
  Select idSolicitacaoCompra, Sum(qtdeAtendida) As qtdeAtendida
  From solicitacaocompraitempedidocompra
  Group By idSolicitacaoCompra
) ate On ate.idSolicitacaoCompra = sc.id
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = ${NOMUS_ATRIBUTO_COLETA}
) col On col.idProduto = p.id
Left Join (
  Select apv.idProduto, alo.opcao
  From atributoprodutovalor apv
  Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = ${NOMUS_ATRIBUTO_COMPRADOR}
) cpr On cpr.idProduto = p.id
Left Join (
  Select
    si.idSolicitacaoCompra,
    Group_Concat(Distinct cc.nome Order By cc.nome Separator ', ') As cotacoes
  From solicitacaocompra_itemcotacaocompra si
  Inner Join solicitacaocompra sc2 On sc2.id = si.idSolicitacaoCompra
    And sc2.status In (2, 6)
    And sc2.lixeira Is Null
    And sc2.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
  Inner Join itemcotacaocompra ic On ic.id = si.idItemCotacaoCompra
  Inner Join cotacaocompra cc On cc.id = ic.idCotacaoCompra
  Group By si.idSolicitacaoCompra
) cot On cot.idSolicitacaoCompra = sc.id
Where sc.status In (2, 6)
  And sc.lixeira Is Null
  And sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
`;

function situacaoPrazo(valor: unknown): SituacaoPrazoSolicitacao {
  const s = String(valor ?? '');
  if (s === 'atrasada' || s === 'hoje' || s === 'proxima' || s === 'no_prazo' || s === 'sem_data') {
    return s;
  }
  return 'sem_data';
}

function dataIso(valor: unknown): string | null {
  const s = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith('0000')) return null;
  return s;
}

function mapearLinha(row: Record<string, unknown>) {
  return {
    idSolicitacao: Number(row.idSolicitacao ?? 0),
    idProduto: Number(row.idProduto ?? 0),
    codigo: String(row.codigo ?? '').trim(),
    descricao: String(row.descricao ?? '').trim(),
    nomeColeta: String(row.nomeColeta ?? '').trim(),
    comprador: String(row.comprador ?? '').trim() || 'A Definir',
    saldo: Number(row.saldo ?? 0),
    status: String(row.statusNome ?? ''),
    dataNecessidade: dataIso(row.dataNecessidade),
    dataEmissao: dataIso(row.dataEmissao),
    diasEmAberto: row.diasEmAberto == null ? null : Number(row.diasEmAberto),
    diasAteNecessidade: row.diasAteNecessidade == null ? null : Number(row.diasAteNecessidade),
    situacaoPrazo: situacaoPrazo(row.situacaoPrazo),
    cotacoes: String(row.cotacoes ?? '').trim(),
  };
}

export async function consultarSolicitacoesCompraRotina(
  comprador: string | null
): Promise<{ data: SolicitacoesCompraRotinaConsulta; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: vazio(), erro: 'NOMUS_DB_URL não configurado' };
  }

  const compradorFiltro = comprador?.trim() || null;
  if (compradorFiltro && COMPRADORES_EXCLUIDOS.has(compradorFiltro)) {
    return { data: vazio(), erro: 'Comprador não disponível.' };
  }

  try {
    const [opcoes, consulta] = await Promise.all([
      listarOpcoesCompradorPendencias(),
      pool.query(SQL_LISTAR),
    ]);
    if (opcoes.erro) return { data: vazio(), erro: opcoes.erro };

    const [rows] = consulta as [Record<string, unknown>[], unknown];
    const todas = (Array.isArray(rows) ? rows : [])
      .map(mapearLinha)
      .filter((l) => l.idSolicitacao > 0 && !COMPRADORES_EXCLUIDOS.has(l.comprador));

    const contagens: Record<string, number> = {};
    for (const nome of opcoes.data) contagens[nome] = 0;
    for (const linha of todas) {
      contagens[linha.comprador] = (contagens[linha.comprador] ?? 0) + 1;
    }

    const compradores = [...opcoes.data];
    for (const nome of Object.keys(contagens)) {
      if (!compradores.includes(nome)) compradores.push(nome);
    }
    compradores.sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const escopo = compradorFiltro
      ? todas.filter((l) => l.comprador === compradorFiltro)
      : todas;
    const linhas = priorizarSolicitacoesCompra(escopo);

    return {
      data: {
        linhas,
        total: linhas.length,
        totalGeral: todas.length,
        contagens,
        compradores,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: vazio(), erro: msg };
  }
}

function vazio(): SolicitacoesCompraRotinaConsulta {
  return { linhas: [], total: 0, totalGeral: 0, contagens: {}, compradores: [] };
}
