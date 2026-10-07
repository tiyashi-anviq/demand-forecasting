import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
interface TipApi { show: (html: ReactNode, ev: { clientX: number; clientY: number }) => void; hide: () => void }
const Ctx = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTip = () => useContext(Ctx);
export function TipProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = useCallback((body: ReactNode, ev: { clientX: number; clientY: number }) => {
    const w = ref.current?.offsetWidth ?? 220, h = ref.current?.offsetHeight ?? 80;
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
    setSt({ x: Math.max(4, x), y: Math.max(4, y), body });
  }, []);
  const hide = useCallback(() => setSt(null), []);
  return <Ctx.Provider value={{ show, hide }}>{children}{st && <div ref={ref} className="tip" style={{ left: st.x, top: st.y }} role="tooltip">{st.body}</div>}</Ctx.Provider>;
}
