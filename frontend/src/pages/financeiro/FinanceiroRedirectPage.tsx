import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { rotaInicialFinanceiro } from '../../utils/financeiroPermissoes';

/** Abre a primeira tela de Financeiro que o usuário pode acessar. */
export default function FinanceiroRedirectPage() {
  const { hasPermission, profileLoaded } = useAuth();
  if (!profileLoaded) return null;
  const destino = rotaInicialFinanceiro(hasPermission);
  return <Navigate to={destino ?? '/sem-acesso'} replace />;
}
