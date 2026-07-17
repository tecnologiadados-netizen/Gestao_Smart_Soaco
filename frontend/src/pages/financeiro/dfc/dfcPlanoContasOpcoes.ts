import estruturaJson from './estruturaDfcArvore.json';
import type { DfcEstruturaNo } from './ArvoreContasDfc';
import { classificacaoExcluidaDaArvoreDfc } from './mapeamentoFluxoDfc';

export type OpcaoFiltroPlano = { id: string; label: string; idNum: number };

function flatten(nodes: DfcEstruturaNo[], out: OpcaoFiltroPlano[]): void {
  for (const n of nodes) {
    if (n.codigo?.trim() && classificacaoExcluidaDaArvoreDfc(n.codigo)) continue;
    if (n.id != null && n.id > 0) {
      const cod = n.codigo?.trim();
      const label = cod ? `${cod} — ${n.nome}` : n.nome;
      out.push({ id: String(n.id), label, idNum: n.id });
    }
    if (n.children?.length) flatten(n.children, out);
  }
}

const _roots = (estruturaJson as unknown as { roots: DfcEstruturaNo[] }).roots;
const _opcoesPlano = (() => {
  const list: OpcaoFiltroPlano[] = [];
  flatten(_roots, list);
  list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  return list;
})();

export function listarOpcoesPlanoContasDfc(): OpcaoFiltroPlano[] {
  return _opcoesPlano;
}
