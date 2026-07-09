import { Navigate } from 'react-router-dom';

export function AvaliacaoFornecedorRedirectPage() {
  return <Navigate to="/qualidade/registros?tipo=avaliacao-fornecedor" replace />;
}
