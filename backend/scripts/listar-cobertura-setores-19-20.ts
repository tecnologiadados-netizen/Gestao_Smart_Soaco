/**
 * Lista itens do painel Cobertura com vínculo aos setores 19 (galpão bobina)
 * ou 20 (MP processada), saldo > 0 e preço qualificado.
 * Uso: npx tsx scripts/listar-cobertura-setores-19-20.ts
 */
import '../src/load-dotenv.js';
import { isNomusEnabled, queryNomus } from '../src/config/nomusDb.js';
import { consultarPainelCoberturaEstoque } from '../src/data/coberturaEstoqueRepository.js';

async function main(): Promise<void> {
  if (!isNomusEnabled()) {
    console.error('NOMUS_DB_URL não configurado.');
    process.exit(1);
  }

  console.error('Consultando painel Cobertura…');
  const { data, erro } = await consultarPainelCoberturaEstoque({
    filtros: { comEmpenho: 'todos' },
    considerarRequisicoes: false,
  });
  if (erro || !data) {
    console.error(erro ?? 'Sem dados');
    process.exit(1);
  }

  const itens = data.itens;
  const ids = itens.map((i) => i.idProduto).filter((id) => id > 0);
  if (ids.length === 0) {
    console.log('Nenhum item no painel.');
    return;
  }

  const vinculo = new Map<number, { s19: boolean; s20: boolean }>();
  const CHUNK = 400;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(', ');
    const [rows] = (await queryNomus(
      `
Select pe.idProduto As idProduto,
  Max(Case When pese.idSetorEstoque = 19 Then 1 Else 0 End) As s19,
  Max(Case When pese.idSetorEstoque = 20 Then 1 Else 0 End) As s20
From produtoempresa pe
Inner Join produtoempresa_setorestoque pese On pese.idProdutoEmpresa = pe.id
Where pe.idEmpresa = 1
  And pese.idSetorEstoque In (19, 20)
  And pe.idProduto In (${ph})
Group By pe.idProduto
`.trim(),
      chunk
    )) as [Record<string, unknown>[], unknown];
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.idProduto ?? 0);
      if (id <= 0) continue;
      vinculo.set(id, {
        s19: Number(r.s19 ?? 0) === 1,
        s20: Number(r.s20 ?? 0) === 1,
      });
    }
  }

  const filtrados = itens
    .filter((row) => {
      const v = vinculo.get(row.idProduto);
      if (!v || (!v.s19 && !v.s20)) return false;
      if ((Number(row.saldo) || 0) <= 0) return false;
      if (row.precoUnitario == null || !(Number(row.precoUnitario) > 0)) return false;
      return true;
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));

  console.log(`Total: ${filtrados.length} itens (vínculo 19 e/ou 20, saldo > 0, preço > 0)\n`);
  console.log(
    ['Código', 'Descrição', 'Setores', 'Saldo', 'Preço', 'Status'].join('\t')
  );
  for (const row of filtrados) {
    const v = vinculo.get(row.idProduto)!;
    const setores = [v.s19 ? '19' : null, v.s20 ? '20' : null].filter(Boolean).join('+');
    console.log(
      [
        row.codigo,
        (row.descricao ?? '').replace(/\t/g, ' ').slice(0, 80),
        setores,
        String(row.saldo),
        String(row.precoUnitario),
        row.statusPainel,
      ].join('\t')
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
