import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';
import { ROTA_PERMISSAO, primeiraRotaPermitida } from '../utils/routePermission';

export default function PermissionGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { hasPermission, isMaster, profileLoaded } = useAuth();
  const pathname = location.pathname.replace(/\/$/, '') || '/';

  // Aguarda /api/me antes de negar acesso (cookie ou sessionStorage; evita falso "Sem acesso"
  // ao abrir abas novas sem token no sessionStorage, ex.: visualização de documentos).
  if (!profileLoaded) return <>{children}</>;

  const permsNecessarias =
    ROTA_PERMISSAO[pathname] ??
    (pathname.startsWith('/kpis/') ? ROTA_PERMISSAO['/kpis'] : undefined) ??
    (pathname.startsWith('/qualidade/') ? ROTA_PERMISSAO['/qualidade'] : undefined);
  if (permsNecessarias && !permsNecessarias.some((p) => hasPermission(p))) {
    const redirect = primeiraRotaPermitida(hasPermission, isMaster);
    if (redirect != null && redirect !== pathname) return <Navigate to={redirect} replace />;
    if (pathname !== '/sem-acesso') return <Navigate to="/sem-acesso" replace />;
  }
  return <>{children}</>;
}
