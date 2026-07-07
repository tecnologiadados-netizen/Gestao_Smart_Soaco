import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PERMISSOES, type CodigoPermissao } from '../../config/permissoes';
import {
  PCP_MENU,
  COMUNICACAO_INTERNA_SUBMENUS,
  COMPRAS_SUBMENUS,
  ENGENHARIA_SUBMENUS,
  GESTAO_USUARIOS_SUBMENUS,
  QUALIDADE_MENU,
  type FinanceiroMenuEntry,
  type NavMenuEntry,
  filterPcpMenuChildren,
  navMenuEntryAtivo,
} from '../../config/navigationMenu';
import { podeAcessarRotaChamadosSuporte, podeConfigurarSuporte } from '../../utils/suportePermissoes';
import { podeVerMenuFinanceiro } from '../../utils/financeiroPermissoes';

const SIDEBAR_LINK =
  'block rounded-md px-3 py-2 text-sm transition min-h-[36px] truncate';
const SIDEBAR_LINK_ACTIVE =
  'bg-accent-500/15 text-accent-400 font-medium';
const SIDEBAR_LINK_IDLE =
  'text-white/75 hover:text-white hover:bg-white/10';

const SIDEBAR_SECTION_BTN =
  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition min-h-[36px]';
const SIDEBAR_SECTION_ACTIVE = 'bg-primary-600 text-white';
const SIDEBAR_SECTION_IDLE = 'text-white/75 hover:text-white hover:bg-white/10';

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function MenuIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>;
}

const ICONS = {
  pcp: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  logistica: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4l4-4V9a1 1 0 00-1-1h-4m-4 0V6a1 1 0 011-1h2a1 1 0 011 1v1m-6 9h6" />
    </svg>
  ),
  comunicacao: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  fluxos: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  compras: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  engenharia: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  qualidade: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  financeiro: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  integracao: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  usuarios: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  suporte: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
};

type HasPermission = (codigo: CodigoPermissao) => boolean;

export interface SidebarProps {
  open: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onNavigate: () => void;
  pathname: string;
  hasPermission: HasPermission;
  isMaster: boolean;
  logisticaMenu: NavMenuEntry[];
  integracaoItems: { to: string; label: string }[];
  financeiroMenu: FinanceiroMenuEntry[];
  supportUnreadCount: number;
}

function SidebarLabel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <span
      className={`min-w-0 truncate transition-opacity duration-200 ${
        open ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'
      }`}
    >
      {children}
    </span>
  );
}

function SidebarNavLink({
  to,
  label,
  sidebarOpen,
  onNavigate,
  className = '',
  title,
  external = false,
}: {
  to: string;
  label: string;
  sidebarOpen: boolean;
  onNavigate: () => void;
  className?: string;
  title?: string;
  external?: boolean;
}) {
  if (external) {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = pathname === to || pathname.startsWith(`${to}/`);
    return (
      <a
        href={to}
        title={title ?? label}
        onClick={onNavigate}
        className={`${SIDEBAR_LINK} ${isActive ? SIDEBAR_LINK_ACTIVE : SIDEBAR_LINK_IDLE} ${className}`}
      >
        <SidebarLabel open={sidebarOpen}>{label}</SidebarLabel>
      </a>
    );
  }

  return (
    <NavLink
      to={to}
      title={title ?? label}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${SIDEBAR_LINK} ${isActive ? SIDEBAR_LINK_ACTIVE : SIDEBAR_LINK_IDLE} ${className}`
      }
    >
      <SidebarLabel open={sidebarOpen}>{label}</SidebarLabel>
    </NavLink>
  );
}

function NavMenuTree({
  entries,
  pathname,
  sidebarOpen,
  accordionOpen,
  toggleAccordion,
  onNavigate,
  hasPermission,
  depth = 0,
  prefix = '',
}: {
  entries: NavMenuEntry[];
  pathname: string;
  sidebarOpen: boolean;
  accordionOpen: Set<string>;
  toggleAccordion: (key: string) => void;
  onNavigate: () => void;
  hasPermission: HasPermission;
  depth?: number;
  prefix?: string;
}) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === 'link') {
          return (
            <SidebarNavLink
              key={entry.to}
              to={entry.to}
              label={entry.label}
              sidebarOpen={sidebarOpen}
              onNavigate={onNavigate}
              className={depth > 0 ? 'pl-3' : ''}
            />
          );
        }

        const children =
          prefix.startsWith('pcp') && (entry.label === 'Estoque' || entry.label === 'Programação')
            ? filterPcpMenuChildren(entry, hasPermission)
            : entry.children;

        const key = prefix ? `${prefix}:${entry.label}` : entry.label;
        const isOpen = accordionOpen.has(key);
        const ativo = children.some((c) => navMenuEntryAtivo(c, pathname));

        return (
          <div key={key} className={depth > 0 ? 'pl-1' : ''}>
            <button
              type="button"
              onClick={() => toggleAccordion(key)}
              className={`${SIDEBAR_SECTION_BTN} w-full text-left text-sm font-normal ${
                ativo ? 'text-accent-400' : SIDEBAR_LINK_IDLE
              }`}
              aria-expanded={isOpen}
            >
              <SidebarLabel open={sidebarOpen}>
                <span className="flex flex-1 items-center justify-between gap-1 min-w-0">
                  <span className="truncate">{entry.label}</span>
                  {sidebarOpen && <ChevronDown open={isOpen} />}
                </span>
              </SidebarLabel>
            </button>
            {sidebarOpen && isOpen && (
              <div className="border-l border-white/10 ml-4 pl-1">
                <NavMenuTree
                  entries={children}
                  pathname={pathname}
                  sidebarOpen={sidebarOpen}
                  accordionOpen={accordionOpen}
                  toggleAccordion={toggleAccordion}
                  onNavigate={onNavigate}
                  hasPermission={hasPermission}
                  depth={depth + 1}
                  prefix={key}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function SidebarSection({
  id,
  label,
  icon,
  active,
  sidebarOpen,
  onExpand,
  accordionOpen,
  toggleAccordion,
  children,
  badge,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  sidebarOpen: boolean;
  onExpand: () => void;
  accordionOpen: Set<string>;
  toggleAccordion: (key: string) => void;
  children: ReactNode;
  badge?: number;
}) {
  const isOpen = accordionOpen.has(id);

  const handleClick = () => {
    if (!sidebarOpen) {
      onExpand();
      toggleAccordion(id);
      return;
    }
    toggleAccordion(id);
  };

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={handleClick}
        title={label}
        className={`${SIDEBAR_SECTION_BTN} relative ${active ? SIDEBAR_SECTION_ACTIVE : SIDEBAR_SECTION_IDLE}`}
        aria-expanded={isOpen}
      >
        <MenuIcon>{icon}</MenuIcon>
        <SidebarLabel open={sidebarOpen}>
          <span className="flex flex-1 items-center justify-between gap-1 min-w-0">
            <span className="truncate">{label}</span>
            {sidebarOpen && <ChevronDown open={isOpen} />}
          </span>
        </SidebarLabel>
        {badge != null && badge > 0 && (
          <span
            className={`absolute top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ${
              sidebarOpen ? 'right-2' : 'right-0.5'
            }`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      {sidebarOpen && isOpen && <div className="mt-0.5 space-y-0.5 pl-1">{children}</div>}
    </div>
  );
}

export default function Sidebar({
  open,
  onExpand,
  onCollapse,
  onNavigate,
  pathname,
  hasPermission,
  isMaster,
  logisticaMenu,
  integracaoItems,
  financeiroMenu,
  supportUnreadCount,
}: SidebarProps) {
  const [accordionOpen, setAccordionOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) setAccordionOpen(new Set());
  }, [open]);

  const toggleAccordion = useCallback((key: string) => {
    setAccordionOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isPcpActive = pathname.startsWith('/pedidos');
  const isLogisticaActive =
    pathname.startsWith('/logistica') || pathname === '/heatmap';
  const isComunicacaoActive = pathname === '/pedidos/sycroorder';
  const isComprasActive = pathname.startsWith('/compras');
  const isIntegracaoActive =
    pathname.startsWith('/integracao') ||
    pathname.startsWith('/whatsapp') ||
    pathname.startsWith('/situacao-api');
  const isEngenhariaActive = pathname.startsWith('/engenharia');
  const isQualidadeActive = pathname.startsWith('/qualidade');
  const isFinanceiroActive = pathname.startsWith('/financeiro');
  const isGestaoUsuariosActive = pathname.startsWith('/usuarios');
  const isSuporteActive = pathname.startsWith('/suporte');

  const showLogistica =
    (hasPermission(PERMISSOES.LOGISTICA_VER) ||
      hasPermission(PERMISSOES.LOGISTICA_TOTAL) ||
      hasPermission(PERMISSOES.LOGISTICA_CUBAGEM_VER) ||
      hasPermission(PERMISSOES.HEATMAP_VER)) &&
    logisticaMenu.length > 0;

  const suporteItems: { to: string; label: string }[] = [];
  if (podeAcessarRotaChamadosSuporte(hasPermission)) {
    suporteItems.push({ to: '/suporte', label: 'Chamados' });
  }
  if (podeConfigurarSuporte(isMaster, hasPermission)) {
    suporteItems.push({ to: '/suporte/configuracao', label: 'Configurações de suporte' });
  }

  return (
    <aside
      className={`relative z-40 flex shrink-0 flex-col border-r border-soaco-gray/30 bg-black transition-[width] duration-200 ease-in-out ${
        open ? 'w-[240px]' : 'w-16'
      }`}
      aria-label="Menu principal"
      onMouseEnter={onExpand}
      onMouseLeave={onCollapse}
    >
      <nav className="scrollbar-app flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-2 py-3">
        {hasPermission(PERMISSOES.PCP_VER_TELA) && (
          <SidebarSection
            id="pcp"
            label="PCP"
            icon={ICONS.pcp}
            active={isPcpActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            <NavMenuTree
              entries={PCP_MENU}
              pathname={pathname}
              sidebarOpen={open}
              accordionOpen={accordionOpen}
              toggleAccordion={toggleAccordion}
              onNavigate={onNavigate}
              hasPermission={hasPermission}
              prefix="pcp"
            />
          </SidebarSection>
        )}

        {showLogistica && (
          <SidebarSection
            id="logistica"
            label="Logística"
            icon={ICONS.logistica}
            active={isLogisticaActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            <NavMenuTree
              entries={logisticaMenu}
              pathname={pathname}
              sidebarOpen={open}
              accordionOpen={accordionOpen}
              toggleAccordion={toggleAccordion}
              onNavigate={onNavigate}
              hasPermission={hasPermission}
              prefix="logistica"
            />
          </SidebarSection>
        )}

        {hasPermission(PERMISSOES.COMUNICACAO_TELA_VER) && (
          <SidebarSection
            id="comunicacao"
            label="Comunicação interna"
            icon={ICONS.comunicacao}
            active={isComunicacaoActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {COMUNICACAO_INTERNA_SUBMENUS.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {(hasPermission(PERMISSOES.FLUXOS_VER) || hasPermission(PERMISSOES.FLUXOS_EDITAR)) && (
          <NavLink
            to="/mind-maps"
            title="Fluxos Decisórios"
            onClick={onNavigate}
            className={({ isActive }) =>
              `${SIDEBAR_SECTION_BTN} mb-0.5 ${
                isActive || pathname.startsWith('/mind-maps')
                  ? SIDEBAR_SECTION_ACTIVE
                  : SIDEBAR_SECTION_IDLE
              }`
            }
          >
            <MenuIcon>{ICONS.fluxos}</MenuIcon>
            <SidebarLabel open={open}>Fluxos Decisórios</SidebarLabel>
          </NavLink>
        )}

        {hasPermission(PERMISSOES.COMPRAS_VER) && (
          <SidebarSection
            id="compras"
            label="Compras"
            icon={ICONS.compras}
            active={isComprasActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {COMPRAS_SUBMENUS.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {hasPermission(PERMISSOES.PRECIFICACAO_VER) && (
          <SidebarSection
            id="engenharia"
            label="Engenharia"
            icon={ICONS.engenharia}
            active={isEngenhariaActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {ENGENHARIA_SUBMENUS.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {hasPermission(PERMISSOES.QUALIDADE_VER) && (
          <SidebarSection
            id="qualidade"
            label="Qualidade"
            icon={ICONS.qualidade}
            active={isQualidadeActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            <NavMenuTree
              entries={QUALIDADE_MENU}
              pathname={pathname}
              sidebarOpen={open}
              accordionOpen={accordionOpen}
              toggleAccordion={toggleAccordion}
              onNavigate={onNavigate}
              hasPermission={hasPermission}
              prefix="qualidade"
            />
          </SidebarSection>
        )}

        {podeVerMenuFinanceiro(hasPermission) && (
          <SidebarSection
            id="financeiro"
            label="Financeiro"
            icon={ICONS.financeiro}
            active={isFinanceiroActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {financeiroMenu.map((entry) =>
              entry.kind === 'link' ? (
                <SidebarNavLink
                  key={entry.to}
                  to={entry.to}
                  label={entry.label}
                  sidebarOpen={open}
                  onNavigate={onNavigate}
                />
              ) : (
                <div key={entry.label}>
                  <button
                    type="button"
                    onClick={() => toggleAccordion(`financeiro:${entry.label}`)}
                    className={`${SIDEBAR_SECTION_BTN} w-full text-left text-sm font-normal pl-3 ${SIDEBAR_LINK_IDLE}`}
                    aria-expanded={accordionOpen.has(`financeiro:${entry.label}`)}
                  >
                    <SidebarLabel open={open}>
                      <span className="flex flex-1 items-center justify-between gap-1 min-w-0">
                        <span className="truncate">{entry.label}</span>
                        <ChevronDown open={accordionOpen.has(`financeiro:${entry.label}`)} />
                      </span>
                    </SidebarLabel>
                  </button>
                  {accordionOpen.has(`financeiro:${entry.label}`) && (
                    <div className="border-l border-white/10 ml-4 pl-1">
                      {entry.children.map((item) => (
                        <SidebarNavLink
                          key={item.to}
                          to={item.to}
                          label={item.label}
                          sidebarOpen={open}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </SidebarSection>
        )}

        {integracaoItems.length > 0 && (
          <SidebarSection
            id="integracao"
            label="Integração"
            icon={ICONS.integracao}
            active={isIntegracaoActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {integracaoItems.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
                title={item.label}
              />
            ))}
          </SidebarSection>
        )}

        {hasPermission(PERMISSOES.USUARIOS_GERENCIAR) && (
          <SidebarSection
            id="gestao-usuarios"
            label="Gestão de usuários"
            icon={ICONS.usuarios}
            active={isGestaoUsuariosActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
          >
            {GESTAO_USUARIOS_SUBMENUS.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {suporteItems.length > 0 && (
          <SidebarSection
            id="suporte"
            label="Suporte"
            icon={ICONS.suporte}
            active={isSuporteActive}
            sidebarOpen={open}
            onExpand={onExpand}
            accordionOpen={accordionOpen}
            toggleAccordion={toggleAccordion}
            badge={supportUnreadCount}
          >
            {suporteItems.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                sidebarOpen={open}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        )}
      </nav>
    </aside>
  );
}
