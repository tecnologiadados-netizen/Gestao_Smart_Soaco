import { Navigate } from 'react-router-dom';

/** Redireciona para o hub de credenciais (e-mail + WhatsApp). */
export default function IntegracaoPage() {
  return <Navigate to="/integracao/credenciais" replace />;
}
