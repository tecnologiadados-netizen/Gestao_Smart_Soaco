/**
 * Histórico de atualizações de documento externo.
 * O arquivo da revisão vigente não entra aqui.
 * Os anteriores ficam da publicação mais antiga para a mais recente.
 * Arquivos sem data (lote inicial, antes de haver atualização) permanecem
 * no começo, na ordem em que foram registrados.
 */

export type AtualizacaoExternaItem = {
  key: string;
  nome: string;
  dataPublicacao?: string;
  dataUrl?: string;
  storagePath?: string;
};

type ArquivoRef = {
  nome: string;
  dataUrl?: string;
  storagePath?: string;
};

type HistoricoRef = ArquivoRef & {
  dataPublicacao?: string;
};

type VersaoRef = {
  id: string;
  versao: string;
  dataAprovacao?: string;
  dataElaboracao?: string;
  arquivos: ArquivoRef[];
};

type ItemInterno = AtualizacaoExternaItem & {
  ordemVersao?: number;
};

function tempoPublicacao(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  const tempo = Date.parse(raw);
  return Number.isFinite(tempo) ? tempo : null;
}

function mesmoArquivo(a: ArquivoRef, b: ArquivoRef): boolean {
  const pathA = a.storagePath?.trim();
  const pathB = b.storagePath?.trim();
  if (pathA && pathB) return pathA === pathB;
  return a.nome.trim() === b.nome.trim();
}

function ordenar(items: ItemInterno[]): ItemInterno[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = tempoPublicacao(a.item.dataPublicacao);
      const tb = tempoPublicacao(b.item.dataPublicacao);
      const aComData = ta != null;
      const bComData = tb != null;
      if (aComData && bComData && ta !== tb) return ta - tb;
      if (aComData !== bComData) return aComData ? 1 : -1;
      const va = a.item.ordemVersao;
      const vb = b.item.ordemVersao;
      if (va != null && vb != null && va !== vb) return va - vb;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function montarAtualizacoesExternas(input: {
  historico: HistoricoRef[];
  versoes: VersaoRef[];
  versaoAtual: string;
  vigentes: ArquivoRef[];
}): AtualizacaoExternaItem[] {
  const items: ItemInterno[] = [];

  input.historico.forEach((h, idx) => {
    const nome = h.nome?.trim();
    if (!nome) return;
    if (input.vigentes.some((v) => mesmoArquivo(v, { ...h, nome }))) return;
    items.push({
      key: `hist-${idx}-${nome}`,
      nome,
      dataPublicacao: h.dataPublicacao,
      dataUrl: h.dataUrl,
      storagePath: h.storagePath,
    });
  });

  for (const ver of input.versoes) {
    if (ver.versao === input.versaoAtual) continue;
    const ordem = Number.parseInt(ver.versao, 10);
    const dataPublicacao = ver.dataAprovacao || ver.dataElaboracao;
    ver.arquivos.forEach((arquivo, idx) => {
      const nome = arquivo.nome?.trim();
      if (!nome) return;
      if (input.vigentes.some((v) => mesmoArquivo(v, { ...arquivo, nome }))) return;
      items.push({
        key: `ver-${ver.id}-${idx}`,
        nome,
        dataPublicacao,
        dataUrl: arquivo.dataUrl,
        storagePath: arquivo.storagePath,
        ...(Number.isNaN(ordem) ? {} : { ordemVersao: ordem }),
      });
    });
  }

  return ordenar(items).map(({ ordemVersao: _ordem, ...item }) => item);
}
