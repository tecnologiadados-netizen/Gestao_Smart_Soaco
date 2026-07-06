import { StoreHydration } from '@qualidade/components/providers/store-hydration';
import { QualidadeSubnav } from '@qualidade/components/layout/qualidade-subnav';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreHydration>
      <QualidadeSubnav />
      <div className="w-full">{children}</div>
    </StoreHydration>
  );
}
