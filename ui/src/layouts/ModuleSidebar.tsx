import { NavLink, useLocation } from 'react-router-dom';
import { SCREENS } from '../screens/registry';
import './ModuleSidebar.css';

/** Plain anchor list (not Carbon SideNavLink): active = background wash + semibold + tinted icon, no accent bar. */
export function ModuleSidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  useLocation();
  const groups = ['Plan', 'Operate', 'Assist'] as const;
  return (
    <nav className="module-sidebar" aria-label="Screens">
      {groups.map((g) => (
        <div key={g} className="module-sidebar-group">
          {!collapsed && <div className="module-sidebar-label">{g}</div>}
          {SCREENS.filter((s) => s.group === g).map((s) => {
            const Icon = s.icon;
            return (
              <NavLink key={s.id} to={s.path} title={collapsed ? s.title : undefined} onClick={onNavigate}
                className={({ isActive }) => 'module-sidebar-link' + (isActive ? ' module-sidebar-link-active' : '') + (collapsed ? ' module-sidebar-link-collapsed' : '')}>
                <Icon size={16} />
                {!collapsed && <span>{s.title}</span>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
