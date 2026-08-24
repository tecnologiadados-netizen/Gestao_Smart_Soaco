import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  podeAcessarDigitacaoConferencia,
  podeAcessarGestaoMesa,
} from '../../utils/recebimentoPermissoes';

/** Abre a primeira tela de Recebimento permitida ao usuário. */
export default function RecebimentoRedirectPage() {
  const { hasPermission } = useAuth();
  if (podeAcessarGestaoMesa(hasPermission)) return <Navigate to="/recebimento/mesa" replace />;
  if (podeAcessarDigitacaoConferencia(hasPermission)) {
    return <Navigate to="/recebimento/digitacao" replace />;
  }
  return <Navigate to="/sem-acesso" replace />;
}
