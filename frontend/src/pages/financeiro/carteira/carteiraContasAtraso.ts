/** Conta e Status conta vêm do SQL como itens `campo1|campo2` separados por `||`. */

export type ContaAtrasoItem = {
  codigo: string;
  valor: number | null;
};

export type StatusContaAtrasoItem = {
  status: string;
  vencimento: string | null;
};

function splitItens(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseContasAtraso(raw: string | null | undefined): ContaAtrasoItem[] {
  return splitItens(raw).map((item) => {
    // Formato novo: codigo|valor — legado: só código (ou lista com vírgula)
    if (item.includes('|')) {
      const [codigo, valorStr] = item.split('|');
      const valor = Number(String(valorStr ?? '').replace(',', '.'));
      return {
        codigo: (codigo ?? '').trim(),
        valor: Number.isFinite(valor) ? valor : null,
      };
    }
    return { codigo: item.replace(/,$/, '').trim(), valor: null };
  }).filter((x) => x.codigo);
}

export function parseStatusContasAtraso(raw: string | null | undefined): StatusContaAtrasoItem[] {
  if (!raw?.trim()) return [];
  // Legado: literal "Em atraso" sem data
  if (!raw.includes('|') && !raw.includes('||')) {
    return [{ status: raw.trim(), vencimento: null }];
  }
  return splitItens(raw).map((item) => {
    const [status, vencimento] = item.split('|');
    return {
      status: (status ?? 'Em atraso').trim() || 'Em atraso',
      vencimento: (vencimento ?? '').trim() || null,
    };
  });
}

export function formatContasAtrasoTexto(raw: string | null | undefined, fmtValor: (n: number) => string): string {
  const itens = parseContasAtraso(raw);
  if (itens.length === 0) return '';
  return itens
    .map((c) => (c.valor != null ? `${c.codigo} · ${fmtValor(c.valor)}` : c.codigo))
    .join('\n');
}

export function formatStatusContasAtrasoTexto(
  raw: string | null | undefined,
  fmtData: (iso: string | null) => string
): string {
  const itens = parseStatusContasAtraso(raw);
  if (itens.length === 0) return '';
  return itens
    .map((s) => (s.vencimento ? `${s.status} · ${fmtData(s.vencimento)}` : s.status))
    .join('\n');
}
