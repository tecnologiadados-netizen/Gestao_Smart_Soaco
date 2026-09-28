import { Outlet, useLocation } from 'react-router-dom';
import { QualidadeSubnav } from '@qualidade/components/layout/qualidade-subnav';
import { StoreHydration } from '@qualidade/components/providers/store-hydration';
import { LoadingProvider } from '@qualidade/components/providers/loading-provider';
import '@qualidade/qualidade-module.css';

export default function QualidadeModuleLayout() {
  const location = useLocation();
  const viewer = location.pathname.includes('/documentos/visualizar');

  return (
    <LoadingProvider>
      <StoreHydration>
        {viewer ? (
          <div className="qualidade-module flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        ) : (
          <div className="qualidade-module flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="sgq-shell flex min-h-0 w-full flex-1 flex-col">
              <QualidadeSubnav />
              <div className="sgq-page flex min-h-0 w-full min-w-0 flex-1 flex-col">
                <Outlet />
              </div>
            </div>
          </div>
        )}
      </StoreHydration>
    </LoadingProvider>
  );
}
