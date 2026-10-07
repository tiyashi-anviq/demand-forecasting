import { useApp } from '../state/AppState';
import { ComposedModal, ModalHeader, ModalBody } from '@carbon/react';
import { USE_CASES, useGoUseCase } from '../lib/useCases';

/** Old `openUseCases` "Jump to a use case" list: the 19 use cases, each clickable. */
export function UseCasesModal() {
  const { ucOpen, setUcOpen } = useApp();
  const goUc = useGoUseCase();
  return (
    <ComposedModal open={ucOpen} onClose={() => setUcOpen(false)} size="lg" aria-label="Use cases">
      <ModalHeader title="Use cases" label={`Jump to a use case · ${USE_CASES.length}`} />
      <ModalBody>
        <div className="note" style={{ margin: '0 0 10px' }}>Jump straight to a screen. The charts that respond to levers are in use cases 1 and 2.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,20rem),1fr))', gap: 8 }}>
          {USE_CASES.map((u) => (
            <button key={u.n} type="button" onClick={() => { setUcOpen(false); goUc(u); }}
              style={{ display: 'flex', gap: 10, textAlign: 'left', alignItems: 'flex-start', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 0 }}>
              <b style={{ minWidth: 22, color: 'var(--ink-brand)' }}>{u.n}</b>
              <span><span style={{ display: 'block', fontWeight: 600 }}>{u.title}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-2)' }}>{u.desc}</span></span>
            </button>
          ))}
        </div>
      </ModalBody>
    </ComposedModal>
  );
}
