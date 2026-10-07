import type { ReactNode } from 'react';
import type { CarbonIconType } from '@carbon/icons-react';
export function EmptyState({ icon: Icon, title, message, action, tone = 'brand', children }: { icon: CarbonIconType; title: string; message?: string; action?: ReactNode; tone?: 'brand' | 'danger'; children?: ReactNode }) {
  return (
    <div style={{ minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--cds-spacing-04)', textAlign: 'center', border: '1px solid var(--reiq-border-subtle)', background: 'var(--reiq-layer-01)', padding: 'var(--cds-spacing-06)', borderRadius: 0 }}>
      <Icon size={32} style={{ color: tone === 'danger' ? 'var(--crit)' : 'var(--reiq-interactive-01)' }} />
      <h3 style={{ margin: 0, fontSize: 'var(--cds-heading-03-font-size)', fontWeight: 600 }}>{title}</h3>
      {message && <p className="muted" style={{ margin: 0, maxWidth: '32rem' }}>{message}</p>}
      {action}{children}
    </div>
  );
}
