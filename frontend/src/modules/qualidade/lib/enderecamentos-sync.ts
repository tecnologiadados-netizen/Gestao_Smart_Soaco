import type { Department } from '@qualidade/types/user';
import type { Enderecamento } from '@qualidade/types/enderecamento';

export const ENDERECAMENTOS_OPCOES_CHAVE = 'sgq-enderecamentos';

export function formatEnderecamentoLabel(
  enderecamento: Enderecamento,
  departments: Department[]
): string {
  const setor = departments.find((d) => d.id === enderecamento.setorId);
  if (!setor) return enderecamento.endereco;
  return `${setor.nome} — ${enderecamento.endereco}`;
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
