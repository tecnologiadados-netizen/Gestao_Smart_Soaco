import type { ItemCarteiraGondola } from './carteiraItens.js';
import { lerFichaProducaoNomus } from './fichaNomus.js';
import { componentesPlanilha } from './fichaPlanilha.js';
import { aplicarMedidasSalvas } from './medidasPeca.js';
import type { ComponenteDetalhe } from './regras.js';

export type OrigemFicha = 'nomus' | 'planilha' | 'nenhuma';

export type DetalheItemGondola = {
  item: ItemCarteiraGondola;
  origem: OrigemFicha;
  componentes: ComponenteDetalhe[];
};

export async function montarDetalheItem(item: ItemCarteiraGondola): Promise<{
  disponivel: boolean;
  detalhe: DetalheItemGondola | null;
  erro?: string;
}> {
  const nomus = await lerFichaProducaoNomus(item.codigo, item.qtdePendenteReal);
  if (!nomus.disponivel) return { disponivel: false, detalhe: null, erro: nomus.erro };

  if (nomus.temFicha) {
    return {
      disponivel: true,
      detalhe: { item, origem: 'nomus', componentes: await aplicarMedidasSalvas(nomus.componentes) },
    };
  }

  const daPlanilha = componentesPlanilha(item.setor, item.codigo, item.qtdePendenteReal);
  return {
    disponivel: true,
    detalhe: {
      item,
      origem: daPlanilha.length > 0 ? 'planilha' : 'nenhuma',
      componentes: daPlanilha,
    },
  };
}
