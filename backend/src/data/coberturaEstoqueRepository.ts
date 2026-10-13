/**
 * Painel de Cobertura de Estoque — agrega sobre a mesma consulta da Consulta de Estoque.
 * Recorte fixo: vínculo a pelo menos um dos setores almox secundário (2), galpão bobina (19)
 * ou matéria-prima processada (20).
 */
import { formatNomusErroConexao, isNomusEnabled, queryNomus } from '../config/nomusDb.js';
import {
  consultarEstoque,
  type FiltrosConsultaEstoque,
} from './consultaEstoqueRepository.js';
import {
  NOMUS_ATRIBUTO_COMPRADOR,
  SETORES_VINCULO_PAINEL_COBERTURA_SQL,
  formatarSetoresVinculoCobertura,
} from './sql/sqlComprasEstoqueFragments.js';
import {
  aplicarMediaPrecoBobinaPorChave,
  chaveDimensionalBobina,
  SQL_CHAVE_DIMENSIONAL_BOBINA,
} from './coberturaBobinaPreco.js';
import {
  agregarCoberturaEstoque,
  itemAptoUniversoPainelCobertura,
  type StatusCoberturaEstoque,
} from './coberturaEstoqueStatus.js';

export const TIPOS_MOVIMENTACAO_PRECO_COBERTURA = [
  'Compra para material almox secundário',
  'Compra para material almox galpões',
  'AJUSTE PARA ATUALIZAR PREÇO DA ÚLTIMA COMPRA (TRIB INCLUÍDA)',
  'Compra para industrialização',
] as const;

const CM_CHUNK = 400;
const CM_CHUNK_CONCURRENCY = 2;
const BOBINA_MEDIA_CACHE_TTL_MS = 10 * 60 * 1000;

type BobinaMediaCache = {
  at: number;
  tiposKey: string;
  map: Map<string, number>;
};

let bobinaMediaCache: BobinaMediaCache | null = null;

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

async function mapChunksParallel<T>(
  items: T[],
  chunkSize: number,
  concurrency: number,
  worker: (chunk: T[]) => Promise<void>
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  let next = 0;
  const run = async () => {
    while (true) {
      const i = next++;
      if (i >= chunks.length) return;
      await worker(chunks[i]!);
    }
  };
  const n = Math.min(Math.max(1, concurrency), chunks.length);
  if (n <= 0) return;
  await Promise.all(Array.from({ length: n }, () => run()));
}

/** Já tem atividade na grade sintética (antes do CM) — entra no painel sem precisar de CM. */
function temSinalPipelineCobertura(row: {
  saldo: number;
  empenho: number;
  solicitacao?: number;
  cotacao?: number;
  pedidoCompra?: number;
}): boolean {
  return (
    (Number(row.saldo) || 0) !== 0 ||
    (Number(row.empenho) || 0) !== 0 ||
    (Number(row.solicitacao) || 0) !== 0 ||
    (Number(row.cotacao) || 0) !== 0 ||
    (Number(row.pedidoCompra) || 0) !== 0
  );
}

function mergeNumMap(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, v);
  return out;
}

function mergeStrMap(a: Map<number, string>, b: Map<number, string>): Map<number, string> {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, v);
  return out;
}

/** Comprador, preço, família, última mov. e setores — só para ids que entram no universo. */
async function enriquecerMetadadosCobertura(ids: number[]): Promise<{
  compradorMap: Map<number, string>;
  precoMap: Map<number, number>;
  familiaMap: Map<number, string>;
  ultimaMovMap: Map<number, string>;
  setoresMap: Map<number, string>;
}> {
  if (ids.length === 0) {
    return {
      compradorMap: new Map(),
      precoMap: new Map(),
      familiaMap: new Map(),
      ultimaMovMap: new Map(),
      setoresMap: new Map(),
    };
  }
  const [compradorMap, precoMap, familiaMap, ultimaMovMap, setoresMap] = await Promise.all([
    consultarCompradorPorIds(ids),
    consultarUltimoPrecoEntradaPorIds(ids),
    consultarFamiliaProdutoPorIds(ids),
    consultarUltimaMovimentacaoEstoquePorIds(ids),
    consultarSetoresVinculoCoberturaPorIds(ids),
  ]);
  return { compradorMap, precoMap, familiaMap, ultimaMovMap, setoresMap };
}

/**
 * Consumo médio mensal — mesma fórmula do Ressup Almox (`Consumo Medio` em sqlRegistroColetaPrecos).
 */
async function consultarConsumoMedioPorIds(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  if (!isNomusEnabled()) return map;

  await mapChunksParallel(unicos, CM_CHUNK, CM_CHUNK_CONCURRENCY, async (chunk) => {
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
      const [rows] = (await queryNomus(sql, [...chunk, ...chunk])) as [
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
  });

  for (const id of unicos) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

async function consultarCompradorPorIds(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  if (!isNomusEnabled()) return map;

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
      const [rows] = (await queryNomus(sql, chunk)) as [Record<string, unknown>[], unknown];
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

  if (!isNomusEnabled()) return map;

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
      const [rows] = (await queryNomus(sql, chunk)) as [Record<string, unknown>[], unknown];
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

  if (!isNomusEnabled()) return map;

  const tipos = [...TIPOS_MOVIMENTACAO_PRECO_COBERTURA];
  const tiposPh = placeholders(tipos.length);
  const descricaoPorId = new Map<number, string>();

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select ranked.idProduto, ranked.precoUnitario, ranked.descricao
From (
  Select ide.idProduto,
    ide.valorUnitario As precoUnitario,
    p.descricao As descricao,
    ROW_NUMBER() Over (
      Partition By ide.idProduto
      Order By de.dataEntrada Desc, ide.id Desc
    ) As rn
  From itemdocumentoestoque ide
  Inner Join documentoestoque de On de.id = ide.idDocumentoEstoque
  Inner Join tipomovimentacao tm On tm.id = de.idTipoMovimentacao
  Inner Join produto p On p.id = ide.idProduto
  Where tm.nome In (${tiposPh})
    And ide.valorUnitario > 0
    And ide.idProduto In (${ph})
) ranked
Where ranked.rn = 1
`.trim();

    try {
      const [rows] = (await queryNomus(sql, [...tipos, ...chunk])) as [
        Record<string, unknown>[],
        unknown,
      ];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        const preco = Number(r.precoUnitario ?? NaN);
        // Aceita preços fracionários baixos (ex. 0,002); só rejeita zero/negativo/NaN.
        if (id <= 0 || !Number.isFinite(preco) || preco <= 0) continue;
        map.set(id, preco);
        const desc = String(r.descricao ?? '').trim();
        if (desc) descricaoPorId.set(id, desc);
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarUltimoPrecoEntradaPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // Descrições dos ids sem entrada (ainda podem herdar média da chave dimensional).
  const semDesc = unicos.filter((id) => !descricaoPorId.has(id));
  if (semDesc.length > 0) {
    for (let i = 0; i < semDesc.length; i += CM_CHUNK) {
      const chunk = semDesc.slice(i, i + CM_CHUNK);
      const ph = placeholders(chunk.length);
      try {
        const [rows] = (await queryNomus(
          `Select id As idProduto, descricao From produto Where id In (${ph})`,
          chunk
        )) as [Record<string, unknown>[], unknown];
        for (const r of Array.isArray(rows) ? rows : []) {
          const id = Number(r.idProduto ?? 0);
          const desc = String(r.descricao ?? '').trim();
          if (id > 0 && desc) descricaoPorId.set(id, desc);
        }
      } catch (err) {
        console.error(
          '[coberturaEstoqueRepository] descricao produto (bobina):',
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const chaves = new Set<string>();
  for (const desc of descricaoPorId.values()) {
    const chave = chaveDimensionalBobina(desc);
    if (chave) chaves.add(chave);
  }

  if (chaves.size > 0) {
    const mediaPorChave = await consultarMediaPrecoBobinaPorChave(tipos);
    aplicarMediaPrecoBobinaPorChave(map, descricaoPorId, mediaPorChave);
  }

  return map;
}

/**
 * Média do preço cheio das entradas (tipos do painel) na data mais recente por chave dimensional.
 * Mesma lógica de agrupamento da precificação; fonte de valor = regra do painel.
 * Cache em memória (TTL curto): o scan é global e independente do recorte de produtos.
 */
async function consultarMediaPrecoBobinaPorChave(
  tipos: readonly string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!isNomusEnabled() || tipos.length === 0) return map;

  const tiposKey = [...tipos].join('\0');
  const agora = Date.now();
  if (
    bobinaMediaCache &&
    bobinaMediaCache.tiposKey === tiposKey &&
    agora - bobinaMediaCache.at < BOBINA_MEDIA_CACHE_TTL_MS
  ) {
    return new Map(bobinaMediaCache.map);
  }

  const tiposPh = placeholders(tipos.length);
  const sql = `
With base As (
  Select
    ide.valorUnitario As precoUnitario,
    de.dataEntrada As dataEntrada,
    (${SQL_CHAVE_DIMENSIONAL_BOBINA}) As bobina
  From itemdocumentoestoque ide
  Inner Join documentoestoque de On de.id = ide.idDocumentoEstoque
  Inner Join tipomovimentacao tm On tm.id = de.idTipoMovimentacao
  Inner Join produto p On p.id = ide.idProduto
  Where tm.nome In (${tiposPh})
    And ide.valorUnitario > 0
    And Replace(Upper(p.descricao), 'INOX', 'INO') Like 'BOBINA%X%MM%'
    And Replace(Upper(p.descricao), 'INOX', 'INO') Not Like '%ETIQUETA%'
),
ud As (
  Select bobina, Max(dataEntrada) As dataEntrada
  From base
  Where bobina <> ''
  Group By bobina
)
Select
  b.bobina As bobina,
  Round(Avg(b.precoUnitario), 2) As precoMedio
From base b
Inner Join ud On ud.bobina = b.bobina And ud.dataEntrada = b.dataEntrada
Where b.bobina <> ''
Group By b.bobina
`.trim();

  try {
    const [rows] = (await queryNomus(sql, [...tipos])) as [Record<string, unknown>[], unknown];
    for (const r of Array.isArray(rows) ? rows : []) {
      const chave = String(r.bobina ?? '').trim();
      const preco = Number(r.precoMedio ?? NaN);
      if (!chave || !Number.isFinite(preco) || preco <= 0) continue;
      map.set(chave, preco);
    }
    bobinaMediaCache = { at: agora, tiposKey, map: new Map(map) };
  } catch (err) {
    console.error(
      '[coberturaEstoqueRepository] consultarMediaPrecoBobinaPorChave:',
      err instanceof Error ? err.message : err
    );
  }
  return map;
}

/**
 * Última data de movimentação no almox secundário (entrada ou saída nos setores 2/19).
 * Produtos sem linha no mapa = nunca movimentaram nesse recorte.
 */
async function consultarUltimaMovimentacaoEstoquePorIds(
  ids: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;

  if (!isNomusEnabled()) return map;

  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select mp.idProduto As idProduto,
  Date_Format(Max(mp.data), '%Y-%m-%d') As ultimaMovimentacao
From movimentacaoproducao mp
Where mp.idProduto In (${ph})
  And (
    mp.idSetorEstoqueSaida In (2, 19)
    Or mp.idSetorEstoqueEntrada In (2, 19)
  )
Group By mp.idProduto
`.trim();
    try {
      const [rows] = (await queryNomus(sql, chunk)) as [Record<string, unknown>[], unknown];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        const data = String(r.ultimaMovimentacao ?? '').trim();
        if (id <= 0 || !data) continue;
        map.set(id, data);
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarUltimaMovimentacaoEstoquePorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return map;
}

async function consultarSetoresVinculoCoberturaPorIds(
  ids: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unicos.length === 0) return map;
  if (!isNomusEnabled()) return map;

  const porProduto = new Map<number, number[]>();
  for (let i = 0; i < unicos.length; i += CM_CHUNK) {
    const chunk = unicos.slice(i, i + CM_CHUNK);
    const ph = placeholders(chunk.length);
    const sql = `
Select Distinct pe.idProduto As idProduto, pese.idSetorEstoque As idSetor
From produtoempresa pe
Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
Where pe.idEmpresa = 1
  And pese.idSetorEstoque In (${SETORES_VINCULO_PAINEL_COBERTURA_SQL})
  And pe.idProduto In (${ph})
`.trim();
    try {
      const [rows] = (await queryNomus(sql, chunk)) as [Record<string, unknown>[], unknown];
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = Number(r.idProduto ?? 0);
        const setor = Number(r.idSetor ?? 0);
        if (id <= 0 || setor <= 0) continue;
        const list = porProduto.get(id) ?? [];
        list.push(setor);
        porProduto.set(id, list);
      }
    } catch (err) {
      console.error(
        '[coberturaEstoqueRepository] consultarSetoresVinculoCoberturaPorIds:',
        err instanceof Error ? err.message : err
      );
    }
  }

  for (const id of unicos) {
    map.set(id, formatarSetoresVinculoCobertura(porProduto.get(id) ?? []));
  }
  return map;
}

/** Nomes distintos de família de produto (cadastro Nomus) para o filtro do painel. */
export async function consultarNomesFamiliaProduto(): Promise<{
  data: string[];
  erro?: string;
}> {
  if (!isNomusEnabled()) {
    return { data: [], erro: 'Nomus indisponível' };
  }
  try {
    const [rows] = (await queryNomus(`
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
    return { data: [], erro: formatNomusErroConexao(err) };
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
  // comEmpenho vem do filtro do painel (toggle "somente produtos com empenho").
  // Vínculo de setor: almox secundário OU galpão bobina OU MP processada.
  // Regras de status já toleram Empenho = 0.
  const { data, erro } = await consultarEstoque({
    filtros: {
      ...params.filtros,
      comEmpenho: params.filtros.comEmpenho ?? 'todos',
      somenteAlmoxCobertura: true,
      somenteAlmoxSecundario: false,
    },
    considerarRequisicoes: params.considerarRequisicoes,
    permitirSemFiltro: true,
  });

  if (erro) {
    return { data: null, erro };
  }

  // Fase 1: itens com saldo/empenho/SC/cotação/PC já entram; os demais só se CM > 0.
  // Evita preço/comprador/família/mov/setores para o volume descartado (tudo zero).
  const comSinal = data.filter(temSinalPipelineCobertura);
  const semSinal = data.filter((r) => !temSinalPipelineCobertura(r));
  const idsComSinal = comSinal.map((r) => r.idProduto);
  const idsSemSinal = semSinal.map((r) => r.idProduto);

  const [cmComSinal, metaComSinal, cmSemSinal] = await Promise.all([
    consultarConsumoMedioPorIds(idsComSinal),
    enriquecerMetadadosCobertura(idsComSinal),
    consultarConsumoMedioPorIds(idsSemSinal),
  ]);

  const aptosSemSinal = semSinal.filter((r) => (cmSemSinal.get(r.idProduto) ?? 0) > 0);
  const metaSemSinal = await enriquecerMetadadosCobertura(aptosSemSinal.map((r) => r.idProduto));

  const cmMap = mergeNumMap(cmComSinal, cmSemSinal);
  const compradorMap = mergeStrMap(metaComSinal.compradorMap, metaSemSinal.compradorMap);
  const precoMap = mergeNumMap(metaComSinal.precoMap, metaSemSinal.precoMap);
  const familiaMap = mergeStrMap(metaComSinal.familiaMap, metaSemSinal.familiaMap);
  const ultimaMovMap = mergeStrMap(metaComSinal.ultimaMovMap, metaSemSinal.ultimaMovMap);
  const setoresMap = mergeStrMap(metaComSinal.setoresMap, metaSemSinal.setoresMap);

  let comCm = [...comSinal, ...aptosSemSinal]
    .map((r) => ({
      ...r,
      consumoMedio: cmMap.get(r.idProduto) ?? 0,
      comprador: compradorMap.get(r.idProduto) ?? 'A definir',
      precoUnitario: precoMap.get(r.idProduto) ?? null,
      familiaProduto: familiaMap.get(r.idProduto) ?? 'Sem família',
      ultimaMovimentacaoEstoque: ultimaMovMap.get(r.idProduto) ?? null,
      setoresVinculo: setoresMap.get(r.idProduto) ?? '',
    }))
    .filter(itemAptoUniversoPainelCobertura);

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
