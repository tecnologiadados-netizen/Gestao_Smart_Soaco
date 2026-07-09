import { Navigate } from 'react-router-dom';

export function AvaliacaoFornecedorHistoricoRedirectPage() {
  return <Navigate to="/qualidade/registros/consulta?tipo=avaliacao-fornecedor" replace />;
}
