import type { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Tag } from '@carbon/react';
import { Apps, SettingsAdjust, Information } from '@carbon/icons-react';
import { useApp, useLevers } from '../state/AppState';
import { useIsMobile } from '../lib/useIsMobile';
import './ModulePageHeader.css';

export function ModulePageHeader({ group, title, subtitle, toolbar }: { group: string; title: string; subtitle?: string; toolbar?: ReactNode }) {
  const mobile = useIsMobile();
  const { setDrawerOpen, setUcOpen } = useApp();
  const L = useLevers();
  return (
    <div className="module-page-header module-page-header-sticky">
      <div className="module-page-breadcrumb-row">
        <Breadcrumb noTrailingSlash size={mobile ? 'sm' : 'md'}>
          <BreadcrumbItem href="#/overview"><Apps size={16} aria-label="Eveready Planner" /></BreadcrumbItem>
          <BreadcrumbItem href="#/overview">Planner</BreadcrumbItem>
          <BreadcrumbItem>{group}</BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>{title}</BreadcrumbItem>
        </Breadcrumb>
      </div>
      <div className="app-title-row">
        <h1 className="module-page-title">{title}</h1>
        <div className="module-page-header-actions">
          <Tag size="sm" type={L.active ? 'warm-gray' : 'cool-gray'} className="lv-chip">{L.active ? 'What-if active' : 'Base case'}</Tag>
          <Button kind="tertiary" size="sm" renderIcon={Information} onClick={() => setUcOpen(true)}>Use cases</Button>
          <Button kind="primary" size="sm" renderIcon={SettingsAdjust} onClick={() => setDrawerOpen(true)}>Scenario levers</Button>
        </div>
      </div>
      {subtitle && <p className="module-page-subtitle">{subtitle}</p>}
      {toolbar}
    </div>
  );
}
