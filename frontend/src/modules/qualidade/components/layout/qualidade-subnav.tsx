import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  BarChart3,
  ClipboardList,
  FileText,
  Home,
  MapPin,
  Search,
  Wrench,
} from 'lucide-react';
import { cn } from '@qualidade/lib/utils';
import { useConfigStore } from '@qualidade/lib/store/config-store';
import { useDocumentsStore } from '@qualidade/lib/store/documents-store';
import { useCalibrationsStore } from '@qualidade/lib/store/calibrations-store';
import { NovoDocumentoNav } from '@qualidade/components/documentos/novo-documento-nav';
import { ValidadeNotificacoesBell } from '@qualidade/components/documentos/validade-notificacoes-bell';

type Module = 'documentos' | 'calibracoes' | 'registros' | 'configuracoes';

function getActiveModule(pathname: string): Module {
  if (pathname.startsWith('/qualidade/registros') || pathname.startsWith('/qualidade/avaliacao-fornecedor')) {
    return 'registros';
  }
  if (pathname.startsWith('/qualidade/calibracoes')) return 'calibracoes';
  if (pathname.startsWith('/qualidade/configuracoes')) return 'configuracoes';
  return 'documentos';
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

function getNavItems(module: Module): NavItem[] {
  switch (module) {
    case 'documentos':
      return [
        { label: 'Início', href: '/qualidade/documentos', icon: Home },
        { label: 'Consulta', href: '/qualidade/documentos/consulta', icon: Search },
      ];
    case 'calibracoes':
      return [
        { label: 'Início', href: '/qualidade/calibracoes', icon: Home },
        { label: 'Cadastros', href: '/qualidade/calibracoes/cadastros/equipamentos', icon: ClipboardList },
        { label: 'Consulta', href: '/qualidade/calibracoes/consulta', icon: Search },
        { label: 'Visão geral', href: '/qualidade/calibracoes/visao-geral', icon: BarChart3 },
      ];
    case 'registros':
      return [
        { label: 'Início', href: '/qualidade/registros', icon: Home },
        { label: 'Consulta', href: '/qualidade/registros/consulta', icon: Search },
      ];
    case 'configuracoes':
      return [
        { label: 'Início', href: '/qualidade/configuracoes', icon: Home },
        { label: 'Setores', href: '/qualidade/configuracoes/setores', icon: Wrench },
        { label: 'Categorias', href: '/qualidade/configuracoes/tipos-documento', icon: FileText },
        { label: 'Endereçamento', href: '/qualidade/configuracoes/enderecamento', icon: MapPin },
      ];
  }
}

export function QualidadeSubnav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeModule = getActiveModule(pathname);
  const navItems = getNavItems(activeModule);

  const currentUserId = useConfigStore((s) => s.currentUserId);
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);
  const calibrationEquipment = useCalibrationsStore((s) => s.equipment);
  const getPendingCalibrations = useCalibrationsStore((s) => s.getPendingCalibrations);

  const calPending = useMemo(
    () =>
      getPendingCalibrations('interna').length + getPendingCalibrations('externa').length,
    [calibrationEquipment, getPendingCalibrations],
  );

  const pendingCount =
    activeModule === 'documentos'
      ? getPendingTasks(currentUserId).length
      : activeModule === 'calibracoes'
        ? calPending
        : 0;

  return (
    <div className="sgq-subnav mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/qualidade/${activeModule}` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {item.label === 'Início' && pendingCount > 0 && (
                <span className="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning text-[11px] font-bold leading-none text-warning-foreground">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
        {activeModule === 'documentos' ? <NovoDocumentoNav /> : null}
      </nav>

      {activeModule === 'documentos' ? (
        <div className="ml-auto shrink-0 pl-1">
          <ValidadeNotificacoesBell
            variant="default"
            onVerDocumento={(id) => navigate(`/qualidade/documentos/${id}`)}
          />
        </div>
      ) : null}
    </div>
  );
}
