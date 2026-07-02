import type {
  ProgramacaoProducaoRecurso,
  QtdeProduzir,
  RoteiroProducao,
} from '../components/programacao-producao/types';

export const LEGACY_RECURSO_PERFIL = '__legacy_perfiladeira__';
export const LEGACY_RECURSO_MANUAL = '__legacy_manual__';

const LEGACY_LABELS: Record<string, string> = {
  [LEGACY_RECURSO_PERFIL]: 'Perfiladeira',
  [LEGACY_RECURSO_MANUAL]: 'Manual',
};

export function chaveRoteiro(sequencia: string[]): string {
  return sequencia.map((c) => c.trim()).filter(Boolean).join('->');
}

export function normalizarRoteiro(raw: unknown): RoteiroProducao | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const seq = Array.isArray(o.sequencia)
    ? o.sequencia.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const qtde = Number(o.qtde);
  if (!seq.length || !Number.isFinite(qtde) || qtde <= 0) return null;
  return { sequencia: seq, qtde };
}

/** Converte formato antigo { perfiladeira, manual } para roteiros. */
export function migrarQtdeProduzirLegado(raw: unknown): QtdeProduzir {
  if (!raw || typeof raw !== 'object') return { roteiros: [] };
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.roteiros)) {
    const roteiros = o.roteiros
      .map((r) => normalizarRoteiro(r))
      .filter((r): r is RoteiroProducao => r != null);
    return { roteiros };
  }
  const roteiros: RoteiroProducao[] = [];
  const perf = Number(o.perfiladeira) || 0;
  const manual = Number(o.manual) || 0;
  if (perf > 0) roteiros.push({ sequencia: [LEGACY_RECURSO_PERFIL], qtde: perf });
  if (manual > 0) roteiros.push({ sequencia: [LEGACY_RECURSO_MANUAL], qtde: manual });
  return { roteiros };
}

export function somaQtdeRoteiros(q?: QtdeProduzir): number {
  if (!q?.roteiros?.length) return 0;
  return q.roteiros.reduce((s, r) => s + (Number.isFinite(r.qtde) ? r.qtde : 0), 0);
}

export function linhaTemQtdeProduzir(q?: QtdeProduzir): boolean {
  return somaQtdeRoteiros(q) > 0;
}

export function nomeRecursoPorCod(
  cod: string,
  recursos: ProgramacaoProducaoRecurso[] | Map<string, ProgramacaoProducaoRecurso>
): string {
  const legacy = LEGACY_LABELS[cod];
  if (legacy) return legacy;
  const map = recursos instanceof Map ? recursos : new Map(recursos.map((r) => [r.cod, r]));
  return map.get(cod)?.nome ?? cod;
}

export function textoSequenciaRoteiro(
  sequencia: string[],
  recursos: ProgramacaoProducaoRecurso[] | Map<string, ProgramacaoProducaoRecurso>
): string {
  const partes = sequencia.map((c) => nomeRecursoPorCod(c, recursos));
  return partes.join(' → ');
}

/** Versão ASCII para PDF (jsPDF não renderiza bem Unicode como →). */
export function textoSequenciaRoteiroPdf(
  sequencia: string[],
  recursos: ProgramacaoProducaoRecurso[] | Map<string, ProgramacaoProducaoRecurso>
): string {
  const partes = sequencia.map((c) => nomeRecursoPorCod(c, recursos));
  return partes.join(' -> ');
}

export function textoRoteiroComQtde(
  roteiro: RoteiroProducao,
  recursos: ProgramacaoProducaoRecurso[] | Map<string, ProgramacaoProducaoRecurso>,
  formatNum: (n: number) => string
): string {
  return `${textoSequenciaRoteiro(roteiro.sequencia, recursos)}: ${formatNum(roteiro.qtde)}`;
}

export function textoRoteiroComQtdePdf(
  roteiro: RoteiroProducao,
  recursos: ProgramacaoProducaoRecurso[] | Map<string, ProgramacaoProducaoRecurso>,
  formatNum: (n: number) => string
): string {
  return `${textoSequenciaRoteiroPdf(roteiro.sequencia, recursos)}: ${formatNum(roteiro.qtde)}`;
}

export function roteirosDuplicados(roteiros: RoteiroProducao[]): boolean {
  const vistos = new Set<string>();
  for (const r of roteiros) {
    const k = chaveRoteiro(r.sequencia);
    if (!k) continue;
    if (vistos.has(k)) return true;
    vistos.add(k);
  }
  return false;
}

export function validarQtdeProduzirModal(q: QtdeProduzir): string | null {
  if (!q.roteiros.length) return 'Informe ao menos um roteiro.';
  for (let i = 0; i < q.roteiros.length; i++) {
    const r = q.roteiros[i]!;
    if (!r.sequencia.length) return `Roteiro ${i + 1}: selecione ao menos um recurso na sequência.`;
    if (!Number.isFinite(r.qtde) || r.qtde <= 0) {
      return `Roteiro ${i + 1}: informe a quantidade a produzir.`;
    }
  }
  if (roteirosDuplicados(q.roteiros)) return 'Não é permitido cadastrar roteiros iguais.';
  return null;
}

/** Soma das qtdes dos roteiros que passam por recurso "Perfiladeira" (legado ou cadastro). */
export function somaQtdePerfiladeiraRoteiros(
  q: QtdeProduzir | undefined,
  recursos: ProgramacaoProducaoRecurso[]
): number {
  if (!q?.roteiros?.length) return 0;
  const map = new Map(recursos.map((r) => [r.cod, r]));
  let soma = 0;
  for (const rot of q.roteiros) {
    const temPerfil = rot.sequencia.some((c) => {
      if (c === LEGACY_RECURSO_PERFIL) return true;
      const nome = map.get(c)?.nome?.trim().toLowerCase() ?? '';
      return nome === 'perfiladeira';
    });
    if (temPerfil) soma += rot.qtde;
  }
  return soma;
}

export function usuarioRecursoLabel(r: ProgramacaoProducaoRecurso): string {
  if (r.atualizadoPorNome?.trim()) return r.atualizadoPorNome.trim();
  return r.atualizadoPorLogin;
}
