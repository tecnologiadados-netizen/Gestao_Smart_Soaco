import { prisma } from '../../config/prisma.js';
import { hasSectorAccess } from '../lib/rh-permissions.js';
import type { RhGroupPermissions } from '../lib/rh-permissions.js';
import { parseValuesJson, s, toNullableNumber } from '../utils/rhHelpers.js';

function parseSalary(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  let str = String(raw).trim();
  if (!str) return 0;
  str = str.replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!str) return 0;
  if (str.includes(',')) {
    const n = Number.parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number.parseFloat(str.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function getDashboard() {
  const [turnover, headcount, custo, alertas] = await Promise.all([
    prisma.rhDashboardTurnover.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhDashboardHeadcount.findMany({ orderBy: { setor: 'asc' } }),
    prisma.rhDashboardCustoSetor.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.rhDashboardAlertas.findMany({ orderBy: { ordem: 'asc' } }),
  ]);

  return {
    turnoverData: turnover.map((r) => ({ month: r.mes, value: r.valor })),
    headcountData: headcount.map((r) => ({ sector: r.setor, count: r.count })),
    sectorCostData: custo.map((r) => ({ name: r.nome, value: r.value })),
    alerts: alertas.map((r) => ({ message: r.message, severity: r.severity, sector: r.sector })),
  };
}

export async function getRelatorios() {
  const rows = await prisma.rhRelatoriosMensais.findMany({ orderBy: { ordem: 'asc' } });
  return rows.map((r) => ({
    month: r.month,
    admissoes: r.admissoes,
    demissoes: r.demissoes,
    folha: r.folha,
  }));
}

export async function getColaboradores() {
  const rows = await prisma.rhColaboradores.findMany();
  return rows.map((r) => ({
    id: r.codigo,
    name: r.nome,
    cargo: r.cargo,
    setor: r.setor,
    salario: Number(r.salario),
    admissao: r.admissao,
    status: r.status,
    tempoEmpresa: r.tempoEmpresa ?? '',
  }));
}

export async function getCargos(isMaster: boolean, permissions: RhGroupPermissions, areas: string[]) {
  const selectedAreas = new Set(areas.map(s).filter(Boolean));
  const faixaMap = new Map<
    string,
    { faixaMin: number | null; faixaMax: number | null; updatedBy: string | null; updatedAt: string | null }
  >();
  const [organico, faixas] = await Promise.all([
    prisma.rhOrganico.findMany({ select: { cargo: true, setor: true, area: true, valuesJson: true } }),
    prisma.rhCargoFaixas.findMany(),
  ]);

  for (const f of faixas) {
    faixaMap.set(f.cargo, {
      faixaMin: f.faixaMin,
      faixaMax: f.faixaMax,
      updatedBy: f.updatedBy,
      updatedAt: f.updatedAt?.toISOString() ?? null,
    });
  }

  const hasText = (v: unknown) => s(v) !== '';
  const detalheArquivoIndex = (values: string[]) => (values.length >= 87 ? 86 : 85);
  const salarioTotalIndex = (values: string[]) => (values.length >= 87 ? 74 : 73);
  const isApiOnlyRow = (values: string[]) => {
    const detIdx = detalheArquivoIndex(values);
    const origem = s(values[detIdx] ?? values[85]).toUpperCase();
    if (origem === 'API_SECULLUM') return true;
    const hasPlanilhaSignals =
      hasText(values[11]) || hasText(values[15]) || hasText(values[16]) || hasText(values[detIdx]) || hasText(values[85]);
    return !hasPlanilhaSignals;
  };

  const byCargo = new Map<string, { count: number; sum: number }>();
  const bySetor = new Map<string, { count: number; sum: number }>();
  const areaSet = new Set<string>();
  const inconsistencias: Array<{
    matricula: string;
    nome: string;
    cargo: string;
    setor: string;
    area?: string;
    salario: number;
    faixaMin: number;
    faixaMax: number;
    problema: string;
    severity: 'red' | 'yellow';
  }> = [];

  for (const row of organico) {
    const cargo = s(row.cargo) || '—';
    const setor = s(row.setor) || '—';
    const values = parseValuesJson(row.valuesJson);
    if (isApiOnlyRow(values)) continue;
    const area = s(row.area) || s(values[13]) || '—';
    areaSet.add(area);
    if (selectedAreas.size > 0 && !selectedAreas.has(area)) continue;
    if (!isMaster && !hasSectorAccess(permissions, setor)) continue;

    const matricula = s(values[0]) || '—';
    const nome = s(values[1]) || '—';
    const salario = parseSalary(values[salarioTotalIndex(values)]);

    const cargoAgg = byCargo.get(cargo) ?? { count: 0, sum: 0 };
    cargoAgg.count += 1;
    cargoAgg.sum += salario;
    byCargo.set(cargo, cargoAgg);

    const setorAgg = bySetor.get(setor) ?? { count: 0, sum: 0 };
    setorAgg.count += 1;
    setorAgg.sum += salario;
    bySetor.set(setor, setorAgg);

    const faixa = faixaMap.get(cargo);
    if (faixa?.faixaMin != null && faixa?.faixaMax != null) {
      if (salario < faixa.faixaMin) {
        const diffPerc = faixa.faixaMin > 0 ? ((faixa.faixaMin - salario) / faixa.faixaMin) * 100 : 0;
        inconsistencias.push({
          matricula,
          nome,
          cargo,
          setor,
          area,
          salario: Number(salario.toFixed(2)),
          faixaMin: Number(faixa.faixaMin.toFixed(2)),
          faixaMax: Number(faixa.faixaMax.toFixed(2)),
          problema: `Salário ${diffPerc.toFixed(2).replace('.', ',')}% abaixo da faixa mínima`,
          severity: 'red',
        });
      } else if (salario > faixa.faixaMax) {
        const diffPerc = faixa.faixaMax > 0 ? ((salario - faixa.faixaMax) / faixa.faixaMax) * 100 : 0;
        inconsistencias.push({
          matricula,
          nome,
          cargo,
          setor,
          area,
          salario: Number(salario.toFixed(2)),
          faixaMin: Number(faixa.faixaMin.toFixed(2)),
          faixaMax: Number(faixa.faixaMax.toFixed(2)),
          problema: `Salário ${diffPerc.toFixed(2).replace('.', ',')}% acima da faixa máxima`,
          severity: 'red',
        });
      }
    }
  }

  return {
    cargos: Array.from(byCargo.entries())
      .map(([cargo, agg]) => {
        const faixa = faixaMap.get(cargo) ?? { faixaMin: null, faixaMax: null, updatedBy: null, updatedAt: null };
        return {
          cargo,
          faixaMin: faixa.faixaMin,
          faixaMax: faixa.faixaMax,
          media: agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : 0,
          count: agg.count,
          faixaUpdatedBy: faixa.updatedBy,
          faixaUpdatedAt: faixa.updatedAt,
        };
      })
      .sort((a, b) => a.cargo.localeCompare(b.cargo, 'pt-BR')),
    inconsistencias: inconsistencias
      .sort((a, b) => {
        const aRef = a.salario < a.faixaMin ? a.faixaMin : a.faixaMax;
        const bRef = b.salario < b.faixaMin ? b.faixaMin : b.faixaMax;
        return Math.abs(b.salario - bRef) - Math.abs(a.salario - aRef);
      })
      .slice(0, 50),
    salaryBySetor: Array.from(bySetor.entries())
      .map(([setor, agg]) => ({
        setor,
        media: agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.media - a.media),
    areas: Array.from(areaSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export async function setCargoFaixa(input: {
  cargo: string;
  faixaMin: number | null;
  faixaMax: number | null;
  updatedBy: string;
}) {
  const cargo = s(input.cargo);
  if (!cargo) throw new Error('Campo cargo é obrigatório.');
  await prisma.rhCargoFaixas.upsert({
    where: { cargo },
    create: {
      cargo,
      faixaMin: toNullableNumber(input.faixaMin),
      faixaMax: toNullableNumber(input.faixaMax),
      updatedBy: input.updatedBy,
    },
    update: {
      faixaMin: toNullableNumber(input.faixaMin),
      faixaMax: toNullableNumber(input.faixaMax),
      updatedBy: input.updatedBy,
    },
  });
}
