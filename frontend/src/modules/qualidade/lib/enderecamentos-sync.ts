import type { Department } from '@qualidade/types/user';
import {
  ENDERECAMENTO_SETOR_GERAL_LABEL,
  isEnderecamentoSetorGeral,
  type Enderecamento,
} from '@qualidade/types/enderecamento';

export const ENDERECAMENTOS_OPCOES_CHAVE = 'sgq-enderecamentos';

export function enderecamentoSetorLabel(
  departments: Department[],
  setorId: string
): string {
  if (isEnderecamentoSetorGeral(setorId)) return ENDERECAMENTO_SETOR_GERAL_LABEL;
  return departments.find((d) => d.id === setorId)?.nome ?? '—';
}

export function formatEnderecamentoLabel(
  enderecamento: Enderecamento,
  departments: Department[]
): string {
  const setorNome = enderecamentoSetorLabel(departments, enderecamento.setorId);
  if (setorNome === '—') return enderecamento.endereco;
  return `${setorNome} — ${enderecamento.endereco}`;
}

/** Endereços do setor + endereços com setor Geral (aplicam a todos). */
export function filterEnderecamentosPorSetor(
  enderecamentos: Enderecamento[],
  setorId: string
): Enderecamento[] {
  if (!setorId) return enderecamentos;
  return enderecamentos.filter(
    (item) =>
      item.setorId === setorId || isEnderecamentoSetorGeral(item.setorId)
  );
}

export function parseEnderecamentosFromOpcoes(
  valores: string[] | undefined
): Enderecamento[] {
  if (!valores?.length) return [];

  const parsed: Enderecamento[] = [];
  for (const valor of valores) {
    try {
      const item = JSON.parse(valor) as Partial<Enderecamento>;
      if (
        typeof item.id === 'string' &&
        typeof item.setorId === 'string' &&
        typeof item.endereco === 'string' &&
        item.endereco.trim()
      ) {
        parsed.push({
          id: item.id,
          setorId: item.setorId,
          endereco: item.endereco.trim(),
        });
      }
    } catch {
      /* ignora valor inválido */
    }
  }
  return parsed;
}

export function serializeEnderecamentos(enderecamentos: Enderecamento[]): string[] {
  return enderecamentos.map((e) =>
    JSON.stringify({
      id: e.id,
      setorId: e.setorId,
      endereco: e.endereco.trim(),
    })
  );
}

export function buildLocalizacaoOpcoes(
  enderecamentos: Enderecamento[],
  departments: Department[],
  valorAtual = ''
): Array<{ value: string; label: string }> {
  const map = new Map<string, { value: string; label: string }>();

  for (const item of enderecamentos) {
    const value = item.endereco.trim();
    if (!value) continue;
    map.set(value, {
      value,
      label: formatEnderecamentoLabel(item, departments),
    });
  }

  const atual = valorAtual.trim();
  if (atual && !map.has(atual)) {
    map.set(atual, { value: atual, label: atual });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
  );
}
