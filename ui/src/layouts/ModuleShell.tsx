import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppTopBar } from './AppTopBar';
import { ModuleSidebar } from './ModuleSidebar';
import { useApp } from '../state/AppState';
import { useIsMobile } from '../lib/useIsMobile';
import './ModuleShell.css';

/** Fixed topbar + (rail | mobile drawer) + exactly one scrolling content pane (reference §3, split view). */
export function ModuleShell({ children }: { children: ReactNode }) {
  const { railCollapsed, setRailCollapsed } = useApp();
  const mobile = useIsMobile();
  const loc = useLocation();
  useEffect(() => { if (mobile) setRailCollapsed(true); }, [loc.pathname, mobile, setRailCollapsed]);   // route change closes the mobile drawer
  const drawerOpen = mobile && !railCollapsed;
  return (
    <>
      <AppTopBar onMenu={() => setRailCollapsed((c) => !c)} menuActive={!railCollapsed} />
      <div className="module-shell" style={{ paddingTop: 'var(--reiq-size-topbar)' }}>
        {!mobile && (
          <aside className={'module-shell-rail' + (railCollapsed ? ' module-shell-rail-collapsed' : '')}>
            <ModuleSidebar collapsed={railCollapsed} />
          </aside>
        )}
        <main className="module-shell-content thin-scroll thin-scroll-strong">{children}</main>
      </div>
      {drawerOpen && (
        <div className="nav-drawer-overlay" role="presentation" onClick={() => setRailCollapsed(true)}>
          <aside className="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation" onClick={(e) => e.stopPropagation()}>
            <ModuleSidebar collapsed={false} onNavigate={() => setRailCollapsed(true)} />
          </aside>
        </div>
      )}
    </>
  );
}
