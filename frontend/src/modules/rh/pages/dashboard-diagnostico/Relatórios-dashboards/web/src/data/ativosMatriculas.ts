/**
 * Matrículas de colaboradores ativos — fallback quando a integração Secullum ainda não carregou.
 * Em produção, o painel usa `createColaboradorAtivoResolver` (flag `desligado` do Secullum).
 */
export const MATRICULAS_ATIVAS = new Set<number>([
  1449, 1427, 1044, 1118, 1485, 373, 1802, 951, 84, 1375, 62, 777, 1151, 913, 31, 1778, 42, 354, 537, 787, 1771, 1758, 1755, 1607, 1672, 155, 324, 832, 87, 459, 1724, 446, 1395, 1539, 871, 1694, 1561, 1519, 551, 1306, 1783, 1795, 1722, 1583, 939, 24, 1756, 1289, 986, 417, 775, 923, 1081, 251, 1748, 1468, 1769, 462, 1761, 1030, 1286, 1432, 1478, 1616, 1792, 1733, 1749, 954, 160, 521, 1516, 1775, 1250, 88, 1788, 1646, 1753, 1599, 1277, 1143, 884, 910, 1638, 1221, 1772, 230, 1574, 1367, 1128, 926, 1768, 1177, 902, 1262, 1391, 1555, 1237, 877, 1508, 1628, 1565, 168, 1745, 471, 529, 1144, 1320, 897, 76, 932, 1474, 1348, 1774, 1506, 384, 1037, 1762, 1577, 1765, 133, 1328, 1699, 1587, 1113, 1794, 1757, 1475, 80, 52, 1273, 1000, 1305, 989, 1008, 1528, 1261, 1556, 1158, 1654, 886, 1578, 1148, 1791, 1005, 1662, 1752, 1344, 1709, 1389, 509, 1548, 1766, 855, 1350, 434, 530, 96, 1691, 556, 1610, 1179, 1710, 1735, 1760, 1125, 1725, 1682, 1601, 1543, 1554, 1803, 1806, 1805,
])

export type ColaboradorAtivoResolver = (matricula: number) => boolean

function normalizeMatriculaKey(value: unknown): string {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  return digits.replace(/^0+/, '') || '0'
}

export function colaboradorAtivo(matricula: number): boolean {
  const key = normalizeMatriculaKey(matricula)
  const n = Number(key)
  return Number.isFinite(n) && MATRICULAS_ATIVAS.has(n)
}

/** Mesma regra do filtro “Colaboradores ativos” do painel (`!desligado` no Secullum). */
export function createColaboradorAtivoResolver(
  funcionarios: { numeroFolha: string; desligado: boolean }[],
): ColaboradorAtivoResolver {
  if (!funcionarios.length) return colaboradorAtivo

  const byMatricula = new Map<string, { desligado: boolean }>()
  for (const f of funcionarios) {
    const key = normalizeMatriculaKey(f.numeroFolha)
    if (!key) continue
    byMatricula.set(key, { desligado: Boolean(f.desligado) })
  }

  return (matricula: number) => {
    const hit = byMatricula.get(normalizeMatriculaKey(matricula))
    if (!hit) return false
    return !hit.desligado
  }
}
