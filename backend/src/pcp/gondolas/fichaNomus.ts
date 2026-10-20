import type { RowDataPacket } from 'mysql2';
import { getNomusPool, isNomusEnabled } from '../../config/nomusDb.js';
import {
  chaveFicha,
  multiplicarPelaCarteira,
  tipoComponente,
  type ComponenteDetalhe,
} from './regras.js';

type LinhaNomus = {
  codigoPai: string;
  idLista: number;
  codigo: string;
  descricao: string;
  tipo: 'PI' | 'PP' | null;
  quantidade: number;
};

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Pais que têm lista de produção padrão, para pintar a grade sem abrir cada ficha. */
export async function paisComListaProducao(
  codigos: string[]
): Promise<{ disponivel: boolean; pais: string[]; erro?: string }> {
  const unicos = [...new Set(codigos.map((codigo) => codigo.trim()).filter(Boolean))];
  if (unicos.length === 0) return { disponivel: true, pais: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, pais: [], erro: 'NOMUS indisponível' };
  }

  const exatos = unicos.map((codigo) => codigo.toUpperCase());
  const bases = [...new Set(unicos.map((codigo) => chaveFicha(codigo)))];
  const phExatos = exatos.map(() => '?').join(', ');
  const phBases = bases.map(() => '?').join(', ');

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT DISTINCT TRIM(pai.nome) AS codigoPai
      FROM produto pai
      INNER JOIN listamateriais lm
        ON lm.idProduto = pai.id
        AND lm.padrao = 1
        AND lm.descricao LIKE 'Lista%Produ__o'
      WHERE pai.ativo = 1
        AND (
          UPPER(TRIM(pai.nome)) IN (${phExatos})
          OR UPPER(TRIM(SUBSTRING_INDEX(pai.nome, '.', 1))) IN (${phBases})
        )
      `,
      [...exatos, ...bases]
    );
    return {
      disponivel: true,
      pais: rows.map((row) => String(row.codigoPai ?? '').trim()).filter(Boolean),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gondolas] fichas da grade:', msg);
    return { disponivel: false, pais: [], erro: msg };
  }
}

/**
 * Ficha de produção padrão do Nomus. A lista existe mesmo quando não há PI/PP
 * (só matéria-prima, por exemplo): nesse caso a planilha não entra.
 */
export async function lerFichaProducaoNomus(
  codigoItem: string,
  qtdeReal: number
): Promise<{ disponivel: boolean; temFicha: boolean; componentes: ComponenteDetalhe[]; erro?: string }> {
  const codigo = codigoItem.trim();
  const base = chaveFicha(codigo);
  if (!codigo) return { disponivel: true, temFicha: false, componentes: [] };

  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { disponivel: false, temFicha: false, componentes: [], erro: 'NOMUS indisponível' };
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        TRIM(pai.nome) AS codigoPai,
        lm.id AS idLista,
        TRIM(comp.nome) AS codigo,
        TRIM(comp.descricao) AS descricao,
        tp.nome AS tipoNome,
        CAST(REPLACE(IFNULL(pq.qtdeNecessaria, '0'), ',', '.') AS DECIMAL(18, 6)) AS quantidade
      FROM produto pai
      INNER JOIN listamateriais lm
        ON lm.idProduto = pai.id
        AND lm.padrao = 1
        AND lm.descricao LIKE 'Lista%Produ__o'
      LEFT JOIN produtoqtde pq ON pq.idListaMateriais = lm.id
      LEFT JOIN produto comp ON comp.id = pq.idProdutoComponente AND comp.ativo = 1
      LEFT JOIN tipoproduto tp
        ON tp.id = comp.idTipoProduto
        AND tp.nome IN ('Produto intermediário', 'Produto em processo')
      WHERE pai.ativo = 1
        AND (
          UPPER(TRIM(pai.nome)) = ?
          OR UPPER(TRIM(SUBSTRING_INDEX(pai.nome, '.', 1))) = ?
        )
      `,
      [codigo.toUpperCase(), base]
    );

    const linhas: LinhaNomus[] = rows.map((row) => ({
      codigoPai: String(row.codigoPai ?? '').trim(),
      idLista: numero(row.idLista),
      codigo: String(row.codigo ?? '').trim(),
      descricao: String(row.descricao ?? '').trim(),
      tipo: tipoComponente(String(row.tipoNome ?? '')),
      quantidade: numero(row.quantidade),
    }));

    const exatos = linhas.filter((linha) => linha.codigoPai.toUpperCase() === codigo.toUpperCase());
    const escolhidas = exatos.some((linha) => linha.idLista > 0)
      ? exatos
      : linhas.filter((linha) => chaveFicha(linha.codigoPai) === base);
    const temFicha = escolhidas.some((linha) => linha.idLista > 0);
    const porChave = new Map<string, ComponenteDetalhe>();
    for (const linha of escolhidas) {
      if (!linha.tipo || !linha.codigo) continue;
      const chave = `${linha.tipo}|${linha.codigo}`;
      const atual = porChave.get(chave);
      if (atual) {
        atual.quantidade += linha.quantidade;
        atual.quantidadeTotal = multiplicarPelaCarteira(atual.quantidade, qtdeReal);
        continue;
      }
      porChave.set(chave, {
        codigo: linha.codigo,
        descricao: linha.descricao,
        tipo: linha.tipo,
        quantidade: linha.quantidade,
        quantidadeTotal: multiplicarPelaCarteira(linha.quantidade, qtdeReal),
        materiaPrima: '',
        medida01: '',
        medida02: '',
      });
    }
    const componentes = [...porChave.values()].sort(
      (a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo)
    );

    return { disponivel: true, temFicha, componentes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gondolas] ficha Nomus:', msg);
    return { disponivel: false, temFicha: false, componentes: [], erro: msg };
  }
}
