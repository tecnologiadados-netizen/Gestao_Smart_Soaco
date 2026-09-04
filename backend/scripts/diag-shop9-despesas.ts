import 'dotenv/config';
import { writeFileSync } from 'fs';
import { isShop9Enabled } from '../src/config/shop9Db.js';
import {
  carregarLinhasShop9Financeiro,
  queryDfcShop9DespesasPagamentoEmAberto,
} from '../src/data/dfcShop9Repository.js';
import {
  resolverIdEmpresaShop9SaidasDre,
  resolverNomusIdEmpresaShop9,
} from '../src/data/dfcShop9Empresa.js';

const out: string[] = [];
const log = (...a: unknown[]) => {
  const line = a.map(String).join(' ');
  out.push(line);
  console.log(line);
};

async function main() {
  log('shop9Enabled', isShop9Enabled());
  const { rows, erro } = await carregarLinhasShop9Financeiro(true);
  log('rows', rows.length, 'erro', erro ?? '');

  const tipos = new Map<string, number>();
  for (const r of rows) {
    const t = String(r.tipoConta || '').trim().toUpperCase() || '(vazio)';
    tipos.set(t, (tipos.get(t) || 0) + 1);
  }
  log('tipos', JSON.stringify(Object.fromEntries(tipos)));

  const abertos = rows.filter((r) => !r.dataBaixa);
  log('abertos', abertos.length);
  const abertosP = abertos.filter((r) => String(r.tipoConta).trim().toUpperCase() === 'P');
  log('abertosP', abertosP.length);

  const byUsed = new Map<number, number>();
  const byDre = new Map<number, number>();
  for (const r of abertosP) {
    const idRes = resolverNomusIdEmpresaShop9(r);
    const idDre = resolverIdEmpresaShop9SaidasDre(r);
    const used = idRes ?? (r.ordemFilial === 6 ? 2 : 1);
    byUsed.set(used, (byUsed.get(used) || 0) + 1);
    if (idDre != null) byDre.set(idDre, (byDre.get(idDre) || 0) + 1);
  }
  log('byUsed(empresaParaIdNomus atual)', JSON.stringify(Object.fromEntries(byUsed)));
  log('byDre(resolverSaidasDre)', JSON.stringify(Object.fromEntries(byDre)));

  const sample = abertosP
    .filter(
      (r) =>
        r.ordemFilial === 6 ||
        /marques|refrigera/i.test(String(r.centrocusto || '') + String(r.empresa || '')),
    )
    .slice(0, 12)
    .map((r) => ({
      fil: r.ordemFilial,
      emp: r.empresa,
      cc: r.centrocusto,
      tipo: r.tipoConta,
      saldo: r.saldoBaixar,
      total: r.valorTotalCalculado,
      idRes: resolverNomusIdEmpresaShop9(r),
      idDre: resolverIdEmpresaShop9SaidasDre(r),
    }));
  log('sampleRNRef', JSON.stringify(sample, null, 2));

  const q34 = await queryDfcShop9DespesasPagamentoEmAberto({
    dataInicio: '2026-01-01',
    dataFim: '2026-12-31',
    idEmpresas: [3, 4],
  });
  log('query 3+4 Jan-Dez', q34.linhas.length, q34.erro ?? '');

  const qAll = await queryDfcShop9DespesasPagamentoEmAberto({
    dataInicio: '2026-01-01',
    dataFim: '2026-12-31',
    idEmpresas: [1, 2, 3, 4],
  });
  const be: Record<number, number> = {};
  for (const l of qAll.linhas) be[l.idEmpresa] = (be[l.idEmpresa] || 0) + 1;
  log('query all Jan-Dez', qAll.linhas.length, JSON.stringify(be));

  const qHoje = await queryDfcShop9DespesasPagamentoEmAberto({
    dataInicio: '2026-01-01',
    dataFim: new Date().toISOString().slice(0, 10),
    idEmpresas: [3, 4],
  });
  log('query 3+4 ate hoje', qHoje.linhas.length);

  writeFileSync('tmp-shop9-diag.txt', out.join('\n'), 'utf8');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
