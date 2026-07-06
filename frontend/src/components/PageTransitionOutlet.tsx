import { Outlet, useLocation } from 'react-router-dom';

/** Conteúdo das rotas filhas com animação padrão ao trocar de tela. */
export default function PageTransitionOutlet() {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="soaco-page-transition flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <Outlet />
    </div>
  );
}
