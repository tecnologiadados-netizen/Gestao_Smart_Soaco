import { Outlet } from 'react-router-dom';
import { DashboardShell } from '@qualidade/components/layout/dashboard-shell';
import { LoadingProvider } from '@qualidade/components/providers/loading-provider';
import '@qualidade/qualidade-module.css';

export default function QualidadeModuleLayout() {
  return (
    <LoadingProvider>
      <div className="qualidade-module min-h-0 flex-1">
        <DashboardShell>
          <Outlet />
        </DashboardShell>
      </div>
    </LoadingProvider>
  );
}
