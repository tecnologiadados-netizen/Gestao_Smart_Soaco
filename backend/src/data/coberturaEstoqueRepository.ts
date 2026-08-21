/**
 * Painel de Cobertura de Estoque — agrega sobre a mesma consulta da Consulta de Estoque.
 * Recorte fixo: itens com empenho líquido > 0 e vínculo ao almoxarifado secundário (setor 2).
 */
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import {
  consultarEstoque,
  type FiltrosConsultaEstoque,
} from './consultaEstoqueRepository.js';
import { NOMUS_ATRIBUTO_COMPRADOR } from './sql/sqlComprasEstoqueFragments.js';
import {
  agregarCoberturaEstoque,
  type StatusCoberturaEstoque,
} from './coberturaEstoqueStatus.js';

export const TIPOS_MOVIMENTACAO_PRECO_COBERTURA = [
  'Compra para material almox secundário',
  'AJUSTE PARA ATUALIZAR PREÇO DA ÚLTIMA COMPRA (TRIB INCLUÍDA)',
  'Compra para industrialização',
] as const;

const CM_CHUNK = 400;

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/**
 * Consumo médio mensal — mesma fórmula do Ressup Almox (`Consumo Medio` em sqlRegistroColetaPrecos).
 */
async function consultarConsumoMedioPorIds(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select a.idProduto As idProduto,
  Round((Sum(a.qtde) / Case
    When DateDiff(CurDate(), da.primeiraentrada) > 180 Then 180 Else (
      Case When DateDiff(CurDate(), a.data) > 180 Then 180
        Else DateDiff(CurDate(), a.data) End
    ) End) * 30, 0) As consumoMedio
From movimentacaoproducao a
Left Join tipomovimentacao b On a.idTipoMovimentacao = b.id
Left Join (
  Select a2.idProduto As idProduto,
    a2.idSetorEstoqueSaida,
    a2.data As primeiraentrada
  From movimentacaoproducao a2
  Left Join tipomovimentacao b2 On a2.idTipoMovimentacao = b2.id
  Where a2.idTipoMovimentacao In (50, 77, 18)
    And a2.idSetorEstoqueSaida In (2, 19)
    And b2.natureza In (2, 6)
    And a2.idProduto In (${ph})
  Group By a2.idProduto, a2.idSetorEstoqueSaida
) da On da.idProduto = a.idProduto
Where a.idProduto In (${ph})
  And a.data > (
    Select Date_Sub(d.datafinal, Interval DayOfMonth(d.datafinal) - 1 Day)
    From (Select CurDate(), Date_Add(CurDate(), Interval -6 Month) As datafinal) d
  )
  And a.idTipoMovimentacao In (50, 77, 18)
  And a.idSetorEstoqueSaida In (2, 19)
  And b.natureza In (2, 6)
Group By a.idProduto
`.trim();

    try {
      const [rows] = (await pool.query(sql, [...chunk, ...chunk])) as [
        Record<string, unknown>[],
        unknown,
      ];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        if (id <= 0) continue;
        map.set(id, Number(r.consumoMedio ?? 0) || 0);
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarConsumoMedioPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }

  for (const id of unicos) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

async function consultarCompradorPorIds(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select apv.idProduto As idProduto,
  Coalesce(Nullif(Trim(alo.opcao), ''), 'A definir') As comprador
From atributoprodutovalor apv
Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
Where apv.idAtributo = ${NOMUS_ATRIBUTO_COMPRADOR}
  And apv.idProduto In (${ph})
`.trim();
    try {
      const [rows] = (await pool.query(sql, chunk)) as [Record<string, unknown>[], unknown];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        if (id <= 0) continue;
        map.set(id, String(r.comprador ?? '').trim() || 'A definir');
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarCompradorPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }
  return map;
}

async function consultarFamiliaProdutoPorIds(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select p.id As idProduto,
  Coalesce(Nullif(Trim(fp.nome), ''), 'Sem família') As familiaProduto
From produto p
Left Join familiaproduto fp On p.idFamiliaProduto = fp.id
Where p.id In (${ph})
`.trim();
    try {
      const [rows] = (await pool.query(sql, chunk)) as [Record<string, unknown>[], unknown];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        if (id <= 0) continue;
        map.set(id, String(r.familiaProduto ?? '').trim() || 'Sem família');
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarFamiliaProdutoPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }
  return map;
}

async function consultarUltimoPrecoEntradaPorIds(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return map;

  const tipos = [...TIPOS_MOVIMENTACAO_PRECO_COBERTURA];
  const tiposPh = placeholders(tipos.length);

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select ranked.idProduto, ranked.precoUnitario
From (
  Select ide.idProduto,
    ide.valorUnitario As precoUnitario,
    ROW_NUMBER() Over (
      Partition By ide.idProduto
      Order By de.dataEntrada Desc, ide.id Desc
    ) As rn
  From itemdocumentoestoque ide
  Inner Join documentoestoque de On de.id = ide.idDocumentoEstoque
  Inner Join tipomovimentacao tm On tm.id = de.idTipoMovimentacao
  Where tm.nome In (${tiposPh})
    And ide.valorUnitario > 0
    And ide.idProduto In (${ph})
) ranked
Where ranked.rn = 1
`.trim();

    try {
      const [rows] = (await pool.query(sql, [...tipos, ...chunk])) as [
        Record<string, unknown>[],
        unknown,
      ];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        const preco = Number(r.precoUnitario ?? NaN);
        // Aceita preços fracionários baixos (ex. 0,002); só rejeita zero/negativo/NaN.
        if (id <= 0 || !Number.isFinite(preco) || preco <= 0) continue;
        map.set(id, preco);
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarUltimoPrecoEntradaPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return map;
}

/** Nomes distintos de família de produto (cadastro Nomus) para o filtro do painel. */
export async function consultarNomesFamiliaProduto(): Promise<{
  data: string[];
  erro?: string;
}> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { data: [], erro: 'Nomus indisponível' };
  }
  try {
    const [rows] = (await pool.query(`
Select Distinct Trim(fp.nome) As familia
From familiaproduto fp
Where fp.nome Is Not Null And Trim(fp.nome) <> ''
Order By 1
`.trim())) as [Record<string, unknown>[], unknown];
    const nomes = (Array.isArray(rows) ? rows : [])
      .map((r) => String(r.familia ?? '').trim())
      .filter(Boolean);
    const comSemFamilia = nomes.includes('Sem família') ? nomes : ['Sem família', ...nomes];
    return { data: comSemFamilia };
  } catch (err) {
    console.error(
      '[coberturaEstoqueRepository] consultarNomesFamiliaProduto:',
      err instanceof Error ? err.message : err
    );
    return { data: [], erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function consultarPainelCoberturaEstoque(params: {
  filtros: FiltrosConsultaEstoque;
  considerarRequisicoes: boolean;
  status?: StatusCoberturaEstoque | null;
  topN?: number;
}): Promise<{
  data: (ReturnType<typeof agregarCoberturaEstoque> & { familiasDisponiveis: string[] }) | null;
  erro?: string;
}> {
  // Universo atual: comEmpenho 'sim'. No 2º momento, remover este forçamento
  // para incluir Empenho = 0 (visão Sem giro) — regras de status já toleram essas linhas.
  const { data, erro } = await consultarEstoque({
    filtros: { ...params.filtros, comEmpenho: 'sim', somenteAlmoxSecundario: true },
    considerarRequisicoes: params.considerarRequisicoes,
    permitirSemFiltro: true,
  });

  if (erro) {
    return { data: null, erro };
  }

  const ids = data.map((r) => r.idProduto);
  const [cmMap, compradorMap, precoMap, familiaMap] = await Promise.all([
    consultarConsumoMedioPorIds(ids),
    consultarCompradorPorIds(ids),
    consultarUltimoPrecoEntradaPorIds(ids),
    consultarFamiliaProdutoPorIds(ids),
  ]);
  let comCm = data.map((r) => ({
    ...r,
    consumoMedio: cmMap.get(r.idProduto) ?? 0,
    comprador: compradorMap.get(r.idProduto) ?? 'A definir',
    precoUnitario: precoMap.get(r.idProduto) ?? null,
    familiaProduto: familiaMap.get(r.idProduto) ?? 'Sem família',
  }));

  // Opções do filtro = famílias presentes no universo do painel (antes do filtro de família).
  const familiasDisponiveis = [
    ...new Set(comCm.map((r) => (r.familiaProduto ?? '').trim() || 'Sem família')),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const familiasSel = (params.filtros.familias ?? [])
    .map((f) => String(f).trim())
    .filter(Boolean);
  if (familiasSel.length > 0) {
    const set = new Set(familiasSel);
    comCm = comCm.filter((r) => set.has(r.familiaProduto));
  }

  const agg = agregarCoberturaEstoque(comCm, {
    statusFiltro: params.status ?? null,
  });

  return {
    data: {
      ...agg,
      familiasDisponiveis,
    },
  };
}
