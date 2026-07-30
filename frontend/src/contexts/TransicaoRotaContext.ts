import { createContext, useContext } from 'react';

/**
 * Indica que o overlay de troca de tela está cobrindo a viewport.
 *
 * Sem provider o valor é `false`, então telas fora do Layout (login, módulos
 * isolados) seguem com o comportamento normal.
 *
 * Fica separado do provider de propósito: `useDuracaoMinima` consome este
 * contexto e o provider consome o overlay, que por sua vez usa o hook — juntos
 * no mesmo arquivo isso viraria ciclo de import.
 */
export const TransicaoRotaContext = createContext(false);

export function useTransicaoRotaAtiva(): boolean {
  return useContext(TransicaoRotaContext);
}
