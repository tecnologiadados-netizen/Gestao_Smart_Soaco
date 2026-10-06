import { useState } from 'react';
import { getStoredToken } from '@/api/client';
import PdvInicioPage from '@pdv/pages/PdvInicioPage';
import PdvLoginPage from '@pdv/pages/PdvLoginPage';

const ENTRADA_KEY = 'pdv_entrada';

export function pdvEntradaAberta(): boolean {
  return sessionStorage.getItem(ENTRADA_KEY) === '1' && Boolean(getStoredToken());
}

export function marcarEntradaPdv(): void {
  sessionStorage.setItem(ENTRADA_KEY, '1');
}

export function limparEntradaPdv(): void {
  sessionStorage.removeItem(ENTRADA_KEY);
}

/** /pdv fica fora do menu do Gestão: primeiro o login do operador, depois o balcão. */
export default function PdvEntry() {
  const [aberto, setAberto] = useState(pdvEntradaAberta);

  if (!aberto) {
    return (
      <PdvLoginPage
        onEntrou={() => {
          marcarEntradaPdv();
          setAberto(true);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <PdvInicioPage
        onSair={() => {
          limparEntradaPdv();
          setAberto(false);
        }}
      />
    </div>
  );
}
