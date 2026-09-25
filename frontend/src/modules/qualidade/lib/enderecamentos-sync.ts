import type { Department } from '@qualidade/types/user';
import {
  ENDERECAMENTO_CATEGORIA_LABEL,
  ENDERECAMENTO_SETOR_GERAL_LABEL,
  isEnderecamentoSetorGeral,
  type Enderecamento,
  type EnderecamentoCategoria,
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
  // No formulário, endereços "Geral" aparecem só pelo nome do local (sem prefixo "Geral —").
  if (isEnderecamentoSetorGeral(enderecamento.setorId)) {
    return enderecamento.endereco;
  }
  const setorNome = enderecamentoSetorLabel(departments, enderecamento.setorId);
  if (setorNome === '—') return enderecamento.endereco;
  return `${setorNome} — ${enderecamento.endereco}`;
}

export function normalizarCategoriaEnderecamento(
  valor: unknown
): EnderecamentoCategoria {
  return valor === 'eletronico' ? 'eletronico' : 'fisico';
}

/** Endereços do setor + endereços com setor Geral (aplicam a todos). */
export function filterEnderecamentosPorSetor(
  enderecamentos: Enderecamento[],
  setorId: string,
  categorias?: EnderecamentoCategoria[]
): Enderecamento[] {
  return enderecamentos.filter((item) => {
    const setorOk =
      !setorId ||
      item.setorId === setorId ||
      isEnderecamentoSetorGeral(item.setorId);
    if (!setorOk) return false;
    if (!categorias) return true;
    if (categorias.length === 0) return false;
    return categorias.includes(normalizarCategoriaEnderecamento(item.categoria));
  });
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
          categoria: normalizarCategoriaEnderecamento(item.categoria),
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
      categoria: normalizarCategoriaEnderecamento(e.categoria),
    })
  );
}

export interface LocalizacaoGuarda {
  categoria: EnderecamentoCategoria;
  endereco: string;
}

/** Lê o campo `localizacao`: texto antigo ou lista JSON de guardas. */
export function parseLocalizacoesDocumento(raw: string | undefined | null): LocalizacaoGuarda[] {
  const texto = (raw ?? '').trim();
  if (!texto) return [];
  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const endereco = String((item as { endereco?: unknown }).endereco ?? '').trim();
          if (!endereco) return [];
          return [
            {
              categoria: normalizarCategoriaEnderecamento(
                (item as { categoria?: unknown }).categoria
              ),
              endereco,
            },
          ];
        });
      }
    } catch {
      /* valor legado em texto livre */
    }
  }
  return [{ categoria: 'fisico', endereco: texto }];
}

export function serializeLocalizacoesDocumento(items: LocalizacaoGuarda[]): string {
  const validas = items
    .map((item) => ({
      categoria: normalizarCategoriaEnderecamento(item.categoria),
      endereco: item.endereco.trim(),
    }))
    .filter((item) => item.endereco);
  if (validas.length === 0) return '';
  if (validas.length === 1 && validas[0].categoria === 'fisico') {
    return validas[0].endereco;
  }
  return JSON.stringify(validas);
}

export function formatLocalizacoesDocumento(
  raw: string | undefined | null,
  enderecamentos: Enderecamento[],
  departments: Department[]
): string {
  const items = parseLocalizacoesDocumento(raw);
  if (items.length === 0) return '—';
  return items
    .map((item) => {
      const opcoes = buildLocalizacaoOpcoes(
        filterEnderecamentosPorSetor(enderecamentos, '', [item.categoria]),
        departments,
        item.endereco
      );
      const lugar =
        opcoes.find((opcao) => opcao.value === item.endereco)?.label ?? item.endereco;
      return `${ENDERECAMENTO_CATEGORIA_LABEL[item.categoria]}: ${lugar}`;
    })
    .join(' · ');
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
