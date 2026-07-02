import estruturaJson from './estruturaDreArvore.json';
import type { DreEstruturaNo } from './ArvoreContasDre';

export type OpcaoFiltroPlanoDre = { id: string; label: string; idNum: number };

export type OpcaoRateioPlanoDre = {
  codigo: string;
  pathKey: string;
  nome: string;
  label: string;
};

function flatten(nodes: DreEstruturaNo[], out: OpcaoFiltroPlanoDre[]): void {
  for (const n of nodes) {
    if (n.id != null && n.id > 0) {
      const cod = n.codigo?.trim();
      const label = cod ? `${cod} — ${n.nome}` : n.nome;
      out.push({ id: String(n.id), label, idNum: n.id });
    }
    if (n.children?.length) flatten(n.children, out);
  }
}

const _roots = (estruturaJson as unknown as { roots: DreEstruturaNo[] }).roots;
const _opcoesPlano = (() => {
  const list: OpcaoFiltroPlanoDre[] = [];
  flatten(_roots, list);
  list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  return list;
})();

function flattenRateio(nodes: DreEstruturaNo[], out: OpcaoRateioPlanoDre[]): void {
  for (const n of nodes) {
    const cod = n.codigo?.trim();
    if (cod && n.pathKey) {
      out.push({
        codigo: cod,
        pathKey: n.pathKey,
        nome: n.nome,
        label: `${cod} — ${n.nome}`,
      });
    }
    if (n.children?.length) flattenRateio(n.children, out);
  }
}

const _opcoesRateio = (() => {
  const list: OpcaoRateioPlanoDre[] = [];
  flattenRateio(_roots, list);
  list.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  return list;
})();

export function listarOpcoesPlanoContasDre(): OpcaoFiltroPlanoDre[] {
  return _opcoesPlano;
}

export function listarOpcoesRateioPlanoContasDre(): OpcaoRateioPlanoDre[] {
  return _opcoesRateio;
}
