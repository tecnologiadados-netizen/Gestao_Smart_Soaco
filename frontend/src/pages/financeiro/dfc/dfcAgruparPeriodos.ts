/** Agrupa colunas diárias da DFC resumida (sábado + domingo + segunda). */

const DIAS_SEMANA = [
  'DOMINGO',
  'SEGUNDA-FEIRA',
  'TERÇA-FEIRA',
  'QUARTA-FEIRA',
  'QUINTA-FEIRA',
  'SEXTA-FEIRA',
  'SÁBADO',
] as const;

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDataBr(ymd: string): string {
  const [y, mo, d] = ymd.split('-');
  if (!y || !mo || !d) return ymd;
  return `${d}/${mo}/${y}`;
}

export type ColunaResumoDfc =
  | {
      tipo: 'dia';
      periodos: [string];
      rotuloPrincipal: string;
      rotuloSecundario: string;
      agrupado: false;
    }
  | {
      tipo: 'fimDeSemana';
      periodos: string[];
      rotuloPrincipal: 'SÁBADO A SEGUNDA';
      rotuloSecundario: string;
      agrupado: true;
    };

export function nomeDiaSemana(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return '';
  return DIAS_SEMANA[dt.getDay()];
}

/** Monta colunas da visão resumida: cada dia isolado; bloco sáb–dom–seg agrupado após a segunda. */
export function montarColunasResumo(
  periodos: string[],
  granularidade: 'dia' | 'mes',
): ColunaResumoDfc[] {
  if (granularidade !== 'dia') {
    return periodos.map((p) => ({
      tipo: 'dia' as const,
      periodos: [p] as [string],
      rotuloPrincipal: fmtDataBr(p),
      rotuloSecundario: '',
      agrupado: false,
    }));
  }

  const setPeriodos = new Set(periodos);
  const blocoFimSemanaInserido = new Set<string>();
  const colunas: ColunaResumoDfc[] = [];

  for (const p of periodos) {
    const dt = parseYmd(p);
    if (!dt) {
      colunas.push({
        tipo: 'dia',
        periodos: [p],
        rotuloPrincipal: nomeDiaSemana(p),
        rotuloSecundario: fmtDataBr(p),
        agrupado: false,
      });
      continue;
    }

    colunas.push({
      tipo: 'dia',
      periodos: [p],
      rotuloPrincipal: nomeDiaSemana(p),
      rotuloSecundario: fmtDataBr(p),
      agrupado: false,
    });

    // Agrupamento só depois da segunda-feira (sáb + dom + seg já exibidos separadamente).
    if (dt.getDay() === 1) {
      const seg = p;
      const dom = ymdFromDate(addDays(dt, -1));
      const sab = ymdFromDate(addDays(dt, -2));
      const grupo = [sab, dom, seg].filter((d) => setPeriodos.has(d));
      const chaveBloco = grupo.join('|');
      if (grupo.length >= 2 && !blocoFimSemanaInserido.has(chaveBloco)) {
        blocoFimSemanaInserido.add(chaveBloco);
        colunas.push({
          tipo: 'fimDeSemana',
          periodos: grupo,
          rotuloPrincipal: 'SÁBADO A SEGUNDA',
          rotuloSecundario: `${fmtDataBr(grupo[0])} a ${fmtDataBr(grupo[grupo.length - 1])}`,
          agrupado: true,
        });
      }
    }
  }

  return colunas;
}
