import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
/** Small "i" button that opens a short explanation under it. Click or Enter to open; Esc or a click elsewhere closes it. */
export function InfoBtn({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {                                   // keep the popover on screen: flip it to the left when it would run off the right edge
    const el = pop.current; if (!open || !el) return;
    el.style.left = ''; el.style.right = '';
    if (el.getBoundingClientRect().right > window.innerWidth - 8) { el.style.left = 'auto'; el.style.right = '-8px'; }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="infob" ref={ref}>
      <button type="button" className="infob-b" aria-label={'How this is worked out: ' + title} aria-expanded={open} onClick={() => setOpen((o) => !o)}>i</button>
      {open && <span className="infob-p" ref={pop} role="dialog" aria-label={title}><b>{title}</b>{children}</span>}
    </span>
  );
}
