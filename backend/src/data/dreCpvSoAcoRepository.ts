/**
 * DRE — CPV Só Aço (Nomus): BOM + custo médio mensal.
 * Direto (6.1.1): custoTotal onde idItemPedidoSM = So Aco.
 * Indireto (6.1.2): So Moveis com MKP por grupoProduto.
 * Margem MKP (6.2.2): diferença bruto − líquido (sem MKP − com MKP), como 1.4.2 na receita.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  calcularValorFaturamentoIndireto,
  nomeGrupoProdutoDre,
  variacaoMkpPorGrupo,
} from './dreMkpVariacoes.js';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

const PSM_PEDIDO_EMISAO_MIN = '2024-01-01';
const ID_SO_ACO = 'So Aco';
const ID_SO_MOVEIS = 'So Moveis';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function aplicarSqlCpv(
  sql: string,
  params: { dataInicio: string; dataFim: string; idEmpresa: number },
): string {
  return sql
    .replace(/\{\{PSM_DATA_MIN\}\}/g, PSM_PEDIDO_EMISAO_MIN)
    .replace(/\{\{ID_EMPRESA\}\}/g, String(params.idEmpresa))
    .replace(/\{\{DATA_EMISSAO_MIN\}\}/g, params.dataInicio)
    .replace(/\{\{DATA_EMISSAO_MAX\}\}/g, params.dataFim)
    .replace(/\{\{ID_EMPRESA_SAIDA\}\}/g, String(params.idEmpresa));
}

export type DreCpvSoAcoLinha = {
  mes: number;
  ano: number;
  grupoProduto: string;
  custoTotal: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Aplica MKP sobre custototal: equivalente a (unit × (1-MKP%)) × qtde. */
function aplicarMkpCpv(custototal: number, grupoProduto: string): number {
  if (custototal <= 0) return 0;
  const mkp = variacaoMkpPorGrupo(grupoProduto);
  return calcularValorFaturamentoIndireto(custototal, 1, mkp);
}

export async function queryDreCpvSoAco(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{
  direto: DreCpvSoAcoLinha[];
  indireto: DreCpvSoAcoLinha[];
  indiretoSemMkp: DreCpvSoAcoLinha[];
  erro?: string;
}> {
  if (!isNomusEnabled()) {
    return { direto: [], indireto: [], indiretoSemMkp: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { direto: [], indireto: [], indiretoSemMkp: [], erro: 'Pool Nomus indisponível.' };

  const idEmpresa = params.idEmpresaSaida ?? 1;
  if (!DATE_RE.test(params.dataInicio) || !DATE_RE.test(params.dataFim)) {
    return { direto: [], indireto: [], indiretoSemMkp: [], erro: 'Datas inválidas (use YYYY-MM-DD).' };
  }
  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0) {
    return { direto: [], indireto: [], indiretoSemMkp: [], erro: 'idEmpresaSaida inválido.' };
  }

  try {
    const sql = aplicarSqlCpv(loadSql('dreCpvSoAco.sql'), {
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      idEmpresa,
    });
    const [rows] = await pool.query(sql);
    const diretoMap = new Map<string, DreCpvSoAcoLinha>();
    const indiretoMap = new Map<string, DreCpvSoAcoLinha>();
    const indiretoMargemMap = new Map<string, DreCpvSoAcoLinha>();

    for (const r of rows as Record<string, unknown>[]) {
      const mes = toInt(r.mes);
      const ano = toInt(r.ano);
      const grupoProduto = nomeGrupoProdutoDre(String(r.grupoProduto ?? 'Outros').trim() || 'Outros');
      const idSm = String(r.idItemPedidoSM ?? '').trim();
      const custoBruto = toNum(r.custoTotal ?? r.custototal);
      if (custoBruto <= 0 || !mes || !ano) continue;

      const k = `${ano}\t${mes}\t${grupoProduto}`;

      if (idSm === ID_SO_ACO) {
        const prev = diretoMap.get(k);
        diretoMap.set(k, {
          mes,
          ano,
          grupoProduto,
          custoTotal: Math.round(((prev?.custoTotal ?? 0) + custoBruto) * 100) / 100,
        });
      } else if (idSm === ID_SO_MOVEIS) {
        const custoLiquido = aplicarMkpCpv(custoBruto, grupoProduto);
        const margemMkp = Math.max(0, custoBruto - custoLiquido);
        const prevLiq = indiretoMap.get(k);
        indiretoMap.set(k, {
          mes,
          ano,
          grupoProduto,
          custoTotal: Math.round(((prevLiq?.custoTotal ?? 0) + custoLiquido) * 100) / 100,
        });
        if (margemMkp > 0) {
          const prevMargem = indiretoMargemMap.get(k);
          indiretoMargemMap.set(k, {
            mes,
            ano,
            grupoProduto,
            custoTotal: Math.round(((prevMargem?.custoTotal ?? 0) + margemMkp) * 100) / 100,
          });
        }
      }
    }

    return {
      direto: [...diretoMap.values()],
      indireto: [...indiretoMap.values()],
      indiretoSemMkp: [...indiretoMargemMap.values()],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreCpvSoAco]', msg);
    return { direto: [], indireto: [], indiretoSemMkp: [], erro: msg };
  }
}
