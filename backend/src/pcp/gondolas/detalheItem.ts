import { buscarItemCarteira, type ItemCarteiraGondola } from './carteiraItens.js';
import { lerFichaProducaoNomus } from './fichaNomus.js';
import { componentesPlanilha } from './fichaPlanilha.js';
import { aplicarMedidasSalvas } from './medidasPeca.js';
import { marcarItemConcluido, pecasGeradas } from './ordensGondola.js';
import { preferenciaFicha } from './preferenciaFicha.js';
import { chavePeca, type ComponenteDetalhe } from './regras.js';

export type OrigemFicha = 'nomus' | 'planilha' | 'nenhuma';

export type DetalheItemGondola = {
  item: ItemCarteiraGondola;
  origem: OrigemFicha;
  componentes: ComponenteDetalhe[];
  /** O código tem lista de produção no Nomus e linhas na planilha; `origem` segue a escolha guardada. */
  ambasFichas?: boolean;
};

async function marcarPecasEmOrdem(idItem: number, componentes: ComponenteDetalhe[]): Promise<ComponenteDetalhe[]> {
  const doItem = (await pecasGeradas([idItem])).get(idItem);
  if (!doItem) return componentes;
  return componentes.map((componente) => {
    const numero = doItem.get(chavePeca(componente));
    return numero ? { ...componente, ordemGerada: numero } : componente;
  });
}

export async function montarDetalheItem(item: ItemCarteiraGondola): Promise<{
  disponivel: boolean;
  detalhe: DetalheItemGondola | null;
  erro?: string;
}> {
  const nomus = await lerFichaProducaoNomus(item.codigo, item.qtdePendenteReal);
  if (!nomus.disponivel) return { disponivel: false, detalhe: null, erro: nomus.erro };

  const daPlanilha = componentesPlanilha(item.setor, item.codigo, item.qtdePendenteReal);
  const ambasFichas = nomus.temFicha && daPlanilha.length > 0;
  const ficarComPlanilha = ambasFichas && (await preferenciaFicha(item.codigo)) === 'planilha';

  if (nomus.temFicha && !ficarComPlanilha) {
    const componentes = await aplicarMedidasSalvas(nomus.componentes);
    return {
      disponivel: true,
      detalhe: {
        item,
        origem: 'nomus',
        componentes: await marcarPecasEmOrdem(item.idItem, componentes),
        ambasFichas,
      },
    };
  }

  return {
    disponivel: true,
    detalhe: {
      item,
      origem: daPlanilha.length > 0 ? 'planilha' : 'nenhuma',
      componentes: await marcarPecasEmOrdem(item.idItem, daPlanilha),
      ambasFichas,
    },
  };
}

/** Depois de gravar a ordem: tira da grade o item cujas peças da ficha já saíram todas em ordem. */
export async function atualizarItensConcluidos(idItens: number[], ordemId: number): Promise<void> {
  const unicos = [...new Set(idItens)];
  for (let i = 0; i < unicos.length; i += 4) {
    await Promise.all(
      unicos.slice(i, i + 4).map(async (idItem) => {
        const busca = await buscarItemCarteira(idItem);
        if (!busca.disponivel || !busca.item) return;
        const montado = await montarDetalheItem(busca.item);
        const componentes = montado.detalhe?.componentes ?? [];
        if (componentes.length > 0 && componentes.every((componente) => componente.ordemGerada)) {
          await marcarItemConcluido(idItem, ordemId);
        }
      })
    );
  }
}
