/**
 * Quantidade do pai simbólico a partir da carteira dos filhos do NOMUS.
 *
 * O pai pertence a Gôndolas ou Porta-pallets. Cada filho é um produto do NOMUS.
 * A quantidade gravada no vínculo diz quantas unidades daquele filho entram em
 * 1 pai e fica para o plano. Ela não entra na conta da quantidade do pai.
 *
 * A quantidade sugerida do pai é o saldo em aberto dos filhos: a soma do
 * saldo de cada item Liberado ou Atendido parcialmente. A qtde pedida fica
 * só como referência do que foi vendido.
 */

export type FilhoParaSugestao = {
  quantidade: number;
  qtdePedida: number;
  pendente: number;
};

export type FilhoComSugestao = FilhoParaSugestao & {
  paisImplicados: number;
};

export type ResumoSugestao = {
  qtdePedida: number;
  pendente: number;
  sugestao: number;
  filhos: FilhoComSugestao[];
};

export function paisImplicados(qtdePedida: number, quantidadeNaFicha: number): number {
  const pedida = Number(qtdePedida);
  const naFicha = Number(quantidadeNaFicha);
  if (!Number.isFinite(pedida) || pedida <= 0) return 0;
  if (!Number.isFinite(naFicha) || naFicha <= 0) return 0;
  return Math.ceil(pedida / naFicha);
}

export function resumirSugestao(filhos: FilhoParaSugestao[]): ResumoSugestao {
  const linhas = filhos.map((filho) => ({
    quantidade: Number(filho.quantidade) || 0,
    qtdePedida: Number(filho.qtdePedida) || 0,
    pendente: Number(filho.pendente) || 0,
    paisImplicados: paisImplicados(filho.qtdePedida, filho.quantidade),
  }));

  return {
    qtdePedida: linhas.reduce((acc, linha) => acc + linha.qtdePedida, 0),
    pendente: linhas.reduce((acc, linha) => acc + linha.pendente, 0),
    sugestao: linhas.reduce((acc, linha) => acc + linha.pendente, 0),
    filhos: linhas,
  };
}
